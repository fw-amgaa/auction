import { and, desc, eq } from "drizzle-orm";

import { db, schema } from "@auction/db";
import type { FeedItem } from "@auction/shared";

import { BID_LUA } from "./lua";
import { log } from "./logger";
import { redis } from "./redis";

const lotKey = (id: string) => `lot:${id}`;
const committedKey = (uid: string) => `u:${uid}:committed`;
const pseudoKey = (id: string) => `lot:${id}:pseudo`;
const LIVE_SET = "live:lots";

export type LiveStatus = "scheduled" | "live" | "ended";

export interface LotMeta {
  reserve: number;
  step: number;
  status: LiveStatus;
  exists: boolean;
}

/** Auction phase from the clock — the lifecycle status is only a publish gate. */
function computeLive(dbStatus: string, startsAt: number, endsAt: number): LiveStatus {
  if (dbStatus !== "scheduled" && dbStatus !== "live") return "ended"; // draft/cancelled/ended/settled
  const now = Date.now();
  if (now < startsAt) return "scheduled";
  if (now >= endsAt) return "ended";
  return "live";
}

/** Load a lot's auction state into Redis from Postgres if not already present. */
export async function ensureLot(lotId: string): Promise<LotMeta> {
  const key = lotKey(lotId);
  const existing = await redis.hgetall(key);
  if (existing && existing.status) {
    // re-derive scheduled -> live as the clock advances, even from cache
    if (existing.status === "scheduled") {
      const live = computeLive("scheduled", Number(existing.startsAt || 0), Number(existing.endsAt || 0));
      if (live !== "scheduled") {
        await redis.hset(key, "status", live);
        if (live === "live") await redis.sadd(LIVE_SET, lotId);
        existing.status = live;
      }
    }
    return {
      reserve: Number(existing.reserve),
      step: Number(existing.step),
      status: existing.status as LiveStatus,
      exists: true,
    };
  }
  const [row] = await db
    .select({ lot: schema.lots, cat: schema.categories })
    .from(schema.lots)
    .innerJoin(schema.categories, eq(schema.lots.categoryId, schema.categories.id))
    .where(eq(schema.lots.id, lotId))
    .limit(1);
  if (!row) return { reserve: 0, step: 0, status: "ended", exists: false };
  const lot = row.lot;

  const startsAt = lot.startsAt?.getTime() ?? 0;
  const endsAt = lot.endsAt?.getTime() ?? Date.now() + 60_000;
  const status = computeLive(lot.status, startsAt, endsAt);
  const price = lot.currentPrice ?? lot.reserve;
  const hasBids = lot.currentPrice != null ? "1" : "0";
  // max seq from durable bids (crash-recovery rehydrate)
  const [top] = await db
    .select({ seq: schema.bids.seq })
    .from(schema.bids)
    .where(eq(schema.bids.lotId, lotId))
    .orderBy(desc(schema.bids.seq))
    .limit(1);

  await redis.hset(key, {
    price: String(price),
    leader: lot.leaderUserId ?? "",
    step: String(lot.step),
    reserve: String(lot.reserve),
    startsAt: String(startsAt),
    endsAt: String(endsAt),
    status,
    hasBids,
    seq: String(top?.seq ?? 0),
    code: lot.code,
    species: row.cat.name,
  });
  if (status === "live") await redis.sadd(LIVE_SET, lotId);
  return { reserve: lot.reserve, step: lot.step, status, exists: true };
}

/** Initialise a user's committed total in Redis from durable winning bids (once). */
export async function ensureUserCommitted(userId: string): Promise<void> {
  if (await redis.exists(committedKey(userId))) return;
  const winning = await db
    .select({ amount: schema.bids.amount })
    .from(schema.bids)
    .innerJoin(schema.lots, eq(schema.bids.lotId, schema.lots.id))
    .where(
      and(
        eq(schema.bids.userId, userId),
        eq(schema.bids.status, "winning"),
        eq(schema.lots.status, "live"),
      ),
    );
  const sum = winning.reduce((a, b) => a + b.amount, 0);
  await redis.set(committedKey(userId), String(sum));
}

