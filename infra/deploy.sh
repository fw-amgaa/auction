#!/usr/bin/env bash
# Run from the repo root on your workstation: sync code to the EC2 box and deploy.
# Reads the instance public IP from infra/.aws-resources (written by provision-aws.sh).
#
#   DOMAIN=auction.yourdomain.mn bash infra/deploy.sh
set -euo pipefail

DOMAIN="${DOMAIN:?export DOMAIN=auction.yourdomain.mn}"
REGION="${REGION:-ap-southeast-1}"
HERE="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$HERE/.aws-resources"
KEY=~/.ssh/auction-key.pem
HOST="ec2-user@${PUBLIC_IP:?missing PUBLIC_IP in .aws-resources}"

echo "waiting for SSH on $PUBLIC_IP …"
for i in $(seq 1 40); do
  ssh -i "$KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=5 "$HOST" true 2>/dev/null && { echo "ssh ready"; break; }
  sleep 5
done

echo "Syncing code to $HOST …"
rsync -az --delete \
  --exclude node_modules --exclude .next --exclude .turbo \
  --exclude infra/data --exclude infra/.aws-resources \
  --exclude .git --exclude .env --exclude .uploads \
  -e "ssh -i $KEY -o StrictHostKeyChecking=accept-new" \
  "$HERE/../" "$HOST:~/auction/"

echo "Running bootstrap on the box …"
ssh -i "$KEY" "$HOST" "cd ~/auction && DOMAIN=$DOMAIN REGION=$REGION bash infra/bootstrap.sh"
