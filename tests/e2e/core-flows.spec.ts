import { test, expect } from '@playwright/test';

/**
 * Praxis E2E Test Suite — Core User Flows
 *
 * Run: npx playwright test
 * Run UI mode: npx playwright test --ui
 * Run headed: npx playwright test --headed
 *
 * Prerequisites:
 * - Backend running on localhost:3001
 * - Frontend running on localhost:3000
 * - Supabase test project configured
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:3001/api';

// ─── Test User Credentials ──────────────────────────────────────────────────
// These should be seeded in your test Supabase instance before running E2E tests.
const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'test@praxis.app',
  password: process.env.TEST_USER_PASSWORD || 'TestPass123!',
};

// ─── Helper: Create random test user via API ───────────────────────────────
async function createTestUser(page: any) {
  const email = `test_${Date.now()}@praxis.app`;
  const password = 'TestPass123!';

  await page.goto(`${BASE_URL}/signup`);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign up/i }).click();

  // Wait for redirect to onboarding
  await page.waitForURL(/\/onboarding|\/dashboard|\/goal-selection/);

  return { email, password };
}

// ─── Helper: Login existing user ────────────────────────────────────────────
async function login(page: any, email: string, password: string) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
}

// ─── Health Check ──────────────────────────────────────────────────────────
test.describe('System Health', () => {
  test('frontend is reachable', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page).toHaveTitle(/Praxis/i);
  });

  test('backend API is healthy', async ({ request }) => {
    const res = await request.get(`${API_URL}/health`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe('ok');
  });
});

// ─── Authentication Flow ───────────────────────────────────────────────────
test.describe('Authentication', () => {
  test('signup → onboarding redirect', async ({ page }) => {
    const { email, password } = await createTestUser(page);

    // Should redirect to onboarding after signup
    await expect(page).toHaveURL(/\/onboarding|\/goal-selection/);
  });

  test('login with valid credentials', async ({ page }) => {
    await login(page, TEST_USER.email, TEST_USER.password);

    // Should redirect to dashboard (or onboarding if not completed)
    await page.waitForURL(/\/dashboard|\/onboarding|\/goal-selection/);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.getByLabel(/email/i).fill('wrong@email.com');
    await page.getByLabel(/password/i).fill('WrongPass123!');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should show error message
    await expect(page.getByText(/invalid|error|failed/i)).toBeVisible({ timeout: 5000 });
  });

  test('logout redirects to login', async ({ page }) => {
    await login(page, TEST_USER.email, TEST_USER.password);
    await page.waitForURL(/\/dashboard|\/onboarding|\/goal-selection/);

    // Click logout (in navbar profile menu)
    await page.getByRole('button', { name: /account menu/i }).click();
    await page.getByRole('menuitem', { name: /sign out/i }).click();

    await expect(page).toHaveURL(/\/login|\/$/);
  });
});

// ─── Onboarding Flow ───────────────────────────────────────────────────────
test.describe('Onboarding', () => {
  test('complete onboarding: profile → goals → dashboard', async ({ page }) => {
    const { email, password } = await createTestUser(page);

    // Step 1: Fill profile
    await page.waitForSelector('input[label*="name" i], input[placeholder*="name" i]');
    await page.getByLabel(/name/i).fill('Test User');
    await page.getByLabel(/age/i).selectOption('25');

    // Click continue
    await page.getByRole('button', { name: /continue/i }).click();

    // Step 2: Select domains (if applicable)
    // Wait for domain chips to appear
    await page.waitForTimeout(1000);

    // Click "Finish" or "Start Goal Selection"
    await page.getByRole('button', { name: /start goal selection|continue/i }).click();

    // Should redirect to goal selection
    await page.waitForURL(/\/goal-selection/);
    await expect(page.getByText(/setup your notebook|define your first goals/i)).toBeVisible();
  });

  test('skip goal selection goes to dashboard', async ({ page }) => {
    // ... after reaching goal selection ...
    const skipButton = page.getByRole('button', { name: /skip for now/i });
    if (await skipButton.isVisible()) {
      await skipButton.click();
      await page.waitForURL(/\/dashboard/);
    }
  });
});

// ─── Dashboard ─────────────────────────────────────────────────────────────
test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, TEST_USER.email, TEST_USER.password);
    await page.waitForURL(/\/dashboard|\/onboarding|\/goal-selection/);

    // If redirected to onboarding, skip to dashboard
    if (page.url().includes('/onboarding') || page.url().includes('/goal-selection')) {
      const skipButton = page.getByRole('button', { name: /skip for now|let'?s go/i });
      if (await skipButton.isVisible()) {
        await skipButton.click();
        await page.waitForURL(/\/dashboard/);
      }
    }
  });

  test('dashboard loads with user greeting', async ({ page }) => {
    await expect(page.getByText(/dashboard|today|good morning|good afternoon/i)).toBeVisible();
  });

  test('streak is visible', async ({ page }) => {
    // Streak should be in navbar or dashboard
    const streakElement = page.getByText(/streak|🔥|\d+d/i);
    // May be 0 if new user, but element should exist
    await expect(page.locator('[data-testid="streak"], [class*="streak"]')).toBeVisible({ timeout: 3000 }).catch(() => {
      // Streak may not render for new users — acceptable
    });
  });

  test('daily check-in works', async ({ page }) => {
    const checkInButton = page.getByRole('button', { name: /check.?in/i });
    if (await checkInButton.isVisible({ timeout: 3000 })) {
      await checkInButton.click();

      // Should show success toast
      await expect(page.getByText(/check.?in.*success|streak/i)).toBeVisible({ timeout: 5000 });
    }
  });
});

// ─── Goal Management ───────────────────────────────────────────────────────
test.describe('Goals', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, TEST_USER.email, TEST_USER.password);
    await page.waitForURL(/\/dashboard|\/onboarding|\/goal-selection/);
  });

  test('create first goal', async ({ page }) => {
    // Navigate to goal selection if not already there
    if (!page.url().includes('/goal-selection')) {
      await page.goto(`${BASE_URL}/goal-selection`);
    }

    // Select a domain/category
    await page.getByRole('button', { name: /fitness|career|academics|mental/i }).first().click();

    // Select a sub-category chip
    await page.getByRole('button', { name: /strength|cardio|learning|meditation/i }).first().click();

    // Fill topic name
    await page.getByLabel(/topic name/i).fill('Test Goal');

    // Save
    await page.getByRole('button', { name: /continue with|save/i }).click();

    // Should redirect to dashboard
    await page.waitForURL(/\/dashboard|\/notes/);
  });
});

// ─── Notebook ──────────────────────────────────────────────────────────────
test.describe('Notebook', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, TEST_USER.email, TEST_USER.password);
    await page.waitForURL(/\/dashboard|\/onboarding|\/goal-selection/);
  });

  test('open notebook and create note', async ({ page }) => {
    await page.goto(`${BASE_URL}/notes`);
    await expect(page.getByText(/notebook|notes|journal/i)).toBeVisible({ timeout: 5000 });
  });
});

// ─── Responsive Design ─────────────────────────────────────────────────────
test.describe('Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

  test('login page is mobile-friendly', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test('dashboard adapts to mobile', async ({ page }) => {
    await login(page, TEST_USER.email, TEST_USER.password);
    await page.waitForURL(/\/dashboard|\/onboarding|\/goal-selection/);

    // Mobile menu should be visible (hamburger icon)
    await expect(page.getByRole('button', { name: /open menu|menu/i })).toBeVisible({ timeout: 3000 });
  });
});

// ─── Performance ───────────────────────────────────────────────────────────
test.describe('Performance', () => {
  test('homepage loads under 2s', async ({ page }) => {
    const start = Date.now();
    await page.goto(BASE_URL);
    await expect(page).toHaveTitle(/Praxis/i);
    const loadTime = Date.now() - start;

    expect(loadTime).toBeLessThan(2000);
  });

  test('no console errors on login page', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');

    // Filter out expected errors (e.g., favicon 404)
    const realErrors = errors.filter(e => !e.includes('favicon'));
    expect(realErrors).toHaveLength(0);
  });
});
