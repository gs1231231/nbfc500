# BankOS Performance Benchmark Report

**Environment:** Production / Staging
**Date:** _______________
**Version:** _______________
**Tester:** _______________
**Load Test Tool:** k6 v0.50+

---

## Executive Summary

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| API P95 Response Time | < 500ms | ___ ms | PASS / FAIL |
| API P99 Response Time | < 1000ms | ___ ms | PASS / FAIL |
| Error Rate (normal load) | < 1% | ___% | PASS / FAIL |
| Throughput (sustained) | > 100 RPS | ___ RPS | PASS / FAIL |
| DB Query P95 | < 100ms | ___ ms | PASS / FAIL |
| Concurrent Users (stable) | 100 | ___ | PASS / FAIL |
| Memory (API service at load) | < 512 MB | ___ MB | PASS / FAIL |
| CPU (API service at load) | < 70% | ___% | PASS / FAIL |

---

## Test Scenarios

### Scenario 1: Smoke Test (Baseline)

| Parameter | Value |
|-----------|-------|
| Virtual Users | 1 |
| Duration | 1 iteration |
| Target | Verify basic connectivity |

| Endpoint | Response Time | Status |
|----------|--------------|--------|
| GET /health | ___ ms | |
| POST /auth/login | ___ ms | |
| GET /los/applications | ___ ms | |
| POST /los/applications | ___ ms | |

---

### Scenario 2: Normal Load (100 VUs)

| Parameter | Value |
|-----------|-------|
| Ramp-up | 0 → 100 VUs over 1 minute |
| Sustained | 100 VUs for 5 minutes |
| Ramp-down | 100 → 0 VUs over 1 minute |

**Endpoint Performance (p50 / p95 / p99 in ms):**

| Endpoint | p50 | p95 | p99 | Error Rate |
|----------|-----|-----|-----|------------|
| GET /health | ___ | ___ | ___ | ___% |
| POST /auth/login | ___ | ___ | ___ | ___% |
| GET /los/applications | ___ | ___ | ___ | ___% |
| POST /los/applications | ___ | ___ | ___ | ___% |
| GET /lms/loans | ___ | ___ | ___ | ___% |
| GET /dashboard/summary | ___ | ___ | ___ | ___% |

**Overall:**

| Metric | Value |
|--------|-------|
| Total Requests | ___ |
| Requests/sec (peak) | ___ |
| Requests/sec (avg) | ___ |
| Data Received | ___ MB |
| Failed Checks | ___% |

---

### Scenario 3: Stress Test (200 VUs)

| Parameter | Value |
|-----------|-------|
| Stages | 0→50 VUs (2m), 50→100 (2m), 100→150 (2m), 150→200 (2m) |
| Goal | Find breaking point / degradation threshold |

**Results at each stage:**

| Stage | VUs | P95 (ms) | Error Rate | CPU | Memory |
|-------|-----|----------|------------|-----|--------|
| Stage 1 | 50 | ___ | ___% | ___% | ___ MB |
| Stage 2 | 100 | ___ | ___% | ___% | ___ MB |
| Stage 3 | 150 | ___ | ___% | ___% | ___ MB |
| Stage 4 | 200 | ___ | ___% | ___% | ___ MB |

**Breaking Point:** ___ VUs (where error rate > 5% or P95 > 1000ms)

---

### Scenario 4: Spike Test (300 VUs — 30 seconds)

| Parameter | Value |
|-----------|-------|
| Baseline | 10 VUs |
| Spike | 300 VUs for 30 seconds |
| Recovery | 10 VUs after spike |

| Metric | Baseline | During Spike | After Spike (Recovery) |
|--------|----------|--------------|------------------------|
| P95 Response Time | ___ ms | ___ ms | ___ ms |
| Error Rate | ___% | ___% | ___% |
| CPU | ___% | ___% | ___% |
| Memory | ___ MB | ___ MB | ___ MB |

**Recovery Time:** ___ seconds (time to return to baseline performance)

---

## API Response Times — Detailed Breakdown

### Authentication Service

| Operation | P50 | P95 | P99 | Notes |
|-----------|-----|-----|-----|-------|
| Login | ___ ms | ___ ms | ___ ms | Includes bcrypt hash comparison |
| Token Refresh | ___ ms | ___ ms | ___ ms | |
| Logout | ___ ms | ___ ms | ___ ms | |

### Loan Origination Service (LOS)

| Operation | P50 | P95 | P99 | Notes |
|-----------|-----|-----|-----|-------|
| Create Application | ___ ms | ___ ms | ___ ms | |
| List Applications | ___ ms | ___ ms | ___ ms | Page size 20 |
| Get Application Detail | ___ ms | ___ ms | ___ ms | |
| Update Application Status | ___ ms | ___ ms | ___ ms | |
| Pull Bureau Report | ___ ms | ___ ms | ___ ms | Mock: <1s; Live: 5-30s |
| Run BRE Evaluation | ___ ms | ___ ms | ___ ms | |

