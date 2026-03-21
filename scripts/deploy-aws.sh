#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy-aws.sh — Launch a BankOS t3.small EC2 instance in ap-south-1
#
# Usage:
#   chmod +x scripts/deploy-aws.sh
#   ./scripts/deploy-aws.sh [--key-name bankos-key] [--repo https://...]
#
# Pre-requisites:
#   - AWS CLI v2 installed and configured (aws configure)
#   - The IAM user/role needs: ec2:*, iam:CreateInstanceProfile (optional)
#
# What it does:
#   1. Creates an EC2 key pair and saves the .pem locally
#   2. Creates a security group with SSH (22), HTTP (80), HTTPS (443)
#   3. Resolves the latest Amazon Linux 2023 AMI for ap-south-1
#   4. Launches t3.small with ec2-user-data.sh as the user-data script
#   5. Waits for the instance to reach "running" state
#   6. Prints the public IP and SSH command
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Configurable defaults ─────────────────────────────────────────────────────
REGION="${AWS_REGION:-ap-south-1}"
INSTANCE_TYPE="t3.small"
KEY_NAME="${KEY_NAME:-bankos-key}"
SECURITY_GROUP="${SECURITY_GROUP:-bankos-sg}"
REPO_URL="${REPO_URL:-https://github.com/gs1231231/nbfc500.git}"
VOLUME_SIZE="${VOLUME_SIZE:-20}"   # GB — root EBS volume
PEM_DIR="${PEM_DIR:-$HOME/.ssh}"

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

# ── Parse flags ───────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --key-name)      KEY_NAME="$2";      shift 2 ;;
    --region)        REGION="$2";        shift 2 ;;
    --repo)          REPO_URL="$2";      shift 2 ;;
    --sg)            SECURITY_GROUP="$2"; shift 2 ;;
    --volume-size)   VOLUME_SIZE="$2";   shift 2 ;;
    *) warn "Unknown flag: $1"; shift ;;
  esac
done

PEM_FILE="$PEM_DIR/$KEY_NAME.pem"

# ── Validate AWS CLI ──────────────────────────────────────────────────────────
command -v aws >/dev/null 2>&1 || error "AWS CLI not found. Install from https://aws.amazon.com/cli/"
aws sts get-caller-identity --region "$REGION" >/dev/null 2>&1 \
  || error "AWS credentials not configured. Run: aws configure"

info "Deploying BankOS to $INSTANCE_TYPE in $REGION"
info "Repo: $REPO_URL"

# ── 1. Key pair ───────────────────────────────────────────────────────────────
if aws ec2 describe-key-pairs --key-names "$KEY_NAME" --region "$REGION" \
    --query 'KeyPairs[0].KeyName' --output text 2>/dev/null | grep -q "$KEY_NAME"; then
  warn "Key pair '$KEY_NAME' already exists — skipping creation"
  warn "Ensure you have the .pem at $PEM_FILE"
else
  info "Creating key pair '$KEY_NAME' ..."
  mkdir -p "$PEM_DIR"
  aws ec2 create-key-pair \
    --key-name "$KEY_NAME" \
    --region "$REGION" \
    --query 'KeyMaterial' \
    --output text > "$PEM_FILE"
  chmod 400 "$PEM_FILE"
  info "Key saved to $PEM_FILE"
fi

# ── 2. Security group ─────────────────────────────────────────────────────────
SG_ID=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=$SECURITY_GROUP" \
  --region "$REGION" \
  --query 'SecurityGroups[0].GroupId' \
  --output text 2>/dev/null || true)

if [[ -z "$SG_ID" || "$SG_ID" == "None" ]]; then
  info "Creating security group '$SECURITY_GROUP' ..."
  SG_ID=$(aws ec2 create-security-group \
    --group-name "$SECURITY_GROUP" \
    --description "BankOS production security group" \
    --region "$REGION" \
    --query 'GroupId' \
    --output text)

  # SSH (restrict to your IP in production — using 0.0.0.0/0 for bootstrap)
  aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --region "$REGION" \
    --protocol tcp --port 22   --cidr 0.0.0.0/0
  # HTTP
  aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --region "$REGION" \
    --protocol tcp --port 80   --cidr 0.0.0.0/0
  # HTTPS (for future certbot / SSL termination)
  aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --region "$REGION" \
    --protocol tcp --port 443  --cidr 0.0.0.0/0

  info "Security group created: $SG_ID"
