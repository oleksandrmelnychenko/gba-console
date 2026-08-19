import type { Locator, Page } from '@playwright/test';

export const uk = {
  login: 'Логін',
  password: 'Пароль',
  signIn: 'Увійти',
  create: 'Створити',
  save: 'Зберегти',
  add: 'Додати',
  upload: 'Завантажити',
  refresh: 'Оновити',
  search: 'Пошук',
  confirm: 'Підтвердити',
  cancel: 'Скасувати',
  delete: 'Видалити',
  newSale: 'Новий продаж',
} as const;

export function tableRow(page: Page, rowId: string | number): Locator {
  return page.locator(`[data-testid="data-table-row"][data-row-id="${rowId}"]`);
}

export function tableRows(page: Page): Locator {
  return page.locator('[data-testid="data-table-row"]');
}

export function tableCell(row: Locator, column: string): Locator {
  return row.locator(`[data-testid="data-table-cell"][data-column="${column}"]`);
}

export function filterBar(page: Page): Locator {
  return page.locator('.app-filter-bar');
}

export function tableShell(page: Page): Locator {
  return page.locator('.console-table-shell');
}
