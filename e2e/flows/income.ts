import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type { TestIncomeParseConfig, TestIncomeSupplier } from '../data/testIncome';
import { CUSTOMS_DATE } from '../data/testIncome';
import { bodyOf } from '../helpers/envelope';
import { customsSpecificationFile, assertNotRawCcd } from '../helpers/uploads';

async function selectFirstCombobox(page: Page, name: string): Promise<void> {
  const combobox = page.getByRole('combobox', { name });
  await expect(combobox).toBeEnabled({ timeout: 30_000 });
  await combobox.click();
  await page.getByRole('option').first().click();
}

async function selectComboboxBySearch(
  page: Page,
  name: string,
  query: string,
  expectedOption?: string,
): Promise<void> {
  const combobox = page.getByRole('combobox', { name });
  await expect(combobox).toBeEnabled({ timeout: 30_000 });
  await combobox.click();
  await combobox.fill(query);
  const option = expectedOption
    ? page.getByRole('option', { name: expectedOption, exact: true })
    : page.getByRole('option').first();
  await expect(option).toHaveCount(1, { timeout: 30_000 });
  await option.click();
  await expect(combobox).toHaveValue(expectedOption ?? /.+/);
}

async function ensureComboboxSelected(page: Page, name: string): Promise<void> {
  const combobox = page.getByRole('combobox', { name });
  const current = await combobox.inputValue().catch(() => '');
  if (current && current.trim().length > 0) {
    return;
  }
  await selectFirstCombobox(page, name);
}

async function attachFile(page: Page, trigger: () => Promise<void>, filePath: string): Promise<void> {
  assertNotRawCcd(filePath);
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), trigger()]);
  await chooser.setFiles(filePath);
}

export interface CreatedOrderRef {
  organizationName: string;
  orderNetId: string;
  orderNumber: string;
}

export interface SpreadsheetUploadOptions {
  filePath?: string;
  number?: string;
  parse?: Partial<TestIncomeParseConfig>;
}

function uploadFile(supplier: TestIncomeSupplier, options?: SpreadsheetUploadOptions): string {
  return options?.filePath ?? customsSpecificationFile(supplier.dirPrefix);
}

function uploadParse(
  supplier: TestIncomeSupplier,
  options?: SpreadsheetUploadOptions,
): TestIncomeParseConfig {
  return { ...supplier.parse, ...options?.parse };
}

export function scopedNumber(supplier: TestIncomeSupplier, runId: string): string {
  return `${supplier.invoiceNumber}-${runId}`;
}

export async function createDirectOrderFromCcd(
  page: Page,
  supplier: TestIncomeSupplier,
  runId: string,
  options?: SpreadsheetUploadOptions,
): Promise<CreatedOrderRef> {
  const file = uploadFile(supplier, options);
  const parse = uploadParse(supplier, options);
  const number = scopedNumber(supplier, runId);

  await page.goto('/orders/ukraine/all/new');
  await expect(page.getByRole('button', { name: 'Створити' })).toBeVisible({ timeout: 30_000 });

  await selectComboboxBySearch(
    page,
    'Постачальник',
    supplier.supplierSearch ?? supplier.dirPrefix,
    supplier.supplierName,
  );
  await ensureComboboxSelected(page, 'Організація');
  await ensureComboboxSelected(page, 'Договір');
  const organizationName = await page.getByRole('combobox', { name: 'Організація' }).inputValue();
  expect(organizationName.trim().length, 'selected order organization').toBeGreaterThan(0);

  await attachFile(page, () => page.getByLabel('Файл', { exact: true }).click(), file);

  await page.getByLabel('Код товару', { exact: true }).fill(String(parse.productCode));
  await page.getByLabel('Кількість', { exact: true }).fill(String(parse.qty));
  await page.getByLabel('З рядка', { exact: true }).fill(String(parse.startRow));
  await page.getByLabel('До рядка', { exact: true }).fill(String(parse.endRow));
  await page.getByLabel('Колонка ціни', { exact: true }).fill(String(parse.price));

  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes('/supplies/orders/ukraine/new/file') && res.request().method() === 'POST',
      { timeout: 120_000 },
    ),
    page.getByRole('button', { name: 'Створити' }).click(),
  ]);
  expect(response.ok(), `order upload HTTP ${response.status()}`).toBe(true);
  const body = bodyOf<Record<string, unknown>>(await response.json());
  expect(body.HasError, `order parse HasError; MissingVendorCodes=${JSON.stringify(body.MissingVendorCodes)}`).not.toBe(true);

  const supplyOrder = (body.SupplyOrder ?? body.supplyOrder) as Record<string, unknown> | undefined;
  const orderNetId = supplyOrder?.NetUID ?? supplyOrder?.NetUid;
  expect(orderNetId, `order NetUid missing in response: ${JSON.stringify(body).slice(0, 500)}`).toBeTruthy();

  await expect(page.getByText('Замовлення створено')).toBeVisible({ timeout: 20_000 });

  return { organizationName, orderNetId: String(orderNetId), orderNumber: number };
}

