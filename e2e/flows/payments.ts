import { expect, type Page } from '@playwright/test';

export interface ClientPaymentInput {
  agreementCurrencyNetUid: string;
  amount: number;
  clientAgreementNetUid: string;
  clientName: string;
  clientNetUid: string;
  clientSearchValue: string;
  registerCurrencyNetUid: string;
  saleNetUid: string;
  saleNumber: string;
}

export interface CreatedClientPaymentRef {
  arrivalNumber: string;
  incomePaymentOrderNetUid: string;
  operationNetUid: string;
}

const NET_UID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function unwrapBody(payload: unknown): unknown {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;

    return 'Body' in record ? record.Body : payload;
  }

  return payload;
}

function readArray(payload: unknown): unknown[] {
  const body = unwrapBody(payload);

  if (Array.isArray(body)) {
    return body;
  }

  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;

    for (const key of ['Items', 'Clients', 'Agreements', 'ClientAgreements', 'Data', 'Collection']) {
      if (Array.isArray(record[key])) {
        return record[key] as unknown[];
      }
    }
  }

  return [];
}

function readNetUid(entity: unknown): string | null {
  if (!entity || typeof entity !== 'object' || Array.isArray(entity)) {
    return null;
  }

  const record = entity as Record<string, unknown>;
  const value = record.NetUid ?? record.NetUID ?? record.NetId ?? record.NetID;

  return typeof value === 'string' ? value.toLowerCase() : null;
}

function collectClientNetUids(payload: unknown): string[] {
  const result = new Set<string>();

  const append = (client: unknown) => {
    const netUid = readNetUid(client);
    if (netUid) {
      result.add(netUid);
    }

    if (!client || typeof client !== 'object' || Array.isArray(client)) {
      return;
    }

    const links = (client as Record<string, unknown>).SubClients;
    if (!Array.isArray(links)) {
      return;
    }

    for (const link of links) {
      if (link && typeof link === 'object' && !Array.isArray(link)) {
        append((link as Record<string, unknown>).SubClient);
      }
    }
  };

  readArray(payload).forEach(append);

  return [...result];
}

function readPersistedOrderNetUid(payload: unknown): string {
  const body = unwrapBody(payload);
  const netUid = readNetUid(body);

  if (!netUid || !NET_UID.test(netUid)) {
    throw new Error(`Income-payment response did not contain a persisted NetUID: ${JSON.stringify(payload).slice(0, 1000)}`);
  }

  return netUid;
}

function assertCreateRequest(
  requestPayload: unknown,
  input: ClientPaymentInput,
  arrivalNumber: string,
): void {
  expect(requestPayload && typeof requestPayload === 'object').toBe(true);
  const order = requestPayload as Record<string, unknown>;

  expect(Number(order.Amount)).toBe(input.amount);
  expect(order.ArrivalNumber).toBe(arrivalNumber);
  expect(readNetUid(order.Client)).toBe(input.clientNetUid.toLowerCase());
  expect(readNetUid(order.ClientAgreement)).toBe(input.clientAgreementNetUid.toLowerCase());
  expect(readNetUid(order.Currency)).toBe(input.registerCurrencyNetUid.toLowerCase());

  const allocations = Array.isArray(order.IncomePaymentOrderSales)
    ? order.IncomePaymentOrderSales as Array<Record<string, unknown>>
    : [];
  expect(allocations, 'request contains exactly one selected sale debt').toHaveLength(1);
  expect(readNetUid(allocations[0].Sale)).toBe(input.saleNetUid.toLowerCase());
}

