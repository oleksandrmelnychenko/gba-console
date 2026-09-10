import type { ReportDataset, ReportRequestBody } from '../types'
import { revenueExactId } from './revenueComparison'
import { isValuationAgreementId } from './reportValuation'

export const AGREEMENT_PRICES_SOURCE = 22
export const AGREEMENT_PRICES_TITLE = 'Ціни товарів за договором'
export const AGREEMENT_PRICES_RESOURCE = 'Ціни за договором'
export const AGREEMENT_PRICES_CAPTION = 'Поточна договірна ціна, EUR'
export const AGREEMENT_PRICES_ROWS = ['Товар', 'Одиниця виміру'] as const
export const AGREEMENT_PRICES_NOTE_PREFIXES = ['Договір цін:', 'Режим цін:', 'ПДВ цін:', 'Покриття цін:',
  'Причини невизначених цін:', 'Точність цін:', 'Межі цін:'] as const
const unsupported = new Set(['onec', 'comparison', 'xyz', 'revenuecomparison', 'buyersalesshare', 'returncomparison',
  'ratecomparison', 'margincomparison', 'paymentcomparison', 'ordering', 'filterexpression', 'topgroups',
  'threshold', 'hidezero', 'abcclassification'])
const invalid = 'Ціни за договором підтримують лише Товар → Одиниця виміру, одну ціну EUR і точні відбори товарів та одиниць. Налаштування не застосовано.'

/** Current unit quotes are separate facts; no financial aggregation is inferred. */
export function isAgreementPricesDataset(dataset: ReportDataset): boolean {
  const fields = (key: 'Groupings' | 'Measurements' | 'Filters', expected: readonly number[]) =>
    Array.isArray(dataset[key]) && dataset[key].length === expected.length
      && expected.every(type => dataset[key].filter(field => field.Type === type && field.Selectable !== false).length === 1)
  return dataset.DataSource === AGREEMENT_PRICES_SOURCE && dataset.PeriodSupported === false && dataset.PeriodRequired !== true
    && isAgreementPricesCapability(dataset.agreementPrices)
    && fields('Groupings', [5, 28]) && fields('Measurements', [63]) && fields('Filters', [1, 2, 20])
    && ['Ordering', 'FilterExpression', 'TopGroups', 'Threshold', 'HideZero', 'AbcClassification']
      .every(key => (dataset as unknown as Record<string, unknown>)[key] == null)
}

export function isAgreementPricesCapability(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const expected = { Version: 1, RequiredAgreement: true, RequiredRows: [5, 28], ColumnsSupported: false, TotalsSupported: false,
    MaximumProducts: 15000, MaximumPriceDecimals: 14, MaximumSignificantDigits: 15 }
  return Object.entries(expected).every(([key, expectedValue]) => JSON.stringify((value as Record<string, unknown>)[key]) === JSON.stringify(expectedValue))
}

export function agreementPricesConfigurationError(data: ReportRequestBody, dataset?: ReportDataset): string | null {
  if (data.dataSource !== AGREEMENT_PRICES_SOURCE) return null
  if (!isValuationAgreementId(data.valuationClientAgreementId)) return 'Виберіть точний договір клієнта для звіту цін.'
  if (dataset && !isAgreementPricesDataset(dataset)) return 'Сервер не підтвердив можливості звіту цін за договором.'
  if (data.from || data.to || Object.entries(data).some(([key, value]) => unsupported.has(key.toLowerCase()) && value != null)) return invalid
  if (!data.sorted || !Array.isArray(data.sorted.Row) || !Array.isArray(data.sorted.Col) || !Array.isArray(data.sorted.Measurements)
    || data.sorted.Row.length !== 2 || data.sorted.Row[0]?.type !== 5 || data.sorted.Row[1]?.type !== 28 || data.sorted.Col.length
    || data.sorted.Measurements.length !== 1 || data.sorted.Measurements[0]?.Type !== 63
    || (data.sorted.Measurements[0].IsChecked != null && data.sorted.Measurements[0].IsChecked !== true)) return invalid
  if (!Array.isArray(data.selections) || data.selections.length > 64) return invalid
  let count = 0
  for (const selection of data.selections) {
    if (!selection || (selection.IsChecked != null && typeof selection.IsChecked !== 'boolean')) return invalid
    if (!Array.isArray(selection.Values)) return invalid
    count += selection.Values.length
    if (count > 2000) return 'Звіт цін підтримує до 2 000 значень відборів.'
    if (![1, 2, 20].includes(selection.SelectedField?.Type) || ![0, 1, 2, 4].includes(selection.FilterCondition?.Type)
      || !selection.Values.length || selection.Values.some(value => !revenueExactId(value?.Data))) return invalid
  }
  return null
}
