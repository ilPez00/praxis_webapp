"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
// ============================================================================
// Authentication Flows
// ============================================================================
test_1.test.describe('Authentication', () => {
    (0, test_1.test)('should show login page', (_a) => __awaiter(void 0, [_a], void 0, function* ({ page }) {
        yield page.goto('/');
        yield (0, test_1.expect)(page).toHaveTitle(/Praxis/);
    }));
    (0, test_1.test)('should show registration form', (_a) => __awaiter(void 0, [_a], void 0, function* ({ page }) {
        yield page.goto('/register');
        yield (0, test_1.expect)(page.locator('input[type="email"]')).toBeVisible();
        yield (0, test_1.expect)(page.locator('input[type="password"]')).toBeVisible();
    }));
    (0, test_1.test)('should validate password strength', (_a) => __awaiter(void 0, [_a], void 0, function* ({ page }) {
        yield page.goto('/register');
        // Try weak password
        yield page.fill('input[type="password"]', '123');
        yield page.click('button[type="submit"]');
        // Should show error
        yield (0, test_1.expect)(page.locator('text=password')).toBeVisible();
    }));
});
// ============================================================================
// Goal Management Flows
// ============================================================================
test_1.test.describe('Goal Management', () => {
    test_1.test.beforeEach((_a) => __awaiter(void 0, [_a], void 0, function* ({ page }) {
        // Login as demo user or skip if not configured
        yield page.goto('/login');
        // Note: Actual login would require test credentials
        test_1.test.skip();
    }));
    (0, test_1.test)('should create a new goal', (_a) => __awaiter(void 0, [_a], void 0, function* ({ page }) {
        yield page.goto('/notes');
        // Click "Add Goal" button
        yield page.click('button:has-text("Add Goal")');
        // Fill goal details
        yield page.fill('input[placeholder*="goal"]', 'Test E2E Goal');
        yield page.selectOption('select', 'Career');
        // Save
        yield page.click('button:has-text("Save")');
        // Verify goal appears in tree
        yield (0, test_1.expect)(page.locator('text=Test E2E Goal')).toBeVisible();
    }));
    (0, test_1.test)('should update goal progress', (_a) => __awaiter(void 0, [_a], void 0, function* ({ page }) {
        yield page.goto('/notes');
        // Find a goal and update progress
        const goalCard = page.locator('[data-testid="goal-card"]').first();
        yield goalCard.click();
        // Use progress slider
        const slider = page.locator('input[type="range"]');
        yield slider.fill('50');
        // Verify progress updated
        yield (0, test_1.expect)(page.locator('text=50%')).toBeVisible();
    }));
});
// ============================================================================
// Tracker & Logging Flows
// ============================================================================
test_1.test.describe('Tracker & Logging', () => {
    test_1.test.beforeEach((_a) => __awaiter(void 0, [_a], void 0, function* ({ page }) {
        yield page.goto('/login');
        test_1.test.skip();
    }));
    (0, test_1.test)('should log a tracker entry', (_a) => __awaiter(void 0, [_a], void 0, function* ({ page }) {
        yield page.goto('/notes');
        // Select a goal
        yield page.click('[data-testid="goal-card"]:first-child');
        // Click log tracker
        yield page.click('button:has-text("Log")');
        // Fill tracker data
        yield page.fill('input[type="number"]', '10');
        // Submit
        yield page.click('button[type="submit"]');
        // Verify entry appears
        yield (0, test_1.expect)(page.locator('text=Logged')).toBeVisible();
    }));
    (0, test_1.test)('should show activity calendar', (_a) => __awaiter(void 0, [_a], void 0, function* ({ page }) {
        yield page.goto('/notes');
        // Calendar should be visible
        yield (0, test_1.expect)(page.locator('[data-testid="activity-calendar"]')).toBeVisible();
        // Should have some days marked (if user has activity)
        const activeDays = page.locator('[data-active="true"]');
        yield (0, test_1.expect)(activeDays.count()).toBeGreaterThan(0);
    }));
});
// ============================================================================
// Payment & Premium Flows (CRITICAL)
// ============================================================================
test_1.test.describe('Payment Flows', () => {
    (0, test_1.test)('should show upgrade page', (_a) => __awaiter(void 0, [_a], void 0, function* ({ page }) {
        yield page.goto('/upgrade');
        yield (0, test_1.expect)(page.locator('text=Premium')).toBeVisible();
        yield (0, test_1.expect)(page.locator('text=pricing')).toBeVisible();
    }));
    (0, test_1.test)('should handle Stripe checkout', (_a) => __awaiter(void 0, [_a], void 0, function* ({ page }) {
        yield page.goto('/upgrade');
        // Click upgrade button
        yield page.click('button:has-text("Upgrade")');
        // Should redirect to Stripe or show Stripe modal
        // Note: Actual payment testing requires Stripe test mode
        test_1.test.skip();
    }));
});
// ============================================================================
// Axiom AI Coaching Flows
// ============================================================================
test_1.test.describe('Axiom AI Coaching', () => {
    test_1.test.beforeEach((_a) => __awaiter(void 0, [_a], void 0, function* ({ page }) {
        yield page.goto('/login');
        test_1.test.skip();
    }));
    (0, test_1.test)('should show Axiom daily protocol', (_a) => __awaiter(void 0, [_a], void 0, function* ({ page }) {
        yield page.goto('/coaching');
        // Should show Axiom message
        yield (0, test_1.expect)(page.locator('text=Axiom')).toBeVisible();
        // Should show routine
        yield (0, test_1.expect)(page.locator('text=routine')).toBeVisible();
    }));
    (0, test_1.test)('should regenerate Axiom brief', (_a) => __awaiter(void 0, [_a], void 0, function* ({ page }) {
        yield page.goto('/coaching');
        // Click regenerate button
        yield page.click('button:has-text("Refresh")');
        // Should show loading then new content
        yield (0, test_1.expect)(page.locator('[data-testid="axiom-loading"]')).toBeVisible();
    }));
});
// ============================================================================
// Social Features
// ============================================================================
test_1.test.describe('Social Features', () => {
    test_1.test.beforeEach((_a) => __awaiter(void 0, [_a], void 0, function* ({ page }) {
        yield page.goto('/login');
        test_1.test.skip();
    }));
    (0, test_1.test)('should create a post', (_a) => __awaiter(void 0, [_a], void 0, function* ({ page }) {
        yield page.goto('/dashboard');
        // Click compose
        yield page.click('button:has-text("Post")');
        // Fill content
        yield page.fill('textarea', 'Test E2E post');
        // Submit
        yield page.click('button[type="submit"]');
        // Verify post appears
        yield (0, test_1.expect)(page.locator('text=Test E2E post')).toBeVisible();
    }));
    (0, test_1.test)('should send a message', (_a) => __awaiter(void 0, [_a], void 0, function* ({ page }) {
        yield page.goto('/communication');
        // Select conversation
        yield page.click('[data-testid="conversation"]:first-child');
        // Type message
        yield page.fill('input[placeholder*="message"]', 'Test E2E message');
        // Send
        yield page.click('button[type="submit"]');
        // Verify message appears
        yield (0, test_1.expect)(page.locator('text=Test E2E message')).toBeVisible();
    }));
});
// ============================================================================
// Mobile Responsiveness
// ============================================================================
test_1.test.describe('Mobile Responsiveness', () => {
    (0, test_1.test)('should work on mobile viewport', (_a) => __awaiter(void 0, [_a], void 0, function* ({ page }) {
        var _b;
        yield page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
        yield page.goto('/');
        // Should not have horizontal scroll
        const bodyWidth = yield page.evaluate(() => document.body.scrollWidth);
        const viewportWidth = ((_b = page.viewportSize()) === null || _b === void 0 ? void 0 : _b.width) || 0;
        (0, test_1.expect)(bodyWidth).toBeLessThanOrEqual(viewportWidth);
    }));
    (0, test_1.test)('should show mobile navigation', (_a) => __awaiter(void 0, [_a], void 0, function* ({ page }) {
        yield page.setViewportSize({ width: 375, height: 667 });
        yield page.goto('/dashboard');
        // Mobile menu should be visible
        yield (0, test_1.expect)(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
    }));
});
// ============================================================================
// Error Handling
// ============================================================================
test_1.test.describe('Error Handling', () => {
    (0, test_1.test)('should show 404 page', (_a) => __awaiter(void 0, [_a], void 0, function* ({ page }) {
        yield page.goto('/nonexistent-page-12345');
        yield (0, test_1.expect)(page.locator('text=404')).toBeVisible();
        yield (0, test_1.expect)(page.locator('text=not found')).toBeVisible();
    }));
    (0, test_1.test)('should handle network errors gracefully', (_a) => __awaiter(void 0, [_a], void 0, function* ({ page }) {
        yield page.route('**/api/**', route => route.abort('failed'));
        yield page.goto('/dashboard');
        // Should show error message, not crash
        yield (0, test_1.expect)(page.locator('text=error')).toBeVisible();
    }));
});
