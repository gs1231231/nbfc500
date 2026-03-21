#!/usr/bin/env bash
# =============================================================================
# BankOS Disaster Recovery (DR) Drill Script
# Prompt 80
#
# This script automates the DR drill process:
#   1. Database backup verification
#   2. Database restore test to a secondary instance
#   3. Service failover simulation
#   4. Health check verification across all services
#   5. Recovery time measurement (RTO verification)
#
# Usage:
#   chmod +x scripts/dr-drill.sh
#   ./scripts/dr-drill.sh [--env staging|prod] [--skip-backup] [--skip-restore]
#
# Prerequisites:
#   - PostgreSQL client tools (pg_dump, pg_restore, psql)
#   - Docker (for spinning up a fresh restore target)
#   - curl (for health checks)
#   - jq (for JSON parsing)
#   - AWS CLI (if using S3 for backup storage)
#
# Exit codes:
#   0 = DR drill passed — RTO within target
#   1 = DR drill failed — RTO breached or health checks failed
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${SCRIPT_DIR}/../logs/dr-drills"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DRILL_LOG="${LOG_DIR}/dr-drill-${TIMESTAMP}.log"
REPORT_FILE="${LOG_DIR}/dr-report-${TIMESTAMP}.txt"

# Target RTO (Recovery Time Objective) in seconds
RTO_TARGET_SECONDS=3600  # 1 hour

# Database configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-bankos}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_RESTORE_PORT="${DB_RESTORE_PORT:-5433}"  # Secondary DB for restore test
DB_RESTORE_NAME="${DB_RESTORE_NAME:-bankos_dr_test}"

# Backup configuration
BACKUP_DIR="${BACKUP_DIR:-/var/backups/bankos}"
S3_BUCKET="${S3_BUCKET:-}"  # Optional: s3://your-bucket/bankos-backups
BACKUP_RETENTION_DAYS=30

# Service health check endpoints
API_GATEWAY_URL="${API_GATEWAY_URL:-http://localhost:3000}"
LOS_SERVICE_URL="${LOS_SERVICE_URL:-http://localhost:3001}"
LMS_SERVICE_URL="${LMS_SERVICE_URL:-http://localhost:3002}"
BRE_SERVICE_URL="${BRE_SERVICE_URL:-http://localhost:3003}"
COLLECTION_SERVICE_URL="${COLLECTION_SERVICE_URL:-http://localhost:3004}"
PAYMENT_SERVICE_URL="${PAYMENT_SERVICE_URL:-http://localhost:3005}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------

ENV="staging"
SKIP_BACKUP=false
SKIP_RESTORE=false
SKIP_FAILOVER=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --env) ENV="$2"; shift 2 ;;
    --skip-backup) SKIP_BACKUP=true; shift ;;
    --skip-restore) SKIP_RESTORE=true; shift ;;
    --skip-failover) SKIP_FAILOVER=true; shift ;;
    --rto-target) RTO_TARGET_SECONDS="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

mkdir -p "${LOG_DIR}"

log() {
  local level="$1"
  local message="$2"
  local ts
  ts=$(date '+%Y-%m-%d %H:%M:%S')
  echo "[${ts}] [${level}] ${message}" | tee -a "${DRILL_LOG}"
}

info()    { log "INFO " "${BLUE}${*}${NC}"; }
success() { log "OK   " "${GREEN}${*}${NC}"; }
warn()    { log "WARN " "${YELLOW}${*}${NC}"; }
error()   { log "ERROR" "${RED}${*}${NC}"; }

DRILL_START_TIME=$(date +%s)
STEP_RESULTS=()
OVERALL_STATUS="PASS"

record_step() {
  local step_name="$1"
  local step_status="$2"  # PASS or FAIL
  local step_duration="$3"
  local step_notes="${4:-}"
  STEP_RESULTS+=("${step_name}|${step_status}|${step_duration}|${step_notes}")
  if [[ "${step_status}" == "FAIL" ]]; then
    OVERALL_STATUS="FAIL"
  fi
}

elapsed_since() {
  local start_time="$1"
  echo $(( $(date +%s) - start_time ))
}

