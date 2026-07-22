# Ops Runbook — Seasonal Single-EC2 Deployment

See ARCHITECTURE.md §11. This system is **seasonal**: live for ~2 months, idle the rest of
the year. The whole point is to pay almost nothing off-season.

## Box layout
One EC2 (Graviton `t4g`) running `docker compose`: `caddy`, `web`, `bid`, `redis`.
**Postgres is managed (RDS, Multi-AZ)** — the money data (balances/holds/bids) lives there for
automated failover + point-in-time recovery, not on the box's disk. Redis stays on the box (it's
pub/sub + live arbitration state, rehydrated from Postgres on restart via `engine.ts:ensureLot`).

## First-time production deploy
Config/secrets live in **AWS Secrets Manager** (`auction/prod`, region `ap-southeast-1`), pulled
to a root `.env` on the box by `infra/secrets-to-env.sh` using the EC2 instance IAM role.

```
# 1) provision infra (IAM, security groups, RDS Multi-AZ, EC2 + Elastic IP).
#    Writes the RDS endpoint back into the secret. Records IDs to infra/.aws-resources.
bash infra/provision-aws.sh

# 2) point your domain's DNS A record at the printed Elastic IP.

# 3) sync code to the box + bootstrap (installs docker/node, migrate, seed, compose up).
DOMAIN=auction.yourdomain.mn bash infra/deploy.sh
```
Redeploys after code changes: re-run step 3 (`DOMAIN=… bash infra/deploy.sh`).
SES must be out of sandbox + the sender verified for real password emails (else they log to the
container console — see `lib/email.ts`).

## Seasonal lifecycle
> Step-by-step operator guide in Mongolian: **`infra/RUNBOOK-mn.md`**.

1. **Off-season:** EC2 **STOPPED** — no compute bill, but you still pay for the EBS volume, the
   Elastic IP, **and RDS**. RDS is the dominant off-season cost, so stopping only EC2 saves
   little. For a gap longer than a week, snapshot `auction-pg` and **delete the instance**:
   a stopped RDS instance is auto-started by AWS after 7 days. See `RUNBOOK-mn.md` §4.2/§5.
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
