import { defineConfig } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:8084';
const readyWorkflowSpecs = /(?:specs\/00-shell|specs\/f1-income\/.*|specs\/f2-sales\/.*|specs\/f3-returns\/.*|specs\/f4-warehouse\/.*|specs\/f5-cash\/.*|specs\/f6-cross\/.*)\.spec\.ts/;

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
      testMatch: readyWorkflowSpecs,
      grep: /@smoke/,
      dependencies: ['setup'],
      use: { storageState: 'e2e/.auth/user.json' },
    },
    {
      name: 'full',
      testMatch: readyWorkflowSpecs,
      dependencies: ['setup'],
      use: { storageState: 'e2e/.auth/user.json' },
    },
  ],
});
