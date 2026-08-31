import { expect, type Page, type Response } from '@playwright/test';

export interface ClientReturnInput {
  clientName: string;
  clientNetUid: string;
  clientSearchValue: string;
  orderItemId: number;
  orderItemNetUid: string;
  organizationName: string;
  organizationNetUid: string;
  qty: number;
  saleNetUid: string;
  saleNumber: string;
  searchByArticleOnly?: boolean;
  status: number;
  statusLabel: string;
  storageId: number;
  storageName: string;
  storageNetUid: string;
  vendorCode: string;
}

export interface CreatedClientReturnRef {
  saleReturnNetUid: string;
}

function apiPath(responseUrl: string): string {
  return new URL(responseUrl).pathname;
}

function unwrapBody(payload: unknown): unknown {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const envelope = payload as Record<string, unknown>;

    return 'Body' in envelope ? envelope.Body : payload;
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

    for (const key of ['Items', 'Sales', 'Data']) {
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

function readPersistedReturnNetUid(payload: unknown): string {
  const body = unwrapBody(payload);
  const nested = body && typeof body === 'object' && !Array.isArray(body)
    ? body as Record<string, unknown>
    : {};
  const saleReturn = nested.SaleReturn && typeof nested.SaleReturn === 'object'
    ? nested.SaleReturn
    : body;
  const netUid = readNetUid(saleReturn);

  if (!netUid || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(netUid)) {
    throw new Error(`Sale-return response did not contain a persisted NetUID: ${JSON.stringify(payload).slice(0, 1000)}`);
  }

  return netUid;
}

function assertSearchContainsExactOrderItem(payload: unknown, input: ClientReturnInput): void {
  const exactSales = readArray(payload).filter((sale) => readNetUid(sale) === input.saleNetUid.toLowerCase());

  expect(exactSales, 'sales-for-return response contains the exact persisted sale').toHaveLength(1);
  const sale = exactSales[0] as Record<string, unknown>;
  const order = sale.Order && typeof sale.Order === 'object'
    ? sale.Order as Record<string, unknown>
    : {};
  const items = Array.isArray(order.OrderItems) ? order.OrderItems : [];
  const itemIdentities = items.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { id: null, netUid: null };
    }

    const record = item as Record<string, unknown>;

    return { id: Number(record.Id), netUid: readNetUid(record) };
  });
  const exactItems = items.filter((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return false;
    }

    const record = item as Record<string, unknown>;

    return Number(record.Id) === Number(input.orderItemId) && readNetUid(record) === input.orderItemNetUid.toLowerCase();
  });

  expect(
    exactItems,
    `sales-for-return response contains order item ${input.orderItemId}/${input.orderItemNetUid}; received ${JSON.stringify(itemIdentities)}`,
  ).toHaveLength(1);
}

function assertCreateRequest(response: Response, input: ClientReturnInput): void {
  const payload = response.request().postDataJSON() as Record<string, unknown>;
  const client = payload.Client as Record<string, unknown>;
  const items = payload.SaleReturnItems as Array<Record<string, unknown>>;

  expect(readNetUid(client), 'create request carries the exact selected client').toBe(input.clientNetUid.toLowerCase());
  expect(items, 'create request has one exact return item').toHaveLength(1);

  const item = items[0];
  const orderItem = item.OrderItem as Record<string, unknown>;
  const storage = item.Storage as Record<string, unknown>;

  expect(Number(orderItem.Id)).toBe(Number(input.orderItemId));
  expect(readNetUid(orderItem)).toBe(input.orderItemNetUid.toLowerCase());
  expect(Number(item.Qty)).toBe(input.qty);
  expect(Number(item.SaleReturnItemStatus)).toBe(input.status);
  expect(Number(storage.Id)).toBe(Number(input.storageId));
  expect(readNetUid(storage)).toBe(input.storageNetUid.toLowerCase());
}

