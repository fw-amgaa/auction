# Handoff: Wildlife Permit Auction Platform (Агнуурын эрх)

## Overview
An official Mongolian government **real-time auction platform** for wildlife-hunting permits.
Citizens (Иргэн) and legal entities (Хуулийн этгээд) register, pass KYC, receive a bidding
limit, and bid on permits (argali/Угалз, ibex/Тэх, wolf/Чоно, fish/Загас, etc.) in live
auctions. Admins manage KYC, limits, lots, and watch a live monitor.

**Primary language: Mongolian (Cyrillic).** All UI strings are Mongolian; English here is for
the developer only.

## About the Design Files
The bundled `*.dc.html` files are **design references created in HTML** — prototypes showing
the intended look and behavior. They are **not** production code to copy directly. The task is
to **recreate these designs in the target codebase's existing environment** (React, Vue,
SwiftUI, native, etc.) using its established components, routing, and data layer. If no
environment exists yet, choose an appropriate framework (the prototypes map cleanly to a React
+ component-library setup) and implement there.

The `.dc.html` format is a lightweight prototyping runtime (`support.js`): markup between
`<x-dc>` tags with `{{ }}` interpolation, plus a `class Component extends DCLogic` that exposes
values via `renderVals()`. Treat the markup as the visual/structural reference and the
`renderVals()`/state logic as the behavioral reference. Drop `support.js` and the wrapper when
porting.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, copy, and interactions are all specified.
Recreate the UI pixel-faithfully using the codebase's libraries. Styling in the prototypes is
inline; the exact values are listed under Design Tokens.

## Screens / Views

### Public / auth
- **Landing.dc.html** — Marketing front door. Sticky translucent header (logo + Нэвтрэх/Login,
  Бүртгүүлэх/Register). Dark navy hero: eyebrow badge, headline, stat row (8 species / 24 lots /
  1,240+ users), and a live-auction preview card. "How it works" 4-step grid; upcoming-auction
  card grid; navy trust-signals band; crimson CTA band; footer.
- **Login.dc.html** — Split layout: left dark brand panel (logo on white chip, headline, trust
  chips), right form. Three views in one component: **login** (registry/email + password with
  show/hide, error state), **OTP** (4-cell code, auto-fill demo, resend countdown), **recover**
  (email → "link sent" success). View state machine in the logic class.
- **Register.dc.html** — 4-step KYC wizard with left progress rail. Step 1 account-type cards
  (Иргэн vs Хуулийн этгээд); Step 2 fields **switch by type**; Step 3 drag-drop document upload
  with image/PDF preview + remove; Step 4 review (with edit jump-back) + **versioned T&C**
  checkbox (v2.3 · 2026-01). Step 5 success. Inline validation (required/email/phone), crimson
  Next disabled until valid.

### Authenticated app (shared AppNav)
- **AppNav.dc.html** — Sticky top nav: logo, links (Каталог · Миний санал · Үлдэгдэл · Мэдэгдэл
  · Тусламж), balance pill, notification bell w/ unread badge, avatar. **Mobile (≤760px):**
  desktop links + balance text hide; a fixed **bottom tab bar** (icons + labels) appears; body
  gets bottom padding. Props: `active`, `balance`, `notif`, `user`.
- **Catalog.dc.html** — Hub. Species icon rail (8 species + Бүгд), search + aimag + status +
  sort bar, responsive lot-card grid (auto-fill minmax 290px). Cards: striped image placeholder,
  code (e.g. `Угалз:U9`), status badge (LIVE pulses crimson / UPCOMING / ENDED), reserve or
  current price, live countdown (crimson under 5 min), watch star, CTA. Live cards have a pulsing
  ring. Empty state. **Hosts the app guided tour** (see below).
- **Lot Detail.dc.html** — Gallery + thumbnails, info facts grid, **increment-band explainer**
  (step = 10% of reserve; shows +1…+5 resulting prices), bid-history preview, sticky right
  action panel (current price, live countdown, "enter live room" CTA, green eligibility banner,
  schedule).
