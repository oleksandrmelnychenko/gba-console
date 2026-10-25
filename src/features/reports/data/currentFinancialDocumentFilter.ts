import type { ReportDataset, ReportDatasetField, ReportEntity, ReportRequestBody, ReportSelectedValue } from '../types'
import { usesCurrentFinancialAxes } from './currentFinancialAxes'

export const FINANCIAL_DOCUMENT_FILTER = 12
export const FINANCIAL_DOCUMENT_LOOKUP = '/report/datasets/current-financial/documents/lookup'
const conditions = [0, 1, 2, 4] as const
export type FinancialDocumentReference = { kind: 'sale' | 'return'; id: string }
export type CurrentFinancialDocumentFilter = {
  version: 1; requiredProfitReadMode: 0; requiredDayOrganizationBasis: 0
  field: ReportDatasetField; valueKind: 'documentRef'; conditions: number[]
  lookupPath: typeof FINANCIAL_DOCUMENT_LOOKUP; maximumValues: 100
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

export function currentFinancialDocumentFilterCapability(dataset?: ReportDataset): CurrentFinancialDocumentFilter | undefined {
  const cap = dataset?.currentFinancialDocumentFilter
  if (dataset?.DataSource !== 35 || !record(cap) || cap.version !== 1 || cap.requiredProfitReadMode !== 0
    || cap.requiredDayOrganizationBasis !== 0 || cap.valueKind !== 'documentRef' || cap.lookupPath !== FINANCIAL_DOCUMENT_LOOKUP
    || cap.maximumValues !== 100 || !Array.isArray(cap.conditions) || cap.conditions.length !== conditions.length
    || !cap.conditions.every((type, index) => type === conditions[index]) || !record(cap.field)
    || cap.field.Type !== FINANCIAL_DOCUMENT_FILTER || cap.field.Selectable !== true
    || typeof cap.field.Name !== 'string' || !cap.field.Name.trim()) return undefined
  return cap as CurrentFinancialDocumentFilter
}
export function currentFinancialDocumentFilterSupported(dataset?: ReportDataset, request?: object): boolean {
  return !!request && usesCurrentFinancialAxes(request) && !!currentFinancialDocumentFilterCapability(dataset)
}

/** A reference is exactly two fields; aliases cannot collide and Int64 never passes through Number. */
export function financialDocumentReference(value: unknown): FinancialDocumentReference | null {
  if (typeof value === 'string') {
    if (value.length > 512) return null
    try {
      const tokens = [...value.matchAll(/"((?:\\.|[^"\\])*)"\s*:/g)]
      const keys = tokens.map(match => (JSON.parse(`"${match[1]}"`) as string).toLowerCase())
      if (keys.length !== 2 || new Set(keys).size !== 2) return null
      const idToken = tokens[keys.indexOf('id')]
      if (!idToken) return null
      const rawId = value.slice(idToken.index! + idToken[0].length).trimStart()
      // JSON.parse erases numeric lexical evidence (1e2 / 1.0). Match the server's integer-token rule.
      if (!rawId.startsWith('"') && !/^[1-9]\d*\s*[,}]/.test(rawId)) return null
      value = JSON.parse(value)
    } catch { return null }
  }
  if (!record(value) || Object.keys(value).length !== 2) return null
  const entries = Object.entries(value), names = entries.map(([key]) => key.toLowerCase())
  if (new Set(names).size !== 2 || !names.includes('kind') || !names.includes('id')) return null
  const kind = entries.find(([key]) => key.toLowerCase() === 'kind')?.[1]
  const rawId = entries.find(([key]) => key.toLowerCase() === 'id')?.[1]
  const id = typeof rawId === 'string' ? rawId : typeof rawId === 'number' && Number.isSafeInteger(rawId) ? String(rawId) : ''
  if ((kind !== 'sale' && kind !== 'return') || !/^[1-9]\d{0,18}$/.test(id) || BigInt(id) > 9223372036854775807n) return null
  return { kind, id }
}
export const financialDocumentKey = (reference: FinancialDocumentReference) => `${reference.kind}:${reference.id}`

/** Lookup display wrappers never enter request Data. */
export function financialDocumentEntityReference(entity: ReportEntity): FinancialDocumentReference | null {
  const direct = financialDocumentReference(entity)
  if (direct) return direct
  const reference = financialDocumentReference(entity.documentRef)
  return reference && entity.Id === financialDocumentKey(reference) ? reference : null
}
export function financialDocumentSelectedEntity(value: ReportSelectedValue): ReportEntity {
  const reference = financialDocumentReference(value.Data)
  return reference ? { Id: financialDocumentKey(reference), Name: value.Name, documentRef: reference } : value.Data
}

export function currentFinancialDocumentFilterError(data: ReportRequestBody, dataset?: ReportDataset, draft = false): string | null {
  if (data.dataSource !== 35 || !Array.isArray(data.selections)) return null
  const selected = data.selections.filter(selection => selection?.SelectedField?.Type === FINANCIAL_DOCUMENT_FILTER)
  if (!selected.length) return null
  if (!usesCurrentFinancialAxes(data)) return 'Відбір за документом доступний лише для поточних документів GBA та основи «Продажі мінус повернення». Поверніть цей режим або приберіть відбір; дати й налаштування збережено.'
  if (!currentFinancialDocumentFilterCapability(dataset)) return 'Поточний сервер не підтвердив відбір прибутку за документом. Налаштування збережено без змін.'
  if (selected.some(selection => !conditions.some(type => type === selection.FilterCondition?.Type)
    || !Array.isArray(selection.Values) || !draft && selection.Values.length < 1 || selection.Values.length > 100
    || [0, 1].includes(selection.FilterCondition.Type) && (draft ? selection.Values.length > 1 : selection.Values.length !== 1)
    || selection.Values.some(value => !financialDocumentReference(value?.Data))))
    return 'Оберіть точні документи продажу або повернення: одне значення для «Дорівнює / Не дорівнює» або до 100 для списку.'
  return null
}

/** The new capability admits its own lookup independently of the old five-field lookup marker. */
export function financialDocumentLookupPolicy(dataset: ReportDataset | undefined, request: ReportRequestBody | undefined,
  field: number | undefined, mode: 0 | 1 | undefined, unavailable: boolean | undefined) {
  if (dataset?.DataSource !== 35 || field !== 12) return { mode, unavailable }
  const supported = currentFinancialDocumentFilterSupported(dataset, request)
  return { mode: supported ? 0 as const : undefined, unavailable: !supported }
}
