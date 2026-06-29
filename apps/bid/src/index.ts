/**
 * Bid service (Phase 5). WebSocket arena server:
 *  - ticket auth on connect (HMAC from apps/web)
 *  - Redis Lua bid arbitration + Postgres persistence (engine.ts)
 *  - Redis pub/sub fan-out, tailored per connection (privacy-preserving labels)
 *  - spectator counts, rate limiting, anti-snipe, close sweep
 */
import { createServer } from "node:http";

import { and, eq, gt, inArray, lte } from "drizzle-orm";

import { db, schema } from "@auction/db";
import { BID_RATE_PER_SEC, ClientMessage, type ServerMessage } from "@auction/shared";
import { WebSocketServer, type WebSocket } from "ws";

import {
  ensureLot,
  ensureUserCommitted,
  finalize,
  getCommitted,
  isEligible,
  placeBid,
  pseudonym,
  recentFeed,
} from "./engine";
import { log } from "./logger";
import { redis, sub } from "./redis";
import { verifyTicket } from "./ticket";

const PORT = Number(process.env.BID_WS_PORT ?? 8080);
const EVENTS = "auction:events";

interface Conn {
  ws: WebSocket;
  userId: string;
  role: "bidder" | "admin";
  limit: number;
  lots: Set<string>;
  /** per-lot eligibility cache (admins are always eligible) */
  eligible: Map<string, boolean>;
  alive: boolean;
}

/** Resolve (and cache) whether this connection may see/bid the given lot. */
async function checkEligible(conn: Conn, lotId: string): Promise<boolean> {
  if (conn.role === "admin") return true;
  const cached = conn.eligible.get(lotId);
  if (cached !== undefined) return cached;
  const ok = await isEligible(conn.userId, lotId);
  conn.eligible.set(lotId, ok);
  return ok;
}

const conns = new Map<WebSocket, Conn>();
const lotSubs = new Map<string, Set<WebSocket>>();

function send(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

async function balanceMsg(conn: Conn): Promise<ServerMessage> {
  const committed = await getCommitted(conn.userId);
  return { t: "balance", available: conn.limit - committed, committed, limit: conn.limit };
}

async function sendSnapshot(conn: Conn, lotId: string) {
  const h = await redis.hgetall(`lot:${lotId}`);
  if (!h.status) return;
  const leader = h.leader || "";
  const committed = await getCommitted(conn.userId);
  const youLead = leader !== "" && leader === conn.userId;
  send(conn.ws, {
    t: "snapshot",
    lotId,
    price: Number(h.price),
    reserve: Number(h.reserve),
    inc1: Number(h.inc1),
    inc2: Number(h.inc2),
    leaderLabel: leader === "" ? null : youLead ? "Та" : await pseudonym(lotId, leader),
    youLead,
    hasBids: h.hasBids === "1",
    endsAt: Number(h.endsAt),
    seq: Number(h.seq),
    spectators: Number((await redis.get(`lot:${lotId}:spec`)) ?? "0"),
    status: h.status === "live" ? "live" : "ended",
    feed: await recentFeed(lotId, conn.userId),
    available: conn.limit - committed,
    committed,
    limit: conn.limit,
  });
}

async function rateLimited(userId: string): Promise<boolean> {
  const key = `rl:${userId}`;
  const n = await redis.incr(key);
  if (n === 1) await redis.expire(key, 1);
  return n > BID_RATE_PER_SEC;
}

/* --------------------------- pub/sub fan-out ------------------------------ */

interface BidEvent {
  type: "bid";
  lotId: string;
  price: number;
  seq: number;
  endsAt: number;
  extended: boolean;
  leaderUserId: string;
  releasedUser: string | null;
  releasedAmount: number;
  ts: number;
}
interface ClosedEvent {
  type: "closed";
  lotId: string;
  leaderUserId: string | null;
  price: number;
}
interface SpecEvent {
  type: "spectators";
  lotId: string;
  count: number;
}
type Event = BidEvent | ClosedEvent | SpecEvent;

sub.subscribe(EVENTS).catch((e) => log.error({ err: e }, "subscribe failed"));
sub.on("message", (_ch, raw) => {
  void handleEvent(JSON.parse(raw) as Event);
});

async function handleEvent(ev: Event) {
  const subscribers = lotSubs.get(ev.lotId);
  if (!subscribers || subscribers.size === 0) return;

  if (ev.type === "spectators") {
    for (const ws of subscribers) send(ws, { t: "spectators", lotId: ev.lotId, count: ev.count });
    return;
  }

  if (ev.type === "bid") {
    const rivalLabel = await pseudonym(ev.lotId, ev.leaderUserId);
    for (const ws of subscribers) {
      const conn = conns.get(ws);
      if (!conn) continue;
      const mine = conn.userId === ev.leaderUserId;
      send(ws, {
        t: "bid",
        lotId: ev.lotId,
        price: ev.price,
        seq: ev.seq,
        endsAt: ev.endsAt,
        extended: ev.extended,
        leaderLabel: mine ? "Та" : rivalLabel,
        youLead: mine,
        feedItem: { seq: ev.seq, label: mine ? "Та" : rivalLabel, amount: ev.price, ts: ev.ts, mine },
      });
      if (conn.userId === ev.releasedUser) {
        send(ws, { t: "outbid", lotId: ev.lotId, returned: ev.releasedAmount });
        send(ws, await balanceMsg(conn));
      }
      if (mine) send(ws, await balanceMsg(conn));
    }
    return;
  }

  // closed
  for (const ws of subscribers) {
    const conn = conns.get(ws);
    if (!conn) continue;
    const result = !ev.leaderUserId ? "ended" : conn.userId === ev.leaderUserId ? "won" : "lost";
    send(ws, { t: "closed", lotId: ev.lotId, result, price: ev.price });
    send(ws, await balanceMsg(conn));
  }
}

/* ------------------------------ connections ------------------------------- */

const wss = new WebSocketServer({ noServer: true });

const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "bid", conns: conns.size }));
    return;
  }
  res.writeHead(404);
  res.end();
});

