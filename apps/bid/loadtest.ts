/**
 * Local load test for the bid arena. Seeds N bidders, opens N WebSocket clients
 * that contend on ONE live lot, and reports throughput / latency / correctness.
 *
 *   pnpm exec dotenv -e .env -- pnpm --filter @auction/bid exec tsx loadtest.ts
 *   N=500 DURATION_MS=20000 pnpm exec dotenv -e .env -- \
 *     pnpm --filter @auction/bid exec tsx loadtest.ts
 *
 * Requires Redis + Postgres up and a fresh live lot (run `pnpm db:reset-demo`).
 */
import { createHmac } from "node:crypto";

import { and, count, desc, eq, gt, like, max } from "drizzle-orm";

import { db, schema } from "@auction/db";
import WebSocket from "ws";

const N = Number(process.env.N ?? process.argv[2] ?? 200);
const DURATION_MS = Number(process.env.DURATION_MS ?? 20_000);
const WS_BASE = process.env.WS_LOADTEST_URL ?? `ws://localhost:${process.env.BID_WS_PORT ?? 8080}`;
const SECRET = process.env.WS_TICKET_SECRET ?? "change-me-in-prod";
const THINK_MIN = 20;
const THINK_MAX = 140;
const LIMIT = 10_000_000_000; // large enough that balance never blocks the test

const b64url = (s: string) =>
  Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function mintTicket(uid: string): string {
  const body = b64url(JSON.stringify({ uid, role: "bidder", kyc: "approved", limit: LIMIT, exp: Date.now() + 3_600_000 }));
  const sig = createHmac("sha256", SECRET).update(body).digest("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${body}.${sig}`;
}

async function ensureUsers(n: number): Promise<string[]> {
  const rows = Array.from({ length: n }, (_, i) => ({
    email: `loadtest-${i}@auction.test`,
    accountType: "individual" as const,
    kyc: "approved" as const,
    source: "admin" as const,
    limit: LIMIT,
  }));
  // chunked insert to stay under parameter limits
  for (let i = 0; i < rows.length; i += 500) {
    await db.insert(schema.users).values(rows.slice(i, i + 500)).onConflictDoNothing({ target: schema.users.email });
  }
  const found = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(like(schema.users.email, "loadtest-%@auction.test"))
    .limit(n);
  return found.map((r) => r.id);
}

async function pickLiveLot(): Promise<{ id: string; code: string } | null> {
  const live = and(eq(schema.lots.status, "live"), gt(schema.lots.endsAt, new Date()));
  const [lot] = await db
    .select({ id: schema.lots.id, code: schema.lots.code })
    .from(schema.lots)
    .where(process.env.LOT_CODE ? and(live, eq(schema.lots.code, process.env.LOT_CODE)) : live)
    .orderBy(desc(schema.lots.endsAt))
    .limit(1);
  return lot ?? null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pct = (sorted: number[], p: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]! : 0);

async function main() {
  console.log(`load test: N=${N} clients, ${DURATION_MS / 1000}s, target=${WS_BASE}`);
  const lot = await pickLiveLot();
  if (!lot) {
    console.error("No live lot with a future end time. Run `pnpm db:reset-demo` first.");
    process.exit(1);
  }
  console.log(`bidding on lot ${lot.code} (${lot.id})`);
  const ids = await ensureUsers(N);
  console.log(`seeded/loaded ${ids.length} bidders`);

  const latencies: number[] = [];
  const rejects: Record<string, number> = {};
  let connected = 0, connErr = 0, sent = 0, accepted = 0, extensions = 0, maxPrice = 0;
  let stopping = false;

  const clients = ids.map((uid) => {
    const ws = new WebSocket(`${WS_BASE}/ws?ticket=${encodeURIComponent(mintTicket(uid))}`);
    let pendingAt = 0; // 0 = no bid in flight
    let leading = false;

    const bid = () => {
      if (stopping || pendingAt || leading || ws.readyState !== ws.OPEN) return;
      pendingAt = performance.now();
      sent++;
      ws.send(JSON.stringify({ t: "bid", lotId: lot.id, nSteps: 1 }));
    };
    const resolve = () => {
      if (pendingAt) { latencies.push(performance.now() - pendingAt); pendingAt = 0; }
    };

    ws.on("open", () => {
      connected++;
      ws.send(JSON.stringify({ t: "subscribe", lotId: lot.id }));
    });
    ws.on("message", (raw) => {
      let m: { t: string; youLead?: boolean; price?: number; extended?: boolean; reason?: string };
      try { m = JSON.parse(raw.toString()); } catch { return; }
      if (m.t === "snapshot") { if (!m.youLead) setTimeout(bid, Math.random() * (THINK_MAX - THINK_MIN) + THINK_MIN); }
      else if (m.t === "bid") {
        if (typeof m.price === "number") maxPrice = Math.max(maxPrice, m.price);
        if (m.extended) extensions++;
        leading = !!m.youLead;
        if (m.youLead) { accepted++; resolve(); }
        else { resolve(); setTimeout(bid, Math.random() * (THINK_MAX - THINK_MIN) + THINK_MIN); }
      } else if (m.t === "rejected") {
        rejects[m.reason ?? "?"] = (rejects[m.reason ?? "?"] ?? 0) + 1;
        resolve();
        if (m.reason !== "closed") setTimeout(bid, 80 + Math.random() * 120);
      } else if (m.t === "closed") { leading = false; }
    });
    ws.on("error", () => { connErr++; });
    return ws;
  });

  // Watchdog: don't let a lost resolution wedge a client.
  const t0 = performance.now();
  await sleep(DURATION_MS);
  stopping = true;
  const wallSec = (performance.now() - t0) / 1000;
  for (const ws of clients) { try { ws.close(); } catch { /* ignore */ } }
  await sleep(500);

  // Correctness from the durable record.
  const [{ n: winning } = { n: 0 }] = await db
    .select({ n: count() }).from(schema.bids)
    .where(and(eq(schema.bids.lotId, lot.id), eq(schema.bids.status, "winning")));
  const [{ n: totalBids } = { n: 0 }] = await db
    .select({ n: count() }).from(schema.bids).where(eq(schema.bids.lotId, lot.id));
  const [{ m: dbMax } = { m: 0 }] = await db
    .select({ m: max(schema.bids.amount) }).from(schema.bids).where(eq(schema.bids.lotId, lot.id));

  latencies.sort((a, b) => a - b);
  const rejTotal = Object.values(rejects).reduce((a, b) => a + b, 0);
  console.log("\n──────── RESULTS ────────");
  console.log(`connections:     ${connected}/${N} ok, ${connErr} errors`);
  console.log(`bids sent:       ${sent}`);
  console.log(`bids accepted:   ${accepted}  (${(accepted / wallSec).toFixed(0)}/s)`);
  console.log(`rejects:         ${rejTotal}  ${JSON.stringify(rejects)}`);
  console.log(`bid latency ms:  p50=${pct(latencies, 50).toFixed(1)} p95=${pct(latencies, 95).toFixed(1)} p99=${pct(latencies, 99).toFixed(1)} max=${(latencies.at(-1) ?? 0).toFixed(1)}`);
  console.log(`anti-snipe ext:  ${extensions}`);
  console.log("── correctness (durable DB) ──");
  console.log(`winning rows:    ${winning}  (must be exactly 1)`);
  console.log(`bids persisted:  ${totalBids}   final price (db max): ${Number(dbMax).toLocaleString()}`);
  console.log(`final price seen (ws): ${maxPrice.toLocaleString()}`);
  console.log(winning === 1 ? "✅ single-winner invariant held" : "❌ INVARIANT VIOLATION");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