export async function createProForma(
  page: Page,
  supplier: TestIncomeSupplier,
  runId: string,
  orderNetId: string,
  options?: SpreadsheetUploadOptions,
): Promise<void> {
  const file = uploadFile(supplier, options);
  await page.goto(`/orders/ukraine/all/edit/${orderNetId}`);
  const card = page.locator('.supply-detail-card').filter({ hasText: 'Проформа' });
  await expect(card).toBeVisible({ timeout: 30_000 });

  const createButton = card.getByRole('button', { name: /Створити|Редагувати/ });
  if (!(await createButton.isVisible())) {
    const approveButton = page.getByRole('button', { name: 'Затвердити замовлення', exact: true });
    await expect(approveButton).toBeVisible({ timeout: 20_000 });
    const approveResponsePromise = page.waitForResponse(
      (response) => response.request().method() === 'POST' &&
        new URL(response.url()).pathname.endsWith('/supplies/orders/direct-supply-order/logistic-way/approve'),
      { timeout: 60_000 },
    );
    await approveButton.click();
    const approveResponse = await approveResponsePromise;
    expect(approveResponse.ok(), `order approval HTTP ${approveResponse.status()}`).toBe(true);
    await expect(page.getByText('Замовлення погоджено')).toBeVisible({ timeout: 20_000 });
  }
  await expect(createButton).toBeVisible({ timeout: 20_000 });
  await createButton.click();

  const numberField = card.getByLabel('Номер').first();
  await expect(numberField).toBeVisible({ timeout: 20_000 });
  await numberField.fill(`PF-${scopedNumber(supplier, runId)}`);

  await attachFile(page, () => card.getByRole('button', { name: 'Додати файли' }).click(), file);
  await expect(card.getByText('Документів немає')).toBeHidden({ timeout: 10_000 });

  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => new URL(res.url()).pathname.endsWith('/supplies/orders/direct-supply-order/logistic-way/proform') &&
        res.request().method() === 'POST',
      { timeout: 60_000 },
    ),
    card.getByRole('button', { name: 'Зберегти' }).click(),
  ]);
  expect(response.ok(), `proforma save HTTP ${response.status()}`).toBe(true);
  await expect(page.getByText('Проформу збережено')).toBeVisible({ timeout: 20_000 });
}

export async function createProFormaPaymentTask(
  page: Page,
  orderNetId: string,
  percent: number,
  responsibleName: string,
): Promise<void> {
  await page.goto(`/orders/ukraine/all/edit/${orderNetId}`);
  const createButton = page.getByRole('button', { name: 'Створити платіжну задачу', exact: true });
  await expect(createButton).toBeEnabled({ timeout: 30_000 });
  await createButton.click();

  const drawer = page.getByRole('dialog', { name: 'Створити платіжну задачу' });
  await expect(drawer).toBeVisible({ timeout: 20_000 });
  await drawer.getByLabel('Відсоток', { exact: true }).fill(String(percent));
  await drawer.getByLabel('Бух. витрата', { exact: true }).check();

  const responsible = drawer.getByRole('combobox', { name: 'Відповідальний за оплату' });
  await responsible.click();
  await responsible.fill(responsibleName);
  const responsibleOption = page.getByRole('option', { name: responsibleName, exact: true });
  await expect(responsibleOption).toHaveCount(1, { timeout: 30_000 });
  await responsibleOption.click();

  const responsePromise = page.waitForResponse(
    (response) => response.request().method() === 'POST' &&
      new URL(response.url()).pathname.endsWith('/supplies/invoices/direct-supply-order/logistic-way/payment-tasks/create'),
    { timeout: 60_000 },
  );
  await drawer.getByRole('button', { name: 'Зберегти', exact: true }).click();
  const response = await responsePromise;
  expect(response.ok(), `proforma payment task HTTP ${response.status()}`).toBe(true);
  await expect(drawer).toBeHidden({ timeout: 20_000 });
}

