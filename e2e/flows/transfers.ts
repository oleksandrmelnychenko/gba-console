import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as XLSX from 'xlsx';

export interface TransferInput {
  fromStorageName: string;
  organizationName: string;
  qty: number;
  toStorageName: string;
  vendorCode: string;
}

export interface CreatedTransferRef {
  operationNetUid: string;
}

const OPERATION_NET_UID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function writeTransferXlsx(vendorCode: string, qty: number): { directory: string; filePath: string } {
  const sheet = XLSX.utils.aoa_to_sheet([[vendorCode, qty]]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Transfer');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gba-transfer-'));
  const filePath = path.join(directory, 'transfer.xlsx');
  const buffer = XLSX.write(book, { bookType: 'xlsx', type: 'buffer' }) as Buffer;
  fs.writeFileSync(filePath, buffer);

  return { directory, filePath };
}

async function pickStorage(
  page: Page,
  dialog: Locator,
  label: string,
  name: string,
  organizationName: string,
): Promise<void> {
  const select = dialog.getByLabel(label, { exact: true });
  await select.click();
  await select.fill(name);
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const option = page
    .getByRole('option')
    .filter({ hasText: new RegExp(`^${escaped}(\\s*\\(|$)`) })
    .filter({ hasText: organizationName });
  await expect(option).toHaveCount(1, { timeout: 20_000 });
  await option.click();
}

export async function createProductTransfer(
  page: Page,
  input: TransferInput,
): Promise<CreatedTransferRef> {
  const spreadsheet = writeTransferXlsx(input.vendorCode, input.qty);

  try {
    await page.goto('/products/transfers');
    await page.getByRole('button', { name: 'Нове переміщення', exact: true }).click();

    const dialog = page.getByRole('dialog').filter({ hasText: 'Нове переміщення з файлу' });
    await expect(dialog).toBeVisible({ timeout: 20_000 });

    await pickStorage(page, dialog, 'Зі складу', input.fromStorageName, input.organizationName);
    await pickStorage(page, dialog, 'На склад', input.toStorageName, input.organizationName);

    await dialog.getByLabel('Колонка коду', { exact: true }).fill('1');
    await dialog.getByLabel('Колонка кількості', { exact: true }).fill('2');
    await dialog.getByLabel('Початковий рядок', { exact: true }).fill('1');
    await dialog.getByLabel('Кінцевий рядок', { exact: true }).fill('1');

    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      dialog.getByLabel('Файл', { exact: true }).click(),
    ]);
    await chooser.setFiles(spreadsheet.filePath);

    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/products/transfers/page/import/file') &&
        response.request().method() === 'POST',
      { timeout: 120_000 },
    );
    await dialog.getByRole('button', { name: 'Створити', exact: true }).click();
    const response = await responsePromise;
    expect(response.ok(), `product-transfer HTTP ${response.status()}`).toBe(true);

    const operationFromQuery = new URL(response.url()).searchParams.get('operationNetUid') || '';
    const operationFromHeader = response.request().headers()['idempotency-key'] || '';
    expect(operationFromQuery).toMatch(OPERATION_NET_UID);
    expect(operationFromHeader.toLowerCase()).toBe(operationFromQuery.toLowerCase());
    await expect(dialog).toBeHidden({ timeout: 30_000 });

    return { operationNetUid: operationFromQuery.toLowerCase() };
  } finally {
    fs.rmSync(spreadsheet.directory, { force: true, recursive: true });
  }
}
