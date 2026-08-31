import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type { TestIncomeSupplier } from '../data/testIncome';
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
  orderNetId: string;
  orderNumber: string;
}

export function scopedNumber(supplier: TestIncomeSupplier, runId: string): string {
  return `${supplier.invoiceNumber}-${runId}`;
}

export async function createDirectOrderFromCcd(
  page: Page,
  supplier: TestIncomeSupplier,
  runId: string,
): Promise<CreatedOrderRef> {
  const file = customsSpecificationFile(supplier.dirPrefix);
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

  await attachFile(page, () => page.getByLabel('Файл', { exact: true }).click(), file);

  await page.getByLabel('Код товару', { exact: true }).fill(String(supplier.parse.productCode));
  await page.getByLabel('Кількість', { exact: true }).fill(String(supplier.parse.qty));
  await page.getByLabel('З рядка', { exact: true }).fill(String(supplier.parse.startRow));
  await page.getByLabel('До рядка', { exact: true }).fill(String(supplier.parse.endRow));
  await page.getByLabel('Колонка ціни', { exact: true }).fill(String(supplier.parse.price));

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

  return { orderNetId: String(orderNetId), orderNumber: number };
}

export async function createProForma(
  page: Page,
  supplier: TestIncomeSupplier,
  runId: string,
  orderNetId: string,
): Promise<void> {
  const file = customsSpecificationFile(supplier.dirPrefix);
  await page.goto(`/orders/ukraine/all/edit/${orderNetId}`);
  const card = page.locator('.supply-detail-card').filter({ hasText: 'Проформа' });
  await expect(card).toBeVisible({ timeout: 30_000 });

  const createButton = card.getByRole('button', { name: /Створити|Редагувати/ });
  await expect(createButton).toBeVisible({ timeout: 20_000 });
  await createButton.click();

  const numberField = card.getByLabel('Номер').first();
  await expect(numberField).toBeVisible({ timeout: 20_000 });
  await numberField.fill(`PF-${scopedNumber(supplier, runId)}`);

  await attachFile(page, () => card.getByRole('button', { name: 'Додати файли' }).click(), file);
  await expect(card.getByText('Документів немає')).toBeHidden({ timeout: 10_000 });

  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes('/supplies/orders/update') && res.request().method() === 'POST',
      { timeout: 60_000 },
    ),
    card.getByRole('button', { name: 'Зберегти' }).click(),
  ]);
  expect(response.ok(), `proforma save HTTP ${response.status()}`).toBe(true);
  await expect(page.getByText('Проформу збережено')).toBeVisible({ timeout: 20_000 });
}

export interface CreatedInvoiceRef {
  invoiceNetId: string;
  invoiceNumber: string;
}

