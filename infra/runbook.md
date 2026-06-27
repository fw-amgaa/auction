# Ops Runbook — Seasonal Single-EC2 Deployment

See ARCHITECTURE.md §11. This system is **seasonal**: live for ~2 months, idle the rest of
the year. The whole point is to pay almost nothing off-season.

## Box layout
One EC2 (Graviton `t4g`) running `docker compose`: `caddy`, `web`, `bid`, `postgres`, `redis`.

## Seasonal lifecycle
1. **Off-season:** EC2 **STOPPED**. You pay only for the EBS volume (a few $/yr). No compute bill.
2. **Pre-season (registration weeks):** start a small instance (e.g. `t4g.small`).
3. **Auction day:** the morning before, **resize up** (e.g. `t4g.large`/`xlarge`) for headroom —
   EC2 bills hourly, so a big box for a day is a few dollars. Take an EBS snapshot first.
4. **After the event:** resize back down, then **STOP** the instance for the off-season.

## Resize procedure (stop → change type → start)
```
aws ec2 stop-instances --instance-ids <id>
aws ec2 wait instance-stopped --instance-ids <id>
aws ec2 modify-instance-attribute --instance-id <id> --instance-type t4g.large
aws ec2 start-instances --instance-ids <id>
```

## Backups
- **Before each event:** EBS snapshot of the box.
- **Nightly during the season:** `pg_dump` to S3 (see cron below). Pennies.
```
docker compose -f infra/docker-compose.yml exec -T postgres \
  pg_dump -U auction auction | gzip | aws s3 cp - s3://<bucket>/backups/$(date +%F).sql.gz
```

## MANDATORY before the real auction
Load-test the chosen instance size against **1000 concurrent WebSocket clients bidding on one
lot**. Confirm bid latency, correctness (no double-winner, holds balance out), and that the box
holds. Find the ceiling in a test, never at 09:00 on auction day.

## Start / stop the app on the box
```
pnpm infra:up      # bring up postgres + redis (dev) — prod compose adds web/bid/caddy
pnpm db:migrate    # apply migrations
pnpm db:seed       # seed categories + terms (first run only)
```
