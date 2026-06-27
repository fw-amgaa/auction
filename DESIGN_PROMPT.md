# Design Prompt — Online Real-Time Wildlife-Permit Auction Platform

> Feed this to the design tool whole for a full design system + screens, or section-by-section
> (each screen below is self-contained). All product rules trace back to `PLAN.md`.
> **Primary language: Mongolian (Cyrillic).** English copy here is for the designer's understanding;
> render UI strings in Mongolian (sample strings provided).

---

## 0. The brief in one line

Design a **clean, professional, trustworthy** real-time auction web app for **official government wildlife-hunting-permit auctions** — calm and authoritative for browsing and registration, but **fast, legible, and electric** during live bidding, so a first-time user instantly understands what's happening as bids fly. Must include a **first-time guided tour** and **keyboard shortcuts for live bidding**.

---

## 1. Who uses it & the feeling

- **Users:** Mongolian citizens and companies bidding on hunting permits (e.g. Угалз/argali, Тэх/ibex). Many are **not tech-savvy** and may bid from a phone. They are committing real money — trust and clarity are paramount.
- **Emotional targets:**
  - Browsing/registration → *official, safe, organized, reassuring* (this is a government process).
  - Live bidding → *alive, urgent, crystal-clear* — "pow pow" pace, but the user never feels lost.
- **Anti-goals:** nothing flashy/gimmicky, no clutter, no ambiguity about money or who's winning.

---

## 2. Visual direction

