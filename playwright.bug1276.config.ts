import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/browser',
  testMatch: 'bug1276.scroll.spec.ts',
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4176',
    browserName: 'chromium',
    launchOptions: { channel: 'chrome' },
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4176 --strictPort',
    url: 'http://127.0.0.1:4176/tests/browser/bug1276.html',
    reuseExistingServer: false,
  },
})