export interface CreatedInvoiceRef {
  invoiceNetId: string;
  invoiceNumber: string;
}

export interface CreatedDeliveryProtocolRef {
  protocolNetId: string;
}

export async function createArrivedDeliveryProtocol(
  page: Page,
  order: CreatedOrderRef,
  invoice: CreatedInvoiceRef,
  statuses: Array<'В дорозі' | 'Прибув'> = ['В дорозі', 'Прибув'],
): Promise<CreatedDeliveryProtocolRef> {
  await page.goto('/product-delivery-protocols');
  const addButton = page.locator('main').getByRole('button', { name: 'Додати', exact: true });
  await expect(addButton).toBeVisible({ timeout: 30_000 });
  await addButton.click();

  const createModal = page.getByRole('dialog').filter({ hasText: 'Додати протокол доставки товару' });
  await expect(createModal).toBeVisible({ timeout: 20_000 });
  const organization = createModal.getByRole('combobox', { name: 'Організація' });
  await organization.click();
  await organization.fill(order.organizationName);
  const organizationOption = page.getByRole('option', { name: order.organizationName, exact: true });
  await expect(organizationOption).toHaveCount(1, { timeout: 30_000 });
  await organizationOption.click();

  const createResponsePromise = page.waitForResponse(
    (response) => response.request().method() === 'POST' &&
      new URL(response.url()).pathname.endsWith('/delivery/product/protocol/registry/new'),
    { timeout: 60_000 },
  );
  await createModal.getByRole('button', { name: 'Створити', exact: true }).click();
  const createResponse = await createResponsePromise;
  expect(createResponse.ok(), `delivery protocol create HTTP ${createResponse.status()}`).toBe(true);
  const created = bodyOf<Record<string, unknown>>(await createResponse.json());
  const protocolNetId = created.NetUid ?? created.NetUID;
  expect(protocolNetId, `delivery protocol NetUid missing: ${JSON.stringify(created).slice(0, 500)}`).toBeTruthy();

  await page.waitForURL(new RegExp(`/product-delivery-protocols/${String(protocolNetId)}$`), { timeout: 30_000 });
  const protocolDrawer = page.getByRole('dialog').filter({ hasText: 'Протокол доставки товару' });
  await expect(protocolDrawer).toBeVisible({ timeout: 30_000 });
  await protocolDrawer.getByRole('button', { name: 'Управління інвойсами', exact: true }).click();

  const invoicesDrawer = page.getByRole('dialog', { name: 'Додати інвойси' });
  await expect(invoicesDrawer).toBeVisible({ timeout: 20_000 });
  const invoiceCard = invoicesDrawer.locator('.invoice-select-card').filter({ hasText: invoice.invoiceNumber });
  await expect(invoiceCard).toHaveCount(1, { timeout: 30_000 });
  await invoiceCard.getByRole('checkbox').check();

  const assignResponsePromise = page.waitForResponse(
    (response) => response.request().method() === 'POST' &&
      new URL(response.url()).pathname.endsWith('/delivery/product/protocol/logistic/add/supply/invoices'),
    { timeout: 60_000 },
  );
  await invoicesDrawer.getByRole('button', { name: 'Зберегти', exact: true }).click();
  const assignResponse = await assignResponsePromise;
  expect(assignResponse.ok(), `delivery protocol invoice assignment HTTP ${assignResponse.status()}`).toBe(true);
  await expect(invoicesDrawer).toBeHidden({ timeout: 30_000 });

  for (const action of statuses) {
    const statusButton = protocolDrawer.getByRole('button', { name: action, exact: true });
    await expect(statusButton).toBeEnabled({ timeout: 30_000 });
    await statusButton.click();
    const confirmation = page.getByRole('dialog', { name: 'Підтвердити зміну статусу' });
    await expect(confirmation).toBeVisible({ timeout: 20_000 });
    const statusResponsePromise = page.waitForResponse(
      (response) => response.request().method() === 'POST' &&
        new URL(response.url()).pathname.endsWith('/delivery/product/protocol/logistic/update/status'),
      { timeout: 60_000 },
    );
    await confirmation.getByRole('button', { name: 'Підтвердити', exact: true }).click();
    const statusResponse = await statusResponsePromise;
    expect(statusResponse.ok(), `delivery protocol ${action} HTTP ${statusResponse.status()}`).toBe(true);
  }

  if (statuses.includes('Прибув')) {
    await expect(protocolDrawer.getByRole('button', { name: 'Завершено', exact: true })).toBeDisabled({
      timeout: 30_000,
    });
  }

  return { protocolNetId: String(protocolNetId) };
}

