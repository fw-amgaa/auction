#!/usr/bin/env bash
# Runs ON the EC2 box (Amazon Linux 2023, arm64) with the repo synced to ~/auction.
# Installs runtime deps, pulls secrets, migrates + seeds the DB, and starts the stack.
#
#   DOMAIN=auction.yourdomain.mn REGION=ap-southeast-1 bash infra/bootstrap.sh
set -euo pipefail

DOMAIN="${DOMAIN:?export DOMAIN=auction.yourdomain.mn}"
REGION="${REGION:-ap-southeast-1}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

# ---- system packages (idempotent) ----
if ! command -v docker >/dev/null; then
  sudo dnf -y install docker git
  sudo systemctl enable --now docker
  sudo usermod -aG docker ec2-user || true
fi
if ! docker compose version >/dev/null 2>&1; then
  sudo mkdir -p /usr/libexec/docker/cli-plugins
  sudo curl -sL "https://github.com/docker/compose/releases/download/v2.32.4/docker-compose-linux-$(uname -m)" \
    -o /usr/libexec/docker/cli-plugins/docker-compose
  sudo chmod +x /usr/libexec/docker/cli-plugins/docker-compose
fi
if ! command -v node >/dev/null; then
  curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
  sudo dnf -y install nodejs
fi
sudo corepack enable || true

# ---- swap: t4g.micro has only 1GB RAM; `next build` + the stack need headroom ----
if [ ! -f /swapfile ]; then
  sudo dd if=/dev/zero of=/swapfile bs=1M count=4096 status=none
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile >/dev/null
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

# ---- secrets -> .env, with the domain filled in ----
bash infra/secrets-to-env.sh auction/prod "$REGION"
sed -i "s/REPLACE_DOMAIN/$DOMAIN/g" .env
# WS_PUBLIC_URL must be a plain (non-NEXT_PUBLIC_) runtime var — see lib/ws-ticket.ts
grep -q '^WS_PUBLIC_URL=' .env || echo "WS_PUBLIC_URL=wss://$DOMAIN/ws" >> .env

# ---- DB migrate + seed (host -> RDS, via .env) ----
# Migrations are idempotent. Seeding is NOT re-run on redeploys (SKIP_SEED=1),
# since the demo seed resets lot state and would disrupt a live auction.
pnpm install --frozen-lockfile
pnpm db:migrate
[ "${SKIP_SEED:-}" = "1" ] || pnpm db:seed

# ---- run the stack ----
sudo -E DOMAIN="$DOMAIN" docker compose -f infra/docker-compose.prod.yml up -d --build
echo "Stack is up. Browse https://$DOMAIN once DNS points here (Caddy will fetch TLS)."
