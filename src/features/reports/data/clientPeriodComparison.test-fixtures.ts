import type { ReportDataset, ReportRequestBody, SpreadsheetCellValue } from '../types'
import { CLIENT_COMPARISON_CAPTIONS, CLIENT_COMPARISON_TITLE } from './clientPeriodComparison'
import { CLIENT_COMPARISON_EMPTY_STATE, CLIENT_COMPARISON_NOTE_PREFIXES } from './clientPeriodComparisonSpreadsheet'
import { clientActivityDataset } from './clientActivity.test-fixtures'
import { defaultDatasetRequest } from './reportDatasets'

export const clientComparisonDataset: ReportDataset = {
  ...clientActivityDataset, DataSource: 13, Name: CLIENT_COMPARISON_TITLE,
  Groupings: clientActivityDataset.Groupings.filter(item => [5, 6, 7, 8, 12, 15].includes(item.Type)),
  Filters: clientActivityDataset.Filters.filter(item => item.Type !== 12),
  Measurements: CLIENT_COMPARISON_CAPTIONS.map((Name, index) => ({ Type: index + 25, Name })),
  Comparison: { Version: 1, Required: true, DateFormat: 'yyyy-MM-dd', ColumnsSupported: false, MaximumRowGroupings: 6,
    MaximumUnionFacts: 200000, PercentageDecimalPlaces: 2, PercentageRounding: 'AwayFromZero',
    ZeroDenominator: '100 when both counts known and previous=0; includes 0/0',
    UnknownOwnership: 'Each count independent; delta and percentage require both known' },
}
export function clientComparisonRequest(): ReportRequestBody {
  return { ...defaultDatasetRequest(clientComparisonDataset, '2026-07-01', '2026-07-31'),
    comparison: { Version: 1, From: '2026-06-01', To: '2026-06-30' } }
}
export function clientComparisonRows(kind: 'known' | 'current-unknown' | 'previous-unknown' | 'empty' = 'known', selected = [0, 1, 2, 3]): SpreadsheetCellValue[][] {
  const headers = [CLIENT_COMPARISON_TITLE, 'Поточний період: 01.07.2026 – 31.07.2026', 'Період порівняння: 01.06.2026 – 30.06.2026',
    'Час читання (UTC): 08.09.2026 00:00:00.000 – 08.09.2026 00:00:00.120', 'Рядки: Клієнт', 'Колонки: —',
    `Показники: ${selected.map(index => CLIENT_COMPARISON_CAPTIONS[index]).join(', ')}`,
    ...CLIENT_COMPARISON_NOTE_PREFIXES.map(prefix => `! ${prefix} повний контекст розрахунку.`)]
  if (kind === 'empty') headers.push(CLIENT_COMPARISON_EMPTY_STATE)
  const values = (label: string, numbers: Array<number | null>) => [label, ...selected.map(index => numbers[index])]
  const detail = kind === 'known' ? [values('Клієнт A [101]', [2, 1, 1, 100]), values('Підсумок: A', [2, 1, 1, 100]), values('Клієнт B [102]', [2, 1, 1, 100])]
    : kind === 'empty' ? [] : [values('Клієнт [103]', kind === 'current-unknown' ? [null, 2, null, null] : [2, null, null, null])]
  const grand = kind === 'known' ? [3, 2, 1, 50] : kind === 'empty' ? [0, 0, 0, 100]
    : kind === 'current-unknown' ? [null, 2, null, null] : [2, null, null, null]
  return [...headers.map(line => [line, line]), [], ['Клієнт', ...selected.map(() => 'Порівняння клієнтів')],
    ['Клієнт', ...selected.map(index => CLIENT_COMPARISON_CAPTIONS[index])], ...detail, values('Загальний підсумок', grand)]
}