export async function markDeliveryProtocolArrived(page: Page, protocolNetId: string): Promise<void> {
  await page.goto(`/product-delivery-protocols/${protocolNetId}`);
  const protocolDrawer = page.getByRole('dialog').filter({ hasText: 'Протокол доставки товару' });
  await expect(protocolDrawer).toBeVisible({ timeout: 30_000 });
  const statusButton = protocolDrawer.getByRole('button', { name: 'Прибув', exact: true });
  await expect(statusButton).toBeEnabled({ timeout: 30_000 });
  await statusButton.click();
  const confirmation = page.getByRole('dialog', { name: 'Підтвердити зміну статусу' });
  const responsePromise = page.waitForResponse(
    (response) => response.request().method() === 'POST' &&
      new URL(response.url()).pathname.endsWith('/delivery/product/protocol/logistic/update/status'),
    { timeout: 60_000 },
  );
  await confirmation.getByRole('button', { name: 'Підтвердити', exact: true }).click();
  const response = await responsePromise;
  expect(response.ok(), `delivery protocol Прибув HTTP ${response.status()}`).toBe(true);
}

export async function addInvoiceFromCcd(
  page: Page,
  supplier: TestIncomeSupplier,
  runId: string,
  orderNetId: string,
  options?: SpreadsheetUploadOptions,
): Promise<CreatedInvoiceRef> {
  const file = uploadFile(supplier, options);
  const parse = uploadParse(supplier, options);
  const number = options?.number ?? scopedNumber(supplier, runId);

  await page.goto(`/orders/ukraine/all/edit/${orderNetId}/supply-invoices`);
  const addInvoice = page.getByRole('button', { name: 'Додати інвойс' });
  await expect(addInvoice).toBeEnabled({ timeout: 30_000 });
  await addInvoice.click();

  const modal = page.getByRole('dialog').filter({ hasText: 'Додати інвойс' });
  await modal.getByLabel('Номер', { exact: true }).fill(number);
  await modal.getByLabel('Дата', { exact: true }).fill(`${supplier.invoiceDate}T10:00`);

  await attachFile(page, () => modal.getByLabel('Файл', { exact: true }).click(), file);

  await modal.getByLabel('Код товару', { exact: true }).fill(String(parse.productCode));
  await modal.getByLabel('Кількість', { exact: true }).fill(String(parse.qty));
  await modal.getByLabel('З рядка', { exact: true }).fill(String(parse.startRow));
  await modal.getByLabel('До рядка', { exact: true }).fill(String(parse.endRow));
  await modal.getByRole('textbox', { name: 'Ціна', exact: true }).fill(String(parse.price));

  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => new URL(res.url()).pathname.endsWith('/supplies/invoices/ukraine/update/file') &&
        res.request().method() === 'POST',
      { timeout: 120_000 },
    ),
    modal.getByRole('button', { name: 'Створити' }).click(),
  ]);
  expect(response.ok(), `invoice upload HTTP ${response.status()}`).toBe(true);
  const invoice = bodyOf<Record<string, unknown>>(await response.json());
  const invoiceNetId = invoice.NetUid ?? invoice.NetUID;
  expect(invoiceNetId, `invoice NetUid missing: ${JSON.stringify(invoice).slice(0, 500)}`).toBeTruthy();

  await expect(page.getByText('Інвойс завантажено')).toBeVisible({ timeout: 20_000 });

  return { invoiceNetId: String(invoiceNetId), invoiceNumber: number };
}

