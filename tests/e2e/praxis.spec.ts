import { test, expect } from '@playwright/test';

// ============================================================================
// Authentication Flows
// ============================================================================

test.describe('Authentication', () => {
  test('should show login page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Praxis/);
  });

  test('should show registration form', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('should validate password strength', async ({ page }) => {
    await page.goto('/register');
    
    // Try weak password
    await page.fill('input[type="password"]', '123');
    await page.click('button[type="submit"]');
    
    // Should show error
    await expect(page.locator('text=password')).toBeVisible();
  });
});

// ============================================================================
// Goal Management Flows
// ============================================================================

test.describe('Goal Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as demo user or skip if not configured
    await page.goto('/login');
    // Note: Actual login would require test credentials
    test.skip();
  });

  test('should create a new goal', async ({ page }) => {
    await page.goto('/notes');
    
    // Click "Add Goal" button
    await page.click('button:has-text("Add Goal")');
    
    // Fill goal details
    await page.fill('input[placeholder*="goal"]', 'Test E2E Goal');
    await page.selectOption('select', 'Career');
    
    // Save
    await page.click('button:has-text("Save")');
    
    // Verify goal appears in tree
    await expect(page.locator('text=Test E2E Goal')).toBeVisible();
  });

  test('should update goal progress', async ({ page }) => {
    await page.goto('/notes');
    
    // Find a goal and update progress
    const goalCard = page.locator('[data-testid="goal-card"]').first();
    await goalCard.click();
    
    // Use progress slider
    const slider = page.locator('input[type="range"]');
    await slider.fill('50');
    
    // Verify progress updated
    await expect(page.locator('text=50%')).toBeVisible();
  });
});

// ============================================================================
// Tracker & Logging Flows
// ============================================================================

test.describe('Tracker & Logging', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    test.skip();
  });

  test('should log a tracker entry', async ({ page }) => {
    await page.goto('/notes');
    
    // Select a goal
    await page.click('[data-testid="goal-card"]:first-child');
    
    // Click log tracker
    await page.click('button:has-text("Log")');
    
    // Fill tracker data
    await page.fill('input[type="number"]', '10');
    
    // Submit
    await page.click('button[type="submit"]');
    
    // Verify entry appears
    await expect(page.locator('text=Logged')).toBeVisible();
  });

  test('should show activity calendar', async ({ page }) => {
    await page.goto('/notes');
    
    // Calendar should be visible
    await expect(page.locator('[data-testid="activity-calendar"]')).toBeVisible();
    
    // Should have some days marked (if user has activity)
    const activeDays = page.locator('[data-active="true"]');
    await expect(activeDays.count()).toBeGreaterThan(0);
  });
});

// ============================================================================
// Payment & Premium Flows (CRITICAL)
// ============================================================================

test.describe('Payment Flows', () => {
  test('should show upgrade page', async ({ page }) => {
    await page.goto('/upgrade');
    
    await expect(page.locator('text=Premium')).toBeVisible();
    await expect(page.locator('text=pricing')).toBeVisible();
  });

  test('should handle Stripe checkout', async ({ page }) => {
    await page.goto('/upgrade');
    
    // Click upgrade button
    await page.click('button:has-text("Upgrade")');
    
    // Should redirect to Stripe or show Stripe modal
    // Note: Actual payment testing requires Stripe test mode
    test.skip();
  });
});

// ============================================================================
// Axiom AI Coaching Flows
// ============================================================================

test.describe('Axiom AI Coaching', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    test.skip();
  });

  test('should show Axiom daily protocol', async ({ page }) => {
    await page.goto('/coaching');
    
    // Should show Axiom message
    await expect(page.locator('text=Axiom')).toBeVisible();
    
    // Should show routine
    await expect(page.locator('text=routine')).toBeVisible();
  });

  test('should regenerate Axiom brief', async ({ page }) => {
    await page.goto('/coaching');
    
    // Click regenerate button
    await page.click('button:has-text("Refresh")');
    
    // Should show loading then new content
    await expect(page.locator('[data-testid="axiom-loading"]')).toBeVisible();
  });
});

// ============================================================================
// Social Features
// ============================================================================

test.describe('Social Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    test.skip();
  });

  test('should create a post', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Click compose
    await page.click('button:has-text("Post")');
    
    // Fill content
    await page.fill('textarea', 'Test E2E post');
    
    // Submit
    await page.click('button[type="submit"]');
    
    // Verify post appears
    await expect(page.locator('text=Test E2E post')).toBeVisible();
  });

  test('should send a message', async ({ page }) => {
    await page.goto('/communication');
    
    // Select conversation
    await page.click('[data-testid="conversation"]:first-child');
    
    // Type message
    await page.fill('input[placeholder*="message"]', 'Test E2E message');
    
    // Send
    await page.click('button[type="submit"]');
    
    // Verify message appears
    await expect(page.locator('text=Test E2E message')).toBeVisible();
  });
});

// ============================================================================
// Mobile Responsiveness
// ============================================================================

test.describe('Mobile Responsiveness', () => {
  test('should work on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    await page.goto('/');
    
    // Should not have horizontal scroll
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = page.viewportSize()?.width || 0;
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
  });

  test('should show mobile navigation', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard');
    
    // Mobile menu should be visible
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
  });
});

// ============================================================================
// Error Handling
// ============================================================================

test.describe('Error Handling', () => {
  test('should show 404 page', async ({ page }) => {
    await page.goto('/nonexistent-page-12345');
    
    await expect(page.locator('text=404')).toBeVisible();
    await expect(page.locator('text=not found')).toBeVisible();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    await page.route('**/api/**', route => route.abort('failed'));
    
    await page.goto('/dashboard');
    
    // Should show error message, not crash
    await expect(page.locator('text=error')).toBeVisible();
  });
});
