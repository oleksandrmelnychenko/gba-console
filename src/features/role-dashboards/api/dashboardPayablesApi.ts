import { apiRequest } from '../../../shared/api/apiClient'
import type { PayablesAmounts, PayablesBucket, PayablesPartyKind, PayablesRow, PayablesRows, PayablesRowsRequest, PayablesSnapshot, PayablesWorkspace } from '../payablesTypes'

const invalid = () => new Error('Не вдалося перевірити дані кредиторської заборгованості')
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' ? value as Record<string, unknown> : {}
const field = (data: Record<string, unknown>, key: string) => Object.hasOwn(data, key) ? data[key] : data[key[0].toUpperCase() + key.slice(1)]
const string = (value: unknown): string => { if (typeof value !== 'string') throw invalid(); return value }
const optionalString = (value: unknown): string | null => value == null ? null : string(value)
const integer = (value: unknown): number => { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw invalid(); return value }
const bool = (value: unknown): boolean => { if (typeof value !== 'boolean') throw invalid(); return value }
const timestamp = (value: unknown): string => { const text = string(value); if (!/Z$/i.test(text) || !Number.isFinite(Date.parse(text))) throw invalid(); return text }
const date = (value: unknown): string => { const text = string(value); if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(Date.parse(`${text}T00:00:00Z`))) throw invalid(); return text }
const uuid = (value: unknown): string => { const text = string(value); if (!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(text)) throw invalid(); return text }
const array = (value: unknown): unknown[] => { if (!Array.isArray(value)) throw invalid(); return value }

function amounts(value: unknown): PayablesAmounts {
  const data = record(value)
  const signedBalance = field(data, 'signedBalance'), payable = field(data, 'payable'), advance = field(data, 'advance')
  if (![signedBalance, payable, advance].every(value => typeof value === 'number' && Number.isFinite(value))
    || (payable as number) < 0 || (advance as number) < 0) throw invalid()
  const difference = (advance as number) - (payable as number)
  if (Math.abs((signedBalance as number) - difference) > Number.EPSILON * Math.max(1, Math.abs(signedBalance as number), advance as number, payable as number) * 8) throw invalid()
  return { signedBalance: signedBalance as number, payable: payable as number, advance: advance as number }
}

function bucket(value: unknown): PayablesBucket {
  const data = record(value), currencyCode = string(field(data, 'currencyCode'))
  if (!currencyCode.trim()) throw invalid()
  const result = {
    ...amounts(data), currencyCode, rowCount: integer(field(data, 'rowCount')),
    goodsRowCount: integer(field(data, 'goodsRowCount')), serviceRowCount: integer(field(data, 'serviceRowCount')),
    unknownRowCount: integer(field(data, 'unknownRowCount')),
  }
  if (result.goodsRowCount + result.serviceRowCount !== result.rowCount || result.unknownRowCount > result.rowCount) throw invalid()
  return result
}

function row(value: unknown): PayablesRow {
  const data = record(value), balance = amounts(data), partyKind = integer(field(data, 'partyKind')), known = bool(field(data, 'known'))
  if (partyKind !== 2 && partyKind !== 3) throw invalid()
  if (balance.payable !== Math.max(-balance.signedBalance, 0) || balance.advance !== Math.max(balance.signedBalance, 0)) throw invalid()
  if (!known && (balance.payable !== 0 || balance.advance !== 0)) throw invalid()
  return {
    ...balance, id: string(field(data, 'id')), partyKind, known,
    supplierNetUid: uuid(field(data, 'supplierNetUid')), supplierName: optionalString(field(data, 'supplierName')),
    agreementNetUid: uuid(field(data, 'agreementNetUid')), agreementName: optionalString(field(data, 'agreementName')),
    organizationName: optionalString(field(data, 'organizationName')),
  }
}

function scope(data: Record<string, unknown>, expected?: PayablesPartyKind): PayablesPartyKind | null {
  const actual = field(data, 'partyKind') ?? null
  if (actual !== null && actual !== 2 && actual !== 3) throw invalid()
  if (actual !== (expected ?? null)) throw invalid()
  return actual
}

export function normalizePayablesSnapshot(value: unknown, expected?: PayablesPartyKind): PayablesSnapshot {
  const data = record(value), buckets = array(field(data, 'buckets')).map(bucket)
  if (new Set(buckets.map(item => item.currencyCode)).size !== buckets.length) throw invalid()
  const partyKind = scope(data, expected)
  if (buckets.some(item => partyKind === 2 ? item.serviceRowCount !== 0 : partyKind === 3 && item.goodsRowCount !== 0)) throw invalid()
  return { partyKind, readAtUtc: timestamp(field(data, 'readAtUtc')), asOfDate: date(field(data, 'asOfDate')), buckets }
}

export function normalizePayablesRows(value: unknown, request: PayablesRowsRequest): PayablesRows {
  const data = record(value), total = integer(field(data, 'total'))
  if (field(data, 'asOfDate') !== request.asOfDate || field(data, 'currencyCode') !== request.currencyCode
    || field(data, 'offset') !== request.offset || field(data, 'limit') !== request.limit) throw invalid()
  const partyKind = scope(data, request.partyKind)
  const rows = array(field(data, 'rows')).map(row)
  if (partyKind !== null && rows.some(item => item.partyKind !== partyKind)) throw invalid()
  if (rows.length !== Math.min(request.limit, Math.max(0, total - request.offset)) || new Set(rows.map(item => item.id)).size !== rows.length || rows.some(item => !item.id)) throw invalid()
  return { partyKind, asOfDate: request.asOfDate, currencyCode: request.currencyCode, offset: request.offset, limit: request.limit, total, aggregate: amounts(field(data, 'aggregate')), rows }
}

export async function getPayablesSnapshot(workspace: PayablesWorkspace, signal?: AbortSignal, partyKind?: PayablesPartyKind): Promise<PayablesSnapshot> {
  return normalizePayablesSnapshot(await apiRequest<unknown>('/dashboards/payables', { query: { workspace, ...(partyKind === undefined ? {} : { partyKind }) }, signal }), partyKind)
}

export async function getPayablesRows(request: PayablesRowsRequest, signal?: AbortSignal): Promise<PayablesRows> {
  return normalizePayablesRows(await apiRequest<unknown>('/dashboards/payables/rows', { query: request, signal }), request)
}
