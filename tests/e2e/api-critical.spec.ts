import { test, expect, request } from '@playwright/test';

const API_BASE = process.env.API_URL || 'http://localhost:3001/api';

test.describe('API - Critical Endpoints', () => {
  let authToken: string;
  let testUserId: string;

  test('POST /auth/signup - should create new user', async ({ request }) => {
    const uniqueEmail = `e2e-test-${Date.now()}@example.com`;
    
    const response = await request.post(`${API_BASE}/auth/signup`, {
      data: {
        email: uniqueEmail,
        password: 'TestPass123',
        name: 'E2E Test User',
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.user?.id).toBeDefined();
    testUserId = body.user.id;
  });

  test('POST /auth/login - should login with valid credentials', async ({ request }) => {
    const uniqueEmail = `e2e-login-${Date.now()}@example.com`;
    
    await request.post(`${API_BASE}/auth/signup`, {
      data: {
        email: uniqueEmail,
        password: 'TestPass123',
        name: 'E2E Login Test',
      },
    });

    const loginResponse = await request.post(`${API_BASE}/auth/login`, {
      data: {
        email: uniqueEmail,
        password: 'TestPass123',
      },
    });

    expect(loginResponse.status()).toBe(200);
    const body = await loginResponse.json();
    expect(body.access_token).toBeDefined();
    authToken = body.access_token;
  });

  test('POST /auth/login - should reject invalid password', async ({ request }) => {
    const uniqueEmail = `e2e-fail-${Date.now()}@example.com`;
    
    await request.post(`${API_BASE}/auth/signup`, {
      data: {
        email: uniqueEmail,
        password: 'TestPass123',
        name: 'E2E Fail Test',
      },
    });

    const response = await request.post(`${API_BASE}/auth/login`, {
      data: {
        email: uniqueEmail,
        password: 'WrongPassword',
      },
    });

    expect(response.status()).toBe(401);
  });

  test('GET /health - should return health status', async ({ request }) => {
    const response = await request.get(`${API_BASE.replace('/api', '')}/health`);
    
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
  });

  test('GET /health/ready - should return readiness check', async ({ request }) => {
    const response = await request.get(`${API_BASE.replace('/api', '')}/health/ready`);
    
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.checks?.database).toBeDefined();
  });

  test('POST /auth/signup - should reject weak password', async ({ request }) => {
    const response = await request.post(`${API_BASE}/auth/signup`, {
      data: {
        email: `e2e-weak-${Date.now()}@example.com`,
        password: 'weak',
        name: 'Test',
      },
    });

    expect(response.status()).toBe(400);
  });

  test('POST /auth/signup - should reject invalid email', async ({ request }) => {
    const response = await request.post(`${API_BASE}/auth/signup`, {
      data: {
        email: 'not-an-email',
        password: 'TestPass123',
        name: 'Test',
      },
    });

    expect(response.status()).toBe(400);
  });

  test('POST /auth/signup - should reject duplicate email', async ({ request }) => {
    const uniqueEmail = `e2e-dup-${Date.now()}@example.com`;
    
    await request.post(`${API_BASE}/auth/signup`, {
      data: {
        email: uniqueEmail,
        password: 'TestPass123',
        name: 'Test',
      },
    });

    const response = await request.post(`${API_BASE}/auth/signup`, {
      data: {
        email: uniqueEmail,
        password: 'TestPass123',
        name: 'Test',
      },
    });

    expect(response.status()).toBe(400);
  });
});

test.describe('API - Protected Endpoints (Authenticated)', () => {
  let authToken: string;
  let testUserId: string;

  test.beforeAll(async ({ request }) => {
    const uniqueEmail = `e2e-auth-${Date.now()}@example.com`;
    
    const response = await request.post(`${API_BASE}/auth/signup`, {
      data: {
        email: uniqueEmail,
        password: 'TestPass123',
        name: 'E2E Auth Test',
      },
    });

    const body = await response.json();
    authToken = body.access_token;
    testUserId = body.user?.id;
  });

  test('GET /users/:id - should return user profile with valid token', async ({ request }) => {
    const response = await request.get(`${API_BASE}/users/${testUserId}`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    expect(response.status()).toBe(200);
  });

  test('GET /users/:id - should reject request without token', async ({ request }) => {
    const response = await request.get(`${API_BASE}/users/${testUserId}`);

    expect(response.status()).toBe(401);
  });

  test('PUT /users/:id - should update profile with validation', async ({ request }) => {
    const response = await request.put(`${API_BASE}/users/${testUserId}`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      data: {
        name: 'Updated Name',
        bio: 'Test bio',
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.name).toBe('Updated Name');
  });

  test('PUT /users/:id - should reject invalid profile data', async ({ request }) => {
    const response = await request.put(`${API_BASE}/users/${testUserId}`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      data: {
        bio: 'x'.repeat(1000),
      },
    });

    expect(response.status()).toBe(400);
  });
});

test.describe('API - Rate Limiting', () => {
  test('should rate limit excessive requests', async ({ request }) => {
    const responses = [];
    
    for (let i = 0; i < 10; i++) {
      const response = await request.post(`${API_BASE}/auth/login`, {
        data: {
          email: 'rate-limit-test@example.com',
          password: 'wrong',
        },
      });
      responses.push(response.status());
    }

    const has429 = responses.includes(429);
    expect(has429).toBe(true);
  });
});

test.describe('API - Security Headers', () => {
  test('should include security headers', async ({ request }) => {
    const response = await request.get(`${API_BASE.replace('/api', '')}/health`);
    
    expect(response.status()).toBe(200);
    const headers = response.headers();
    
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBeDefined();
  });
});

test.describe('API - Admin Endpoints', () => {
  test('GET /admin - should require admin role', async ({ request }) => {
    const uniqueEmail = `e2e-admin-test-${Date.now()}@example.com`;
    
    const signupResponse = await request.post(`${API_BASE}/auth/signup`, {
      data: {
        email: uniqueEmail,
        password: 'TestPass123',
        name: 'E2E Admin Test',
      },
    });

    const body = await signupResponse.json();
    const token = body.access_token;

    const adminResponse = await request.get(`${API_BASE}/admin/users`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(adminResponse.status()).toBe(403);
  });
});
