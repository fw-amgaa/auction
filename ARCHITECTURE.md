# Architecture — Real-Time Wildlife-Permit Auction Platform

> The concrete technical blueprint to build from. Pairs with `PLAN.md` (requirements) and
> the design handoff in `Wildlife Permit Auction Platform/` (UI). Last updated 2026-06-27.
> All pure-tech choices here are made deliberately ("pick what's best") with rationale;
> genuine product decisions still open are listed in §13.

---

## 1. Guiding constraints (everything traces to these)

1. **Correctness of "money" accounting** — the bidding-limit ledger and bid records must be
   exact and auditable. (Note: no *real* money moves through the system; the "balance" is an
   admin-issued credit limit with holds — but it must be as correct as if it were money.)
2. **1000 concurrent bidders on one hot lot** — race-free high-bid resolution + fast fan-out,
   but only for short live windows.
3. **Seasonal & cost-sensitive** — near-zero spend off-season; one box that can be stopped.
4. **Stable, modern, boring where it counts.**

---

## 2. Technology decisions (locked, with rationale)

| Concern | Choice | Why |
|---|---|---|
| Language | **TypeScript** everywhere | One language across web + bid service + shared bid math/types. |
| Web app | **Next.js (App Router)** | SSR, auth, all CRUD/admin. Mature, battle-tested. |
| Real-time | **Dedicated Node WebSocket service** (`ws` lib) | Long-lived stateful connections; `ws` is rock-solid and easily handles 1000 conns. (`uWebSockets.js` is the escape hatch if we ever need 10×.) |
| System of record | **PostgreSQL** | ACID for the ledger + bids; the durable truth. |
| Hot-path engine | **Redis** (ioredis) | Atomic bid arbitration (single-threaded → free serialization), pub/sub fan-out, rate limits, presence. |
| ORM / DB access | **Drizzle ORM** + drizzle-kit migrations | SQL-first, lightweight, fully typed, gives us explicit transactions and `SELECT … FOR UPDATE` for ledger integrity. (Prisma was the alternative; Drizzle wins for control over a financial ledger.) |
| Validation | **Zod** | One schema shared client ⇄ server (forms, API, WS messages). |
| Auth | **Auth.js (NextAuth v5)**, Credentials + **database sessions** in Postgres | Revocable sessions (important for admin), role-based. Passwords hashed with **argon2id**. |
| Background jobs | **BullMQ** (on Redis) | Reliable delayed jobs for auction start/close + notification dispatch; reschedulable on anti-snipe extension. |
| File storage | **S3** (private bucket) + presigned uploads, CloudFront optional | KYC docs & lot images; access-controlled. |
| Email | **AWS SES** via nodemailer | KYC results, password-setup invites, notifications. Hard dependency. |
| SMS | **Pluggable `SmsProvider` interface** | OTP + alerts. Concrete Mongolian gateway implemented later (see §13). |
| Reverse proxy / TLS | **Caddy** | Auto-HTTPS, routes `/ws` → bid service, everything else → web. One config file. |
| Packaging | **pnpm workspaces + Turborepo**, **Docker Compose** | Monorepo with shared packages; one compose file runs the whole box. |
| Logging | **pino** (structured) | Cheap, fast, greppable. |
| Currency type | **integer tögrög** (`bigint`) end-to-end | No floats, ever. Amounts are whole ₮. |

---

## 3. Repository layout (target monorepo)

```
auction/
├─ PLAN.md  ARCHITECTURE.md  DESIGN_PROMPT.md      # source-of-truth docs (root)
├─ design/                                         # the .dc.html handoff (reference only)
│   └─ Wildlife Permit Auction Platform/ …
├─ apps/
│   ├─ web/            # Next.js App Router: public site, user app, admin, API routes
│   └─ bid/            # Node WebSocket bid service (+ scheduler/worker, or split as worker)
├─ packages/
│   ├─ db/             # Drizzle schema, migrations, typed client (shared by web + bid)
│   ├─ shared/         # Zod schemas, TS types, bid math (step/band), WS message contracts,
│   │                  #   currency formatting, constants — imported by web AND bid
│   └─ ui/             # (optional) shared React components ported from the design
├─ infra/
│   ├─ docker-compose.yml         # web, bid, postgres, redis, caddy
│   ├─ Caddyfile
│   └─ runbook.md                 # resize / snapshot / stop-start seasonal ops
├─ package.json  pnpm-workspace.yaml  turbo.json
```