export async function addPackingListFromCcd(
  page: Page,
  supplier: TestIncomeSupplier,
  orderNetId: string,
  invoiceNumber: string,
  options?: SpreadsheetUploadOptions,
): Promise<void> {
  const file = uploadFile(supplier, options);
  const parse = uploadParse(supplier, options);

  await page.goto(`/orders/ukraine/all/edit/${orderNetId}/supply-invoices`);

  const addPackList = page.getByRole('button', { name: 'Додати пак лист' });
  await expect(addPackList).toBeEnabled({ timeout: 30_000 });
  await addPackList.click();

  const modal = page.getByRole('dialog').filter({ hasText: 'Додати пак лист' });
  await modal.getByLabel('Номер', { exact: true }).fill(options?.number ?? invoiceNumber);
  await modal.getByLabel('Дата', { exact: true }).fill(`${supplier.invoiceDate}T10:00`);

  await attachFile(page, () => modal.getByLabel('Файл', { exact: true }).click(), file);

  await modal.getByLabel('Код товару', { exact: true }).fill(String(parse.productCode));
  await modal.getByLabel('Кількість', { exact: true }).fill(String(parse.qty));
  await modal.getByLabel('З рядка', { exact: true }).fill(String(parse.startRow));
  await modal.getByLabel('До рядка', { exact: true }).fill(String(parse.endRow));
  await modal.getByRole('textbox', { name: 'Ціна', exact: true }).fill(String(parse.price));
  await modal.getByLabel('Нетто', { exact: true }).fill(String(parse.netWeight));
  await modal.getByLabel('Брутто', { exact: true }).fill(String(parse.grossWeight));

  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => new URL(res.url()).pathname.endsWith('/supplies/packinglists/ukraine/new/file') &&
        res.request().method() === 'POST',
      { timeout: 120_000 },
    ),
    modal.getByRole('button', { name: 'Створити' }).click(),
  ]);
  expect(response.ok(), `packing list upload HTTP ${response.status()}`).toBe(true);
  await expect(page.getByText('Пак лист завантажено')).toBeVisible({ timeout: 20_000 });
}

export async function uploadCustomsCodes(
  page: Page,
  supplier: TestIncomeSupplier,
  orderNetId: string,
  options?: SpreadsheetUploadOptions & { customsDate?: string },
): Promise<void> {
  const file = uploadFile(supplier, options);
  const parse = uploadParse(supplier, options);

  await page.goto(`/orders/ukraine/all/edit/${orderNetId}/specifications`);
  const trigger = page.getByRole('button', { name: 'Завантаження митних кодів' });
  await expect(trigger).toBeEnabled({ timeout: 30_000 });
  await trigger.click();

  const modal = page.getByRole('dialog').filter({ hasText: 'Завантаження митних кодів' });
  const fill = (labelStart: string, value: string | number) =>
    modal.getByLabel(new RegExp(`^${labelStart}(\\s*\\*)?$`)).first().fill(String(value));
  await fill('Дата митної декларації', options?.customsDate ?? CUSTOMS_DATE);
  await fill('Код', parse.productCode);
  await fill('Митна вартість', parse.customsValue);
  await fill('Митний код', parse.uktzed);
  await fill('Мито', parse.duty);
  await fill('Ціна', parse.price);
  await fill('К-сть', parse.qty);
  await fill('Сума ПДВ', parse.vat);
  await fill('Від', parse.startRow);
  await fill('До', parse.endRow);

  await attachFile(page, () => modal.getByLabel('Завантажити', { exact: true }).click(), file);

  const submitButton = modal.getByRole('button', { name: 'Завантажити' }).filter({ hasText: 'Завантажити' });
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => new URL(res.url()).pathname.endsWith('/supplies/invoices/direct-supply-order/specification/upload') &&
        res.request().method() === 'POST',
      { timeout: 180_000 },
    ),
    submitButton.click(),
  ]);
  expect(response.ok(), `specification upload HTTP ${response.status()}`).toBe(true);
}

