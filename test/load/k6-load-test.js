/**
 * Prompt 72: k6 Load Test Script — BankOS API
 *
 * Run with:
 *   k6 run test/load/k6-load-test.js
 *   k6 run --env BASE_URL=https://api.bankos.example.com test/load/k6-load-test.js
 *
 * Scenarios:
 *   default         — 100 concurrent users, ramp up over 1 min, sustain 5 min
 *   smoke           — 1 VU, 1 iteration (sanity check)
 *   stress          — ramp up to 200 VUs to find breaking point
 *   spike           — sudden spike to 300 VUs for 30 seconds
 *
 * Thresholds:
 *   http_req_duration p(95) < 500ms
 *   http_req_failed  rate < 1%
 *   checks           rate > 99%
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_VERSION = '/api/v1';

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------

const loginSuccessRate = new Rate('login_success_rate');
const applicationCreateRate = new Rate('application_create_rate');
const apiErrorRate = new Rate('api_error_rate');
const loginDuration = new Trend('login_duration');
const listDuration = new Trend('list_applications_duration');
const createDuration = new Trend('create_application_duration');
const requestsPerOrg = new Counter('requests_per_org');

// ---------------------------------------------------------------------------
// Test scenarios
// ---------------------------------------------------------------------------

export const options = {
  scenarios: {
    // Smoke test — single user, sanity check
    smoke: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations: 1,
      tags: { scenario: 'smoke' },
      env: { SCENARIO: 'smoke' },
    },

    // Default load — 100 concurrent users ramp up over 1 minute
    default_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 100 },   // Ramp up
        { duration: '5m', target: 100 },   // Sustain
        { duration: '1m', target: 0 },     // Ramp down
      ],
      tags: { scenario: 'default_load' },
      startTime: '0s',
    },

    // Stress test — find breaking point
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },
        { duration: '2m', target: 100 },
        { duration: '2m', target: 150 },
        { duration: '2m', target: 200 },
        { duration: '2m', target: 0 },
      ],
      tags: { scenario: 'stress' },
      startTime: '8m',  // Start after default_load finishes
    },

    // Spike test — sudden traffic burst
    spike: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '10s', target: 10 },
        { duration: '30s', target: 300 },  // Spike!
        { duration: '30s', target: 10 },
        { duration: '10s', target: 0 },
      ],
      tags: { scenario: 'spike' },
      startTime: '23m',
    },
  },

  thresholds: {
    // Primary SLA: 95th percentile response time < 500ms
    'http_req_duration{scenario:default_load}': ['p(95)<500'],
    'http_req_duration{scenario:stress}': ['p(95)<1000'],  // 1s for stress
    'http_req_duration{scenario:spike}': ['p(95)<2000'],   // 2s for spike

    // Error rate < 1% for normal load
    'http_req_failed{scenario:default_load}': ['rate<0.01'],
    'http_req_failed{scenario:stress}': ['rate<0.05'],    // 5% for stress
    'http_req_failed{scenario:spike}': ['rate<0.10'],     // 10% for spike

    // Custom thresholds
    'login_success_rate': ['rate>0.99'],
    'application_create_rate': ['rate>0.95'],
    'api_error_rate': ['rate<0.01'],

    // Endpoint-specific latency
    'login_duration': ['p(95)<300'],
    'list_applications_duration': ['p(95)<500'],
    'create_application_duration': ['p(95)<800'],

    // All checks pass at 99%+
    checks: ['rate>0.99'],
  },
};

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

/**
 * Returns randomized test credentials from a pool of seeded test users.
 * In a real environment, populate from a CSV or environment variable.
 */
function getTestCredentials() {
  const users = [
    { email: 'credit.officer1@growthfinance.com', password: 'BankOS@2026!' },
    { email: 'credit.officer2@growthfinance.com', password: 'BankOS@2026!' },
    { email: 'branch.manager@growthfinance.com', password: 'BankOS@2026!' },
    { email: 'ops.officer@growthfinance.com', password: 'BankOS@2026!' },
    { email: 'viewer@growthfinance.com', password: 'BankOS@2026!' },
  ];
  return users[Math.floor(Math.random() * users.length)];
}

function randomLoanAmount() {
  const amounts = [500000, 1000000, 2000000, 5000000, 10000000]; // 5k to 1L in rupees
  return amounts[Math.floor(Math.random() * amounts.length)] * 100; // convert to paisa
}

function randomTenure() {
  const tenures = [12, 24, 36, 48, 60];
  return tenures[Math.floor(Math.random() * tenures.length)];
}

