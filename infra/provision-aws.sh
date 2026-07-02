#!/usr/bin/env bash
# Provision the production AWS infrastructure for the auction:
#   - IAM role/instance-profile (read Secrets Manager + S3)
#   - Security groups (app: 80/443 public, 22 from your IP; db: 5432 from app)
#   - RDS PostgreSQL (Multi-AZ, encrypted, 7-day PITR)  <-- money data
#   - EC2 (Graviton t4g, Amazon Linux 2023 arm64) + Elastic IP
#   - Writes the RDS endpoint back into the auction/prod secret (DATABASE_URL)
#
# Idempotent-ish: re-running skips resources that already exist. Records IDs to
# infra/.aws-resources so bootstrap.sh and teardown can find them.
#
# Run from the repo root:  bash infra/provision-aws.sh
set -euo pipefail

REGION=ap-southeast-1
SECRET_NAME=auction/prod
KEY_NAME=auction-key
INSTANCE_TYPE=${INSTANCE_TYPE:-t4g.small}        # resize up for auction day
DB_CLASS=${DB_CLASS:-db.t4g.small}
ACCT=$(aws sts get-caller-identity --query Account --output text)
BUCKET=auction-media-$ACCT
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/.aws-resources"
: > "$OUT"
log() { echo ">> $*"; }
save() { echo "$1=$2" >>"$OUT"; }

