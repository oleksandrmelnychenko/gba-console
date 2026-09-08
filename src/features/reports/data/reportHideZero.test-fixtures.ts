import type { ReportDataset, ReportHideZeroCapabilities, ReportRequestBody, SpreadsheetCellValue } from '../types'
import { thresholdDataset, thresholdRequest } from './reportThreshold.test-fixtures'
import { datasetGroupings } from './reportDatasets'
import { accountBalanceHeaderLines } from './accountBalances.test-fixtures'
import { HIDE_ZERO_ALL_HIDDEN_STATE } from './reportHideZero'

export const hideZeroCapabilities: ReportHideZeroCapabilities = { Version: 1, GroupingTypes: [42], Measures: [24], MinimumNativeRowGroups: 1,
  MaximumNativeRowGroups: 1, MaximumColumnGroups: 0, MinimumActiveMeasures: 1, MaximumActiveMeasures: 1, MaximumContributions: 200000,
  OptionalGeneratedGrouping: 46, ProofGrain: 'CurrentPaymentCurrencyRegisterId', UnknownAmountsRetained: true,
  PresentationOnly: true, FactsRetainedForTotals: true, FactsRetainedForAbc: true, GlobalZeroResourceHidden: true, CompleteSourceParity: false }
export const hideZeroDataset: ReportDataset = { ...thresholdDataset, HideZero: hideZeroCapabilities }
export function hideZeroRequest(): ReportRequestBody {
  const original = thresholdRequest()
  return { ...original, hideZero: { Version: 1 }, sorted: { ...original.sorted, Row: [46, 42].map(type => datasetGroupings(hideZeroDataset).find(field => field.type === type)!) },
    threshold: { ...original.threshold as object, Grouping: 42 }, topGroups: { ...original.topGroups as object, Grouping: 42 },
    abcClassification: { ...original.abcClassification as object, Grouping: 42 },
    ordering: { Version: 1, Rows: [{ Grouping: 46, By: 1, Direction: 1, Nulls: 2 }, { Grouping: 42, By: 1, Direction: 1, Nulls: 2 }], Columns: [] } }
}
export const hideZeroAllHiddenLines = [
  ...accountBalanceHeaderLines.map(line => line.startsWith('Рядки:') ? 'Рядки: Запис залишку рахунку'
    : line.startsWith('! Покриття залишків рахунків:') ? '! Покриття залишків рахунків: усі 2 записи підтверджено.'
      : line.startsWith('! Узгодження залишків рахунків:') ? '! Узгодження залишків рахунків: усі ланцюги підтверджено.' : line),
  '! Приховування нулів: лише підтверджені нульові поточні записи залишку.',
  '! Покриття приховування нулів: після нативних відборів 2 записів; після TOP 2; підтверджених нульових 2, непідтверджених 0.',
  '! Видимі рядки та ресурси: перед приховуванням 2 рядків після порогу; приховано 2, видимо 0; видимих ресурсів 0. Усі підтверджені нульові записи приховано; дані джерела не порожні.',
  '! Підсумки при приховуванні нулів: усі факти після TOP збережено для ABC, сортування та підсумків.',
]
/** Synthetic native-style metadata fixture, not a fresh source observation. */
export const hideZeroAllHiddenRows: SpreadsheetCellValue[][] = [...hideZeroAllHiddenLines.map(line => [line, line]), [], [HIDE_ZERO_ALL_HIDDEN_STATE, null]]
