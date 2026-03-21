# BankOS Production Deployment Runbook

**Prompt 50 | Last Updated: March 2026**

This runbook covers the end-to-end process for deploying BankOS to production. All steps must be followed in order. Do not skip steps or combine them unless explicitly noted.

---

## Table of Contents

1. [Pre-Deploy Checklist](#1-pre-deploy-checklist)
2. [Database Migration Steps](#2-database-migration-steps)
3. [Deployment Steps](#3-deployment-steps)
4. [Health Check Verification](#4-health-check-verification)
5. [Rollback Procedure](#5-rollback-procedure)
6. [Post-Deploy Verification](#6-post-deploy-verification)
7. [Incident Response Contacts](#7-incident-response-contacts)

---

## 1. Pre-Deploy Checklist

Complete all items before initiating any deployment to production.

### 1.1 Code Review and CI

- [ ] PR has at least 2 approvals from senior engineers
- [ ] All CI checks pass (lint, typecheck, unit tests, e2e tests)
- [ ] No CRITICAL or HIGH severity vulnerabilities in Snyk scan
- [ ] Code coverage has not decreased below 80%
- [ ] No pending TODO or FIXME comments in changed files

### 1.2 Testing Environment Validation

- [ ] Changes have been deployed to staging for at least 24 hours
- [ ] Smoke tests pass on staging (`pnpm test:smoke --env=staging`)
- [ ] Business stakeholder sign-off obtained for user-facing changes
- [ ] Performance benchmarks on staging are within 10% of baseline

### 1.3 Change Management

- [ ] Change ticket created in JIRA with CAB approval (production deployments require CAB)
- [ ] Deployment window confirmed: Monday-Thursday, 10:00-12:00 IST or 14:00-16:00 IST
- [ ] Avoid deployments: last 3 business days of the month (month-end EMI peak), RBI reporting dates
- [ ] Rollback plan documented in the change ticket
- [ ] On-call engineer confirmed and available for 2 hours post-deployment

### 1.4 Infrastructure Checks

- [ ] Target K8s cluster health: `kubectl get nodes -n bankos` - all nodes Ready
- [ ] Persistent Volume Claims are Bound: `kubectl get pvc -n bankos`
- [ ] Database replication lag < 10 seconds: `psql -c "SELECT now() - pg_last_xact_replay_timestamp()"`
- [ ] Redis has > 20% free memory
- [ ] Sufficient pod capacity: `kubectl top nodes` - no node above 80% CPU or memory
- [ ] Alert silence window created in PagerDuty (30 min for deployment + buffer)

### 1.5 Backup Verification

- [ ] RDS automated backup completed within last 24 hours (check AWS Console)
- [ ] Manual snapshot taken: `aws rds create-db-snapshot --db-instance-identifier bankos-prod --db-snapshot-identifier pre-deploy-YYYY-MM-DD`
- [ ] Confirm snapshot is available before proceeding

### 1.6 Docker Image Validation

- [ ] All Docker images built and pushed to ECR
- [ ] Image tags match the git SHA of the release branch
- [ ] Trivy scan completed for all images with no CRITICAL vulnerabilities
- [ ] Images pulled and verified on staging EKS cluster

---

## 2. Database Migration Steps

Database migrations are the highest-risk step. Execute with extreme care.

### 2.1 Before Running Migrations

```bash
# 1. Connect to the production database (read replica for verification)
psql $DATABASE_URL -c "SELECT count(*) FROM migrations;"

# 2. Check pending migrations
pnpm prisma migrate status

# 3. Verify migration is backward-compatible
#    The migration MUST NOT:
#    - Drop columns still read by the running application
#    - Rename columns without a 2-phase migration
#    - Add NOT NULL columns without DEFAULT values
#    - Add indexes WITHOUT CONCURRENTLY (blocks table access)

# 4. Estimate migration duration on production data volume
#    Run EXPLAIN ANALYZE on migration queries against the read replica first
```

### 2.2 Running Migrations

```bash
# Run in a migration job pod (not locally or from CI for production)
kubectl run migration-job \
  --image=<ECR_REGISTRY>/bankos/api-gateway:<IMAGE_TAG> \
  --namespace=bankos \
  --restart=Never \
  --env="DATABASE_URL=$DATABASE_URL" \
  --command -- sh -c "pnpm prisma migrate deploy && echo DONE"

# Monitor the job
kubectl logs -f migration-job -n bankos

# Check exit code
kubectl get pod migration-job -n bankos -o jsonpath='{.status.containerStatuses[0].state.terminated.exitCode}'
# Expected: 0

# Clean up
kubectl delete pod migration-job -n bankos
```

### 2.3 Long-Running Migration Handling

For migrations that take > 60 seconds (large tables):

1. Use PostgreSQL `CREATE INDEX CONCURRENTLY` - never add indexes without CONCURRENTLY in production
2. For column additions: add as nullable first, backfill with a separate job, then add constraint
3. For data migrations: run in batches of 1000 rows with `pg_sleep(0.01)` between batches to avoid lock contention

### 2.4 Post-Migration Verification

```bash
# Verify row counts are as expected
psql $DATABASE_URL -c "\dt"  # list tables
psql $DATABASE_URL -c "SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC LIMIT 10;"

# Check for lock waits (should be 0 or minimal)
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity WHERE wait_event_type = 'Lock';"

# Verify migration status
pnpm prisma migrate status
# Expected: All migrations have been applied
```

---

## 3. Deployment Steps

### 3.1 Set Environment Variables

```bash
export IMAGE_TAG=$(git rev-parse --short HEAD)
export ENVIRONMENT=production
export AWS_REGION=ap-south-1
export CLUSTER_NAME=bankos-production-cluster
export K8S_NAMESPACE=bankos
export HELM_RELEASE=bankos
```

### 3.2 Update kubeconfig

```bash
aws eks update-kubeconfig \
  --region $AWS_REGION \
  --name $CLUSTER_NAME

# Verify context
kubectl config current-context
kubectl get nodes -n $K8S_NAMESPACE
```

### 3.3 Dry-Run Helm Deployment

Always run dry-run first and review the diff:

```bash
helm upgrade $HELM_RELEASE ./infra/helm \
  --namespace $K8S_NAMESPACE \
  --values infra/helm/values.yaml \
  --values infra/helm/values-prod.yaml \
  --set global.imageTag=$IMAGE_TAG \
  --dry-run \
  --debug \
  2>&1 | tee /tmp/helm-dry-run-$IMAGE_TAG.log

# Review the diff
cat /tmp/helm-dry-run-$IMAGE_TAG.log
```

### 3.4 Execute Deployment

```bash
helm upgrade $HELM_RELEASE ./infra/helm \
  --namespace $K8S_NAMESPACE \
  --values infra/helm/values.yaml \
  --values infra/helm/values-prod.yaml \
  --set global.imageTag=$IMAGE_TAG \
  --set global.environment=$ENVIRONMENT \
  --atomic \
  --cleanup-on-fail \
  --timeout 10m \
  --wait \
  --history-max 5

# Monitor the rollout
kubectl rollout status deployment/api-gateway -n $K8S_NAMESPACE
kubectl rollout status deployment/loan-service -n $K8S_NAMESPACE
kubectl rollout status deployment/collection-service -n $K8S_NAMESPACE
kubectl rollout status deployment/payment-service -n $K8S_NAMESPACE
kubectl rollout status deployment/notification-service -n $K8S_NAMESPACE
kubectl rollout status deployment/underwriting-service -n $K8S_NAMESPACE
kubectl rollout status deployment/reports-service -n $K8S_NAMESPACE
```

### 3.5 Monitor Deployment Progress

Open these dashboards in separate browser tabs before deploying:

- Grafana: https://grafana.bankos.in/d/bankos-main-dashboard
- PagerDuty: https://bankos.pagerduty.com
- AWS EKS Console: check pod events
- Sentry: https://sentry.io/organizations/bankos/issues/

```bash
# Watch pods in real time
kubectl get pods -n $K8S_NAMESPACE -w

# Watch events for issues
kubectl get events -n $K8S_NAMESPACE --sort-by='.lastTimestamp' -w

# Check pod logs during rollout
kubectl logs -f deployment/api-gateway -n $K8S_NAMESPACE --all-containers
```

---

## 4. Health Check Verification

Run all health checks after deployment completes.

### 4.1 Kubernetes Health

```bash
# All pods should be Running (not Pending, CrashLoopBackOff, or Error)
kubectl get pods -n $K8S_NAMESPACE
# Expected: All pods in Running state, RESTARTS should be 0

# Check readiness
kubectl get endpoints -n $K8S_NAMESPACE
# Expected: All services have at least 1 endpoint

# Resource usage within limits
kubectl top pods -n $K8S_NAMESPACE
```

### 4.2 API Health Endpoints

```bash
BASE_URL="https://api.bankos.in"

# Liveness
curl --fail --max-time 10 "$BASE_URL/health" | jq .
# Expected: {"status":"ok","uptime":...}

# Readiness (includes DB and Redis connectivity)
curl --fail --max-time 15 "$BASE_URL/health/ready" | jq .
# Expected: {"status":"ok","database":"up","redis":"up"}

# Version endpoint
curl --fail "$BASE_URL/version" | jq .
# Expected: {"version":"$IMAGE_TAG","service":"api-gateway"}
```

### 4.3 Service-Specific Health

```bash
# Loan service
curl --fail "$BASE_URL/loans/health" | jq .

# Collection service
curl --fail "$BASE_URL/collections/health" | jq .

# Payment service
curl --fail "$BASE_URL/payments/health" | jq .
```

### 4.4 Database Connectivity Verification

```bash
# Check database connections from pods
kubectl exec -n $K8S_NAMESPACE deployment/api-gateway -- \
  node -e "
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    p.\$connect().then(() => console.log('DB OK')).catch(e => { console.error(e); process.exit(1); });
  "
```

### 4.5 Prometheus Metrics

```bash
# Verify metrics are being scraped
curl --fail "https://prometheus.bankos.in/api/v1/query?query=up{job=~'bankos.*'}" | \
  jq '.data.result[] | {job: .metric.job, up: .value[1]}'
# Expected: all services show "1" (up)

# Check for elevated error rate (should be < 1%)
curl "https://prometheus.bankos.in/api/v1/query?query=sum(rate(http_request_duration_seconds_count{status%3D~%225..%22%2Cjob%3D~%22bankos.*%22}[5m]))/sum(rate(http_request_duration_seconds_count{job%3D~%22bankos.*%22}[5m]))" | jq '.data.result'
```

### 4.6 Business Validation

After technical health checks, validate critical business flows:

- [ ] Loan application creation: POST /api/v1/loans/applications
- [ ] Bureau pull (mock in non-prod): POST /api/v1/bureau/pull
- [ ] Payment posting: POST /api/v1/payments
- [ ] Collection task creation: POST /api/v1/collections/tasks
- [ ] Report generation: GET /api/v1/reports/portfolio-summary

---

## 5. Rollback Procedure

### 5.1 When to Roll Back

Initiate rollback immediately if ANY of these are observed within 30 minutes of deployment:

- 5xx error rate > 1% for more than 2 minutes
- P99 response time > 2000ms for more than 2 minutes
- Any pod in CrashLoopBackOff state
- Database connection pool exhausted
- Any data corruption or incorrect calculations observed
- PagerDuty critical alert fires

### 5.2 Automated Rollback

The Helm `--atomic` flag automatically rolls back if deployment fails within the timeout. If this triggers, check:

```bash
helm history $HELM_RELEASE -n $K8S_NAMESPACE
# Identifies which revision is current and which is previous
```

### 5.3 Manual Helm Rollback

```bash
# View deployment history
helm history $HELM_RELEASE -n $K8S_NAMESPACE

# Roll back to previous version (revision 0 = previous)
helm rollback $HELM_RELEASE 0 \
  --namespace $K8S_NAMESPACE \
  --wait \
  --timeout 5m

# Verify rollback
helm status $HELM_RELEASE -n $K8S_NAMESPACE
kubectl get pods -n $K8S_NAMESPACE
```

### 5.4 Database Rollback

**CRITICAL: Database rollbacks are irreversible. Only perform if absolutely necessary.**

If a migration caused data corruption:

```bash
# 1. Put application in maintenance mode (update ConfigMap to serve 503)
kubectl set env deployment/api-gateway MAINTENANCE_MODE=true -n $K8S_NAMESPACE

# 2. Create a safety snapshot BEFORE restoring
aws rds create-db-snapshot \
  --db-instance-identifier bankos-prod \
  --db-snapshot-identifier emergency-pre-restore-$(date +%Y%m%d-%H%M%S)

# 3. Restore from pre-deployment snapshot (THIS WILL CAUSE DATA LOSS)
# NOTE: This requires RDS Multi-AZ point-in-time recovery
# Consult DBA and Engineering Lead before proceeding
# aws rds restore-db-instance-to-point-in-time ...

# 4. After restoration, run the previous app version
helm rollback $HELM_RELEASE 0 -n $K8S_NAMESPACE --wait

# 5. Remove maintenance mode
kubectl set env deployment/api-gateway MAINTENANCE_MODE=false -n $K8S_NAMESPACE
```

### 5.5 Emergency Kubernetes Rollout Undo

For immediate rollback without Helm:

```bash
# Roll back each deployment individually
for service in api-gateway loan-service collection-service payment-service notification-service underwriting-service reports-service; do
  kubectl rollout undo deployment/$service -n $K8S_NAMESPACE
done

# Verify rollout
kubectl rollout status deployment/api-gateway -n $K8S_NAMESPACE --timeout=3m
```

### 5.6 Post-Rollback Steps

1. Notify Slack `#engineering-alerts` and `#ops-war-room` immediately
2. File a P1 incident in PagerDuty
3. Conduct a 15-minute verbal blameless debrief (document in Confluence within 24 hours)
4. Update JIRA change ticket with rollback details
5. Re-open the PR and mark it as blocked until root cause is resolved

---

## 6. Post-Deploy Verification

After successful deployment and health checks:

### 6.1 Monitor for 30 Minutes

Keep the following dashboards open:

- Grafana BankOS dashboard: watch request rate, error rate, P99 latency, active loans
- Sentry Issues: watch for new error spikes
- PagerDuty: watch for any firing alerts

Key metrics to watch (should all be GREEN within 5 minutes of deployment):

| Metric | Threshold |
|--------|-----------|
| API Success Rate | > 99% |
| P99 Response Time | < 500ms |
| 5xx Error Count (5m) | < 10 |
| Pod Restart Count | 0 |
| DB Connection Pool | < 80% utilized |
| Redis Memory | < 80% utilized |

### 6.2 Notify Stakeholders

```
Slack message to #deploy-announcements:

:rocket: BankOS v{IMAGE_TAG} deployed to production successfully
- Deployed at: {TIMESTAMP IST}
- Deployed by: {NAME}
- Changes: {PR_LINK}
- All health checks: PASS
- Monitoring: https://grafana.bankos.in/d/bankos-main-dashboard
```

### 6.3 Update Change Ticket

- Close the CAB change ticket
- Record actual deployment time, duration, and any deviations from this runbook
- Archive Helm dry-run log to the ticket

### 6.4 Remove Alert Silence

Remove the PagerDuty silence window created in the pre-deploy checklist.

---

## 7. Incident Response Contacts

| Role | Name | PagerDuty | Slack | Phone |
|------|------|-----------|-------|-------|
| Engineering Lead | (Owner to fill) | @eng-lead | @eng-lead | +91-XXXXXXXXXX |
| Platform On-Call | Rotational | @oncall-platform | #ops-war-room | +91-XXXXXXXXXX |
| DBA | (Owner to fill) | @dba-oncall | #db-ops | +91-XXXXXXXXXX |
| CTO | (Owner to fill) | @cto | @cto | +91-XXXXXXXXXX |

**PagerDuty Escalation Policy:** Platform Alerts → Engineering Lead (15 min) → CTO (30 min)

**AWS Support:** Case severity P1 for production outages affecting financial transactions.
Link: https://console.aws.amazon.com/support/home

---

## Appendix A: Environment Variables Reference

| Variable | Description | Set In |
|----------|-------------|--------|
| `DATABASE_URL` | PostgreSQL connection string | K8s Secret |
| `REDIS_URL` | Redis connection string | K8s Secret |
| `JWT_SECRET` | JWT signing secret (min 32 chars) | K8s Secret |
| `SENTRY_DSN` | Sentry error tracking DSN | K8s Secret |
| `*_ADAPTER` | Integration adapter selection (real/mock) | ConfigMap |
| `AWS_REGION` | AWS region | ConfigMap |
| `NODE_ENV` | Runtime environment | ConfigMap |

## Appendix B: Key Commands Quick Reference

```bash
# Check all pod statuses
kubectl get pods -n bankos

# Follow logs for a service
kubectl logs -f deployment/<service-name> -n bankos

# Restart a deployment (rolling)
kubectl rollout restart deployment/<service-name> -n bankos

# Scale a deployment
kubectl scale deployment/<service-name> --replicas=3 -n bankos

# Get Helm release history
helm history bankos -n bankos

# Port-forward a service for local debugging
kubectl port-forward svc/api-gateway 3000:3000 -n bankos

# Execute into a pod for debugging
kubectl exec -it deployment/api-gateway -n bankos -- sh

# Check resource usage
kubectl top pods -n bankos
kubectl top nodes
```

## Appendix C: RBI Compliance Notes

- All deployments must be logged in the Change Management System (CMS) per RBI IT Framework
- Production database access is logged and audited
- PII data must never appear in logs or error messages
- Any deployment causing > 15 minutes downtime must be reported to the CTO for RBI disclosure assessment
- CERSAI charge registration must complete within 30 days of disbursement; verify automated jobs are running post-deploy
