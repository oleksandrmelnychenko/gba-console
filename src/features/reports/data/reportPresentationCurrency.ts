import type { ReportDataset, ReportRequestBody } from '../types'
import type { NativeReportPreview } from './nativeReportPreview'
import { requestProfitReadMode } from './profitReadMode'
import { requestDayOrganizationBasis } from './dayOrganizationBasis'

export type ReportPresentationCurrency = { version: 1; currencyNetUid: string }
export type ResolvedReportPresentationCurrency = ReportPresentationCurrency & {
  code: string; rateFamily: 'commercialGba'; datePolicy: 'ownDocument'
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
export const currencyCode = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 32
  && value.trim() === value && !Array.from(value).some(character => {
    const code = character.charCodeAt(0)
    return code < 32 || code >= 127 && code <= 159
  })
export const currencyNetUid = (value: unknown): value is string => typeof value === 'string'
  && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value) && value !== '00000000-0000-0000-0000-000000000000'
export function readPresentationCurrency(value: unknown): ReportPresentationCurrency | undefined {
  return record(value) && value.version === 1 && currencyNetUid(value.currencyNetUid)
    && Object.keys(value).every(key => key === 'version' || key === 'currencyNetUid') ? value as ReportPresentationCurrency : undefined
}
export function readResolvedPresentationCurrency(value: unknown): ResolvedReportPresentationCurrency | undefined {
  return record(value) && value.version === 1 && currencyNetUid(value.currencyNetUid)
    && currencyCode(value.code)
    && value.rateFamily === 'commercialGba' && value.datePolicy === 'ownDocument'
    && Object.keys(value).every(key => ['version', 'currencyNetUid', 'code', 'rateFamily', 'datePolicy'].includes(key))
    ? value as ResolvedReportPresentationCurrency : undefined
}
export function presentationCurrencySupported(dataset?: ReportDataset): boolean {
  const value = dataset?.currentFinancialPresentationCurrency
  return dataset?.DataSource === 35 && record(value) && value.version === 1 && value.defaultCurrency === 'EUR'
    && value.rateFamily === 'commercialGba' && value.datePolicy === 'ownDocument' && value.lookupPath === '/currencies/all'
    && Array.isArray(value.allowedProfitReadModes) && value.allowedProfitReadModes.length === 1 && value.allowedProfitReadModes[0] === 0
    && Array.isArray(value.allowedDayOrganizationBases) && value.allowedDayOrganizationBases.length === 1 && value.allowedDayOrganizationBases[0] === 0
}
export function presentationCurrencyModeSupported(data: ReportRequestBody): boolean {
  return data.dataSource === 35 && requestProfitReadMode(data) === 0 && requestDayOrganizationBasis(data) === 0
}
export function requestPresentationCurrency(data: ReportRequestBody): unknown {
  return Object.hasOwn(data, 'presentationCurrency') ? data.presentationCurrency : data.PresentationCurrency
}
export function presentationCurrencyError(data: ReportRequestBody, dataset?: ReportDataset): string | null {
  const keys = Object.keys(data).filter(key => key.toLowerCase() === 'presentationcurrency')
  if (keys.length > 1 || keys.some(key => key !== 'presentationCurrency' && key !== 'PresentationCurrency'))
    return 'Валюту звіту задано неоднозначно. Налаштування збережено без змін.'
  const value = requestPresentationCurrency(data)
  if (value == null) return null
  if (!readPresentationCurrency(value)) return 'Некоректна валюта звіту. Оберіть валюту з довідника.'
  if (!presentationCurrencyModeSupported(data)) return 'Валюта звіту доступна лише для поточних документів ВП. Поверніть цей спосіб розрахунку або виберіть EUR за замовчуванням.'
  if (!presentationCurrencySupported(dataset)) return 'Сервер не підтвердив вибір валюти звіту. Налаштування збережено без змін.'
  return null
}
export function clonePresentationCurrencyAliases(value: object): Partial<ReportRequestBody> {
  return Object.fromEntries(Object.keys(value).filter(key => key.toLowerCase() === 'presentationcurrency').map(key => [
    key === 'PresentationCurrency' && !Object.hasOwn(value, 'presentationCurrency') ? 'presentationCurrency' : key,
    structuredClone((value as Record<string, unknown>)[key]),
  ]))
}
/** Bind every page to the requested target; export reuses the same immutable result identity. */
export function bindPresentationCurrency(data: ReportRequestBody, preview: NativeReportPreview): void {
  const expected = readPresentationCurrency(requestPresentationCurrency(data))
  const actual = preview.Request?.presentationCurrency
  if (!expected && actual == null) return
  if (!expected || !actual || actual.currencyNetUid.toLowerCase() !== expected.currencyNetUid.toLowerCase())
    throw new Error('Сервер повернув іншу валюту звіту.')
  const semantics = new Map(preview.valueSemantics?.map(item => [item.columnSourceIndex, item.semantics]))
  if (semantics.size !== preview.Columns.length || preview.valueSemantics?.length !== semantics.size
    || preview.Columns.some(column => {
      const value = semantics.get(column.SourceIndex)
      return !value || (value.kind === 'money' ? value.currencyPolicy !== actual.code
        : value.kind !== 'percent' || value.currencyPolicy !== 'notApplicable')
    })) throw new Error('Сервер не підтвердив валюту всіх показників звіту.')
}

// Native source35 money fields; percentages14/15 must retain their own units.
const moneyMeasures = new Set([2, 3, 4, 6, 7, 8, 10, 11, 12])
export const isPresentationCurrencyMoneyMeasure = (type: number | undefined) => type !== undefined && moneyMeasures.has(type)
/** Constructor-only unit caption. Never rewrite persisted metadata or producer result captions. */
export const currencyNeutralMeasureLabel = (label: string): string => label.replace(/\bEUR$|^Євро$/u, 'у валюті звіту')