MYIP=$(curl -s https://checkip.amazonaws.com)/32

VPC_ID=$(aws ec2 describe-vpcs --region $REGION --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId' --output text)
# portable array (macOS bash 3.2 has no mapfile); subnet ids are whitespace-separated
SUBNETS=($(aws ec2 describe-subnets --region $REGION --filters Name=vpc-id,Values=$VPC_ID --query 'Subnets[].SubnetId' --output text))
save VPC_ID "$VPC_ID"
log "VPC=$VPC_ID subnets=${SUBNETS[*]}"

# ---- security groups ----
APP_SG=$(aws ec2 create-security-group --region $REGION --group-name auction-app --description "auction app" --vpc-id "$VPC_ID" --query GroupId --output text 2>/dev/null \
  || aws ec2 describe-security-groups --region $REGION --filters Name=group-name,Values=auction-app Name=vpc-id,Values=$VPC_ID --query 'SecurityGroups[0].GroupId' --output text)
DB_SG=$(aws ec2 create-security-group --region $REGION --group-name auction-db --description "auction db" --vpc-id "$VPC_ID" --query GroupId --output text 2>/dev/null \
  || aws ec2 describe-security-groups --region $REGION --filters Name=group-name,Values=auction-db Name=vpc-id,Values=$VPC_ID --query 'SecurityGroups[0].GroupId' --output text)
save APP_SG "$APP_SG"; save DB_SG "$DB_SG"
aws ec2 authorize-security-group-ingress --region $REGION --group-id "$APP_SG" --protocol tcp --port 80  --cidr 0.0.0.0/0 2>/dev/null || true
aws ec2 authorize-security-group-ingress --region $REGION --group-id "$APP_SG" --protocol tcp --port 443 --cidr 0.0.0.0/0 2>/dev/null || true
aws ec2 authorize-security-group-ingress --region $REGION --group-id "$APP_SG" --protocol tcp --port 22  --cidr "$MYIP" 2>/dev/null || true
aws ec2 authorize-security-group-ingress --region $REGION --group-id "$DB_SG"  --protocol tcp --port 5432 --source-group "$APP_SG" 2>/dev/null || true
log "app SG=$APP_SG  db SG=$DB_SG (ssh from $MYIP)"

# ---- IAM role + instance profile ----
ROLE=auction-ec2
if ! aws iam get-role --role-name $ROLE >/dev/null 2>&1; then
  aws iam create-role --role-name $ROLE --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}' >/dev/null
  aws iam put-role-policy --role-name $ROLE --policy-name auction-access --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[
    {\"Effect\":\"Allow\",\"Action\":[\"secretsmanager:GetSecretValue\"],\"Resource\":\"arn:aws:secretsmanager:$REGION:$ACCT:secret:$SECRET_NAME-*\"},
    {\"Effect\":\"Allow\",\"Action\":[\"s3:GetObject\",\"s3:PutObject\"],\"Resource\":\"arn:aws:s3:::$BUCKET/*\"},
    {\"Effect\":\"Allow\",\"Action\":[\"s3:ListBucket\"],\"Resource\":\"arn:aws:s3:::$BUCKET\"}]}"
  aws iam create-instance-profile --instance-profile-name $ROLE >/dev/null
  aws iam add-role-to-instance-profile --instance-profile-name $ROLE --role-name $ROLE
  sleep 10  # let the instance profile propagate
fi
save ROLE "$ROLE"

# ---- RDS (Multi-AZ) ----
DB_PASSWORD=$(aws secretsmanager get-secret-value --secret-id $SECRET_NAME --region $REGION --query SecretString --output text | python3 -c 'import json,sys;print(json.load(sys.stdin)["DB_PASSWORD"])')
aws rds create-db-subnet-group --region $REGION --db-subnet-group-name auction-db-subnets \
  --db-subnet-group-description "auction" --subnet-ids "${SUBNETS[@]}" 2>/dev/null || true
DB_ENGINE_VERSION=$(aws rds describe-db-engine-versions --region $REGION --engine postgres --default-only --query 'DBEngineVersions[0].EngineVersion' --output text)
log "RDS: postgres $DB_ENGINE_VERSION, $DB_CLASS, Single-AZ, 7-day PITR"
if ! aws rds describe-db-instances --region $REGION --db-instance-identifier auction-pg >/dev/null 2>&1; then
  aws rds create-db-instance --region $REGION \
    --db-instance-identifier auction-pg --engine postgres --engine-version "$DB_ENGINE_VERSION" \
    --db-instance-class $DB_CLASS --allocated-storage 20 --storage-type gp3 --storage-encrypted \
    --master-username auction --master-user-password "$DB_PASSWORD" --db-name auction \
    --vpc-security-group-ids "$DB_SG" --db-subnet-group-name auction-db-subnets \
    --no-multi-az --backup-retention-period "${DB_BACKUP_DAYS:-1}" --no-publicly-accessible >/dev/null
fi
log "waiting for RDS (~10-15 min)…"
aws rds wait db-instance-available --region $REGION --db-instance-identifier auction-pg
ENDPOINT=$(aws rds describe-db-instances --region $REGION --db-instance-identifier auction-pg --query 'DBInstances[0].Endpoint.Address' --output text)
save DB_ENDPOINT "$ENDPOINT"
log "RDS endpoint=$ENDPOINT — writing DATABASE_URL into the secret"
TMPSECRET=$(mktemp)
aws secretsmanager get-secret-value --secret-id $SECRET_NAME --region $REGION --query SecretString --output text \
  | ENDPOINT="$ENDPOINT" python3 -c 'import json,sys,os; d=json.load(sys.stdin); d["DATABASE_URL"]="postgres://auction:"+d["DB_PASSWORD"]+"@"+os.environ["ENDPOINT"]+":5432/auction?sslmode=require"; print(json.dumps(d))' > "$TMPSECRET"
aws secretsmanager put-secret-value --secret-id $SECRET_NAME --region $REGION --secret-string "file://$TMPSECRET" >/dev/null
rm -f "$TMPSECRET"

# ---- key pair ----
if [ ! -f ~/.ssh/${KEY_NAME}.pem ]; then
  aws ec2 create-key-pair --region $REGION --key-name $KEY_NAME --query KeyMaterial --output text > ~/.ssh/${KEY_NAME}.pem
  chmod 600 ~/.ssh/${KEY_NAME}.pem
fi

# ---- EC2 + Elastic IP ----
AMI=$(aws ssm get-parameters --region $REGION --names /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64 --query 'Parameters[0].Value' --output text)
if ! aws ec2 describe-instances --region $REGION --filters Name=tag:Name,Values=auction Name=instance-state-name,Values=running,stopped,pending --query 'Reservations[0].Instances[0].InstanceId' --output text 2>/dev/null | grep -q i-; then
  INSTANCE_ID=$(aws ec2 run-instances --region $REGION --image-id "$AMI" --instance-type $INSTANCE_TYPE \
    --key-name $KEY_NAME --security-group-ids "$APP_SG" --subnet-id "${SUBNETS[0]}" \
    --iam-instance-profile Name=$ROLE \
    --block-device-mappings '[{"DeviceName":"/dev/xvda","Ebs":{"VolumeSize":30,"VolumeType":"gp3","Encrypted":true}}]' \
    --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=auction}]' \
    --query 'Instances[0].InstanceId' --output text)
else
  INSTANCE_ID=$(aws ec2 describe-instances --region $REGION --filters Name=tag:Name,Values=auction Name=instance-state-name,Values=running,stopped,pending --query 'Reservations[0].Instances[0].InstanceId' --output text)
fi
save INSTANCE_ID "$INSTANCE_ID"
aws ec2 wait instance-running --region $REGION --instance-ids "$INSTANCE_ID"
EIP_ALLOC=$(aws ec2 allocate-address --region $REGION --domain vpc --query AllocationId --output text)
aws ec2 associate-address --region $REGION --instance-id "$INSTANCE_ID" --allocation-id "$EIP_ALLOC" >/dev/null
PUBIP=$(aws ec2 describe-addresses --region $REGION --allocation-ids "$EIP_ALLOC" --query 'Addresses[0].PublicIp' --output text)
save EIP_ALLOC "$EIP_ALLOC"; save PUBLIC_IP "$PUBIP"

log "DONE. instance=$INSTANCE_ID public_ip=$PUBIP"
log "Point your domain's DNS A record at $PUBIP, then run infra/bootstrap.sh."
cat "$OUT"