- **Mood:** governmental yet modern — think a serious public-service portal that doesn't feel dated. Authority + nature.
- **Color:**
  - Primary: **deep navy / slate** (authority, trust) — echoes the existing site's navy, elevated.
  - Action accent: a **confident crimson/red** reserved for primary actions and live/urgency (bid, live badge). Use sparingly so it stays meaningful.
  - **Status semantics:** success green (you're winning / approved), warning amber (timer running low / attention), danger red (outbid / rejected). **Never rely on color alone** — pair with icon + text.
  - Warm neutral/earth tones (sand, stone) for backgrounds and a subtle nod to wildlife/nature.
- **Typography:** clean, highly legible sans with **full Cyrillic coverage** (e.g. Inter / Manrope / Noto Sans). **Use tabular (monospaced) figures for all prices, balances, and timers** so digits don't jiggle as they update. Strong type hierarchy.
- **Currency:** Mongolian tögrög, formatted with thousands separators, e.g. **₮5,300,000** (or `5,300,000₮` per local convention — pick one and be consistent).
- **Layout:** generous whitespace, clear grids, card-based catalog, large wildlife imagery. Restrained, structured, never busy.
- **Motion:** purposeful and fast. Micro-animations for live updates (count-ups, slide-ins). Snappy, not bouncy. Respect `prefers-reduced-motion`.
- **Responsive:** mobile-first for bidding; everything works one-handed on a phone.
- **Accessibility:** WCAG AA contrast, full keyboard navigation, screen-reader labels, focus states.

Deliver a **design system first** (color tokens, type scale, spacing, icons, component library: buttons, inputs, cards, badges, modals, toasts, tables, tour tooltips), then the screens.

---

## 3. Information architecture / screens

**Public / auth**
1. Landing — what the auction is, current/upcoming auctions, trust signals (official org, rules), big "Бүртгүүлэх" (Register) / "Нэвтрэх" (Log in).
2. Register — account-type switch: **Иргэн (Individual)** vs **Хуулийн этгээд (Legal entity)**; the correct fields per type (per PLAN.md §4.1); document upload with drag-drop + preview; versioned T&C checkbox. Clear multi-step wizard with progress.
3. Log in / password recovery / (optional OTP).

**Authenticated app (persistent top nav: Catalog · My Bids · Balance · Notifications · Help)**
4. **Catalog / browse** — the upgrade of today's weak listing page. Category rail = species (Тэх, Чоно, Янгир, Загас, Угалз, Гахай, Шувуу, Булга) with icons; powerful filter/sort bar (aimag, status, price, ending-soon); responsive **lot cards** showing image, code (e.g. `Угалз:U9`), reserve price, status badge (Upcoming / **LIVE** / Ended), countdown, watch toggle. Live lots visually distinct and pulsing.
5. **Lot detail** — gallery, full info, reserve, increment band explained, schedule, current price, bid history preview, and the entry point to the live bidding room. Eligibility banner (e.g. "Bid after KYC approval" / "Available balance: ₮X").
6. **★ Live bidding room** — the centerpiece (full spec in §4).
7. **My Bids / My Auctions** — tabs: Active (currently winning / outbid), Won, Lost, Watching. Each row shows status, my bid, current price, time.
8. **Balance (Үлдэгдэл)** — big available/committed/limit summary; an explainer of how holds work ("bidding holds it, being outbid returns it, winning keeps it"); the **ledger** as a clean, filterable timeline (admin issued/raised, holds, releases, consumptions).
9. **Notifications (Мэдэгдэл)** — dedicated tab + bell with unread count; chronological feed grouped by day; types: bid placed (held ₮X), **outbid (₮X returned)**, won (₮X kept), lost, limit increased, auction starting/ending soon, **auction extended (anti-snipe)**, KYC approved/rejected. Read/unread, mark-all-read, filter by type.
10. **Profile & KYC status** — view/edit profile, KYC state, uploaded documents.

**Admin (separate, denser, data-grid aesthetic — still on-brand)**
11. **User management** — searchable user list + **Create user** form for offline registrants (same fields as registration, optional inline KYC pre-approval + initial limit, invite/reset credentials). See follow-up prompt §A.
12. KYC approval queue (approve/reject + reason, document viewer).
13. Limit management (issue/raise/lower per user; view full ledger; record offline refund).
14. Lot management (create/edit/schedule/cancel; reserve & increment band).
15. **Live auction monitor** (real-time: current high, bidder, time, bid velocity).
16. Results & exports (winner lists, payment status, permit generation), audit log.

---

## 4. ★ The Live Bidding Room (highest priority)

Design this so a **first-time user understands everything at a glance** while bids arrive rapidly. Optimize for a phone in one hand and a desktop power-user with the keyboard. Consider a **focused, higher-contrast treatment** here (the "arena") so the live numbers pop.

**Must-have elements, in priority order:**

1. **Your status — the single most important signal.** A large, unmistakable banner:
   - Winning → green, check icon, **"Та тэргүүлж байна"** (You're leading).
   - Outbid → red, alert icon, **"Таны саналыг давсан!"** (You've been outbid!) — momentary attention pulse + optional sound/haptic. This must hit instantly the moment someone passes you.
2. **Current high bid — the hero.** Huge tabular number, **"Одоогийн үнэ"**. On change: smooth count-up animation + brief highlight pulse. Show the (anonymized) bidder, e.g. **"Оролцогч #7"** (pseudonymous for privacy).
3. **Countdown timer — prominent.** Large `MM:SS`, color shifts green → amber → red as it nears zero. **Anti-snipe extension** must be visually loud: when a late bid extends the clock, flash **"Хугацаа сунгагдлаа +30 сек"** and animate the timer jumping up — so users learn it can't be sniped.
4. **Quick-bid controls.** The increment band as **step buttons +1 … +5** (step = 10% of reserve; +5 = the 50% max). Each button shows the **resulting price**, not just the delta (e.g. "+530,000 → ₮5,830,000"). Big tap targets; the minimum (+1) is the default/primary. Disable any step the user **can't afford** given available balance, with a tooltip why. Single tap places the bid (fast); show a brief, cancelable confirmation only if you can keep it under ~1s — prioritize speed but guard against fat-fingers (e.g. press-and-flash, or undo toast).
5. **Available balance, always visible.** **"Боломжит үлдэгдэл: ₮X"** updating live as holds change; subtle warning as it gets tight.
6. **Live bid feed — the "pow pow."** A vertical ticker, newest on top, each new bid **sliding in** with a highlight: bidder + amount + "just now". Caps visible history; feels like a live heartbeat of the room. Your own bids highlighted distinctly.
7. **Connection status.** A small live/reconnecting indicator — in real-time bidding, users must trust the feed is live. Show "Холбогдож байна…" on reconnect and clearly pause bidding controls if disconnected.
8. **Spectator/activity count.** e.g. **"247 хүн үзэж байна"** — social proof + liveliness.
9. **Lot context strip** — image, code, reserve, your current relationship to the lot — compact, doesn't steal focus.

**Interaction principles:** zero ambiguity about (a) am I winning?, (b) how much time?, (c) what will my next tap cost?, (d) can I afford it? Everything else is secondary. Updates must feel **instant** and **physical** (motion + optional sound/haptics, all user-toggleable).

---

## 5. Keyboard shortcuts (live bidding)

Design an on-canvas hint and a **`?` overlay** listing them:
- **`1`–`5`** → place a bid of +N steps (with the same affordability rules).
- **`Enter` / `Space`** → place the minimum legal bid (+1 step) — the fast default.
- **`Esc`** → cancel a pending/confirming bid.
- **`W`** → toggle watch.
- **`M`** → mute/unmute sound cues.
- **`?`** → show/hide shortcut overlay.
Show subtle key hints on the step buttons themselves (e.g. a small "1" on the +1 button). Ensure shortcuts never fire while typing in an input.

---

## 6. First-time guided tour (onboarding)

A polished **spotlight/coachmark walkthrough**: dims the page, highlights one element at a time with a tooltip card (title, short explanation, **Next / Back / Skip**, progress dots). Persist "seen" state; make it re-launchable from **Help**. Two distinct tours:

**A. App tour (after first login):**
1. Categories/species rail → "Browse by animal."
2. A lot card → "Status, price, and countdown at a glance."
3. Balance → "Your bidding limit and how holds work."
4. Notifications → "We'll tell you the moment you're outbid."
5. Help → "Replay this tour anytime."

**B. Live-room tour (first time they enter a live auction) — the important one:**
1. Your-status banner → "This tells you instantly if you're winning or outbid."
2. Current high + timer → "The price and the clock. The clock can extend if someone bids late, so sniping won't work."
3. Quick-bid step buttons → "Tap to raise. Each button shows exactly what you'll pay."
4. Available balance → "You can't bid more than this; outbids return your held amount."
5. Keyboard shortcuts hint → "Power users: press 1–5 or Enter to bid fast. Press ? anytime."
Offer a **risk-free practice bid** in a sandbox lot so they learn the mechanics before real money is on the line.

---

## 7. States & polish (design for all of these)

- **Loading:** skeletons (not spinners) for catalog, lot, ledger.
- **Empty:** friendly empty states (no active auctions, no notifications, no bids yet).
- **Disabled/gated:** KYC pending → bidding disabled with a clear "why" and a link to status.
- **Errors:** bid rejected (too low / over your limit / lot ended) → concise inline reasons in Mongolian; network reconnect.
- **Confirmation & success:** toasts for bid placed / outbid / won.
- **Microcopy:** warm, plain Mongolian; no jargon; explain money rules in human terms.

---

## 8. Sample Mongolian strings (use/refine)

| Context | String |
|---|---|
| Register | Бүртгүүлэх |
| Log in | Нэвтрэх |
| Individual / Legal entity | Иргэн / Хуулийн этгээд |
| Current price | Одоогийн үнэ |
| Time remaining | Үлдсэн хугацаа |
| Place / raise bid | Үнэ нэмэх |
| You're leading | Та тэргүүлж байна |
| You've been outbid! | Таны саналыг давсан! |
| Available balance | Боломжит үлдэгдэл |
| Notifications | Мэдэгдэл |
| Extended +30s | Хугацаа сунгагдлаа +30 сек |
| Watching | Ажиглаж байна |
| N people watching | N хүн үзэж байна |

---

## 9. Deliverables requested from the design tool

1. Design tokens + component library (light theme; optional focused dark "arena" for the live room).
2. Key screens (desktop + mobile): Catalog, Lot detail, **Live bidding room**, Balance/ledger, Notifications, Register/KYC, plus the admin Live monitor.
3. The two guided-tour flows as overlay states.
4. The keyboard-shortcut overlay.
5. Empty/loading/error/disabled states for the core screens.