export async function getCommitted(userId: string): Promise<number> {
  return Number((await redis.get(committedKey(userId))) ?? "0");
}

export async function pseudonym(lotId: string, userId: string): Promise<string> {
  const key = pseudoKey(lotId);
  let idx = await redis.hget(key, userId);
  if (!idx) {
    idx = String(await redis.incr(`${key}:count`));
    await redis.hset(key, userId, idx);
  }
  return `Оролцогч #${idx}`;
}

export async function recentFeed(lotId: string, viewerId: string): Promise<FeedItem[]> {
  const rows = await db
    .select()
    .from(schema.bids)
    .where(eq(schema.bids.lotId, lotId))
    .orderBy(desc(schema.bids.seq))
    .limit(14);
  const out: FeedItem[] = [];
  for (const b of rows) {
    const mine = b.userId === viewerId;
    out.push({
      seq: b.seq,
      label: mine ? "Та" : await pseudonym(lotId, b.userId),
      amount: b.amount,
      ts: b.createdAt.getTime(),
      mine,
    });
  }
  return out;
}

export interface BidResult {
  ok: boolean;
  reason?: string;
  amount?: number;
  seq?: number;
  endsAt?: number;
  extended?: boolean;
  releasedUser?: string | null;
  releasedAmount?: number;
  leaderUserId?: string;
  ts?: number;
}

export async function placeBid(
  lotId: string,
  userId: string,
  nSteps: number,
  limit: number,
): Promise<BidResult> {
  const now = Date.now();
  const res = (await redis.eval(BID_LUA, 1, lotKey(lotId), userId, String(nSteps), String(now), String(limit))) as [
    number,
    ...unknown[],
  ];
  if (Number(res[0]) === 0) return { ok: false, reason: String(res[1]) };

  const amount = Number(res[1]);
  const seq = Number(res[2]);
  const endsAt = Number(res[3]);
  const extended = Number(res[4]) === 1;
  const releasedUser = String(res[5]) || null;
  const releasedAmount = Number(res[6]);

  await persistAccept({ lotId, userId, amount, seq, endsAt, releasedUser, releasedAmount });

  return { ok: true, amount, seq, endsAt, extended, releasedUser, releasedAmount, leaderUserId: userId, ts: now };
}

async function persistAccept(p: {
  lotId: string;
  userId: string;
  amount: number;
  seq: number;
  endsAt: number;
  releasedUser: string | null;
  releasedAmount: number;
}): Promise<void> {
  const newCommitted = await getCommitted(p.userId);
  const relCommitted = p.releasedUser ? await getCommitted(p.releasedUser) : 0;
  const meta = await redis.hmget(lotKey(p.lotId), "code", "species");
  const lotCtx = { lotId: p.lotId, code: meta[0] ?? "", species: meta[1] ?? "" };
  try {
    await db.transaction(async (tx) => {
      // Serialize persistence per lot: Redis already ordered the arbitration,
      // but concurrent persists could otherwise interleave the supersede+insert
      // and leave multiple "winning" rows. A row lock on the lot makes the
      // durable bookkeeping atomic per lot.
      await tx.select({ id: schema.lots.id }).from(schema.lots).where(eq(schema.lots.id, p.lotId)).for("update");

      await tx
        .update(schema.bids)
        .set({ status: "superseded" })
        .where(and(eq(schema.bids.lotId, p.lotId), eq(schema.bids.status, "winning")));

      const [bid] = await tx
        .insert(schema.bids)
        .values({ lotId: p.lotId, userId: p.userId, amount: p.amount, seq: p.seq, status: "winning" })
        .returning({ id: schema.bids.id });

      await tx.insert(schema.limitLedger).values({
        userId: p.userId,
        type: "hold",
        delta: -p.amount,
        committedAfter: newCommitted,
        lotId: p.lotId,
        bidId: bid!.id,
      });
      await tx.update(schema.users).set({ committedCache: newCommitted }).where(eq(schema.users.id, p.userId));

      if (p.releasedUser) {
        await tx.insert(schema.limitLedger).values({
          userId: p.releasedUser,
          type: "release",
          delta: p.releasedAmount,
          committedAfter: relCommitted,
          lotId: p.lotId,
        });
        await tx
          .update(schema.users)
          .set({ committedCache: relCommitted })
          .where(eq(schema.users.id, p.releasedUser));
        await tx.insert(schema.notifications).values({
          userId: p.releasedUser,
          type: "outbid",
          payload: { ...lotCtx, returned: p.releasedAmount },
        });
      }

      await tx
        .update(schema.lots)
        .set({ currentPrice: p.amount, leaderUserId: p.userId, endsAt: new Date(p.endsAt) })
        .where(eq(schema.lots.id, p.lotId));
    });
  } catch (e) {
    // Redis already accepted (user genuinely leads); log for retry/reconciliation.
    log.error({ err: e, lotId: p.lotId, seq: p.seq }, "persist failed (Redis authoritative)");
  }
}

