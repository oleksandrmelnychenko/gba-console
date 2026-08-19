import { expect, test } from '../fixtures/test';

test.describe('оболонка консолі @smoke', () => {
  test('дашборд відкривається, сесія жива, без JS-помилок', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(String(error)));

    await page.goto('/dashboard');
    await expect(page.locator('#root')).not.toBeEmpty();

    const session = await page.request.get('/api/v1/uk/usermanagement/token/session');
    expect(session.ok()).toBe(true);
    expect(pageErrors).toEqual([]);
  });

  test('ключові розділи відкриваються без білого екрана', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(String(error)));
    const routes = ['/sales/ukraine/all', '/orders/ukraine/all', '/products/capitalization', '/warehouse/ukraine'];

    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator('#root')).not.toBeEmpty();
      await expect(page.locator('#root')).not.toContainText('Щось пішло не так');
    }

    expect(pageErrors).toEqual([]);
  });
});
