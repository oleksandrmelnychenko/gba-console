import { revenueExactId } from './revenueComparison'
import type { ReportDataset, ReportRequestBody } from '../types'
import { isComparisonDate } from './clientPeriodComparison'
import { reportFilterExpressionError } from './reportFilterExpression'

export const BUYER_SALES_SHARE_SOURCE = 17
export const BUYER_SALES_SHARE_TITLE = 'Частка продажів новим і повторним покупцям за договорами GBA'
export const BUYER_SALES_SHARE_CAPTIONS = ["Частка продажів новим покупцям за поточний період, %", "Частка продажів новим покупцям за період порівняння, %", "Зміна частки продажів новим покупцям, в.п.", "Відносна зміна частки продажів новим покупцям, %", "Частка продажів повторним покупцям за поточний період, %", "Частка продажів повторним покупцям за період порівняння, %", "Зміна частки продажів повторним покупцям, в.п.", "Відносна зміна частки продажів повторним покупцям, %"] as const
export const BUYER_SALES_SHARE_MAXIMUM = 9999999999999.99
export type BuyerSalesShareOptions = { Version: 1; From: string; To: string; BaseResource: 4; RoundingPolicy: 'NativeBuyerSalesShareRawGrossFinalAwayFromZero2' }
const optionKeys = ['Version', 'From', 'To', 'BaseResource', 'RoundingPolicy'] as const
const invalid = 'Перевірте частки продажів новим і повторним покупцям: два явні періоди, Клієнт → Договір і вибрані показники. Налаштування не застосовано.'
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const aliases = (value: object, name: string) => Object.keys(value).filter(key => key.toLowerCase() === name.toLowerCase())
const filterCapability = { Version: 1, MaximumDepth: 8, MaximumLeaves: 64, MaximumNodes: 128, Operators: [1, 2] }
export function defaultBuyerSalesShare(): BuyerSalesShareOptions {
  return { Version: 1, From: '', To: '', BaseResource: 4, RoundingPolicy: 'NativeBuyerSalesShareRawGrossFinalAwayFromZero2' }
}
export function cloneBuyerSalesShareAliases(data: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).flatMap(([key, value]) => key.toLowerCase() === 'buyersalesshare' ? [[key, structuredClone(value)]] : []))
}
export function requestBuyerSalesShare(data: ReportRequestBody): unknown {
  return (data as unknown as Record<string, unknown>)[aliases(data, 'BuyerSalesShare')[0]]
}
/** Require every option exactly once; neither infer nor align the two independent windows. */
export function buyerSalesShareOptions(raw: unknown): BuyerSalesShareOptions | null {
  if (!record(raw) || Object.keys(raw).length !== optionKeys.length) return null
  const v: Record<string, unknown> = {}
  for (const name of optionKeys) { const keys = aliases(raw, name); if (keys.length !== 1) return null; v[name] = raw[keys[0]] }
  return v.Version === 1 && v.BaseResource === 4 && v.RoundingPolicy === 'NativeBuyerSalesShareRawGrossFinalAwayFromZero2'
    && isComparisonDate(v.From) && isComparisonDate(v.To) && v.From <= v.To ? v as BuyerSalesShareOptions : null
}
export function isBuyerSalesShareCapability(raw: unknown): boolean {
  if (!record(raw)) return false
  const expected = {"Version": 1, "Required": true, "DateFormat": "yyyy-MM-dd", "CalendarTimezone": "Europe/Kyiv", "BaseResources": [4], "RoundingPolicy": "NativeBuyerSalesShareRawGrossFinalAwayFromZero2", "RequiredRows": [12, 15], "ColumnsSupported": false, "MaximumFacts": 200000, "MaximumPeriodMemberships": 400000, "MaximumContracts": 200000, "MaximumDenseCells": 1000000, "MaximumSelections": 64, "MaximumFilterValues": 2000, "PublishedDecimalPlaces": 2, "ZeroPreviousPolicy": "Both shares known and previous raw ratio=0 gives relative change100, including0/0", "UnknownPolicy": "Any unknown amount makes both shares of that period unknown; changes require both periods known; unknown buyer rejects the report", "OrderingPolicy": "Positive ClientID ascending, exact ClientAgreementID ascending", "ClassificationPolicy": "New buyer has no qualifying native sale before each independent period start; repeat buyer has prior activity", "ShareZeroDenominatorPolicy": "Known raw total=0 gives both shares0, including signed cancellation; no0..100 clamp", "HistoryPolicy": "All qualifying activity across all buyer agreements/products; display filters never restrict history; no200000-history-row truncation", "SourceParityVerified": false}
  return Object.entries(expected).every(([key, value]) => JSON.stringify(raw[key]) === JSON.stringify(value))
}
/** Value is descriptive but remains a typed Int32 on the server, even on disabled rows. */
function selectionError(data: ReportRequestBody): string | null {
  if (!Array.isArray(data.selections) || data.selections.length > 64) return invalid
  const ids = new Set<string>()
  for (const item of data.selections) {
    if (!item || (item.IsChecked != null && typeof item.IsChecked !== 'boolean')) return invalid
    if (Array.isArray(item.Values) && item.Values.some(value => !value || (value.Value !== undefined
      && (!Number.isInteger(value.Value) || value.Value < -2147483648 || value.Value > 2147483647)))) return 'Описове Value у відборі має бути цілим Int32; точний ідентифікатор належить Data.Id.'
    if (item.IsChecked === false) continue
    if (![1, 2, 6, 9].includes(item.SelectedField?.Type) || ![0, 1, 2, 4].includes(item.FilterCondition?.Type)
      || !Array.isArray(item.Values) || !item.Values.length || item.Values.length > 2000) return invalid
    for (const value of item.Values) { const id = revenueExactId(value?.Data); if (!id) return 'Відбори часток продажів потребують точного позитивного Id товару, клієнта або ClientAgreement.'; ids.add(id) }
    if (ids.size > 2000) return 'Частки продажів покупцям підтримує до 2 000 різних ідентифікаторів у відборах.'
  }
  return null
}
export function buyerSalesShareConfigurationError(data: ReportRequestBody, dataset?: ReportDataset): string | null {
  const keys = aliases(data, 'BuyerSalesShare')
  if (keys.length > 1) return 'Параметри частки продажів новим і повторним покупцям задані двічі. Налаштування не застосовано.'
  if (data.dataSource !== BUYER_SALES_SHARE_SOURCE) return requestBuyerSalesShare(data) != null
    ? 'Параметри BuyerSalesShare підтримує лише звіт часток продажів покупцям.' : null
  if (!buyerSalesShareOptions(requestBuyerSalesShare(data))) return 'Оберіть початок і завершення періоду частки продажів новим і повторним покупцям та підтверджені параметри розрахунку.'
  if (!isComparisonDate(data.from) || !isComparisonDate(data.to) || data.from > data.to) return 'Оберіть коректний поточний період у межах 1900–9998 років.'
  if (dataset && !isBuyerSalesShareCapability(dataset.BuyerSalesShare)) return 'Сервер не підтвердив можливості частки продажів новим і повторним покупцям.'
  const unsupported = new Set(['onec', 'valuationclientagreementid', 'comparison', 'xyz', 'revenuecomparison', 'ordering', 'topgroups', 'threshold', 'hidezero', 'abcclassification'])
  if (Object.entries(data).some(([key, value]) => unsupported.has(key.toLowerCase()) && value != null)) return invalid
  if (!data.sorted || !Array.isArray(data.sorted.Row) || !Array.isArray(data.sorted.Col) || !Array.isArray(data.sorted.Measurements)
    || data.sorted.Row.length !== 2 || data.sorted.Row[0]?.type !== 12 || data.sorted.Row[1]?.type !== 15 || data.sorted.Col.length) return invalid
  const all = data.sorted.Measurements, active = all.filter(m => m?.IsChecked !== false)
  if (!all.length || all.length > 8 || all.some(m => !m || ![39, 40, 41, 42, 43, 44, 45, 46].includes(m.Type) || (m.IsChecked != null && typeof m.IsChecked !== 'boolean'))
    || !active.length || new Set(active.map(m => m.Type)).size !== active.length) return invalid
  return selectionError(data) ?? reportFilterExpressionError(data, dataset ?? ({ FilterExpression: filterCapability } as ReportDataset))
}
