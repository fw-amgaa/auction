# Wildlife Permit Auction Platform — Project Context

## What this is
A **design prototype** for an official government real-time auction web app for Mongolian
wildlife-hunting permits (argali/Угалз, ibex/Тэх, wolf/Чоно, etc.). Primary language is
**Mongolian (Cyrillic)**. The goal: calm and authoritative for browsing/registration, but
fast, legible, and "electric" during live bidding.

These files are **design references**, not production code. They are HTML prototypes that show
intended look and behavior. To ship this, **recreate these designs in your target codebase's
own environment** (React/Vue/SwiftUI/etc.) using its established patterns — do not ship the
`.dc.html` files directly. See `design_handoff_wildlife_auction/README.md` for the full spec.

## File format — "Design Components" (.dc.html)
Each `*.dc.html` is a self-contained component that opens directly in a browser. Structure:
- A `<template>`-like markup body between `<x-dc>…</x-dc>`.
- A `<script data-dc-script>` containing `class Component extends DCLogic { renderVals(){…} }`
  (a React-class-like API: `state`, `setState`, lifecycle; `renderVals()` returns the values
  the markup interpolates via `{{ path }}` holes).
- `support.js` is the tiny runtime that renders them. It is NOT application code — when you
  port to a real framework you can drop `support.js` and the `.dc.html` wrapper entirely and
  keep the markup + logic as your component reference.
- Styling is **inline** throughout (no stylesheets), except a few `@keyframes`/`@media` blocks
  in each file's `<helmet><style>`.

## Design system (tokens in the handoff README)
- Type: **IBM Plex Sans** (full Cyrillic) + **IBM Plex Mono** for all numbers/prices/timers
  (tabular figures so digits don't jiggle). Headings on Landing/Terms use IBM Plex Sans bold.
- Color: deep navy `#14294A` / `#0E1E38` (authority), crimson `#C8312C` (primary action +
  live/urgency), warm sand `#F5F2EC` (app background), gold `#E7B24B` (logo/accent).
  Status: green `#1F8A5B` (winning/approved), amber `#C77A0A`/`#FFB02E` (attention/timer),
  danger red. The **live bidding room is a dark "arena"** (`#070B14`) — the only dark app screen.
- Currency format: symbol-last with thousands separators, e.g. `5,300,000₮`.
- Never rely on color alone — status always pairs color + icon + text.

## Two guided tours + keyboard shortcuts
- Live-room tour: 5 coachmarks (in `Live Bidding Room.dc.html`), localStorage key `wpa_live_tour`.
- App tour: 5 coachmarks (in `Catalog.dc.html`), key `wpa_app_tour`, re-launchable via
  `Catalog.dc.html?tour=1` and from Help. Anchored by `data-tour="…"` attributes.
- Live-room keyboard: `1`–`5` bid +N steps, `Enter`/`Space` = +1, `Esc` cancel, `W` watch,
  `M` mute, `?` overlay. Shortcuts never fire while typing in inputs.

## Logo
`assets/logo.png` (white background already knocked out to transparency). Used in AppNav,
AdminNav (on a white chip over the dark sidebar), Login, Register, Landing.

## Entry points
- Public: `Landing.dc.html` → `Login.dc.html` / `Register.dc.html`
- User app (shared `AppNav`): `Catalog` → `Lot Detail` → `Live Bidding Room`; `MyBids`,
  `Balance`, `Notifications`, `Profile`, `Help`, `Terms`.
- Admin (shared `AdminNav`): `Admin Live Monitor`, `Admin KYC`, `Admin Users` →
  `Admin Create User` / `Admin User Detail`, `Admin Limits`, `Admin Lots`, `Admin Results`,
  `Admin Audit`.