**Why a shared `packages/shared`:** the bid-validation math (step = 10% reserve, band 1–5
steps, affordability) and the WS message shapes must be **identical** in the browser (optimistic
UI, button enable/disable) and in the bid service (authoritative check). Define once, import twice.

---

## 4. Services & responsibilities

### 4.1 `apps/web` (Next.js)
- Public: Landing, Login (password / OTP / recover), Register (4-step KYC wizard), Terms.
- User app: Catalog, Lot Detail, MyBids, Balance, Notifications, Profile, Help.
- Admin: Live Monitor, KYC queue, Users + Create/Detail, Limits, Lots, Results, Audit.
- API (route handlers / server actions): auth, registration, KYC, catalog reads, lot CRUD
  (admin), limit changes (admin), notification reads, S3 presign, **WS-ticket minting**.
- Does **not** handle live bid writes — it mints a ticket and hands the client to the bid service.

### 4.2 `apps/bid` (Node WS service)
- Accepts authenticated WebSocket connections (one per live viewer).
- Runs the **atomic bid script** against Redis, persists accepted bids + ledger entries to
  Postgres, publishes new state, dispatches notifications.
- Subscribes to Redis pub/sub and pushes updates to its connected clients.
- **Scheduler/worker** (BullMQ; can run in-process now, split later): auction open/close
  transitions, anti-snipe reschedule, "starting/ending soon" + result notifications, email/SMS
  dispatch.
- On startup / crash recovery: **rehydrates Redis** for all live lots from Postgres (§8).

### 4.3 Shared infra
- **Postgres** and **Redis** are shared by both apps (same box now).

---

## 5. Data model (Postgres, via Drizzle)

All money columns are `bigint` (whole tögrög). All tables have `id` (uuid), `created_at`,
`updated_at` unless noted. Append-only tables never UPDATE/DELETE.

- **users** — `account_type` (`individual`|`legal_entity`), `role` (`bidder`|`admin`),
  `email`, `phone`, `password_hash`, `kyc_status` (`pending`|`approved`|`rejected`),
  `limit` (bigint, default 0), `source` (`self`|`admin`), `created_by` (admin id, nullable),
  status flags. **`committed` is NOT stored as truth** — it's derived from current leading bids
  and mirrored in Redis (see §7); a cached `committed_cache` column may exist for display.
- **individual_profiles** / **legal_entity_profiles** — 1:1 with users; the exact docx fields
  per type (citizenship, clan name, father's name, registry no, full address hierarchy, contacts /
  registered name, state-registration cert no, etc.).
- **kyc_documents** — user, `doc_type`, `s3_key`, `review_status`, reviewer, reason.
- **categories** — species code/name, default reserve, default step %, icon, sort order.
- **lots** — `code` (e.g. `U9`), `category_id`, `title`, `description`, `reserve` (bigint),
  `step` (bigint, = 10% reserve, denormalized), `status`
  (`draft`|`scheduled`|`live`|`ended`|`settled`|`cancelled`), `starts_at`, `ends_at`,
  `current_price` (bigint, mirrors Redis during live), `leader_user_id`, `winner_user_id`, images.
- **bids** — `lot_id`, `user_id`, `amount` (bigint), `created_at`, `status`
  (`accepted`|`superseded`|`winning`|`void`), `seq` (per-lot monotonic). **Append-only**; the
  authoritative bid history. Unique `(lot_id, seq)`.
