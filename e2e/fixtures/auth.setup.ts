import { expect, test as setup } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { EntitiesStore } from './entities';

const statePath = path.resolve('e2e/.auth/user.json');

setup('логін і збереження сесії', async ({ page, context, baseURL }) => {
  const username = process.env.E2E_USERNAME;
  const password = process.env.E2E_PASSWORD;
  if (!username || !password) {
    throw new Error('Set E2E_USERNAME and E2E_PASSWORD.');
  }
  if (!/^http:\/\/localhost(:\d+)?$/.test(baseURL ?? '')) {
    throw new Error(
      `E2E_BASE_URL must be http://localhost:<port> so Secure __Host- cookies are accepted; got: ${baseURL}`,
    );
  }

  await page.goto('/login');
  await page.getByLabel('Логін', { exact: true }).fill(username);
  await page.getByLabel('Пароль', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Увійти' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 45_000 });

  const cookies = await context.cookies();
  expect(cookies.some((cookie) => cookie.name === '__Host-gba_at')).toBe(true);

  const rawSession = await page.evaluate(() => window.localStorage.getItem('gba_console_session'));
  expect(rawSession).toBeTruthy();
  const session = JSON.parse(rawSession as string) as { csrfToken?: string; userNetUid?: string };
  expect(session.csrfToken).toBeTruthy();
  expect(session.userNetUid).toBeTruthy();

  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  await context.storageState({ path: statePath });
  EntitiesStore.reset();
});
