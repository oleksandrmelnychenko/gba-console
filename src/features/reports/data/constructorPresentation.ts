import type { ReportDataset, ReportRequestBody } from '../types'
export type ConstructorPresentation = { version: 1; negativeRed: boolean; grandTotals: boolean }
export const defaultConstructorPresentation: ConstructorPresentation = { version: 1, negativeRed: true, grandTotals: true }
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
export function readConstructorPresentation(value: unknown): ConstructorPresentation | undefined {
  return object(value) && Object.keys(value).sort().join(',') === 'grandTotals,negativeRed,version'
    && value.version === 1 && typeof value.negativeRed === 'boolean' && typeof value.grandTotals === 'boolean'
    ? value as ConstructorPresentation : undefined
}
export function requestConstructorPresentation(data: object): unknown {
  const keys = Object.keys(data).filter(key => key.toLowerCase() === 'constructorpresentation')
  return keys.length > 1 ? { invalid: true } : keys.length ? (data as Record<string, unknown>)[keys[0]] : undefined
}
export function cloneConstructorPresentation(data: object): Pick<ReportRequestBody, 'constructorPresentation'> {
  const value = requestConstructorPresentation(data)
  return value === undefined ? {} : { constructorPresentation: structuredClone(value) }
}
export function constructorPresentationSupported(dataset?: ReportDataset): boolean {
  const value = dataset?.constructorPresentation
  return [2, 44].includes(dataset?.DataSource ?? -1) && object(value) && value.version === 1
    && Array.isArray(value.fields) && value.fields.join(',') === 'negativeRed,grandTotals'
}
export function constructorPresentationRequestSupported(request: ReportRequestBody): boolean {
  if (request.dataSource === 44) return request.reportProfile === undefined && request.ReportProfile === undefined
    && request.returnsOnly === undefined && request.ReturnsOnly === undefined
  return request.dataSource === 2 && ['sales', 'grossProfit'].includes(String(request.reportProfile ?? request.ReportProfile))
}
export function constructorPresentationError(request: ReportRequestBody, dataset?: ReportDataset): string | null {
  const value = requestConstructorPresentation(request)
  if (value === undefined) return null
  const customerComparison = request.dataSource === 44
  if (!readConstructorPresentation(value) || !constructorPresentationRequestSupported(request))
    return customerComparison ? 'Непідтримуване оформлення порівняння роботи клієнтів.' : 'Непідтримуване оформлення конструктора продажів.'
  return dataset && (dataset.DataSource !== request.dataSource || !constructorPresentationSupported(dataset))
    ? customerComparison ? 'Сервер ще не підтримує оформлення порівняння роботи клієнтів.' : 'Сервер ще не підтримує оформлення конструктора продажів.' : null
}
