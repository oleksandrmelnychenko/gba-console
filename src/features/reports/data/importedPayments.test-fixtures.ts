import type { ReportDataset, ReportRequestBody, SpreadsheetCellValue } from '../types'
import { IMPORTED_PAYMENTS_CAPTIONS, IMPORTED_PAYMENTS_GROUPS, IMPORTED_PAYMENTS_FILTERS, IMPORTED_PAYMENTS_TITLE } from './importedPayments'
import { IMPORTED_PAYMENTS_EMPTY_STATE, IMPORTED_PAYMENTS_NOTE_PREFIXES } from './importedPaymentsSpreadsheet'
import { defaultDatasetRequest } from './reportDatasets'

const groupNames = ['По роках', 'По кварталах', 'По місяцях', 'Дата', 'Клієнт', 'Договір', 'Організація документа', 'Рахунок',
  'Валюта рахунку', 'Тип рахунку', 'Запис імпортованого платежу', 'Напрям платежу', 'Стаття записаного платежу', 'Система імпорту платежу']
const filterGroups = [12, 15, 39, 40, 41, 44, 47, 48, 49, 50]
export const importedPaymentsDataset: ReportDataset = {
  DataSource: 14, Name: IMPORTED_PAYMENTS_TITLE, Description: 'Поточні суми імпортованих документів у власній валюті.',
  PeriodRequired: true, PeriodSupported: true,
  Groupings: IMPORTED_PAYMENTS_GROUPS.map((Type, index) => ({ Type, Name: groupNames[index] })),
  Filters: IMPORTED_PAYMENTS_FILTERS.map((Type, index) => ({ Type, Name: groupNames[IMPORTED_PAYMENTS_GROUPS.indexOf(filterGroups[index] as typeof IMPORTED_PAYMENTS_GROUPS[number])] })),
  Measurements: IMPORTED_PAYMENTS_CAPTIONS.map((Name, index) => ({ Type: 29 + index, Name })),
  Ordering: { Version: 1, MaximumRules: 32, Groupings: IMPORTED_PAYMENTS_GROUPS.map(Type => ({ Type, By: Type < 4 ? [1, 3] : [1, 2, 3] })) },
  FilterExpression: { Version: 1, MaximumDepth: 8, MaximumLeaves: 64, MaximumNodes: 128, Operators: [1, 2] },
  Limitations: ['Суми записаних документів. Різні або непідтверджені валюти не додаються.'], HideZero: null,
}
export function importedPaymentsRequest(): ReportRequestBody {
  return defaultDatasetRequest(importedPaymentsDataset, '2026-07-01', '2026-07-31')
}
export function importedPaymentsRows(kind: 'known' | 'mixed' | 'unknown' | 'empty' = 'known', selected = [0, 1, 2]): SpreadsheetCellValue[][] {
  const headers = [IMPORTED_PAYMENTS_TITLE, 'Період: 01.07.2026 – 31.07.2026',
    'Час читання (UTC): 08.09.2026 00:00:00.000 – 08.09.2026 00:00:00.120', 'Рядки: Валюта рахунку', 'Колонки: —',
    `Показники: ${selected.map(index => IMPORTED_PAYMENTS_CAPTIONS[index]).join(', ')}`,
    ...IMPORTED_PAYMENTS_NOTE_PREFIXES.map(prefix => `! ${prefix} повний контекст записаних документів.`)]
  if (kind === 'empty') headers.push(IMPORTED_PAYMENTS_EMPTY_STATE)
  const row = (label: string, values: Array<number | null>) => [label, ...selected.map(index => values[index])]
  const known = [row('EUR [1] надходження', [12.3401, 0, 12.3401]), row('EUR [1] виплата', [0, 2.3401, -2.3401]), row('Підсумок: EUR [1]', [12.3401, 2.3401, 10])]
  const data = kind === 'empty' ? [] : kind === 'unknown' ? [row('Непідтверджена валюта', [null, null, null])]
    : kind === 'mixed' ? [...known, row('UAH [2] нульовий документ', [0, 0, 0])] : known
  const totals = kind === 'empty' ? [] : [row('Загальний підсумок', kind === 'known' ? [12.3401, 2.3401, 10] : [null, null, null])]
  return [...headers.map(line => [line, line]), [], ['Валюта рахунку', ...selected.map(() => 'Записані платежі')],
    ['Валюта рахунку', ...selected.map(index => IMPORTED_PAYMENTS_CAPTIONS[index])], ...data, ...totals]
}