export async function addInvoiceFromCcd(
  page: Page,
  supplier: TestIncomeSupplier,
  runId: string,
  orderNetId: string,
): Promise<CreatedInvoiceRef> {
  const file = customsSpecificationFile(supplier.dirPrefix);
  const number = scopedNumber(supplier, runId);

  await page.goto(`/orders/ukraine/all/edit/${orderNetId}/supply-invoices`);
  const addInvoice = page.getByRole('button', { name: 'Додати інвойс' });
  await expect(addInvoice).toBeEnabled({ timeout: 30_000 });
  await addInvoice.click();

  const modal = page.getByRole('dialog').filter({ hasText: 'Додати інвойс' });
  await modal.getByLabel('Номер', { exact: true }).fill(number);
  await modal.getByLabel('Дата', { exact: true }).fill(`${supplier.invoiceDate}T10:00`);

  await attachFile(page, () => modal.getByLabel('Файл', { exact: true }).click(), file);

  await modal.getByLabel('Код товару', { exact: true }).fill(String(supplier.parse.productCode));
  await modal.getByLabel('Кількість', { exact: true }).fill(String(supplier.parse.qty));
  await modal.getByLabel('З рядка', { exact: true }).fill(String(supplier.parse.startRow));
  await modal.getByLabel('До рядка', { exact: true }).fill(String(supplier.parse.endRow));
  await modal.getByRole('textbox', { name: 'Ціна', exact: true }).fill(String(supplier.parse.price));

  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes('/supplies/invoices/update/file') && res.request().method() === 'POST',
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
): Promise<void> {
  const file = customsSpecificationFile(supplier.dirPrefix);

  await page.goto(`/orders/ukraine/all/edit/${orderNetId}/supply-invoices`);

  const addPackList = page.getByRole('button', { name: 'Додати пак лист' });
  await expect(addPackList).toBeEnabled({ timeout: 30_000 });
  await addPackList.click();

  const modal = page.getByRole('dialog').filter({ hasText: 'Додати пак лист' });
  await modal.getByLabel('Номер', { exact: true }).fill(invoiceNumber);
  await modal.getByLabel('Дата', { exact: true }).fill(`${supplier.invoiceDate}T10:00`);

  await attachFile(page, () => modal.getByLabel('Файл', { exact: true }).click(), file);

  await modal.getByLabel('Код товару', { exact: true }).fill(String(supplier.parse.productCode));
  await modal.getByLabel('Кількість', { exact: true }).fill(String(supplier.parse.qty));
  await modal.getByLabel('З рядка', { exact: true }).fill(String(supplier.parse.startRow));
  await modal.getByLabel('До рядка', { exact: true }).fill(String(supplier.parse.endRow));
  await modal.getByRole('textbox', { name: 'Ціна', exact: true }).fill(String(supplier.parse.price));
  await modal.getByLabel('Нетто', { exact: true }).fill(String(supplier.parse.netWeight));
  await modal.getByLabel('Брутто', { exact: true }).fill(String(supplier.parse.grossWeight));

  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes('/supplies/packinglists/new/file') && res.request().method() === 'POST',
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
): Promise<void> {
  const file = customsSpecificationFile(supplier.dirPrefix);

  await page.goto(`/orders/ukraine/all/edit/${orderNetId}/specifications`);
  const trigger = page.getByRole('button', { name: 'Завантаження митних кодів' });
  await expect(trigger).toBeEnabled({ timeout: 30_000 });
  await trigger.click();

  const modal = page.getByRole('dialog').filter({ hasText: 'Завантаження митних кодів' });
  const fill = (labelStart: string, value: string | number) =>
    modal.getByLabel(new RegExp(`^${labelStart}(\\s*\\*)?$`)).first().fill(String(value));
  await fill('Дата митної декларації', CUSTOMS_DATE);
  await fill('Код', supplier.parse.productCode);
  await fill('Митна вартість', supplier.parse.customsValue);
  await fill('Митний код', supplier.parse.uktzed);
  await fill('Мито', supplier.parse.duty);
  await fill('Ціна', supplier.parse.price);
  await fill('К-сть', supplier.parse.qty);
  await fill('Сума ПДВ', supplier.parse.vat);
  await fill('Від', supplier.parse.startRow);
  await fill('До', supplier.parse.endRow);

  await attachFile(page, () => modal.getByLabel('Завантажити', { exact: true }).click(), file);

  const submitButton = modal.getByRole('button', { name: 'Завантажити' }).filter({ hasText: 'Завантажити' });
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes('/supplies/invoices/specification/upload') && res.request().method() === 'POST',
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
      (res) => res.url().includes('/supplies/packinglists/update') && res.request().method() === 'POST',
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
        (res) => res.url().includes('/supplies/ukraine/order/placements/dynamic/rows/new') && res.request().method() === 'POST',
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
        (res) => res.url().includes('/supplies/packinglists/item/readytoplaced/update/all') && res.request().method() === 'PATCH',
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
      (res) => res.url().includes('/products/incomes/new/packinglist/dynamic') && res.request().method() === 'POST',
      { timeout: 180_000 },
    ),
    incomeButton.click(),
  ]);
  expect(response.ok(), `income HTTP ${response.status()}`).toBe(true);
}
