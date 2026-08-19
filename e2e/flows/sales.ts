import { expect, type Page } from '@playwright/test';

export interface WizardSaleInput {
  agreementNetUid: string;
  clientName: string;
  clientNetUid: string;
  vendorCode: string;
  qty: number;
}

export interface CreatedSaleRef {
  saleNetId: string;
}

function apiPath(responseUrl: string): string {
  return new URL(responseUrl).pathname;
}

function readPersistedSaleNetId(payload: unknown): string {
  const envelope = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {};
  const body = envelope.Body && typeof envelope.Body === 'object' && !Array.isArray(envelope.Body)
    ? envelope.Body as Record<string, unknown>
    : envelope;
  const sale = body.Sale && typeof body.Sale === 'object' && !Array.isArray(body.Sale)
    ? body.Sale as Record<string, unknown>
    : body;
  const netId = sale.NetUid ?? sale.NetUID ?? sale.NetId ?? sale.NetID;

  if (typeof netId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(netId)) {
    throw new Error(`Sale response did not contain a persisted sale NetUID: ${JSON.stringify(payload).slice(0, 1000)}`);
  }

  return netId.toLowerCase();
}

export async function createSaleViaWizard(page: Page, input: WizardSaleInput): Promise<CreatedSaleRef> {
  await page.goto('/sales/ukraine/all');
  const createButton = page.locator('.sales-filter-create');
  await expect(createButton).toBeEnabled({ timeout: 30_000 });
  await createButton.click();

  const wizard = page.locator('.new-sale-wizard-frame');
  await expect(wizard).toBeVisible({ timeout: 20_000 });

  const clientSearch = wizard.locator('.new-sale-client-drum__search');
  await clientSearch.focus();
  await page.keyboard.type(input.clientName.slice(0, 40), { delay: 40 });

  const normalizedClientNetUid = input.clientNetUid.toLowerCase();
  const clientRow = wizard.locator(
    `[data-testid="wizard-client-row"][data-client-net-uid="${normalizedClientNetUid}"]`,
  );
  await expect(clientRow).toHaveCount(1, { timeout: 30_000 });
  await clientRow.click({ force: true });

  const agreementCards = wizard.locator('.new-sale-agreement-card');
  await expect(agreementCards).toHaveCount(1, { timeout: 20_000 });
  await agreementCards.first().click({ force: true });
  await wizard.getByRole('button', { name: 'Далі', exact: true }).click();

  const productSearch = wizard.locator('.new-sale-product-picker__search');
  await expect(productSearch).toBeAttached({ timeout: 20_000 });
  await productSearch.focus();
  await page.keyboard.type(input.vendorCode, { delay: 40 });
  await expect(wizard.getByText(/Дост\./).first()).toBeVisible({ timeout: 30_000 });
  await productSearch.focus();
  await page.keyboard.press('Enter');

  const qtyModal = page.getByRole('dialog').filter({ hasText: 'Додати в кошик' });
  await expect(qtyModal).toBeVisible({ timeout: 20_000 });
  await qtyModal.getByLabel('Кількість', { exact: true }).fill(String(input.qty));
  const cartResponsePromise = page.waitForResponse(
    (response) => response.request().method() === 'POST' && apiPath(response.url()).endsWith('/orders/items/new'),
    { timeout: 30_000 },
  );
  const refreshedSalePromise = page.waitForResponse(
    (response) => {
      const url = new URL(response.url());
      return response.request().method() === 'GET' &&
        url.pathname.endsWith('/sales/get/current') &&
        url.searchParams.get('netId')?.toLowerCase() === input.agreementNetUid.toLowerCase();
    },
    { timeout: 30_000 },
  );
  await qtyModal.getByRole('button', { name: 'Додати', exact: true }).click();
  const cartResponse = await cartResponsePromise;
  expect(cartResponse.ok(), `cart mutation HTTP ${cartResponse.status()}`).toBe(true);
  const refreshedSaleResponse = await refreshedSalePromise;
  expect(refreshedSaleResponse.ok(), `current-sale refresh HTTP ${refreshedSaleResponse.status()}`).toBe(true);
  const saleNetId = readPersistedSaleNetId(await refreshedSaleResponse.json());

  const nextButton = wizard.getByRole('button', { name: 'Далі', exact: true });
  await expect(nextButton).toBeEnabled({ timeout: 20_000 });
  await nextButton.click();

  const transporter = wizard.getByLabel('Перевізник', { exact: true });
  await expect(transporter).toBeVisible({ timeout: 30_000 });
  await transporter.click();
  const selfPickup = page.getByRole('option', { name: 'Самовивіз', exact: true });
  await expect(selfPickup).toBeVisible({ timeout: 20_000 });
  await selfPickup.click();
  await expect(transporter).toHaveValue('Самовивіз');
  await expect(wizard.getByLabel('Адреса', { exact: true })).toHaveCount(0);

  const submit = wizard.locator('.new-sale-review-actions__primary');
  await expect(submit).toBeEnabled({ timeout: 30_000 });
  const saleResponsePromise = page.waitForResponse(
    (response) => {
      const path = apiPath(response.url());
      return response.request().method() === 'POST' &&
        (path.endsWith('/sales/new') ||
          path.endsWith('/sales/update/file') ||
          path.endsWith('/sales/update/get/payment/document'));
    },
    { timeout: 120_000 },
  );
  await submit.click();
  const saleResponse = await saleResponsePromise;
  expect(saleResponse.ok(), `sale mutation HTTP ${saleResponse.status()}`).toBe(true);
  await expect(wizard).toBeHidden({ timeout: 60_000 });

  return { saleNetId };
}