- **limit_ledger** — **append-only** money log. `user_id`, `type`
  (`admin_issue`|`admin_raise`|`admin_lower`|`hold`|`release`|`consume`|`offline_refund`),
  `delta` (signed bigint), `balance_after`/`committed_after`, `lot_id` (nullable), `bid_id`
  (nullable), `actor_id` (admin or system), `note`, `created_at`.
- **notifications** — `user_id`, `type`, `payload` (jsonb), `read_at`, `created_at`.
- **audit_log** — `actor_id`, `action`, `target_type`, `target_id`, `meta` (jsonb), `created_at`.
- **sessions / accounts** — Auth.js tables.
- **terms_versions** + **user_terms_acceptance** — versioned T&C (design shows v2.3).

Indexes that matter: `bids(lot_id, seq)`, `bids(user_id)`, `limit_ledger(user_id, created_at)`,
`lots(status, ends_at)`, `notifications(user_id, read_at)`.

---

## 6. The bidding engine (the crown jewel)

### 6.1 Bid rules (authoritative, also mirrored in `packages/shared`)
- `step = round(reserve * 0.10)`.
- A raise of **N steps**, N ∈ **[1,5]** → `amount = current_price + N*step`. (1–5 steps == the
  10%–50%-of-reserve band.)
- **Opening bid rule:** see §13 (must confirm: can the first bid equal the reserve, or must it be
  reserve + N·step?). Default proposed: **first bid may equal reserve** (N can be 0 only when there
  are no bids yet); thereafter N ∈ [1,5].
- Eligibility: authenticated + `kyc_status=approved` + lot `live` + not current leader +
  **affordable**: `committed + amount ≤ limit`.

### 6.2 Redis state (per live lot + per user)
```
lot:{id}  (HASH)   price, leader, reserve, step, endsAt, status
user:{id} (HASH)   limit, committed
lot:{id}:seq (INT) monotonic bid sequence
presence:{lotId} (SET/INT) connected viewers
ratelimit:{userId} (token bucket)
```

### 6.3 Atomic bid — single Redis **Lua** script (runs indivisibly)
```
INPUT: lotId, userId, amount, nSteps, now
1. load lot hash; if status≠live OR now>endsAt        → REJECT(closed)
2. if leader == userId                                → REJECT(self)
3. expected = price + nSteps*step; if 1>nSteps>5
      or amount≠expected                              → REJECT(bad_increment)
4. uc = user.committed; lim = user.limit
   if uc + amount > lim                               → REJECT(insufficient)
5. ACCEPT (all mutations atomic):
   - if leader exists: user:{leader}.committed -= price      # release old leader's hold
   - user:{userId}.committed = uc + amount                   # hold new bid
   - lot.price = amount; lot.leader = userId
   - seq = INCR lot:{id}:seq
   - if endsAt - now <= 15: endsAt += 30; extended=true      # anti-snipe
6. return ACCEPT{ price, leader, seq, endsAt, extended, releasedUser, releasedAmount }
```
Because Redis is single-threaded, all 1000 concurrent bids on the hot lot **serialize for free**
at memory speed — no row-lock pile-up, no lost updates, no double-winner.

### 6.4 After ACCEPT (bid service, durable + fan-out)
1. **Persist (one Postgres tx):** insert `bids` row (with `seq`); mark previous winning bid
   `superseded`; insert `limit_ledger` `hold` (new leader) + `release` (old leader); update
   `lots.current_price/leader_user_id/ends_at`. Idempotent on `(lot_id, seq)`.
2. **Publish** `lot:{id}` event (new price/leader/seq/endsAt/extended) → all WS instances push
   to clients watching that lot; the displaced leader gets a personal **outbid** event.
3. **Notifications:** enqueue outbid (₮ returned) for old leader; if extended, broadcast "+30s".
4. **Reschedule close job** to the new `endsAt` if extended.

### 6.5 Rate limiting & abuse
- Per-user token bucket in Redis (e.g. N bids/sec) checked inside the connection handler before
  the Lua call; reject with a friendly message. Per-connection message-size/flood guards.

