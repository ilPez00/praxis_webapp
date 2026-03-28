import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 users
    { duration: '1m', target: 10 },   // Stay at 10 users
    { duration: '30s', target: 50 },  // Ramp up to 50 users
    { duration: '2m', target: 50 },   // Stay at 50 users
    { duration: '30s', target: 100 }, // Ramp up to 100 users
    { duration: '2m', target: 100 },   // Stress test at 100 users
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests under 500ms
    errors: ['rate<0.1'],               // Error rate under 10%
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3001';

export default function () {
  // Health check (no auth)
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health status is 200': (r) => r.status === 200,
    'health response time < 200ms': (r) => r.timings.duration < 200,
  });
  errorRate.add(healthRes.status !== 200);

  // API root (no auth)
  const apiRes = http.get(`${BASE_URL}/api`);
  check(apiRes, {
    'api root status is 200': (r) => r.status === 200,
  });
  errorRate.add(apiRes.status !== 200);

  // Public leaderboard (no auth)
  const leaderboardRes = http.get(`${BASE_URL}/api/users/leaderboard`);
  check(leaderboardRes, {
    'leaderboard status is 200': (r) => r.status === 200,
  });
  errorRate.add(leaderboardRes.status !== 200);

  // Public stats (no auth)
  const statsRes = http.get(`${BASE_URL}/api/users/stats/public`);
  check(statsRes, {
    'public stats status is 200': (r) => r.status === 200,
  });
  errorRate.add(statsRes.status !== 200);

  sleep(1);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'tests/load/summary.json': JSON.stringify(data),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '';
  const enableColors = options.enableColors || false;
  
  let output = `${indent}Load Test Summary\n`;
  output += `${indent}==================\n`;
  
  if (data.metrics.http_req_duration) {
    const duration = data.metrics.http_req_duration;
    output += `${indent}HTTP Request Duration:\n`;
    output += `${indent}  avg: ${duration.values.avg.toFixed(2)}ms\n`;
    output += `${indent}  p95: ${duration.values['p(95)'].toFixed(2)}ms\n`;
    output += `${indent}  p99: ${duration.values['p(99)'].toFixed(2)}ms\n`;
  }
  
  if (data.metrics.errors) {
    output += `${indent}Error Rate: ${(data.metrics.errors.values.rate * 100).toFixed(2)}%\n`;
  }
  
  return output;
}
