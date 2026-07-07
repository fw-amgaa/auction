# Online Real-Time Auction Platform — Requirements & Plan

> Single source of truth for the build. Last updated during planning brainstorm (2026-06-25).
> Nothing here is code yet — this is the agreed map before we build.

---

## 1. What we're building

A real-time, online auction platform. The first and current use case is a **government wildlife-permit auction** (e.g. Khovd Province auctioning special-purpose hunting permits for Угалз / argali and Тэх / ibex, each animal a uniquely coded lot). It is an **upgrade** of an existing, weak auction site into a proper live-bidding system.

**Design posture:** wildlife-permit auction _today_, but the core engine is built **generic** (categories, lots, bidding, balance) so other auction types can be added later without a rewrite. No over-engineering for use cases we don't have yet.

**Operating reality (drives every cost/scale decision):**

- **Seasonal.** Live for ~2 months/year, then idle until next year.
- Registration runs for ~a week; the **actual live bidding is a narrow window** (the source auction was a single day, 09:00–16:00).
- **Peak load: up to 1000 concurrent bidders on a single hot lot** — but only during those live hours, and likely lower (host city Khovd is small).
- **Cost-sensitive / profit-motivated.** Infra must cost almost nothing in the off-season.

---

## 2. Glossary (Mongolian ↔ system terms)

| Mongolian             | System term           | Meaning                                                                     |
| --------------------- | --------------------- | --------------------------------------------------------------------------- |
| Дуудлага худалдаа     | Auction               | The event / a lot's bidding                                                 |
| Ангилал (зүйл амьтан) | Category              | Species: Тэх, Чоно, Янгир, Загас, Угалз, Гахай, Шувуу, Булга                |
| Шифр (e.g. U9, Т101)  | Lot code              | Unique code identifying one permit/animal                                   |
| Босго үнэ             | Reserve / start price | Opening price a lot must reach                                              |
| Дэнчин                | Deposit               | Real money paid **offline** to qualify (NOT tracked as money in our system) |
| —                     | Limit (balance)       | Admin-issued bidding ceiling/credit representing the user's offline deposit |
| Өсгөх үнийн хязгаар   | Increment band        | Each raise ≥10% and ≤50% of reserve                                         |
| Иргэн                 | Individual            | Citizen participant                                                         |
| Хуулийн этгээд / ААНБ | Legal entity          | Company participant (+ notarized power-of-attorney path)                    |

---

## 3. Roles

- **Bidder** — registers, completes KYC, gets an admin-issued limit, bids in live auctions.
- **Admin / Operator** — runs everything: KYC approval, sets/raises limits, creates and manages lots, monitors live auctions, handles results/exports/refunds.
- _(No "merchant / Дэлгүүр" role — removed. A single operator runs all auctions.)_

---

## 4. Functional requirements

### 4.1 Registration & KYC

- Self-service signup replacing the old manual email/paper process.
- Two account types with the fields from the official application form:
  - **Individual (Иргэн):** citizenship, clan name (ургийн овог), father's name, registry number, full address (aimag → sum → bag → street → building), phone, email, alternate contact.
  - **Legal entity (ААНБ):** registered name, registry number, state-registration certificate number, contact phone, full address; plus **notarized power-of-attorney** support when a representative acts for the entity.
- **Document upload:** ID copy (individual) / state-registration certificate (entity) / notarized power of attorney.
- Versioned **terms & conditions** acceptance at signup.
- **Admin KYC approval queue** — cannot bid until approved.
- **Admin-created accounts (secondary path):** admin can create a user on their behalf for offline/walk-in registrants who submit documents the old way — same fields + document upload, with the option to pre-approve KYC and set the initial limit in one flow. New user receives an email invite to set their own password (or admin sets a temporary one). Stamped in the audit log. Self-registration remains the default path.

### 4.2 Categories & catalog

- Categories = species (the main category screen). Per-category defaults: reserve price, increment band.
- Catalog/browse with search + filters (aimag, status, sort) and lot detail pages with image gallery.
- _(No merchant-category restriction — removed.)_

### 4.3 Auction lots & lifecycle

- **Each lot = one single coded item, one winner.** No quantity, no batches.
- Lot fields: code (U9, Т101…), category/species, reserve price, increment band, scheduled start & end, images, description.
- Lifecycle: `draft → published → registration open → registration closed → live → ended → settled / cancelled`.
- Admin creates and manages all lots.

### 4.4 Bidding engine (the core)