// Places every packing item's full quantity into a single storage column via the UI
// dynamic-placement grid (add column → per-item drawer: add draft with the pre-filled
// full qty + default N-N-N address → accept → apply). Required before Оприходувати.
export async function placeAllItems(page: Page): Promise<void> {
  const addColumn = page.getByTestId('income-add-column');
  await expect(addColumn).toBeVisible({ timeout: 20_000 });
  await expect(addColumn).toBeEnabled();
  await addColumn.click();

  const columnModal = page.getByRole('dialog').filter({ hasText: 'Додати нову колонку' });
  await expect(columnModal).toBeVisible();

  const fromDate = columnModal.getByRole('textbox', { name: 'Від якої дати' });
  await expect(fromDate).toHaveValue(/^\d{4}-\d{2}-\d{2}$/);

  const submitColumn = columnModal.getByRole('button', { name: 'Додати', exact: true });
  await expect(submitColumn).toBeEnabled();

  const [columnResponse] = await Promise.all([
    page.waitForResponse(
      (res) => new URL(res.url()).pathname.endsWith('/supplies/packinglists/product-income/direct-supply-order/placement') &&
        res.request().method() === 'POST',
      { timeout: 60_000 },
    ),
    submitColumn.click(),
  ]);
  expect(columnResponse.ok(), `add column HTTP ${columnResponse.status()}`).toBe(true);

  const cells = page.locator('[data-testid="placement-cell"]');
  await expect(cells.first()).toBeVisible({ timeout: 20_000 });
  const count = await cells.count();

  for (let i = 0; i < count; i += 1) {
    const cell = cells.nth(i);
    if ((await cell.getAttribute('data-placed-qty')) !== '0') {
      continue;
    }
    await cell.click();
    const drawer = page.getByRole('dialog').filter({ hasText: 'Доступна К-сть' });
    await drawer.getByTestId('placement-add-draft').click();
    await drawer.getByTestId('placement-accept-draft').click();
    await Promise.all([
      page.waitForResponse(
        (res) => new URL(res.url()).pathname.endsWith('/supplies/ukraine/order/placements/dynamic/rows/product-income/direct-supply-order/new') &&
          res.request().method() === 'POST',
        { timeout: 30_000 },
      ),
      drawer.getByTestId('placement-apply').click(),
    ]);
    await expect(drawer).toBeHidden({ timeout: 15_000 });
  }
}

export async function postIncome(page: Page, orderNetId: string): Promise<void> {
  await page.goto(`/orders/ukraine/all/edit/${orderNetId}/product-income`);
  const incomeButton = page.getByTestId('income-capitalize');
  await expect(incomeButton).toBeVisible({ timeout: 45_000 });

  const storageSelect = page.getByRole('combobox', { name: 'Склад' });
  await expect(storageSelect).toBeEnabled({ timeout: 20_000 });
  await expect(async () => {
    const current = await storageSelect.inputValue().catch(() => '');
    if (!current.trim()) {
      await storageSelect.click();
      await page.getByRole('option').first().click({ timeout: 5_000 });
    }
    expect((await storageSelect.inputValue()).trim().length).toBeGreaterThan(0);
  }).toPass({ timeout: 45_000 });

  // Mark all packing items ready to place before posting the income (розміщення step).
  const readyButton = page.getByTestId('income-ready-all');
  if (await readyButton.isVisible().catch(() => false)) {
    await Promise.all([
      page.waitForResponse(
        (res) => new URL(res.url()).pathname.endsWith('/supplies/packinglists/product-income/direct-supply-order/readiness') &&
          res.request().method() === 'PATCH',
        { timeout: 60_000 },
      ),
      readyButton.click(),
    ]);
    await expect(readyButton).toBeHidden({ timeout: 20_000 });
  }

  await placeAllItems(page);

  await expect(incomeButton).toBeEnabled({ timeout: 20_000 });

  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => new URL(res.url()).pathname.endsWith('/products/incomes/product-income/direct-supply-order/capitalize') &&
        res.request().method() === 'POST',
      { timeout: 180_000 },
    ),
    incomeButton.click(),
  ]);
  expect(response.ok(), `income HTTP ${response.status()}`).toBe(true);
}
