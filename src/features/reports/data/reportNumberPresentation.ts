import type { ReportDataset, ReportRequestBody } from '../types'

export type ReportNumberKind = 'money' | 'unitPrice' | 'quantity' | 'count' | 'percent' | 'rate' | 'unknown'
export type ReportValueSemantics = {
  kind: ReportNumberKind; currencyPolicy: string; unitPolicy: string; aggregation: string
  scalable: boolean; defaultDecimalPlaces: number; defaultMinimumDecimalPlaces?: number
}
export type ReportNumberPresentation = {
  version: 1; moneyScale: 1 | 1000 | 1000000
  decimalPlacesByKind?: Partial<Record<Exclude<ReportNumberKind, 'count' | 'unknown'>, number>>
}
export const numberPrecisionKinds = ['money', 'quantity', 'percent', 'unitPrice', 'rate'] as const
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
export function readNumberPresentation(value: unknown): ReportNumberPresentation | undefined {
  if (!record(value) || value.version !== 1 || ![1, 1000, 1000000].includes(value.moneyScale as number)
    || Object.keys(value).some(key => !['version', 'moneyScale', 'decimalPlacesByKind'].includes(key))) return undefined
  if (value.decimalPlacesByKind !== undefined && (!record(value.decimalPlacesByKind)
    || Object.entries(value.decimalPlacesByKind).some(([key, places]) => !numberPrecisionKinds.includes(key as typeof numberPrecisionKinds[number])
      || !Number.isInteger(places) || (places as number) < 0 || (places as number) > 6))) return undefined
  return value as ReportNumberPresentation
}
export function requestNumberPresentation(data: ReportRequestBody): unknown {
  return data.numberPresentation ?? data.NumberPresentation
}
export function numberPresentationSupported(dataset?: ReportDataset): boolean {
  const value = dataset?.numberPresentation
  return record(value) && value.version === 1 && Array.isArray(value.moneyScales)
    && value.moneyScales.join(',') === '1,1000,1000000' && value.minimumDecimalPlaces === 0 && value.maximumDecimalPlaces === 6
}
export function numberPresentationError(data: ReportRequestBody, dataset?: ReportDataset): string | null {
  const keys = Object.keys(data).filter(key => key.toLowerCase() === 'numberpresentation')
  if (keys.length > 1 || keys.some(key => key !== 'numberPresentation' && key !== 'NumberPresentation'))
    return 'Формат чисел задано неоднозначно. Налаштування збережено без змін.'
  const value = requestNumberPresentation(data)
  if (value == null) return null
  if (!readNumberPresentation(value)) return 'Непідтримуваний формат чисел. Налаштування збережено без змін.'
  if (dataset && !numberPresentationSupported(dataset)) return 'Сервер не підтвердив налаштування формату чисел.'
  return null
}
export function readValueSemantics(value: unknown): ReportValueSemantics | undefined {
  if (!record(value) || ![...numberPrecisionKinds, 'count', 'unknown'].includes(value.kind as ReportNumberKind)
    || typeof value.currencyPolicy !== 'string' || typeof value.unitPolicy !== 'string' || typeof value.aggregation !== 'string'
    || typeof value.scalable !== 'boolean' || !Number.isInteger(value.defaultDecimalPlaces)
    || value.defaultMinimumDecimalPlaces !== undefined && (!Number.isInteger(value.defaultMinimumDecimalPlaces) || (value.defaultMinimumDecimalPlaces as number) < 0 || (value.defaultMinimumDecimalPlaces as number) > (value.defaultDecimalPlaces as number))
    || (value.defaultDecimalPlaces as number) < 0 || (value.defaultDecimalPlaces as number) > 28) return undefined
  return value as ReportValueSemantics
}
export function moneyScaleLabel(presentation?: ReportNumberPresentation, semantics?: ReportValueSemantics): string {
  if (!presentation || semantics?.kind !== 'money' || !semantics.scalable) return ''
  return presentation.moneyScale === 1000 ? 'тис.' : presentation.moneyScale === 1000000 ? 'млн.' : ''
}
/** Decimal strings never pass through floating point; midpoint rounding matches decimal AwayFromZero. */
export function formatReportDecimal(raw: string, semantics: ReportValueSemantics, presentation: ReportNumberPresentation): string {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(raw)
  if (!match || semantics.kind === 'unknown') return raw
  const precision = semantics.kind === 'count' ? 0 : presentation.decimalPlacesByKind?.[semantics.kind] ?? semantics.defaultDecimalPlaces
  const minimum = semantics.kind === 'count' ? 0 : presentation.decimalPlacesByKind?.[semantics.kind] ?? semantics.defaultMinimumDecimalPlaces ?? precision
  const fraction = match[3] ?? ''
  const scale = semantics.kind === 'money' && semantics.scalable ? presentation.moneyScale : 1
  const denominator = 10n ** BigInt(fraction.length) * BigInt(scale)
  const numerator = BigInt(match[2] + fraction) * 10n ** BigInt(precision)
  let rounded = numerator / denominator
  if ((numerator % denominator) * 2n >= denominator) rounded += 1n
  const digits = rounded.toString().padStart(precision + 1, '0')
  const integer = (precision ? digits.slice(0, -precision) : digits).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')
  let decimal = precision ? digits.slice(-precision) : ''
  while (decimal.length > minimum && decimal.endsWith('0')) decimal = decimal.slice(0, -1)
  return `${match[1] && rounded !== 0n ? '-' : ''}${integer}${decimal ? ',' + decimal : ''}`
}

export function reportValueUnit(semantics: ReportValueSemantics, presentation?: ReportNumberPresentation, resolvedCurrency?: string): string {
  if (semantics.kind === 'percent') return semantics.unitPolicy === 'percentagePoints' ? 'в.п.' : '%'
  if (semantics.kind === 'count') return 'Кількість, ціле число'
  if (semantics.kind === 'quantity') return semantics.unitPolicy === 'sourceStorageUnit' ? 'Одиниці зберігання' : 'Одиниці товару'
  const currencies: Record<string, string> = { EUR: 'EUR', accountCurrency: 'Валюта рахунку', settlementCurrency: 'Валюта договору', documentCurrency: 'Валюта документа', sourceCurrency: 'Джерельна валюта', sourceManagementCurrency: 'Валюта управлінського обліку', confirmedSingleCurrency: 'Підтверджена валюта', quotePerBaseCurrency: 'Курс за одиницю базової валюти' }
  const currency = resolvedCurrency && semantics.currencyPolicy === resolvedCurrency ? resolvedCurrency : currencies[semantics.currencyPolicy] ?? ''
  return [moneyScaleLabel(presentation, semantics), currency, semantics.kind === 'unitPrice' ? 'за одиницю' : ''].filter(Boolean).join(' ')
}
export function cloneNumberPresentationAliases(value: object): Partial<ReportRequestBody> {
  const keys = Object.keys(value).filter(key => key.toLowerCase() === 'numberpresentation' || key.toLowerCase() === 'supplierwarehouse')
  return Object.fromEntries(keys.map(key => [key === 'NumberPresentation' && !Object.hasOwn(value, 'numberPresentation') ? 'numberPresentation' : key === 'SupplierWarehouse' && !Object.hasOwn(value, 'supplierWarehouse') ? 'supplierWarehouse' : key, structuredClone((value as Record<string, unknown>)[key])]))
}