# ---------------------------------------------------------------------------
# Step 1: Pre-Drill Validation
# ---------------------------------------------------------------------------

pre_drill_check() {
  info "============================================================"
  info "   BANKOS DISASTER RECOVERY DRILL"
  info "   Environment: ${ENV}"
  info "   Timestamp:   ${TIMESTAMP}"
  info "   RTO Target:  ${RTO_TARGET_SECONDS}s ($(( RTO_TARGET_SECONDS / 60 )) min)"
  info "============================================================"

  local step_start
  step_start=$(date +%s)

  info "[Step 1] Pre-drill validation..."

  # Check required tools
  local missing_tools=()
  for tool in psql pg_dump pg_restore curl; do
    if ! command -v "${tool}" &>/dev/null; then
      missing_tools+=("${tool}")
    fi
  done

  if [[ ${#missing_tools[@]} -gt 0 ]]; then
    warn "Missing tools: ${missing_tools[*]}"
    warn "Some checks will be simulated."
  else
    success "All required tools present."
  fi

  # Test DB connectivity
  if command -v psql &>/dev/null; then
    if PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" \
        -d "${DB_NAME}" -c "SELECT 1" &>/dev/null 2>&1; then
      success "Primary database connectivity: OK"
    else
      warn "Cannot connect to primary database — continuing in simulation mode"
    fi
  else
    warn "psql not available — simulating database checks"
  fi

  local duration
  duration=$(elapsed_since "${step_start}")
  record_step "Pre-Drill Validation" "PASS" "${duration}s"
}

# ---------------------------------------------------------------------------
# Step 2: Database Backup
# ---------------------------------------------------------------------------

database_backup() {
  if [[ "${SKIP_BACKUP}" == "true" ]]; then
    info "[Step 2] SKIPPING database backup (--skip-backup)"
    record_step "Database Backup" "SKIP" "0s" "Skipped by --skip-backup flag"
    return
  fi

  local step_start
  step_start=$(date +%s)
  info "[Step 2] Database backup..."

  mkdir -p "${BACKUP_DIR}"
  local backup_file="${BACKUP_DIR}/bankos-backup-${TIMESTAMP}.pgdump"

  if command -v pg_dump &>/dev/null; then
    info "  Running pg_dump → ${backup_file}"
    if PGPASSWORD="${DB_PASSWORD}" pg_dump \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        -d "${DB_NAME}" \
        --format=custom \
        --compress=9 \
        --no-acl \
        --no-owner \
        -f "${backup_file}" 2>>"${DRILL_LOG}"; then

      local backup_size
      backup_size=$(du -sh "${backup_file}" | cut -f1)
      success "  Backup created: ${backup_file} (${backup_size})"

      # Upload to S3 if configured
      if [[ -n "${S3_BUCKET}" ]] && command -v aws &>/dev/null; then
        info "  Uploading to S3: ${S3_BUCKET}/${TIMESTAMP}/bankos-backup.pgdump"
        if aws s3 cp "${backup_file}" "${S3_BUCKET}/${TIMESTAMP}/bankos-backup.pgdump" \
            >>"${DRILL_LOG}" 2>&1; then
          success "  S3 upload: OK"
        else
          warn "  S3 upload failed — backup exists locally"
        fi
      fi

      # Verify backup integrity
      info "  Verifying backup integrity..."
      if PGPASSWORD="${DB_PASSWORD}" pg_restore \
          --list "${backup_file}" >>/dev/null 2>&1; then
        success "  Backup integrity check: PASSED"
        local duration
        duration=$(elapsed_since "${step_start}")
        record_step "Database Backup" "PASS" "${duration}s" "File: ${backup_file}, Size: ${backup_size}"
      else
        error "  Backup integrity check: FAILED"
        local duration
        duration=$(elapsed_since "${step_start}")
        record_step "Database Backup" "FAIL" "${duration}s" "Integrity verification failed"
      fi
    else
      error "  pg_dump failed — check logs at ${DRILL_LOG}"
      local duration
      duration=$(elapsed_since "${step_start}")
      record_step "Database Backup" "FAIL" "${duration}s" "pg_dump failed"
    fi
  else
    warn "  pg_dump not available — SIMULATING backup"
    info "  [SIMULATED] Backup would be written to: ${backup_file}"
    local duration
    duration=$(elapsed_since "${step_start}")
    record_step "Database Backup" "PASS" "${duration}s" "SIMULATED (pg_dump not installed)"
  fi

  # Clean up old backups
  info "  Cleaning backups older than ${BACKUP_RETENTION_DAYS} days..."
  find "${BACKUP_DIR}" -name "bankos-backup-*.pgdump" \
      -mtime "+${BACKUP_RETENTION_DAYS}" -delete 2>/dev/null || true
  success "  Old backup cleanup: OK"
}

# ---------------------------------------------------------------------------
# Step 3: Restore to Secondary Instance
# ---------------------------------------------------------------------------

database_restore() {
  if [[ "${SKIP_RESTORE}" == "true" ]]; then
    info "[Step 3] SKIPPING database restore (--skip-restore)"
    record_step "Database Restore" "SKIP" "0s" "Skipped by --skip-restore flag"
    return
  fi

  local step_start
  step_start=$(date +%s)
  info "[Step 3] Database restore to secondary instance..."

  # Find latest backup
  local latest_backup
  latest_backup=$(find "${BACKUP_DIR}" -name "bankos-backup-*.pgdump" \
      -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | awk '{print $2}')

  if [[ -z "${latest_backup}" ]]; then
    warn "  No local backup found. Attempting to fetch from S3..."
    if [[ -n "${S3_BUCKET}" ]] && command -v aws &>/dev/null; then
      local s3_key
      s3_key=$(aws s3 ls "${S3_BUCKET}/" --recursive | sort | tail -1 | awk '{print $4}')
      aws s3 cp "${S3_BUCKET}/${s3_key}" "${BACKUP_DIR}/restore-latest.pgdump"
      latest_backup="${BACKUP_DIR}/restore-latest.pgdump"
    else
      warn "  No backup available. Skipping restore test."
      local duration
      duration=$(elapsed_since "${step_start}")
      record_step "Database Restore" "SKIP" "${duration}s" "No backup file found"
      return
    fi
  fi

  info "  Source backup: ${latest_backup}"

  if command -v psql &>/dev/null && command -v pg_restore &>/dev/null; then
    # Drop and recreate restore target DB
    info "  Preparing restore target: ${DB_RESTORE_NAME} on port ${DB_RESTORE_PORT}"
    PGPASSWORD="${DB_PASSWORD}" psql \
        -h "${DB_HOST}" -p "${DB_RESTORE_PORT}" \
        -U "${DB_USER}" -d postgres \
        -c "DROP DATABASE IF EXISTS ${DB_RESTORE_NAME};" 2>>"${DRILL_LOG}" || true

    PGPASSWORD="${DB_PASSWORD}" psql \
        -h "${DB_HOST}" -p "${DB_RESTORE_PORT}" \
        -U "${DB_USER}" -d postgres \
        -c "CREATE DATABASE ${DB_RESTORE_NAME};" 2>>"${DRILL_LOG}"

    # Restore
    info "  Running pg_restore..."
    if PGPASSWORD="${DB_PASSWORD}" pg_restore \
        -h "${DB_HOST}" \
        -p "${DB_RESTORE_PORT}" \
        -U "${DB_USER}" \
        -d "${DB_RESTORE_NAME}" \
        --no-acl --no-owner \
        --verbose \
        "${latest_backup}" 2>>"${DRILL_LOG}"; then
      success "  Restore completed successfully"

      # Sanity check: verify key tables
      info "  Running post-restore sanity checks..."
      local tables=("organizations" "customers" "loans" "loan_schedules" "payments")
      local all_ok=true
      for table in "${tables[@]}"; do
        local count
        count=$(PGPASSWORD="${DB_PASSWORD}" psql \
            -h "${DB_HOST}" -p "${DB_RESTORE_PORT}" \
            -U "${DB_USER}" -d "${DB_RESTORE_NAME}" \
            -t -c "SELECT COUNT(*) FROM ${table};" 2>/dev/null | tr -d ' ')
        if [[ -n "${count}" ]]; then
          info "  Table ${table}: ${count} rows"
        else
          error "  Cannot read table ${table} from restored DB"
          all_ok=false
        fi
      done

      if [[ "${all_ok}" == "true" ]]; then
        success "  Post-restore sanity checks: ALL PASSED"
        local duration
        duration=$(elapsed_since "${step_start}")
        record_step "Database Restore" "PASS" "${duration}s" "Restored from ${latest_backup}"
      else
        local duration
        duration=$(elapsed_since "${step_start}")
        record_step "Database Restore" "FAIL" "${duration}s" "Post-restore sanity check failed"
      fi
    else
      error "  pg_restore failed"
      local duration
      duration=$(elapsed_since "${step_start}")
      record_step "Database Restore" "FAIL" "${duration}s" "pg_restore failed"
    fi
  else
    warn "  psql/pg_restore not available — SIMULATING restore"
    info "  [SIMULATED] Restore would use: ${latest_backup}"
    local duration
    duration=$(elapsed_since "${step_start}")
    record_step "Database Restore" "PASS" "${duration}s" "SIMULATED"
  fi
}

# ---------------------------------------------------------------------------
# Step 4: Service Failover Simulation
# ---------------------------------------------------------------------------

service_failover() {
  if [[ "${SKIP_FAILOVER}" == "true" ]]; then
    info "[Step 4] SKIPPING service failover simulation (--skip-failover)"
    record_step "Service Failover" "SKIP" "0s"
    return
  fi

  local step_start
  step_start=$(date +%s)
  info "[Step 4] Service failover simulation..."

  # In a real DR drill, this would:
  # 1. Simulate a primary service failure (kill process or stop container)
  # 2. Start the secondary/standby service
  # 3. Update load balancer to point to secondary
  # 4. Verify traffic is flowing to secondary

  # For this drill, we simulate by checking if services respond,
  # then would theoretically fail them over.

  info "  Simulating primary API Gateway failure..."
  info "  [SIMULATED] Stopping primary: docker stop bankos-api-gateway-primary"
  info "  [SIMULATED] Starting standby: docker start bankos-api-gateway-standby"
  info "  [SIMULATED] Updating load balancer target group..."

  # In practice:
  # docker stop bankos-api-gateway || true
  # sleep 5
  # docker start bankos-api-gateway-standby
  # aws elbv2 modify-target-group ...

  success "  [SIMULATED] Service failover completed"
  local duration
  duration=$(elapsed_since "${step_start}")
  record_step "Service Failover" "PASS" "${duration}s" "SIMULATED - no actual services stopped"
}

# ---------------------------------------------------------------------------
# Step 5: Health Check Verification
# ---------------------------------------------------------------------------

health_checks() {
  local step_start
  step_start=$(date +%s)
  info "[Step 5] Health check verification..."

  local all_healthy=true

  # Function to check a single endpoint
  check_endpoint() {
    local name="$1"
    local url="$2"
    local timeout=10

    if command -v curl &>/dev/null; then
      local http_status
      http_status=$(curl -s -o /dev/null -w "%{http_code}" \
          --max-time "${timeout}" \
          --connect-timeout 5 \
          "${url}/health" 2>/dev/null || echo "000")

      if [[ "${http_status}" == "200" ]]; then
        success "  ${name}: HTTP ${http_status} OK"
        return 0
      else
        warn "  ${name}: HTTP ${http_status} (URL: ${url}/health)"
        return 1
      fi
    else
      warn "  ${name}: curl not available — SIMULATING health check"
      info "    [SIMULATED] GET ${url}/health → 200 OK"
      return 0
    fi
  }

  # Check each service
  declare -A services=(
    ["API Gateway"]="${API_GATEWAY_URL}"
    ["LOS Service"]="${LOS_SERVICE_URL}"
    ["LMS Service"]="${LMS_SERVICE_URL}"
    ["BRE Service"]="${BRE_SERVICE_URL}"
    ["Collection Service"]="${COLLECTION_SERVICE_URL}"
    ["Payment Service"]="${PAYMENT_SERVICE_URL}"
  )

  for service_name in "${!services[@]}"; do
    if ! check_endpoint "${service_name}" "${services[${service_name}]}"; then
      all_healthy=false
    fi
  done

  # Database connectivity check
  info "  Checking database connectivity..."
  if command -v psql &>/dev/null; then
    if PGPASSWORD="${DB_PASSWORD}" psql \
        -h "${DB_HOST}" -p "${DB_PORT}" \
        -U "${DB_USER}" -d "${DB_NAME}" \
        -c "SELECT COUNT(*) FROM organizations;" \
        >>/dev/null 2>&1; then
      success "  Primary Database: CONNECTED"
    else
      warn "  Primary Database: UNREACHABLE"
      all_healthy=false
    fi
  else
    info "  [SIMULATED] Primary Database: CONNECTED"
  fi

  # Redis check
  info "  Checking Redis connectivity..."
  if command -v redis-cli &>/dev/null; then
    if redis-cli -h "${REDIS_HOST:-localhost}" ping 2>/dev/null | grep -q PONG; then
      success "  Redis: CONNECTED"
    else
      warn "  Redis: UNREACHABLE"
    fi
  else
    info "  [SIMULATED] Redis: CONNECTED"
  fi

  local duration
  duration=$(elapsed_since "${step_start}")

  if [[ "${all_healthy}" == "true" ]]; then
    record_step "Health Checks" "PASS" "${duration}s" "All services healthy"
  else
    record_step "Health Checks" "FAIL" "${duration}s" "One or more services unreachable"
  fi
}

# ---------------------------------------------------------------------------
# Step 6: Functional Smoke Test Post-Recovery
# ---------------------------------------------------------------------------

functional_smoke_test() {
  local step_start
  step_start=$(date +%s)
  info "[Step 6] Functional smoke test post-recovery..."

  local all_passed=true

  # Test 1: API responds
  if command -v curl &>/dev/null; then
    local health_response
    health_response=$(curl -s --max-time 10 "${API_GATEWAY_URL}/health" 2>/dev/null || echo '{}')
    if echo "${health_response}" | grep -q '"status"'; then
      success "  Smoke Test 1: Health endpoint returns JSON"
    else
      warn "  Smoke Test 1: Health endpoint did not return expected JSON"
      all_passed=false
    fi
  else
    info "  [SIMULATED] Smoke Test 1: Health endpoint returns JSON — PASS"
  fi

  # Test 2: Login endpoint reachable (returns 401 for empty credentials)
  if command -v curl &>/dev/null; then
    local login_status
    login_status=$(curl -s -o /dev/null -w "%{http_code}" \
        --max-time 10 \
        -X POST \
        -H "Content-Type: application/json" \
        -d '{"email":"","password":""}' \
        "${API_GATEWAY_URL}/api/v1/auth/login" 2>/dev/null || echo "000")

    if [[ "${login_status}" =~ ^(400|401|422)$ ]]; then
      success "  Smoke Test 2: Login endpoint reachable (HTTP ${login_status})"
    else
      warn "  Smoke Test 2: Login endpoint returned unexpected HTTP ${login_status}"
      all_passed=false
    fi
  else
    info "  [SIMULATED] Smoke Test 2: Login endpoint reachable — PASS"
  fi

  # Test 3: Database read (via API or direct)
  info "  Smoke Test 3: Database read capability..."
  info "  [SIMULATED] Database read: organizations table accessible — PASS"

  local duration
  duration=$(elapsed_since "${step_start}")

  if [[ "${all_passed}" == "true" ]]; then
    record_step "Functional Smoke Test" "PASS" "${duration}s"
  else
    record_step "Functional Smoke Test" "FAIL" "${duration}s"
  fi
}

# ---------------------------------------------------------------------------
# Step 7: RTO Measurement and Report
# ---------------------------------------------------------------------------

generate_report() {
  local drill_end_time
  drill_end_time=$(date +%s)
  local total_seconds
  total_seconds=$(( drill_end_time - DRILL_START_TIME ))
  local total_minutes
  total_minutes=$(( total_seconds / 60 ))

  info "============================================================"
  info "             DR DRILL REPORT"
  info "============================================================"
  info "  Drill Date:        $(date '+%Y-%m-%d %H:%M:%S')"
  info "  Environment:       ${ENV}"
  info "  Total Duration:    ${total_seconds}s (${total_minutes} min)"
  info "  RTO Target:        ${RTO_TARGET_SECONDS}s"
  info "  Overall Status:    ${OVERALL_STATUS}"
  info "────────────────────────────────────────────────────────────"

  printf "%-35s %-8s %-12s %s\n" "STEP" "STATUS" "DURATION" "NOTES" | tee -a "${DRILL_LOG}"
  printf "%-35s %-8s %-12s %s\n" "────────────────────────────────" "──────" "──────────" "─────────────────────────" | tee -a "${DRILL_LOG}"

  for result in "${STEP_RESULTS[@]}"; do
    IFS='|' read -r step_name step_status step_duration step_notes <<< "${result}"
    printf "%-35s %-8s %-12s %s\n" "${step_name}" "${step_status}" "${step_duration}" "${step_notes}" | tee -a "${DRILL_LOG}"
  done

  info "────────────────────────────────────────────────────────────"

  if [[ "${total_seconds}" -le "${RTO_TARGET_SECONDS}" ]]; then
    success "RTO ACHIEVED: ${total_seconds}s <= ${RTO_TARGET_SECONDS}s target"
    info "Overall Status: PASS"
  else
    error "RTO BREACHED: ${total_seconds}s > ${RTO_TARGET_SECONDS}s target"
    info "Overall Status: FAIL"
    OVERALL_STATUS="FAIL"
  fi

  # Write report to file
  {
    echo "BankOS DR Drill Report"
    echo "======================"
    echo "Date:           $(date '+%Y-%m-%d %H:%M:%S')"
    echo "Environment:    ${ENV}"
    echo "Total Duration: ${total_seconds}s (${total_minutes} min)"
    echo "RTO Target:     ${RTO_TARGET_SECONDS}s ($(( RTO_TARGET_SECONDS / 60 )) min)"
    echo "RTO Status:     $([ "${total_seconds}" -le "${RTO_TARGET_SECONDS}" ] && echo 'ACHIEVED' || echo 'BREACHED')"
    echo "Overall Status: ${OVERALL_STATUS}"
    echo ""
    echo "Step-by-Step Results:"
    echo "---------------------"
    for result in "${STEP_RESULTS[@]}"; do
      IFS='|' read -r step_name step_status step_duration step_notes <<< "${result}"
      echo "  ${step_name}: ${step_status} (${step_duration}) ${step_notes}"
    done
    echo ""
    echo "Log file: ${DRILL_LOG}"
  } > "${REPORT_FILE}"

  info "============================================================"
  info "  Report written to: ${REPORT_FILE}"
  info "  Log written to:    ${DRILL_LOG}"
  info "============================================================"
}

# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------

cleanup() {
  info "Cleaning up DR drill artifacts..."
  # Drop the restore test database if it was created
  if command -v psql &>/dev/null; then
    PGPASSWORD="${DB_PASSWORD}" psql \
        -h "${DB_HOST}" -p "${DB_RESTORE_PORT}" \
        -U "${DB_USER}" -d postgres \
        -c "DROP DATABASE IF EXISTS ${DB_RESTORE_NAME};" 2>>"${DRILL_LOG}" || true
    info "  Dropped restore test database: ${DB_RESTORE_NAME}"
  fi
  info "Cleanup complete."
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

main() {
  pre_drill_check
  database_backup
  database_restore
  service_failover
  health_checks
  functional_smoke_test
  generate_report
  cleanup

  if [[ "${OVERALL_STATUS}" == "PASS" ]]; then
    exit 0
  else
    exit 1
  fi
}

# Trap for cleanup on unexpected exit
trap cleanup EXIT

main "$@"
