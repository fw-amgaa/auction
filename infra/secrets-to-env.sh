#!/usr/bin/env bash
# Pull the production secret from AWS Secrets Manager and write it to the
# repo-root .env that docker-compose.prod.yml reads. Run on the EC2 box, which
# authenticates via its instance IAM role (no static keys needed).
#
# Usage: infra/secrets-to-env.sh [secret-name] [region]
set -euo pipefail

SECRET_NAME="${1:-auction/prod}"
REGION="${2:-ap-southeast-1}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$HERE/.env"

echo "Fetching $SECRET_NAME from Secrets Manager ($REGION)…"
JSON="$(aws secretsmanager get-secret-value --secret-id "$SECRET_NAME" --region "$REGION" --query SecretString --output text)"

# Flatten the JSON object into KEY=VALUE lines.
printf '%s' "$JSON" | python3 -c '
import json, sys
data = json.load(sys.stdin)
for k, v in data.items():
    print(f"{k}={v}")
' > "$OUT"

chmod 600 "$OUT"
echo "Wrote $(grep -c = "$OUT") keys to $OUT"