export async function createClientReturn(page: Page, input: ClientReturnInput): Promise<CreatedClientReturnRef> {
  await page.goto('/sales/ukraine/all/returns/new');

  const organizationsResponsePromise = page.waitForResponse(
    (response) => response.request().method() === 'GET' && apiPath(response.url()).endsWith('/organizations/all'),
    { timeout: 30_000 },
  );
  await page.getByRole('button', { name: 'Створити', exact: true }).first().click();
  const organizationsResponse = await organizationsResponsePromise;
  expect(organizationsResponse.ok(), `organizations HTTP ${organizationsResponse.status()}`).toBe(true);
  const exactOrganizations = readArray(await organizationsResponse.json()).filter(
    (organization) => readNetUid(organization) === input.organizationNetUid.toLowerCase(),
  );
  expect(
    exactOrganizations,
    `organizations response contains ${input.organizationName}/${input.organizationNetUid}`,
  ).toHaveLength(1);
  const exactOrganization = exactOrganizations[0] as Record<string, unknown>;
  const organizationLabel = [exactOrganization.FullName, exactOrganization.Name]
    .find((value) => typeof value === 'string' && value.trim().length > 0);
  expect(organizationLabel, 'exact organization has a visible select label').toEqual(expect.any(String));

  const createDrawer = page.getByRole('dialog', { name: 'Нове повернення', exact: true });
  await expect(createDrawer).toBeVisible({ timeout: 20_000 });

  const organizationSelect = createDrawer.getByLabel('Організація', { exact: true });
  await organizationSelect.click();
  const organizationOption = page.getByRole('option', { name: String(organizationLabel), exact: true });
  await expect(organizationOption).toHaveCount(1);
  await organizationOption.click();

  if (!input.searchByArticleOnly) {
    const clientSelect = createDrawer.getByLabel('Клієнт', { exact: true });
    const clientResponsePromise = page.waitForResponse(
      (response) => {
        const url = new URL(response.url());

        return response.request().method() === 'GET' &&
          url.pathname.endsWith('/clients/sales-returns/search') &&
          url.searchParams.get('value') === input.clientSearchValue;
      },
      { timeout: 30_000 },
    );
    await clientSelect.fill(input.clientSearchValue);
    const clientResponse = await clientResponsePromise;
    expect(clientResponse.ok(), `client search HTTP ${clientResponse.status()}`).toBe(true);

    const clientOption = page
      .getByRole('option')
      .filter({ hasText: input.clientName })
      .filter({ hasText: input.clientSearchValue });
    await expect(clientOption).toHaveCount(1, { timeout: 20_000 });
    await clientOption.click();
  }

  const salesResponsePromise = page.waitForResponse(
    (response) => {
      const url = new URL(response.url());

      return response.request().method() === 'GET' &&
        url.pathname.endsWith('/sales/all/returns/search') &&
        url.searchParams.get('value') === input.vendorCode &&
        (input.searchByArticleOnly
          ? url.searchParams.get('netId') === ''
          : url.searchParams.get('netId')?.toLowerCase() === input.clientNetUid.toLowerCase()) &&
        url.searchParams.get('organizationNetId')?.toLowerCase() === input.organizationNetUid.toLowerCase();
    },
    { timeout: 60_000 },
  );
  await createDrawer.getByLabel('Артикул', { exact: true }).fill(input.vendorCode);
  const salesResponse = await salesResponsePromise;
  expect(salesResponse.ok(), `sales-for-return HTTP ${salesResponse.status()}`).toBe(true);
  assertSearchContainsExactOrderItem(await salesResponse.json(), input);

  const saleRow = createDrawer
    .locator('tbody tr.data-table-row')
    .filter({ hasText: input.saleNumber })
    .filter({ hasText: input.vendorCode });
  await expect(saleRow).toHaveCount(1, { timeout: 30_000 });
  await saleRow.getByRole('button', { name: 'Додати', exact: true }).click();

  const editor = page.getByRole('dialog', { name: 'Позиція повернення', exact: true });
  await expect(editor).toBeVisible({ timeout: 20_000 });
  await editor.getByLabel('Кількість', { exact: true }).fill(String(input.qty));

  const storageResponsePromise = page.waitForResponse(
    (response) => {
      const url = new URL(response.url());

      return response.request().method() === 'GET' &&
        url.pathname.endsWith('/storages/all/returns/filtered') &&
        url.searchParams.get('orderItemNetId')?.toLowerCase() === input.orderItemNetUid.toLowerCase() &&
        url.searchParams.get('organizationNetId')?.toLowerCase() === input.organizationNetUid.toLowerCase() &&
        Number(url.searchParams.get('status')) === input.status;
    },
    { timeout: 30_000 },
  );
  await editor.getByLabel('Причина', { exact: true }).click();
  await page.getByRole('option', { name: input.statusLabel, exact: true }).click();
  const storageResponse = await storageResponsePromise;
  expect(storageResponse.ok(), `return storages HTTP ${storageResponse.status()}`).toBe(true);
  expect(
    readArray(await storageResponse.json()).filter((storage) => readNetUid(storage) === input.storageNetUid.toLowerCase()),
    'return-storage response contains the exact source storage',
  ).toHaveLength(1);

  const storageSelect = editor.getByLabel('Склад повернення', { exact: true });
  await expect(storageSelect).toBeEnabled();
  await storageSelect.click();
  const storageOption = page.getByRole('option').filter({ hasText: input.storageName });
  await expect(storageOption).toHaveCount(1);
  await storageOption.click();
  await editor.getByRole('button', { name: 'Додати', exact: true }).click();
  await expect(editor).toBeHidden();

  await createDrawer.getByRole('button', { name: `Перегляд (1)`, exact: true }).click();
  const reviewDrawer = page.getByRole('dialog', { name: 'Перегляд повернення', exact: true });
  await expect(reviewDrawer).toBeVisible({ timeout: 20_000 });
  await expect(reviewDrawer.getByText(input.vendorCode, { exact: true })).toBeVisible();
  await expect(reviewDrawer.getByText(input.statusLabel, { exact: false })).toBeVisible();

  const createResponsePromise = page.waitForResponse(
    (response) => response.request().method() === 'POST' && apiPath(response.url()).endsWith('/sales/returns/new'),
    { timeout: 120_000 },
  );
  await reviewDrawer.getByRole('button', { name: 'Зберегти', exact: true }).click();
  const createResponse = await createResponsePromise;
  assertCreateRequest(createResponse, input);
  expect(createResponse.ok(), `sale-return mutation HTTP ${createResponse.status()}`).toBe(true);
  const saleReturnNetUid = readPersistedReturnNetUid(await createResponse.json());

  await expect(reviewDrawer).toBeHidden({ timeout: 60_000 });
  await expect(createDrawer).toBeHidden({ timeout: 60_000 });

  return { saleReturnNetUid };
}
