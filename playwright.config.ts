import { defineConfig } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:8084';

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: 'test-results',
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    locale: 'uk-UA',
    timezoneId: 'Europe/Kyiv',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /fixtures\/auth\.setup\.ts/ },
    {
      name: 'smoke',
      testMatch: /specs\/f1-income\/.*\.spec\.ts/,
      grep: /@smoke/,
      dependencies: ['setup'],
      use: { storageState: 'e2e/.auth/user.json' },
    },
    {
      name: 'full',
      testMatch: /specs\/f1-income\/.*\.spec\.ts/,
      dependencies: ['setup'],
      use: { storageState: 'e2e/.auth/user.json' },
    },
  ],
});
