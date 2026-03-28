# Load Testing

This directory contains k6 load tests for the Praxis API.

## Prerequisites

Install k6:

```bash
# macOS
brew install k6

# Ubuntu/Debian
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

## Running Tests

### Local Development

```bash
# Run basic load test against local server
k6 run tests/load/basic-load.test.ts

# Run with custom API URL
API_URL=https://your-api.railway.app k6 run tests/load/basic-load.test.ts
```

### CI/CD

```bash
# Run in Docker
docker run -v $(pwd):/scripts -e API_URL=$API_URL grafana/k6 run /scripts/tests/load/basic-load.test.ts
```

## Test Scenarios

### Basic Load Test (`basic-load.test.ts`)

- Tests health, API root, leaderboard, public stats endpoints
- Simulates 10 → 50 → 100 users
- Targets: p95 < 500ms, error rate < 10%

## Adding More Tests

Create new test files in this directory following the k6 API:

```typescript
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 10,
  duration: "30s",
};

export default function () {
  const res = http.get("YOUR_ENDPOINT");
  check(res, { "status is 200": (r) => r.status === 200 });
  sleep(1);
}
```