export async function createClientPayment(
  page: Page,
  input: ClientPaymentInput,
): Promise<CreatedClientPaymentRef> {
  await page.goto('/accounting/income-cashflows/new/client?type=2&operationType=0');

  const drawer = page.getByRole('dialog').filter({ hasText: 'Реквізити надходження' });
  await expect(drawer).toBeVisible({ timeout: 20_000 });

  const counterparty = drawer.getByRole('combobox', { name: 'Контрагент' });
  await expect(counterparty).toBeEnabled({ timeout: 30_000 });
  await counterparty.click();

  const clientResponsePromise = page.waitForResponse(
    (response) => {
      const url = new URL(response.url());

      return response.request().method() === 'GET' &&
        url.pathname.endsWith('/clients/income-cashflows/client-payment/search') &&
        url.searchParams.get('value') === input.clientSearchValue;
    },
    { timeout: 30_000 },
  );
  await counterparty.fill(input.clientSearchValue);
  const clientResponse = await clientResponsePromise;
  expect(clientResponse.ok(), `client search HTTP ${clientResponse.status()}`).toBe(true);
  expect(
    collectClientNetUids(await clientResponse.json()),
    'client search response contains the exact child/root client identity',
  ).toContain(input.clientNetUid.toLowerCase());

  const clientOption = page.getByRole('option', { name: input.clientName, exact: true });
  await expect(clientOption).toHaveCount(1, { timeout: 20_000 });

  const agreementsResponsePromise = page.waitForResponse(
    (response) => {
      const url = new URL(response.url());

      return response.request().method() === 'GET' &&
        url.pathname.endsWith('/agreements/client/all') &&
        url.searchParams.get('netId')?.toLowerCase() === input.clientNetUid.toLowerCase();
    },
    { timeout: 30_000 },
  );
  const exchangeRateResponsePromise = page.waitForResponse(
    (response) => {
      const url = new URL(response.url());

      return response.request().method() === 'GET' &&
        url.pathname.endsWith('/exchangerates/get/specific') &&
        url.searchParams.get('fromCurrencyNetId')?.toLowerCase() === input.registerCurrencyNetUid.toLowerCase() &&
        url.searchParams.get('toCurrencyNetId')?.toLowerCase() === input.agreementCurrencyNetUid.toLowerCase();
    },
    { timeout: 30_000 },
  );
  await clientOption.click();

  const agreementsResponse = await agreementsResponsePromise;
  expect(agreementsResponse.ok(), `client agreements HTTP ${agreementsResponse.status()}`).toBe(true);
  expect(
    readArray(await agreementsResponse.json()).map(readNetUid),
    'agreement response contains the exact agreement link',
  ).toContain(input.clientAgreementNetUid.toLowerCase());

  const exchangeRateResponse = await exchangeRateResponsePromise;
  expect(exchangeRateResponse.ok(), `specific exchange-rate HTTP ${exchangeRateResponse.status()}`).toBe(true);
  expect(Number(unwrapBody(await exchangeRateResponse.json()))).toBeGreaterThan(0);

  const debtRow = drawer.locator('tbody tr.data-table-row').filter({ hasText: input.saleNumber });
  await expect(debtRow).toHaveCount(1, { timeout: 30_000 });
  await debtRow.getByLabel('Вибрати борг').check();

  const calculationResponsePromise = page.waitForResponse(
    (response) => {
      const url = new URL(response.url());

      return response.request().method() === 'GET' &&
        url.pathname.endsWith('/payments/orders/income/exchange/calculate') &&
        Number(url.searchParams.get('amount')) === input.amount;
    },
    { timeout: 30_000 },
  );
  await drawer.getByRole('textbox', { name: 'Сума', exact: true }).fill(String(input.amount));
  const calculationResponse = await calculationResponsePromise;
  expect(calculationResponse.ok(), `income exchange calculation HTTP ${calculationResponse.status()}`).toBe(true);

  const exchangeRateInput = drawer.getByRole('textbox', { name: 'Курс' });
  await expect.poll(async () => Number(await exchangeRateInput.inputValue())).toBeGreaterThan(0);

  const movement = drawer.getByRole('combobox', { name: 'Стаття руху коштів' });
  await expect.poll(async () => (await movement.inputValue()).trim().length).toBeGreaterThan(0);

  const arrivalNumber = `E2E-FX-${Date.now()}`;
  await drawer.getByRole('textbox', { name: 'Вхідний номер' }).fill(arrivalNumber);

  const createResponsePromise = page.waitForResponse(
    (response) => response.request().method() === 'POST' &&
      new URL(response.url()).pathname.endsWith('/payments/orders/income/accounting/create/client-payment'),
    { timeout: 60_000 },
  );
  await drawer.getByRole('button', { name: 'Зберегти', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: 'Підтвердити створення прибуткового ордера' });
  await expect(confirmation).toBeVisible({ timeout: 20_000 });
  await confirmation.getByRole('button', { name: 'Підтвердити', exact: true }).click();
  const createResponse = await createResponsePromise;
  expect(createResponse.ok(), `income-payment mutation HTTP ${createResponse.status()}`).toBe(true);

  const operationNetUid = createResponse.request().headers()['idempotency-key']?.toLowerCase() || '';
  expect(operationNetUid).toMatch(NET_UID);
  expect(new URL(createResponse.url()).searchParams.get('auto')).toBe('false');
  assertCreateRequest(createResponse.request().postDataJSON(), input, arrivalNumber);

  const incomePaymentOrderNetUid = readPersistedOrderNetUid(await createResponse.json());
  await expect(page.getByText('Прибутковий ордер створено').first()).toBeVisible({ timeout: 30_000 });

  return {
    arrivalNumber,
    incomePaymentOrderNetUid,
    operationNetUid,
  };
}