export async function getLiveLots(): Promise<string[]> {
  return redis.smembers(LIVE_SET);
}

export interface FinalizeResult {
  finalized: boolean;
  leaderUserId: string | null;
  price: number;
}

/**
 * Close a lot whose time is up. DB-driven so it works even with no live viewers
 * (and so a scheduled lot whose window fully elapsed while the service was down
 * still gets ended). Winner/price come from Redis if live, else from Postgres.
 */
export async function finalize(lotId: string): Promise<FinalizeResult> {
  const key = lotKey(lotId);
  const [lot] = await db.select().from(schema.lots).where(eq(schema.lots.id, lotId)).limit(1);
  if (!lot || (lot.status !== "live" && lot.status !== "scheduled")) {
    await redis.srem(LIVE_SET, lotId);
    return { finalized: false, leaderUserId: null, price: 0 };
  }
  if (!lot.endsAt || lot.endsAt.getTime() > Date.now()) {
    return { finalized: false, leaderUserId: null, price: 0 };
  }

  const h = await redis.hmget(key, "leader", "price", "code", "species");
  const leader = h[0] && h[0] !== "" ? h[0] : (lot.leaderUserId ?? null);
  const price = Number(h[1] ?? lot.currentPrice ?? lot.reserve);
  const lotCtx = { lotId, code: h[2] ?? lot.code, species: h[3] ?? "" };
  await redis.hset(key, "status", "ended");
  await redis.srem(LIVE_SET, lotId);

  // distinct bidders (to notify losers)
  const bidders = await db
    .selectDistinct({ userId: schema.bids.userId })
    .from(schema.bids)
    .where(eq(schema.bids.lotId, lotId));

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(schema.lots)
        .set({ status: "ended", winnerUserId: leader })
        .where(eq(schema.lots.id, lotId));

      if (leader) {
        const committed = Math.max(0, (await getCommitted(leader)) - price);
        await redis.set(committedKey(leader), String(committed));
        const [u] = await tx.select().from(schema.users).where(eq(schema.users.id, leader)).limit(1);
        const newLimit = Math.max(0, (u?.limit ?? price) - price);
        await tx
          .update(schema.users)
          .set({ committedCache: committed, limit: newLimit })
          .where(eq(schema.users.id, leader));
        await tx.insert(schema.limitLedger).values({
          userId: leader,
          type: "consume",
          delta: -price,
          balanceAfter: newLimit,
          committedAfter: committed,
          lotId,
        });
        await tx.insert(schema.notifications).values({ userId: leader, type: "won", payload: { ...lotCtx, price } });
      }
      const losers = bidders.map((b) => b.userId).filter((id) => id !== leader);
      if (losers.length > 0) {
        await tx.insert(schema.notifications).values(
          losers.map((userId) => ({ userId, type: "lost" as const, payload: lotCtx })),
        );
      }
    });
  } catch (e) {
    log.error({ err: e, lotId }, "finalize persist failed");
  }
  return { finalized: true, leaderUserId: leader, price };
}
