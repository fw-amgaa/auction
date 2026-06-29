# Next.js web app — multi-stage standalone build for the pnpm/turbo monorepo.
# Build context is the REPO ROOT (see infra/docker-compose.prod.yml).
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

# ---- deps: install once against the lockfile (cached unless manifests change) ----
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/
COPY apps/web/package.json apps/web/
COPY apps/bid/package.json apps/bid/
RUN pnpm install --frozen-lockfile

# ---- build: produce .next/standalone ----
FROM base AS build
COPY --from=deps /repo /repo
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# DB isn't needed at build time: pages are force-dynamic and postgres connects lazily.
RUN pnpm --filter @auction/web build

# ---- runtime: minimal standalone server ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
USER app
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
