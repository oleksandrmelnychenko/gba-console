import { defineConfig } from '@playwright/test';

/**
 * Explicit, read-only audit against the DEV sync result. It is intentionally
 * separate from playwright.config.ts: the disposable golden snapshot may be
 * older than the 1C documents under audit and must never yield a false green.
 */
export default defineConfig({
  testDir: './e2e/live-sync',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-live-sync', open: 'never' }]],
});