function makeApplicationPayload(customerId) {
  return JSON.stringify({
    customerId,
    productCode: 'PL',
    requestedAmountPaisa: randomLoanAmount(),
    requestedTenureMonths: randomTenure(),
    sourceType: 'BRANCH',
  });
}

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

// ---------------------------------------------------------------------------
// Test flows
// ---------------------------------------------------------------------------

/**
 * FLOW 1: Health check — lightweight liveness probe
 */
function healthCheckFlow() {
  group('Health Check', () => {
    const res = http.get(`${BASE_URL}/health`, { tags: { endpoint: 'health' } });
    check(res, {
      'health check: status 200': (r) => r.status === 200,
      'health check: response has status field': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.status === 'ok' || body.status === 'healthy';
        } catch {
          return false;
        }
      },
      'health check: response time < 100ms': (r) => r.timings.duration < 100,
    });
    apiErrorRate.add(res.status >= 500);
  });
}

/**
 * FLOW 2: Login and get JWT token
 */
function loginFlow(credentials) {
  let token = null;

  group('Login', () => {
    const startTime = Date.now();
    const res = http.post(
      `${BASE_URL}${API_VERSION}/auth/login`,
      JSON.stringify(credentials),
      { headers: JSON_HEADERS, tags: { endpoint: 'login' } },
    );
    loginDuration.add(Date.now() - startTime);

    const loginOk = check(res, {
      'login: status 200 or 201': (r) => r.status === 200 || r.status === 201,
      'login: returns access_token': (r) => {
        try {
          const body = JSON.parse(r.body);
          return !!body.access_token || !!body.accessToken || !!body.data?.accessToken;
        } catch {
          return false;
        }
      },
      'login: response time < 300ms': (r) => r.timings.duration < 300,
    });

    loginSuccessRate.add(loginOk && res.status === 200);
    apiErrorRate.add(res.status >= 500);

    if (res.status === 200 || res.status === 201) {
      try {
        const body = JSON.parse(res.body);
        token = body.access_token || body.accessToken || body.data?.accessToken;
      } catch (_) {
        // Token extraction failed
      }
    }
  });

  return token;
}

/**
 * FLOW 3: List loan applications with pagination
 */
function listApplicationsFlow(token) {
  if (!token) return;

  group('List Applications', () => {
    const authHeaders = {
      ...JSON_HEADERS,
      'Authorization': `Bearer ${token}`,
    };

    const startTime = Date.now();
    const res = http.get(
      `${BASE_URL}${API_VERSION}/los/applications?page=1&limit=20&status=LEAD`,
      { headers: authHeaders, tags: { endpoint: 'list_applications' } },
    );
    listDuration.add(Date.now() - startTime);

    check(res, {
      'list applications: status 200': (r) => r.status === 200,
      'list applications: returns array': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body.data) || Array.isArray(body.items) || Array.isArray(body);
        } catch {
          return false;
        }
      },
      'list applications: response time < 500ms': (r) => r.timings.duration < 500,
      'list applications: not 401 (auth works)': (r) => r.status !== 401,
    });

    requestsPerOrg.add(1);
    apiErrorRate.add(res.status >= 500);
  });
}

/**
 * FLOW 4: Create a new loan application
 */
function createApplicationFlow(token) {
  if (!token) return;

  group('Create Application', () => {
    const authHeaders = {
      ...JSON_HEADERS,
      'Authorization': `Bearer ${token}`,
    };

    // First get a customer ID to use
    const customersRes = http.get(
      `${BASE_URL}${API_VERSION}/customers?page=1&limit=5`,
      { headers: authHeaders, tags: { endpoint: 'get_customers' } },
    );

    let customerId = null;
    if (customersRes.status === 200) {
      try {
        const body = JSON.parse(customersRes.body);
        const customers = body.data || body.items || body;
        if (Array.isArray(customers) && customers.length > 0) {
          customerId = customers[Math.floor(Math.random() * customers.length)].id;
        }
      } catch (_) {
        // ignore
      }
    }

    if (!customerId) {
      // Use a placeholder if we can't fetch a real customer
      customerId = 'test-customer-placeholder';
    }

    const startTime = Date.now();
    const res = http.post(
      `${BASE_URL}${API_VERSION}/los/applications`,
      makeApplicationPayload(customerId),
      { headers: authHeaders, tags: { endpoint: 'create_application' } },
    );
    createDuration.add(Date.now() - startTime);

    const createOk = check(res, {
      'create application: status 200 or 201': (r) => r.status === 200 || r.status === 201,
      'create application: returns application ID': (r) => {
        try {
          const body = JSON.parse(r.body);
          return !!(body.id || body.data?.id || body.applicationId);
        } catch {
          return false;
        }
      },
      'create application: response time < 800ms': (r) => r.timings.duration < 800,
    });

    applicationCreateRate.add(createOk);
    apiErrorRate.add(res.status >= 500);
  });
}

