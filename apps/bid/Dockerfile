# Bid WebSocket service — runs the existing tsx entrypoint.
# Build context is the REPO ROOT (see infra/docker-compose.prod.yml).
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/
COPY apps/web/package.json apps/web/
COPY apps/bid/package.json apps/bid/
RUN pnpm install --frozen-lockfile

FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /repo /repo
COPY . .
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /repo
USER app
EXPOSE 8080
CMD ["pnpm", "--filter", "@auction/bid", "start"]