### Loan Management Service (LMS)

| Operation | P50 | P95 | P99 | Notes |
|-----------|-----|-----|-----|-------|
| Disburse Loan | ___ ms | ___ ms | ___ ms | Creates schedule |
| List Loans | ___ ms | ___ ms | ___ ms | Page size 20 |
| Get Loan Detail + Schedule | ___ ms | ___ ms | ___ ms | |
| Record Payment | ___ ms | ___ ms | ___ ms | |
| Generate Schedule PDF | ___ ms | ___ ms | ___ ms | |

### Collection Service

| Operation | P50 | P95 | P99 | Notes |
|-----------|-----|-----|-----|-------|
| Get Collection Tasks | ___ ms | ___ ms | ___ ms | |
| Update Disposition | ___ ms | ___ ms | ___ ms | |
| Run DPD Batch | ___ ms | ___ ms | ___ ms | Full portfolio scan |

---

## Database Query Performance

### Slow Query Log (queries > 50ms)

| Query | Avg (ms) | Max (ms) | Count | Action |
|-------|----------|----------|-------|--------|
| | | | | |

### Key Query Performance

| Query | P50 | P95 | Index Used |
|-------|-----|-----|-----------|
| Get customer by PAN | ___ ms | ___ ms | Yes / No |
| List applications by org+status | ___ ms | ___ ms | Yes / No |
| Get loan schedules by loanId | ___ ms | ___ ms | Yes / No |
| DPD update batch (all active loans) | ___ ms | ___ ms | Yes / No |
| NPA classification batch | ___ ms | ___ ms | Yes / No |

---

## Infrastructure Metrics

### API Service (during 100 VU load)

| Metric | Min | Avg | Max |
|--------|-----|-----|-----|
| CPU Usage (%) | | | |
| Memory (RSS MB) | | | |
| Heap Used (MB) | | | |
| Event Loop Lag (ms) | | | |
| Active Connections | | | |

### Database (PostgreSQL)

| Metric | Value |
|--------|-------|
| Active Connections (peak) | ___ |
| Max Connections Available | ___ |
| Cache Hit Ratio | ___% |
| Avg Query Time | ___ ms |
| Longest Running Query | ___ ms |
| Deadlocks | ___ |

### Redis Cache

| Metric | Value |
|--------|-------|
| Hit Rate | ___% |
| Memory Used | ___ MB |
| Evictions | ___ |
| Connections | ___ |

---

## EMI Calculation Performance

The `calculateEmi()` and `generateSchedule()` functions are pure computation — no I/O.

| Operation | Input Size | Avg Time | Notes |
|-----------|-----------|----------|-------|
| calculateEmi() | N/A | ___ µs | Per call |
| generateSchedule() | 12 months | ___ µs | |
| generateSchedule() | 36 months | ___ µs | |
| generateSchedule() | 240 months | ___ µs | |
| generateSchedule() | 360 months | ___ µs | |

---

## Throughput Benchmarks

### Sustained Throughput

| Concurrent Users | RPS (sustained) | P95 (ms) | Error Rate |
|-----------------|-----------------|----------|------------|
| 10 | ___ | ___ | ___ |
| 25 | ___ | ___ | ___ |
| 50 | ___ | ___ | ___ |
| 100 | ___ | ___ | ___ |
| 150 | ___ | ___ | ___ |
| 200 | ___ | ___ | ___ |

---

## Batch Job Performance

| Job | Records Processed | Duration | RPS |
|-----|------------------|----------|-----|
| Daily DPD Update | ___ loans | ___ min | ___ |
| NPA Classification Run | ___ loans | ___ min | ___ |
| NACH Presentation | ___ mandates | ___ min | ___ |
| CIBIL TUEF Generation | ___ accounts | ___ min | ___ |
| Interest Accrual | ___ loans | ___ min | ___ |

---

## Recommendations

### Performance Improvements Required (if any)

| Issue | Severity | Recommendation | ETA |
|-------|----------|---------------|-----|
| | | | |

### Optimizations Applied

| Optimization | Before | After | Impact |
|-------------|--------|-------|--------|
| Added index on loans(org_id, status) | ___ ms | ___ ms | ___ ms saved |
| Connection pooling (pool size 20) | ___ conns | ___ conns | |
| Redis caching for bureau responses | ___ ms | ___ ms | |

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Performance Engineer | | | |
| Technical Lead | | | |
| Client Technical Reviewer | | | |

---

## Appendix: k6 Raw Output

Paste k6 summary JSON output here:

```json
{
  // k6 results here
}
```