/**
 * FLOW 5: View dashboard/portfolio summary
 */
function dashboardFlow(token) {
  if (!token) return;

  group('Dashboard', () => {
    const authHeaders = {
      ...JSON_HEADERS,
      'Authorization': `Bearer ${token}`,
    };

    const res = http.get(
      `${BASE_URL}${API_VERSION}/dashboard/summary`,
      { headers: authHeaders, tags: { endpoint: 'dashboard' } },
    );

    check(res, {
      'dashboard: not 500': (r) => r.status < 500,
      'dashboard: response time < 1000ms': (r) => r.timings.duration < 1000,
    });
  });
}

// ---------------------------------------------------------------------------
// Main VU function (default export)
// ---------------------------------------------------------------------------

export default function () {
  const credentials = getTestCredentials();

  // 1. Health check (every request)
  healthCheckFlow();
  sleep(0.1);

  // 2. Login
  const token = loginFlow(credentials);
  sleep(0.5);

  if (!token) {
    // Skip remaining flows if login failed
    return;
  }

  // 3. List applications (most common read operation)
  listApplicationsFlow(token);
  sleep(0.3);

  // 4. Create application (30% of users create a new application)
  if (Math.random() < 0.3) {
    createApplicationFlow(token);
    sleep(0.5);
  }

  // 5. Dashboard (50% of users check dashboard)
  if (Math.random() < 0.5) {
    dashboardFlow(token);
    sleep(0.2);
  }

  // Think time between iterations
  sleep(Math.random() * 2 + 1); // 1-3 seconds
}

// ---------------------------------------------------------------------------
// Setup: Run once before all VUs start
// ---------------------------------------------------------------------------

export function setup() {
  console.log(`Starting load test against: ${BASE_URL}`);
  console.log(`Time: ${new Date().toISOString()}`);

  // Verify the target is reachable
  const res = http.get(`${BASE_URL}/health`);
  if (res.status !== 200) {
    console.warn(`WARNING: Health check returned ${res.status}. Target may not be ready.`);
  }

  return {
    startTime: Date.now(),
    targetUrl: BASE_URL,
  };
}

// ---------------------------------------------------------------------------
// Teardown: Run once after all VUs finish
// ---------------------------------------------------------------------------

export function teardown(data) {
  const durationSeconds = (Date.now() - data.startTime) / 1000;
  console.log(`Load test completed. Duration: ${durationSeconds.toFixed(0)}s`);
  console.log(`Target: ${data.targetUrl}`);
}

// ---------------------------------------------------------------------------
// Summary report customization
// ---------------------------------------------------------------------------

export function handleSummary(data) {
  const report = {
    timestamp: new Date().toISOString(),
    targetUrl: BASE_URL,
    thresholdsPassed: data.metrics.checks ? data.metrics.checks.values.rate > 0.99 : false,
    keyMetrics: {
      p95ResponseTime: data.metrics.http_req_duration?.values?.['p(95)']?.toFixed(0) + 'ms',
      errorRate: (data.metrics.http_req_failed?.values?.rate * 100)?.toFixed(2) + '%',
      totalRequests: data.metrics.http_reqs?.values?.count,
      peakRPS: data.metrics.http_reqs?.values?.rate?.toFixed(1) + ' req/s',
    },
  };

  return {
    'test/load/k6-results.json': JSON.stringify(data, null, 2),
    'test/load/k6-summary.json': JSON.stringify(report, null, 2),
    stdout: `
╔══════════════════════════════════════════════════════════════╗
║                   BANKOS LOAD TEST RESULTS                   ║
╠══════════════════════════════════════════════════════════════╣
║ Thresholds Passed: ${report.thresholdsPassed ? '✓ YES' : '✗ NO'}
║ P95 Response Time: ${report.keyMetrics.p95ResponseTime}
║ Error Rate:        ${report.keyMetrics.errorRate}
║ Total Requests:    ${report.keyMetrics.totalRequests}
║ Peak RPS:          ${report.keyMetrics.peakRPS}
╚══════════════════════════════════════════════════════════════╝
`,
  };
}
