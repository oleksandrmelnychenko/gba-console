import type { ReportDataset, ReportRequestBody } from '../types'

export const AGREEMENT_PRICE_COMPARISON_SOURCE = 31
type JsonRecord = Record<string, unknown>
export type AgreementPriceComparisonOptions = {
  version: 1
  baseClientAgreementId: number
  comparedClientAgreementId: number
  productIds: number[]
}

const isId = (value: unknown): value is number => Number.isSafeInteger(value) && typeof value === 'number' && value > 0
const invalid = 'Оберіть два різні точні договори й від 1 до 2 000 унікальних товарів з нашої бази.'
const unsupported = new Set(['valuationclientagreementid', 'onec', 'comparison', 'xyz', 'revenuecomparison',
  'buyersalesshare', 'returncomparison', 'ratecomparison', 'margincomparison', 'paymentcomparison',
  'pricetypesalescomparison', 'ordering', 'filterexpression', 'topgroups', 'threshold', 'hidezero',
  'abcclassification', 'productclassification', 'sourceorganizations', 'returnsonly', 'discountmarkup',
  'provideddiscounts', 'priceanalysis'])

export function defaultAgreementPriceComparison(): AgreementPriceComparisonOptions {
  return { version: 1, baseClientAgreementId: 0, comparedClientAgreementId: 0, productIds: [] }
}

export function requestAgreementPriceComparison(data: object): unknown {
  const keys = Object.keys(data).filter(key => key.toLowerCase() === 'agreementpricecomparison')
  return keys.length === 1 ? (data as Record<string, unknown>)[keys[0]] : undefined
}

export function cloneAgreementPriceComparisonAliases(data: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).flatMap(([key, value]) =>
    key.toLowerCase() === 'agreementpricecomparison' ? [[key, structuredClone(value)]] : []))
}

export function agreementPriceComparisonOptions(raw: unknown): AgreementPriceComparisonOptions | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const value = raw as Record<string, unknown>
  if (Object.keys(value).sort().join(',') !== 'baseClientAgreementId,comparedClientAgreementId,productIds,version') return null
  if (value.version !== 1 || !isId(value.baseClientAgreementId) || !isId(value.comparedClientAgreementId)
    || value.baseClientAgreementId === value.comparedClientAgreementId || !Array.isArray(value.productIds)
    || value.productIds.length < 1 || value.productIds.length > 2000
    || !value.productIds.every(isId) || new Set(value.productIds).size !== value.productIds.length) return null
  return value as AgreementPriceComparisonOptions
}

export function agreementPriceComparisonConfigurationError(data: ReportRequestBody, dataset?: ReportDataset): string | null {
  const aliases = Object.keys(data).filter(key => key.toLowerCase() === 'agreementpricecomparison')
  if (data.dataSource !== AGREEMENT_PRICE_COMPARISON_SOURCE) return aliases.length ? 'Порівняння цін доступне лише у відповідному наборі даних.' : null
  if (aliases.length !== 1 || !agreementPriceComparisonOptions(requestAgreementPriceComparison(data))) return invalid
  if (dataset && (dataset.DataSource !== AGREEMENT_PRICE_COMPARISON_SOURCE || dataset.PeriodSupported !== false
    || !isAgreementPriceComparisonCapability(dataset.agreementPriceComparison)
    || ![5, 28].every(type => dataset.Groupings.some(field => field.Type === type))
    || ![75, 76, 77, 78].every(type => dataset.Measurements.some(field => field.Type === type))))
    return 'Сервер не підтвердив можливості порівняння цін двох договорів.'
  if (data.from || data.to || !Array.isArray(data.selections) || data.selections.length
    || Object.entries(data).some(([key, value]) => unsupported.has(key.toLowerCase()) && value != null))
    return 'Порівняння цін не підтримує період, додаткові відбори або аналітичні перетворення.'
  if (!data.sorted || !Array.isArray(data.sorted.Row) || !Array.isArray(data.sorted.Col)
    || !Array.isArray(data.sorted.Measurements) || data.sorted.Row.map(item => item.type).join(',') !== '5,28' || data.sorted.Col.length
    || data.sorted.Measurements.map(item => item.Type).join(',') !== '75,76,77,78'
    || data.sorted.Measurements.some(item => item.IsChecked === false))
    return 'Порівняння цін потребує структури Товар → Одиниця виміру та чотирьох показників.'
  return null
}

function agreementPriceComparisonCapability(raw: unknown): JsonRecord | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const expected = { version: 1, required: true, maximumRequestedIds: 2000, maximumProducts: 1000,
    requiredRows: [5, 28], measurements: [75, 76, 77, 78] }
  const value = raw as JsonRecord
  if (Object.keys(value).length !== Object.keys(expected).length) return null
  const normalized: JsonRecord = {}
  for (const [key, item] of Object.entries(expected)) {
    const aliases = Object.keys(value).filter(candidate => candidate.toLowerCase() === key.toLowerCase())
    if (aliases.length !== 1 || JSON.stringify(value[aliases[0]]) !== JSON.stringify(item)) return null
    normalized[key] = structuredClone(value[aliases[0]])
  }
  return normalized
}

export function isAgreementPriceComparisonCapability(raw: unknown): boolean {
  return agreementPriceComparisonCapability(raw) !== null
}

export function normalizeAgreementPriceComparisonDataset(value: JsonRecord): ReportDataset | null {
  const keys = Object.keys(value).filter(key => key.toLowerCase() === 'agreementpricecomparison')
  if (keys.length > 1) return null
  const capability = keys.length ? value[keys[0]] : undefined
  const normalizedCapability = agreementPriceComparisonCapability(capability)
  if (value.DataSource === AGREEMENT_PRICE_COMPARISON_SOURCE) {
    if (!normalizedCapability) return null
  } else if (capability != null) return null
  const normalized = { ...value }
  for (const key of keys) delete normalized[key]
  if (normalizedCapability) normalized.agreementPriceComparison = normalizedCapability
  return normalized as ReportDataset
}
