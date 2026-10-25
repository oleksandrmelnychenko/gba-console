import type { ReportDataset, ReportDatasetField, ReportEntity, ReportRequestBody, ReportSelectedValue } from '../types'
import { usesCurrentFinancialAxes } from './currentFinancialAxes'

export const FINANCIAL_BUYER_MANAGER_FILTER = 60
export const FINANCIAL_BUYER_MANAGER_LOOKUP = '/report/datasets/current-financial/buyer-managers/lookup'
const conditions = [0, 1, 2, 4] as const
export type FinancialBuyerManagerReference = { Id: string }
export type CurrentFinancialBuyerManagerFilter = {
  version: 1; requiredProfitReadMode: 0; requiredDayOrganizationBasis: 0
  field: ReportDatasetField; valueKind: 'buyerManagerRef'; conditions: number[]
  lookupPath: typeof FINANCIAL_BUYER_MANAGER_LOOKUP; maximumValues: 100
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

export function currentFinancialBuyerManagerFilterCapability(dataset?: ReportDataset): CurrentFinancialBuyerManagerFilter | undefined {
  const cap = dataset?.currentFinancialBuyerManagerFilter
  if (dataset?.DataSource !== 35 || !record(cap) || cap.version !== 1 || cap.requiredProfitReadMode !== 0
    || cap.requiredDayOrganizationBasis !== 0 || cap.valueKind !== 'buyerManagerRef' || cap.lookupPath !== FINANCIAL_BUYER_MANAGER_LOOKUP
    || cap.maximumValues !== 100 || !Array.isArray(cap.conditions) || cap.conditions.length !== conditions.length
    || !cap.conditions.every((type, index) => type === conditions[index]) || !record(cap.field)
    || cap.field.Type !== FINANCIAL_BUYER_MANAGER_FILTER || cap.field.Selectable !== true
    || typeof cap.field.Name !== 'string' || !cap.field.Name.trim()) return undefined
  return cap as CurrentFinancialBuyerManagerFilter
}
export function currentFinancialBuyerManagerFilterSupported(dataset?: ReportDataset, request?: object): boolean {
  return !!request && usesCurrentFinancialAxes(request) && !!currentFinancialBuyerManagerFilterCapability(dataset)
}

/** SQL binary(16) hex identity; never convert through Guid or Number. Zero means proven unassigned. */
export function financialBuyerManagerReference(value: unknown): FinancialBuyerManagerReference | null {
  if (typeof value === 'string') {
    if (value.length > 512) return null
    try {
      const tokens = [...value.matchAll(/"((?:\\.|[^"\\])*)"\s*:/g)]
      if (tokens.length !== 1 || (JSON.parse(`"${tokens[0][1]}"`) as string).toLowerCase() !== 'id') return null
      value = JSON.parse(value)
    } catch { return null }
  }
  if (!record(value) || Object.keys(value).length !== 1) return null
  const [key, id] = Object.entries(value)[0]
  return key.toLowerCase() === 'id' && typeof id === 'string' && /^[0-9a-fA-F]{32}$/.test(id) ? { Id: id.toUpperCase() } : null
}

/** Only scoped picker wrappers carry this marker; unrelated entity keys are unchanged. */
export function financialBuyerManagerEntityReference(entity: ReportEntity): FinancialBuyerManagerReference | null {
  const reference = financialBuyerManagerReference(entity.buyerManagerRef)
  return reference && entity.Id === reference.Id ? reference : null
}
export function financialBuyerManagerSelectedEntity(value: ReportSelectedValue): ReportEntity {
  const reference = financialBuyerManagerReference(value.Data)
  return reference ? { Id: reference.Id, Name: value.Name, buyerManagerRef: reference } : value.Data
}

export function currentFinancialBuyerManagerFilterError(data: ReportRequestBody, dataset?: ReportDataset, draft = false): string | null {
  if (data.dataSource !== 35 || !Array.isArray(data.selections)) return null
  const selected = data.selections.filter(selection => selection?.SelectedField?.Type === FINANCIAL_BUYER_MANAGER_FILTER)
  if (!selected.length) return null
  if (!usesCurrentFinancialAxes(data)) return 'Відбір за поточним основним менеджером покупця доступний лише для поточних документів GBA та основи «Продажі мінус повернення». Поверніть цей режим або приберіть відбір; дати й налаштування збережено.'
  if (!currentFinancialBuyerManagerFilterCapability(dataset)) return 'Поточний сервер не підтвердив відбір за основним менеджером покупця. Налаштування збережено без змін.'
  for (const selection of selected) {
    if (!conditions.some(type => type === selection.FilterCondition?.Type) || !Array.isArray(selection.Values)
      || (!draft && selection.Values.length < 1) || selection.Values.length > 100
      || [0, 1].includes(selection.FilterCondition.Type) && (draft ? selection.Values.length > 1 : selection.Values.length !== 1))
      return 'Оберіть одного менеджера для «Дорівнює / Не дорівнює» або до 100 різних значень для списку.'
    const ids = new Set<string>()
    for (const value of selection.Values) {
      const reference = financialBuyerManagerReference(value?.Data)
      if (!reference || ids.has(reference.Id)) return 'Оберіть точних менеджерів без повторів або «Без основного менеджера покупця».'
      ids.add(reference.Id)
    }
  }
  return null
}

export function financialBuyerManagerLookupPolicy(dataset: ReportDataset | undefined, request: ReportRequestBody | undefined,
  field: number | undefined, mode: 0 | 1 | undefined, unavailable: boolean | undefined) {
  if (dataset?.DataSource !== 35 || field !== FINANCIAL_BUYER_MANAGER_FILTER) return { mode, unavailable }
  const supported = currentFinancialBuyerManagerFilterSupported(dataset, request)
  return { mode: supported ? 0 as const : undefined, unavailable: !supported }
}
