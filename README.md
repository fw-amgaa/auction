# Ан агнуур — Real-Time Wildlife-Permit Auction Platform

Official Mongolian government real-time auction platform for wildlife-hunting permits.

- **Requirements:** [`PLAN.md`](./PLAN.md)
- **Architecture:** [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- **Design spec:** [`DESIGN_PROMPT.md`](./DESIGN_PROMPT.md) + design references in `design/`

## Stack
TypeScript monorepo (pnpm + Turborepo): **Next.js** web app, dedicated **Node WebSocket** bid
service, **Postgres** (record) + **Redis** (hot path). See ARCHITECTURE.md.

## Layout
```
apps/web      Next.js (App Router) — site, user app, admin
apps/bid      Node WebSocket bid service (+ scheduler)
packages/db   Drizzle schema, client, migrations, seed
packages/shared  bid math, Zod schemas, WS contracts, currency
packages/ui   shared React components (ported from design)
infra/        docker-compose, Caddyfile, runbook
design/       .dc.html design references (do not ship)
```

## Local development
Prereqs: Node 22+, pnpm 10+, Docker.

```bash
pnpm install                    # install workspace deps
cp .env.example .env            # then edit if needed
pnpm infra:up                   # start Postgres + Redis (docker)
pnpm db:generate                # generate SQL migration from schema
pnpm db:migrate                 # apply migrations
pnpm db:seed                    # seed species categories + terms
pnpm dev                        # run web (:3000) + bid service (:8080)
```

- Web: http://localhost:3000  (landing) · `/catalog` · `/admin`
- Bid service health: http://localhost:8080/health

## Build order
Phased plan in ARCHITECTURE.md §12. **Phase 0 (this scaffold)** is complete: monorepo, schema,
shared contracts, infra, and the app shell with the design system. Next: **Phase 1 — auth &
accounts**.