else
  warn "Security group '$SECURITY_GROUP' already exists: $SG_ID"
fi

# ── 3. Resolve latest Amazon Linux 2023 AMI ───────────────────────────────────
info "Resolving latest Amazon Linux 2023 AMI for $REGION ..."
AMI_ID=$(aws ec2 describe-images \
  --owners amazon \
  --filters \
    "Name=name,Values=al2023-ami-2023.*-x86_64" \
    "Name=state,Values=available" \
    "Name=architecture,Values=x86_64" \
  --region "$REGION" \
  --query 'sort_by(Images, &CreationDate)[-1].ImageId' \
  --output text)

[[ -z "$AMI_ID" || "$AMI_ID" == "None" ]] \
  && error "Could not resolve an Amazon Linux 2023 AMI in $REGION"
info "Using AMI: $AMI_ID"

# ── 4. Launch instance ────────────────────────────────────────────────────────
USERDATA_FILE="$(dirname "$0")/ec2-user-data.sh"
[[ -f "$USERDATA_FILE" ]] || error "ec2-user-data.sh not found at $USERDATA_FILE"

info "Launching $INSTANCE_TYPE instance ..."
INSTANCE_ID=$(aws ec2 run-instances \
  --image-id "$AMI_ID" \
  --instance-type "$INSTANCE_TYPE" \
  --key-name "$KEY_NAME" \
  --security-group-ids "$SG_ID" \
  --region "$REGION" \
  --block-device-mappings "[{\"DeviceName\":\"/dev/xvda\",\"Ebs\":{\"VolumeSize\":$VOLUME_SIZE,\"VolumeType\":\"gp3\",\"DeleteOnTermination\":true}}]" \
  --user-data "file://$USERDATA_FILE" \
  --tag-specifications \
    "ResourceType=instance,Tags=[{Key=Name,Value=bankos-prod},{Key=Project,Value=BankOS},{Key=Env,Value=production}]" \
  --metadata-options "HttpTokens=required,HttpEndpoint=enabled" \
  --query 'Instances[0].InstanceId' \
  --output text)

info "Instance launched: $INSTANCE_ID"

# ── 5. Tag and wait ───────────────────────────────────────────────────────────
info "Waiting for instance to reach 'running' state (this takes ~30–60 s) ..."
aws ec2 wait instance-running \
  --instance-ids "$INSTANCE_ID" \
  --region "$REGION"

PUBLIC_IP=$(aws ec2 describe-instances \
  --instance-ids "$INSTANCE_ID" \
  --region "$REGION" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)

PUBLIC_DNS=$(aws ec2 describe-instances \
  --instance-ids "$INSTANCE_ID" \
  --region "$REGION" \
  --query 'Reservations[0].Instances[0].PublicDnsName' \
  --output text)

# ── 6. Summary ────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  BankOS EC2 instance is running!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo ""
echo "  Instance ID  : $INSTANCE_ID"
echo "  Public IP    : $PUBLIC_IP"
echo "  Public DNS   : $PUBLIC_DNS"
echo "  Region       : $REGION"
echo ""
echo "  SSH command:"
echo "  ssh -i $PEM_FILE ec2-user@$PUBLIC_IP"
echo ""
echo "  Application URLs (available after ~5 min of user-data setup):"
echo "  Web portal  → http://$PUBLIC_IP/"
echo "  API         → http://$PUBLIC_IP/api/v1/"
echo "  Swagger     → http://$PUBLIC_IP/api/docs"
echo ""
echo -e "${YELLOW}[NOTE]${NC} The user-data script is still running on the instance."
echo "       To watch progress, SSH in and run:"
echo "       sudo tail -f /var/log/bankos-init.log"
echo ""
echo -e "${YELLOW}[SECURITY]${NC} Restrict SSH (port 22) to your IP after setup:"
echo "  aws ec2 revoke-security-group-ingress --group-id $SG_ID --region $REGION \\"
echo "    --protocol tcp --port 22 --cidr 0.0.0.0/0"
echo "  aws ec2 authorize-security-group-ingress --group-id $SG_ID --region $REGION \\"
echo "    --protocol tcp --port 22 --cidr \$(curl -s ifconfig.me)/32"