---

## 7. Limit / balance accounting (model B — total exposure)

- `available = limit − committed`. `committed` = Σ amounts of lots where the user is current leader.
- Lifecycle exactly as PLAN §4.5: **bid → hold; outbid → release; win → consume; admin → raise.**
- Redis holds the live `committed`; **every transition writes an append-only `limit_ledger` row**
  so Postgres can reconstruct `committed` independently (sum of holds − releases − consumes).
- Admin limit change (web) → update Postgres + `limit_ledger` + Redis `user:{id}.limit` + publish
  `user:{id}` event so any live arena UI updates `available` instantly.
- **Lowering a limit** is rejected if it would drop below current `committed`.

---

## 8. Correctness, durability & crash recovery (money-grade)

The hard question: Redis is authoritative for speed during live bidding, Postgres is the durable
log. How do we guarantee they never permanently disagree?

- **Redis = live authority, Postgres = durable journal.** Each ACCEPT carries a monotonic `seq`;
  Postgres writes are **idempotent** on `(lot_id, seq)`, so a retry after a transient failure can't
  double-insert.
- **Write path:** ACCEPT → enqueue durable persist. If the Postgres write fails, the bid stays
  valid in Redis (the user is genuinely leading) and the persist is **retried**; `seq` ordering is
  preserved. Persist failures alert but don't reject the live bid.
- **Rehydrate on startup / crash:** for every `live` lot, the bid service rebuilds Redis from
  Postgres — `price/leader/seq` = the max-`seq` accepted bid; per-user `committed` = Σ current
  leading-bid amounts; `endsAt` from the lot row. This makes a Redis flush or service restart
  fully recoverable (Postgres is the truth, Redis is a fast cache of it).
- **Close = finalize from durable state:** at `endsAt`, the close job marks the lot `ended`, sets
  `winner_user_id` = current leader, writes a `consume` ledger row for the winner (hold →
  consumed), confirms all other holds were released, emits won/lost notifications. Idempotent.
- **Daily/post-event reconciliation:** a job recomputes each user's `committed` from
  `limit_ledger` and from current leading bids and asserts they match Redis; discrepancies are
  logged for admin review. (Cheap insurance for a financial ledger.)
- **Backups:** EBS snapshot before each event + nightly `pg_dump` to S3.

---

## 9. Real-time transport & protocol

- **Connect:** after login, the browser asks `apps/web` for a **short-lived signed WS ticket**
  (JWT, ~60s, contains userId, role, limit snapshot). It opens `wss://host/ws?ticket=…`; the bid
  service verifies the signature (shared secret) and binds the connection to the user.
- **Client → server messages:** `subscribe{lotId}`, `bid{lotId, nSteps}`, `watch{lotId}`,
  `unsubscribe{lotId}`, `ping`.
- **Server → client messages:** `state{lotId, price, leader#, endsAt, seq, spectators}`,
  `accepted{…}`, `rejected{reason}`, `outbid{lotId, returned}`, `extended{lotId, +30}`,
  `closed{lotId, result}`, `balance{available, committed, limit}`, `pong`.
- **Fan-out:** bid service subscribes to Redis `lot:{id}` and `user:{id}` channels; pushes to the
  right sockets. Single process today, but pub/sub means we can run N bid instances behind the LB
  with no code change.
- **Reconnect:** client auto-reconnects with backoff; on reconnect it re-`subscribe`s and gets a
  fresh `state` snapshot (the design already shows a "reconnecting" state that pauses controls).
- All message shapes are Zod schemas in `packages/shared`.

---

## 10. Auth, roles & security

- **Auth.js (NextAuth v5)**, Credentials provider, **database sessions** (revocable).
  Passwords **argon2id**. Roles: `bidder`, `admin` (route + action guards; admin area separate).
- **OTP login** (design includes it) and **SMS notifications** go through the pluggable
  `SmsProvider`; if SMS isn't enabled at launch, login falls back to email+password and OTP is
  feature-flagged off (see §13).