httpServer.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url ?? "", "http://localhost");
  const ticket = verifyTicket(url.searchParams.get("ticket") ?? "");
  if (!ticket || ticket.kyc !== "approved") {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, ticket);
  });
});

wss.on("connection", (ws: WebSocket, ticket: NonNullable<ReturnType<typeof verifyTicket>>) => {
  const conn: Conn = {
    ws,
    userId: ticket.uid,
    role: ticket.role,
    limit: ticket.limit,
    lots: new Set(),
    eligible: new Map(),
    alive: true,
  };
  conns.set(ws, conn);
  void ensureUserCommitted(ticket.uid);

  ws.on("pong", () => {
    conn.alive = true;
  });

  ws.on("message", (raw) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.toString());
    } catch {
      return;
    }
    const r = ClientMessage.safeParse(parsed);
    if (!r.success) return;
    void onMessage(conn, r.data);
  });

  ws.on("close", () => {
    for (const lotId of conn.lots) {
      lotSubs.get(lotId)?.delete(ws);
      void redis.decr(`lot:${lotId}:spec`).then(async (count) => {
        await redis.publish(EVENTS, JSON.stringify({ type: "spectators", lotId, count: Math.max(0, count) }));
      });
    }
    conns.delete(ws);
  });
});

async function onMessage(conn: Conn, msg: ClientMessage) {
  if (msg.t === "ping") {
    send(conn.ws, { t: "pong" });
    return;
  }

  if (msg.t === "subscribe") {
    const meta = await ensureLot(msg.lotId);
    if (!meta.exists) return;
    if (!(await checkEligible(conn, msg.lotId))) {
      send(conn.ws, { t: "rejected", lotId: msg.lotId, reason: "not_eligible" });
      return;
    }
    conn.lots.add(msg.lotId);
    let set = lotSubs.get(msg.lotId);
    if (!set) {
      set = new Set();
      lotSubs.set(msg.lotId, set);
    }
    set.add(conn.ws);
    const count = await redis.incr(`lot:${msg.lotId}:spec`);
    await sendSnapshot(conn, msg.lotId);
    await redis.publish(EVENTS, JSON.stringify({ type: "spectators", lotId: msg.lotId, count }));
    return;
  }

  if (msg.t === "bid") {
    if (await rateLimited(conn.userId)) {
      send(conn.ws, { t: "rejected", lotId: msg.lotId, reason: "rate_limited" });
      return;
    }
    if (!(await checkEligible(conn, msg.lotId))) {
      send(conn.ws, { t: "rejected", lotId: msg.lotId, reason: "not_eligible" });
      return;
    }
    const res = await placeBid(msg.lotId, conn.userId, msg.option, conn.limit);
    if (!res.ok) {
      send(conn.ws, { t: "rejected", lotId: msg.lotId, reason: res.reason as never });
      return;
    }
    await redis.publish(
      EVENTS,
      JSON.stringify({
        type: "bid",
        lotId: msg.lotId,
        price: res.amount,
        seq: res.seq,
        endsAt: res.endsAt,
        extended: res.extended,
        leaderUserId: res.leaderUserId,
        releasedUser: res.releasedUser,
        releasedAmount: res.releasedAmount,
        ts: res.ts,
      }),
    );
  }
}

/* --------------------------- schedule sweep ------------------------------- *
 * Phases advance by the clock, not by an admin: scheduled lots whose window has
 * opened become live; published lots past their end get finalized. DB-driven so
 * it works even when nobody is watching.                                       */

setInterval(() => {
  void (async () => {
    const now = new Date();

    // finalize anything past its end (scheduled that never opened, or live)
    const due = await db
      .select({ id: schema.lots.id })
      .from(schema.lots)
      .where(and(inArray(schema.lots.status, ["scheduled", "live"]), lte(schema.lots.endsAt, now)));
    for (const { id } of due) {
      await ensureLot(id);
      const r = await finalize(id);
      if (r.finalized) {
        await redis.publish(
          EVENTS,
          JSON.stringify({ type: "closed", lotId: id, leaderUserId: r.leaderUserId, price: r.price }),
        );
        log.info({ lotId: id, winner: r.leaderUserId, price: r.price }, "lot finalized");
      }
    }

    // promote scheduled lots whose window has opened -> live
    const opening = await db
      .select({ id: schema.lots.id })
      .from(schema.lots)
      .where(
        and(
          eq(schema.lots.status, "scheduled"),
          lte(schema.lots.startsAt, now),
          gt(schema.lots.endsAt, now),
        ),
      );
    for (const { id } of opening) {
      await db.update(schema.lots).set({ status: "live" }).where(eq(schema.lots.id, id));
      await ensureLot(id);
      log.info({ lotId: id }, "lot opened (scheduled -> live)");
    }
  })();
}, 2000);

/* ------------------------------ heartbeat --------------------------------- */

setInterval(() => {
  for (const [ws, conn] of conns) {
    if (!conn.alive) {
      ws.terminate();
      continue;
    }
    conn.alive = false;
    if (ws.readyState === ws.OPEN) ws.ping();
  }
}, 30_000);

async function start() {
  await redis.ping();
  log.info("redis connected");
  httpServer.listen(PORT, () => log.info(`bid service listening on :${PORT} (ws /ws)`));
}

start().catch((err) => {
  log.error({ err }, "failed to start bid service");
  process.exit(1);
});
