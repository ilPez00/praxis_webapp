/**
 * Praxis Webapp — Playwright Bug Investigation
 * Checks: routing, console errors, network 4xx/5xx, render crashes, broken links
 */
import { chromium, Browser, Page, ConsoleMessage } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const BASE = 'http://localhost:3000';
const LOG_FILE = path.join(__dirname, 'claude_steps.txt');

const ROUTES_TO_CHECK = [
  '/',
  '/login',
  '/signup',
  '/dashboard',
  '/diary',
  '/discover',
  '/commitments',
  '/open-bets',
  '/profile',
  '/analytics',
  '/notebook',
  '/places',
  '/chat',
  '/groups',
  '/friends',
  '/matches',
  '/settings',
  '/achievements',
  '/leaderboard',
  '/marketplace',
  '/goals',
  '/goal-selection',
  '/challenges',
  '/notes',
  '/search',
];

interface RouteResult {
  path: string;
  status: 'ok' | 'error' | 'crash';
  consoleErrors: string[];
  networkErrors: string[];
  httpErrors: { url: string; status: number }[];
  renderTime: number;
  notes: string[];
}

function log(msg: string) {
  console.log(msg);
}

function appendToSteps(content: string) {
  const timestamp = new Date().toISOString().slice(0, 19);
  const divider = '\n' + '='.repeat(80) + '\n';
  const block = `${divider}[${timestamp}] PLAYWRIGHT BUG INVESTIGATION\n${divider}${content}\n`;
  fs.appendFileSync(LOG_FILE, block, 'utf-8');
}

async function checkRoute(page: Page, routePath: string): Promise<RouteResult> {
  const result: RouteResult = {
    path: routePath,
    status: 'ok',
    consoleErrors: [],
    networkErrors: [],
    httpErrors: [],
    renderTime: 0,
    notes: [],
  };

  const consoleHandler = (msg: ConsoleMessage) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Filter out expected auth/network errors on protected routes
      if (!text.includes('401') && !text.includes('403') && !text.includes('favicon')) {
        result.consoleErrors.push(text.slice(0, 300));
      }
    }
    if (msg.type() === 'warning' && msg.text().includes('Warning:')) {
      result.notes.push(`React warning: ${msg.text().slice(0, 200)}`);
    }
  };

  const requestHandler = (response: any) => {
    const status = response.status();
    const url = response.url();
    if (status >= 400 && !url.includes('favicon') && !url.includes('supabase.co')) {
      result.httpErrors.push({ url: url.replace(BASE, ''), status });
    }
  };

  page.on('console', consoleHandler);
  page.on('response', requestHandler);

  const start = Date.now();
  try {
    await page.goto(BASE + routePath, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(1500); // let lazy components mount
    result.renderTime = Date.now() - start;

    // Check for crash indicators
    const bodyText = await page.locator('body').textContent({ timeout: 3000 }).catch(() => '');
    if (bodyText?.includes('Something went wrong') || bodyText?.includes('error boundary')) {
      result.status = 'crash';
      result.notes.push('Error boundary triggered');
    }

    // Check for blank page (auth redirect is OK)
    const hasContent = await page.locator('body > *').count() > 0;
    if (!hasContent) {
      result.status = 'error';
      result.notes.push('Blank page');
    }

    // Check for broken images
    const brokenImgs = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return imgs
        .filter(img => img.complete && img.naturalWidth === 0 && img.src && !img.src.startsWith('data:'))
        .map(img => img.src);
    });
    if (brokenImgs.length) {
      result.notes.push(`Broken images: ${brokenImgs.slice(0, 3).join(', ')}`);
    }

  } catch (err: any) {
    result.status = 'error';
    result.consoleErrors.push(`Navigation failed: ${err.message}`);
  }

  page.off('console', consoleHandler);
  page.off('response', requestHandler);

  if (result.consoleErrors.length || result.httpErrors.length) {
    if (result.status === 'ok') result.status = 'error';
  }

  return result;
}

async function checkInteractivity(page: Page): Promise<string[]> {
  const issues: string[] = [];

  // Test WelcomeTour shows up on first visit
  await page.goto(BASE + '/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  // Can't test tour without being logged in, note it
  issues.push('INFO: WelcomeTour only shows for authenticated users on first visit');

  // Test speed dial opens
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  const fab = page.locator('button').filter({ has: page.locator('svg line') }).first();
  const fabCount = await fab.count();
  if (fabCount === 0) {
    issues.push('SpeedDial FAB not found on public route / — expected (auth guard)');
  }

  // Check BottomNav present on /login (should NOT be shown)
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  const navText = await page.locator('nav').textContent({ timeout: 2000 }).catch(() => '');
  if (navText?.includes('TODAY') || navText?.includes('DIARY')) {
    issues.push('BUG: BottomNav showing on /login (should be hidden on public routes)');
  }

  return issues;
}

async function main() {
  log('Starting Playwright investigation…');

  let browser: Browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err: any) {
    log(`Failed to launch Chromium: ${err.message}`);
    appendToSteps(`PLAYWRIGHT FAILED TO LAUNCH: ${err.message}`);
    process.exit(1);
  }

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 14 Pro
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
  });
  const page = await context.newPage();

  const results: RouteResult[] = [];

  log(`Checking ${ROUTES_TO_CHECK.length} routes…`);
  for (const route of ROUTES_TO_CHECK) {
    log(`  → ${route}`);
    const result = await checkRoute(page, route);
    results.push(result);
  }

  const interactivity = await checkInteractivity(page);

  await browser.close();

  // Build report
  const bugs: string[] = [];
  const warnings: string[] = [];
  const ok: string[] = [];

  for (const r of results) {
    const summary = `[${r.path}] ${r.renderTime}ms`;
    if (r.status === 'crash') {
      bugs.push(`🔴 CRASH ${summary}\n   ${[...r.consoleErrors, ...r.notes].join('\n   ')}`);
    } else if (r.status === 'error' && r.consoleErrors.length) {
      bugs.push(`🟠 ERROR ${summary}\n   console: ${r.consoleErrors.slice(0, 2).join(' | ')}`);
    } else if (r.httpErrors.length) {
      const nonAuth = r.httpErrors.filter(e => e.status !== 401 && e.status !== 403);
      if (nonAuth.length) {
        bugs.push(`🟠 HTTP ${summary}\n   ${nonAuth.map(e => `${e.status} ${e.url}`).join('\n   ')}`);
      } else {
        warnings.push(`⚠️ AUTH ${summary} — ${r.httpErrors.length} 401/403 (expected on protected routes)`);
      }
    } else if (r.notes.length) {
      warnings.push(`⚠️ NOTE ${summary}\n   ${r.notes.join('\n   ')}`);
    } else {
      ok.push(`✅ ${summary}`);
    }
  }

  const report = [
    `PLAYWRIGHT BUG REPORT — ${new Date().toISOString().slice(0, 10)}`,
    `Routes checked: ${results.length} | Base: ${BASE}`,
    '',
    `BUGS (${bugs.length}):`,
    ...bugs,
    '',
    `WARNINGS (${warnings.length}):`,
    ...warnings,
    '',
    `INTERACTIVITY:`,
    ...interactivity,
    '',
    `OK (${ok.length}/${results.length}):`,
    ...ok,
  ].join('\n');

  log('\n' + report);
  appendToSteps(report);

  log(`\nResults logged to claude_steps.txt`);
}

main().catch(err => {
  console.error('Playwright script failed:', err);
  appendToSteps(`PLAYWRIGHT SCRIPT CRASHED: ${err.message}\n${err.stack}`);
  process.exit(1);
});