- **KYC gate:** server-enforced — no WS ticket / no bid acceptance unless `kyc_status=approved`.
- **S3:** private bucket; uploads via presigned PUT; downloads via short-lived presigned GET
  gated by role (admins view any KYC doc; users only their own).
- Standard hardening: Zod validation on every boundary, CSRF on web forms, rate limits (auth +
  bidding), security headers via Caddy, secrets in env (not committed), audit log on all admin
  actions.

---

## 11. Deployment (single seasonal EC2)

- **One EC2 (Graviton `t4g`)** running `infra/docker-compose.yml`:
  `caddy` (TLS + routing) · `web` (Next.js) · `bid` (WS + worker) · `postgres` · `redis`.
- **Caddy** routes `/ws*` → `bid:PORT`, everything else → `web:3000`; auto-provisions TLS.
- **Seasonal ops** (`infra/runbook.md`): tiny instance for registration weeks → **resize up for
  live-auction days** (hourly billing) → resize down → **STOP instance off-season** (pay only EBS).
  Snapshot before each event; restore path documented.
- **Env/config** via `.env` (DB url, Redis url, S3 creds/bucket, SES creds, WS secret, SMS keys).
- **CI (later/light):** typecheck + build + drizzle migrate; deploy = pull image + compose up.
- **Mandatory pre-event load test:** simulate 1000 concurrent WS clients bidding on one lot
  against the chosen instance size; confirm latency + correctness before the real auction.

---

## 12. Build order (maps to PLAN §8, now concrete)

0. **Scaffold:** monorepo (pnpm/turbo), `packages/db` schema + first migration,
   `packages/shared` (bid math, Zod, WS contracts), Docker Compose dev (postgres+redis),
   Next.js app skeleton with design tokens (IBM Plex, color vars) + ported AppNav/AdminNav.
1. **Auth & accounts:** Auth.js, login (password; OTP behind flag), registration wizard (both
   types), S3 doc upload, T&C versioning.
2. **KYC + admin user mgmt:** approval queue, create-user, user detail, audit log start.
3. **Catalog + admin lots:** categories, lot CRUD/scheduling, catalog + lot detail (read).
4. **Limit/balance:** admin issue/raise/lower, append-only ledger, user Balance screen.
5. **★ Bidding engine:** Redis Lua + bid service + WS protocol + live arena UI (steps,
   anti-snipe, holds, feed, shortcuts, tours, practice). Rehydrate + persistence + reconciliation.
6. **Notifications:** in-app feed + worker dispatch (email now; SMS when provider ready).
7. **Post-auction:** close finalization, results, exports, permit generation.
8. **Hardening + load test + deploy:** security pass, 1000-concurrent simulation, EC2 + runbook.

---

## 13. Decisions — resolved & remaining

**Resolved (2026-06-27):**
1. **SMS / OTP:** ✅ **Email + in-app only at launch.** Login = email + password; notifications =
   email + in-app. OTP login and SMS alerts are **feature-flagged off** behind the `SmsProvider`
   interface, wired later when a Mongolian gateway is chosen. (Email/SES remains a hard dependency.)
2. **Opening-bid rule:** ✅ **First bid may equal the reserve** (win-at-reserve is possible). The
   +1…+5-step band applies only to *raises* after the opening bid. In bid math: when there are no
   bids yet, a bid of exactly `reserve` is valid; afterward `amount = current + N·step`, N ∈ [1,5].
3. **Winner default:** ✅ **Forfeit + offer to next bidder.** On non-payment, the winner is marked
   defaulted (hold consumed/forfeited), and the lot is offered to the **next-highest qualified
   bidder at their bid**. Close-finalization keeps the ranked bid list (from `bids` by `seq`) so the
   runner-up chain is available. (Phase 7.)

**Remaining (non-blocking):**
4. Public results/transparency page — yes/no.
5. Mongolian-only vs Mongolian + English (design is Mongolian-only; code stays i18n-ready).
```