- **Live Bidding Room.dc.html** ⭐ — The centerpiece. **Dark arena** (`#070B14`). In priority
  order: (1) status banner — Winning green "Та тэргүүлж байна" / Outbid red "Таны саналыг
  давсан!" with shake + sound; (2) current-high hero with animated count-up + anonymized leader
  (#7); (3) countdown MM:SS green→amber→red — the end time is fixed;
  (4) quick-bid +1…+5 buttons showing resulting price, disabled when unaffordable/while leading,
  with key hints; single tap bids w/ 5s undo toast; (5) always-visible available balance;
  (6) live bid feed ticker (slide-in, your bids highlighted); (7) connection status
  (live/reconnecting pauses bidding); (8) spectator count; (9) compact lot context strip.
  Keyboard shortcuts + `?` overlay. Live-room guided tour. Practice mode. Ended overlay
  (won/lost). Simulated rival bids drive the demo. Props: `reservePrice`, `creditLimit`,
  `startSeconds`, `spectatorsStart`, `soundDefault`.
- **MyBids.dc.html** — Tabs: Active / Won / Lost / Watching, with status badges and rows linking
  to the arena or lot.
- **Balance.dc.html** — Available/committed/limit summary (dark hero for available), usage bar,
  holds explainer ("bidding holds it, outbid returns it, winning keeps it"), filterable ledger
  timeline (issued/raised/holds/releases/consumptions).
- **Notifications.dc.html** — Day-grouped feed, all brief types (outbid, bid, extended, starting,
  won, lost, limit, kyc) with distinct icons, unread dots, type filters, mark-all-read.
- **Profile.dc.html** — Identity, inline-editable info (verified fields locked), documents, KYC
  verification timeline, balance shortcut.
- **Help.dc.html** — Two tour-replay cards (app tour relaunch + live-room), "how money works",
  FAQ accordion, contact, Terms link.
- **Terms.dc.html** — Versioned T&C (v2.3) with sticky TOC, 6 numbered sections, version history.

### Admin (shared AdminNav — dark sidebar, denser data-grid aesthetic)
- **AdminNav.dc.html** — Dark sidebar: logo on white chip, nav (Шууд хяналт, KYC хүсэлт,
  Хэрэглэгчид, Лимит, Лот, Үр дүн, Аудит), admin identity, logout. Props: `active`, `admin`.
- **Admin Live Monitor.dc.html** — Real-time KPI strip, live-auctions table with sparklines +
  ticking prices, focus panel with velocity chart + recent bids. Self-driving simulation.
- **Admin KYC.dc.html** — Queue list/detail split, info grid, document viewer modal,
  approve / reject-with-reason (reason chips), pending/approved/rejected tabs.
- **Admin Users.dc.html** — Searchable/filterable/sortable user table; loading **skeleton**,
  no-results empty state; KYC badges; row ⋯ menu (approve / adjust limit / reset credentials).
- **Admin Create User.dc.html** — Full-page form; type toggle swaps field sets; doc upload;
  dark **admin-only options** (pre-approve KYC + initial limit); credentials radio (email invite
  vs temp password); inline validation + **live duplicate detection**; submitting → success.
- **Admin User Detail.dc.html** — Identity, inline-edit info, documents, activity timeline,
  limit summary, quick actions.
- **Admin Limits.dc.html** — User table + manage modal (raise/lower/offline-refund) w/ audit
  history.
- **Admin Lots.dc.html** — Create/edit/schedule/cancel modal with increment-band calc; status
  tabs.
- **Admin Results.dc.html** — Winner list, payment status, permit generation, CSV/report export.
- **Admin Audit.dc.html** — Searchable, category-filtered action log.

## Interactions & Behavior
- **Live bidding** (`Live Bidding Room.dc.html`): step = 10% of reserve; bid = current + N×step;
  affordability gated by `creditLimit − hold`; placing a bid holds the amount, being outbid
  releases it. The end time is fixed — a late bid never extends the clock.
  Count-up animation ~460ms ease-out; reduced-motion respected. Rivals bid on a 4–10s random
  timer (weighted so the user can still win). Single tap bids; 5s undo toast (or `Esc`).
  Connection blips to "reconnecting" every ~34s and pauses controls for ~2.6s.
- **Guided tours:** spotlight cutout via `box-shadow: 0 0 0 9999px rgba(...)` over the target's
  `getBoundingClientRect()`; tooltip with progress dots + Back/Next/Skip; recompute on resize.
  App tour anchors: `[data-tour="species"]`, `[data-tour="lots"] > :first-child`,
  `[data-tour="balance"]`, `[data-tour="notifications"]`, `a[href="Help.dc.html"]`.
- **Forms:** required + email (`.+@.+\..+`) + phone (≥8 digits); drag-drop sets a drop-hover
  state; duplicate detection matches against a known registry/email set.
- **Toasts:** success/danger/warn/info palettes; auto-dismiss ~3.6s (5s when undoable).
- **Animations** (`@keyframes` in each `<helmet>`): feedIn (slide), winPulse, outbidPulse
  (shake), priceFlash, extendPop, livedot (pulse), toastIn, badgeFloat, shimmer (skeleton),
  cardLiveRing. All wrapped by `@media (prefers-reduced-motion: reduce)`.
- **Responsive:** desktop-first; AppNav has a real mobile bottom-tab treatment ≤760px; card
  grids and flex rows wrap to single column on phones.

## State Management
Per-screen local state (React-class style) in each file's `Component`. Key shapes:
- Live room: `price, displayPrice, leader, hold, timeLeft, barMax, feed[], conn, soundOn,
  watching, ended, result, toasts[], tour, showShortcuts, practice`.
- Catalog: filters (`species,status,sort,q,aimag`), `watch{}`, `lots[]`, plus tour
  (`tour, spot, vw, vh`).
- Wizards/admin modals: step index, per-type field objects, `docs{}`, decision/edit drafts.
Persisted in localStorage: `wpa_live_tour`, `wpa_app_tour` (tour "seen" flags). In production,
replace the simulated rival-bid timers and self-driving monitor with your realtime backend
(WebSocket) feed; replace localStorage tour flags with user prefs.

## Design Tokens
**Color**
- Navy (authority): `#14294A`, deep `#0E1E38`, arena bg `#070B14`, arena panel `#0E1729`
- Action / live / urgency: crimson `#C8312C` (hover `#B12A26`), arena accent `#E63950`/`#FF5268`
- Background: sand `#F5F2EC`, card `#FFFFFF`, admin bg `#EEF1F5`, borders `#E6E1D6` / `#E1E5EC`
- Accent / logo: gold `#E7B24B`
- Status: success `#1F8A5B` (arena `#2BD07A`), amber `#C77A0A` / `#FFB02E`, danger `#C8312C` /
  arena `#FF5A5F`
- Text: primary `#14294A`/`#1A2436`, secondary `#5B6677`, muted `#8A93A3`/`#A2AAB6`

**Typography**
- Family: `IBM Plex Sans` (UI, full Cyrillic), `IBM Plex Mono` (all numbers — use
  `font-variant-numeric: tabular-nums`).
- Scale (px): page H1 28, section 18–24, card title 14–17, body 13.5–14, label 11–12.5,
  micro 10–11. Hero price 34–56, timer 40–60. Weights 400/500/600/700.

**Spacing / radius / shadow**
- Spacing rhythm: 4 / 6 / 9 / 12–14 / 18 / 22 / 26px.
- Radius: inputs/buttons 8–11, cards 12–16, pills 20, avatars 50%.
- Shadow: card `0 1px 3px rgba(20,41,74,.08)`; raised `0 2px 8px rgba(20,41,74,.06)`;
  overlay `0 24px 60px rgba(...)`.

**Currency**: `Math.round(n).toLocaleString('en-US') + '₮'` → `5,300,000₮`.

## Assets
- `assets/logo.png` — official wordmark (argali mark + "АН АГНУУРИЙН ҮНИЙН САНАЛ ДУУДАХ СИСТЕМ").
  White background already removed to transparency. On dark surfaces (AdminNav, Login) it's
  placed on a white rounded chip.
- Wildlife imagery is **striped CSS placeholders** with species labels — swap in real licensed
  photos (argali, ibex, wolf, ibex, taimen, falcon, boar, sable). Icons are inline SVG
  (no icon-font dependency).

## Files
All screens listed above live at the project root as `*.dc.html`. Shared chrome: `AppNav.dc.html`,
`AdminNav.dc.html`. Runtime: `support.js` (prototype-only — discard on port). Brand: `assets/logo.png`.
Project context for Claude Code: `CLAUDE.md` at the repo root.
