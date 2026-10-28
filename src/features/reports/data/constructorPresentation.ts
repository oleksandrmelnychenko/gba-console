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
  return dataset?.DataSource === 2 && object(value) && value.version === 1
    && Array.isArray(value.fields) && value.fields.join(',') === 'negativeRed,grandTotals'
}
export function constructorPresentationError(request: ReportRequestBody, dataset?: ReportDataset): string | null {
  const value = requestConstructorPresentation(request)
  if (value === undefined) return null
  const profile = request.reportProfile ?? request.ReportProfile
  if (!readConstructorPresentation(value) || request.dataSource !== 2 || !['sales', 'grossProfit'].includes(String(profile)))
    return 'Непідтримуване оформлення конструктора продажів.'
  return dataset && !constructorPresentationSupported(dataset) ? 'Сервер ще не підтримує оформлення конструктора продажів.' : null
}