Ascending English auction, real-time, within a scheduled window.

A bid of amount **B** on lot **L** by a user is accepted only if **all** hold:

1. User is **authenticated** and **KYC-approved**.
2. The lot is **live** (within its window).
3. B **beats the current high** by at least the min increment and by no more than the max increment (**10–50% of reserve**).
4. User is **not already the high bidder** on L (no bidding against yourself).
5. **`available ≥ B`** — the user can afford to hold B (see §4.5).

On acceptance:

- B becomes the new high bid; the bidder becomes leader.
- The bidder's hold increases to B; the **displaced previous leader's hold is released immediately**.
- **Fixed end time:** the lot closes exactly at the admin-scheduled end time — a late bid never moves the clock.
- New state is broadcast live to all watchers (see §6).

Features: live bid feed, full bid history per lot, "you've been outbid," countdown timer.

### 4.5 Balance = bidding limit with holds

The "balance" is **not a wallet of real money** — it's an admin-issued **bidding ceiling/credit** representing the deposit the user paid offline.

- Each user has a `limit` (admin sets it after verifying their offline deposit; admin's discretion, not a fixed formula).
- `committed` = sum of the user's bids on lots **where they are currently the highest bidder**.
- `available = limit − committed`.
- **Bid placed →** B is held (committed ↑), reducing available.
- **Outbid →** hold released (committed ↓), returns to available — free to rebid elsewhere immediately.
- **Won (auction closes with them leading) →** hold is **consumed** (stays deducted).
- **Admin can raise** a user's limit anytime → available rises instantly. Lowering is constrained to not drop below current `committed`.
- **Limit/balance ledger:** an immutable, append-only log of every change — admin issued/raised/lowered, each hold and release, each consumption — for full auditability. This is the "balance log" the operator reviews.
- Real-money **deposit refunds / chargebacks are handled offline**; admin records the action and zeroes/adjusts the limit. We never move real money.

### 4.6 Notifications (dedicated tab)

In-app **Notifications tab** that narrates the full lifecycle, plus optional email/SMS:

- Bid placed (held ₮X) · Outbid (₮X returned) · Won (₮X kept) · Lost.
- Limit issued / increased by admin.
- Auction starting soon · ending soon.
- KYC approved / rejected · document needs fixing.
- (Mongolian-language copy.)

### 4.7 Admin / operator

- **User management:** searchable list of all users; **create user** on behalf of offline registrants (same fields as §4.1, with optional inline KYC pre-approval + initial limit); edit user; invite/reset credentials. All actions audited.
- KYC approval queue (approve/reject with reason).
- Limit management: issue/raise/lower per user; view full balance ledger; record offline refunds.
- Lot management: create/edit/cancel/schedule; set reserve & increment band.
- **Live monitoring** of active auctions (current high, bidder, time remaining).
- Winner determination & result management.
- **Full audit log** of all admin actions.
- **Government-grade exports:** winner lists, payment status, participant lists (CSV/PDF), permit/certificate generation.

### 4.8 Post-auction / fulfillment

- Winner determined at close (final leader).
- Payment of the remaining amount and permit issuance happen **offline**; admin records status and generates the official permit document.
- Public transparency/results page (optional, for government accountability).
- **Winner-default rule: OPEN** (see §9).

---

## 5. Non-functional requirements

- **Concurrency:** correctly handle up to 1000 concurrent bidders on a single lot with consistent, race-free high-bid resolution.
- **Real-time latency:** accepted bids reflected to all watchers within ~tens of ms.
- **Integrity:** the limit ledger and bid records must be correct and auditable (append-only).
- **Security:** auth, role-based access, rate limiting, secure document storage, input validation.
- **Seasonal cost:** near-zero infra spend in the off-season; scale up only for live-auction days.
- **Localization:** Mongolian-first UI (English optional — see §9).
- **Responsive / mobile-friendly.**

---

## 6. Architecture

### Stack (locked)

- **Web app:** Next.js (App Router) — SSR, auth, and all request/response features (registration, KYC, catalog, admin, limit management). Most of the app lives here.
- **Real-time bid service:** a dedicated long-running **Node WebSocket service** — handles live bidding connections and bid arbitration. Logically separate (own process/container) so it can scale and deploy independently; **physically co-located on the same box** for now to keep cost down.
- **Postgres:** system of record — users, KYC, lots, bids (durable), the limit ledger. ACID for anything that must be correct.
- **Redis:** the real-time engine —
  - **Atomic bid arbitration** via a Lua script: in one atomic step, validate the bid (increment band + `available ≥ B`), set the new high, move the hold from the displaced leader to the new leader. Single-threaded Redis serializes all 1000 bids on the hot key for free, at sub-ms speed.
  - **Pub/sub fan-out** to push accepted bids to all WebSocket clients.
  - Rate limiting, presence/connection counts, caching.
- A single Redis instance gives us trivial multi-key atomicity (lot state + per-user committed) in one Lua script.

### Bid flow

```
client ──bid──▶ WS bid service
                 1. auth + KYC check
                 2. Redis Lua (atomic):
                      valid increment? available ≥ B? beats current?
                      → accept: set high=B, leader=user,
                                committed[user]+=Δ, committed[oldLeader]-=hold
                      → reject: reason
                 3. persist accepted bid + ledger entries to Postgres
                 4. Redis PUBLISH new-high
                       ▼
        WS service ─▶ push new high + history to all watchers
                   ─▶ enqueue notifications (outbid, etc.)
```

Redis = referee. Postgres = historian. WS service = announcer.

### Deployment (cost-optimal, seasonal)

- **Single EC2 (ARM/Graviton `t4g`)** running everything via Docker Compose: Next.js app + bid service + Postgres + Redis + Caddy (auto-HTTPS reverse proxy).
- **Size to the moment:** tiny instance during quiet registration weeks; **resize up for live-auction days** (EC2 bills hourly); resize back after.
- **Off-season: STOP the instance** → pay only ~₮ for the EBS disk (a few $/yr). Compute billing pauses while stopped.
- **Backups:** EBS snapshot before the event + nightly `pg_dump` to S3 (pennies).
- **Media/docs:** S3 (+ CloudFront if needed). **Email:** SES. **SMS:** needs a **local Mongolian SMS gateway** (SES/SNS won't reach MN carriers reliably) — OPEN.
- **Accepted risk:** one box = single point of failure during the live event. Mitigated by the narrow live window, pre-event snapshot, and a documented fast-restore path. **Mandatory: load-test the chosen instance size against simulated 1000-concurrent bidding before the real event.**

---

## 7. Data model (first sketch)

- **User** — type (individual/entity), profile fields per type, KYC status, role.
- **KycDocument** — user, type, file ref, review status.
- **Category** — species, default reserve, default increment band.
- **Lot** — code, category, reserve, increment band, start/end, status, images, winner.
- **Bid** — lot, user, amount, timestamp, status (accepted/superseded/winning).
- **LimitLedger** — user, delta, reason (admin-issued/hold/release/consume), balance-after, actor, timestamp (append-only).
- **Notification** — user, type, payload, read/unread.
- **AuditLog** — actor, action, target, timestamp.

_(Holds/committed are derived from current winning bids; mirrored in Redis live, reconciled to Postgres.)_

---

## 8. Phased build plan

1. **Foundation** — repo, Next.js app, Postgres schema, auth, Docker Compose dev environment.
2. **Accounts & KYC** — registration (both types), document upload, T&C, admin approval queue.
3. **Catalog & admin lot management** — categories, lot CRUD, scheduling, images.
4. **Limit/balance system** — admin issue/raise, ledger, user balance view.
5. **Bidding engine** — Redis arbitration + Node WS service + live UI, increment band, holds. _Core milestone._
6. **Notifications tab** — event feed + (email/SMS later).
7. **Post-auction** — winner determination, results, exports, permit generation.
8. **Hardening & load test** — security pass, 1000-concurrent simulation, deploy to EC2, off-season stop/start runbook.

---

## 9. Decisions — resolved & remaining

**Resolved (2026-06-27):**

- **Winner default:** ✅ forfeit deposit-equivalent + **offer the lot to the next-highest qualified bidder** at their bid (close keeps the ranked bid chain). (§4.8)
- **SMS / OTP:** ✅ **not at launch** — email + password login, email + in-app notifications. OTP/SMS behind a pluggable provider, added later when a Mongolian gateway is chosen.
- **Opening-bid rule:** ✅ first bid may **equal the reserve** (win-at-reserve possible); +1…+5-step band applies to raises after the opening bid.

**Remaining (non-blocking):**

- **Languages:** Mongolian only (current) vs Mongolian + English — code stays i18n-ready.
- **Public results page:** expose a transparency page, or keep results admin-only?

**Out of scope:** revenue model — operator handles profit outside the platform.
