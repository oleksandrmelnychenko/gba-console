import type { ReportDataset, ReportSelection, SpreadsheetCellValue } from '../types'
import { CLIENT_ACTIVITY_COUNT_CAPTION, CLIENT_ACTIVITY_EMPTY_STATE, CLIENT_ACTIVITY_REPORT_TITLE } from './clientActivityReport'
import { grossDataset } from './reportDatasets.test-fixtures'
import { defaultDatasetRequest } from './reportDatasets'

const groupingIds = [0, 1, 2, 3, 5, 6, 7, 8, 12, 15, 17]
const groupingIdSet = new Set(groupingIds)
export const clientActivityDataset: ReportDataset = {
  DataSource: 12, Name: CLIENT_ACTIVITY_REPORT_TITLE, Description: 'Проведені продажі за періодом з поточними прив’язками клієнтів GBA.',
  PeriodRequired: true, PeriodSupported: true,
  Groupings: grossDataset.Groupings.filter(field => groupingIdSet.has(field.Type)),
  Measurements: [{ Type: 25, Name: CLIENT_ACTIVITY_COUNT_CAPTION }],
  Filters: [{ Type: 1, Name: 'Товар' }, { Type: 2, Name: 'Артикул' }, { Type: 6, Name: 'Клієнт' },
    { Type: 9, Name: 'Договір клієнта' }, { Type: 12, Name: 'Документ продажу' }],
  Ordering: { Version: 1, MaximumRules: 32, Groupings: groupingIds.map(Type => ({ Type, By: Type <= 3 ? [1, 3] : [1, 2, 3] })) },
  FilterExpression: { Version: 1, MaximumDepth: 8, MaximumLeaves: 64, MaximumNodes: 128, Operators: [1, 2] },
  Limitations: ['Унікальні клієнти визначаються об’єднанням поточних Client.ID, а не додаванням кількості між договорами. Порівнянність із регістром 1С не доведена.'],
}
export const clientActivitySelections: ReportSelection[] = [
  { IsChecked: true, SelectedField: { Type: 9, Name: 'CustomerContract' }, FilterCondition: { Type: 0, Name: 'Дорівнює' },
    Values: [{ Data: { Id: 456246, AgreementId: 802 }, Name: 'Договір A [456246]', Value: 456246 }] },
  { IsChecked: true, SelectedField: { Type: 9, Name: 'CustomerContract' }, FilterCondition: { Type: 0, Name: 'Дорівнює' },
    Values: [{ Data: { Id: 454395, AgreementId: 802 }, Name: 'Договір B [454395]', Value: 454395 }] },
  { IsChecked: false, SelectedField: { Type: 30, Name: 'PaymentCurrency' }, FilterCondition: { Type: 0, Name: 'Дорівнює' },
    Values: [{ Data: { Id: 1 }, Name: 'EUR [1]', Value: 1 }] },
]
export function clientActivityRequest() {
  return { ...defaultDatasetRequest(clientActivityDataset, '2026-06-01', '2026-07-31'),
    selections: structuredClone(clientActivitySelections),
    filterExpression: { Version: 1, Root: { Kind: 2, Children: [{ Kind: 3, SelectionIndex: 0 }, { Kind: 3, SelectionIndex: 1 }] } },
    ordering: { Version: 1, Rows: [{ Grouping: 2, By: 1, Direction: 1, Nulls: 2 }, { Grouping: 12, By: 3, Direction: 2, Nulls: 2, Measure: 25 }], Columns: [] },
  }
}
export const clientActivityHeaderLines = [CLIENT_ACTIVITY_REPORT_TITLE, 'Період: 01.06.2026 – 31.07.2026',
  'Час читання (UTC): 08.09.2026 00:00:00.000 – 08.09.2026 00:00:00.120',
  'Рядки: По місяцях', 'Колонки: —', `Показники: ${CLIENT_ACTIVITY_COUNT_CAPTION}`,
  'Фільтри: Договір клієнта = Договір A [456246] АБО Договір B [454395]',
  '! Джерело активності клієнтів: активні рядки проведених продажів GBA; повернення не віднімають клієнтів.',
  '! Ідентичність клієнтів: поточні Client.ID за точними ClientAgreement.ID, без підміни спільними Agreement.ID.',
  '! Покриття активності клієнтів: 4 рядки; усі ідентичності підтверджено.',
  '! Підсумки клієнтів: кількість унікальних Client.ID у об’єднанні; кількості груп не додаються.',
  '! Межі порівняння з 1С: історичні покупці й повнота регістру не підтверджені.']
export function clientActivityWorkbookRows(kind: 'known' | 'disjoint' | 'unknown' | 'empty' = 'known'): SpreadsheetCellValue[][] {
  const headers = [...clientActivityHeaderLines]
  if (kind === 'unknown') headers[9] = '! Покриття активності клієнтів: один рядок без підтвердженої ідентичності; немає даних.'
  if (kind === 'empty') {
    headers[9] = '! Покриття активності клієнтів: 0 рядків; порожній обсяг підтверджено.'
    headers.push(CLIENT_ACTIVITY_EMPTY_STATE)
  }
  return [...headers.map(line => [line, line]), [], ['По місяцях', 'Активність клієнтів'], ['По місяцях', CLIENT_ACTIVITY_COUNT_CAPTION],
    ...(kind === 'empty' ? [] : [['2026-06', 2], ['Підсумок: 2026-06', 2],
      ['2026-07', kind === 'unknown' ? null : 2], ['Підсумок: 2026-07', kind === 'unknown' ? null : 2]]),
    ['Загальний підсумок', kind === 'empty' ? 0 : kind === 'unknown' ? null : kind === 'disjoint' ? 4 : 3]]
}
