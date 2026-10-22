import { apiRequest } from '../../../shared/api/apiClient'
import type { PayablesAmounts, PayablesBucket, PayablesRows, PayablesRowsRequest, PayablesSnapshot, PayablesWorkspace, PayablesWorld } from '../payablesTypes'

const invalid = () => new Error('Не вдалося перевірити дані кредиторської заборгованості')
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' ? value as Record<string, unknown> : {}
const field = (data: Record<string, unknown>, key: string) => Object.hasOwn(data, key) ? data[key] : data[key[0].toUpperCase() + key.slice(1)]
const string = (value: unknown): string => { if (typeof value !== 'string') throw invalid(); return value }
const optionalString = (value: unknown): string | null => value == null ? null : string(value)
const integer = (value: unknown): number => { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw invalid(); return value }
const bool = (value: unknown): boolean => { if (typeof value !== 'boolean') throw invalid(); return value }
const timestamp = (value: unknown): string => { const text = string(value); if (!/Z$/i.test(text) || !Number.isFinite(Date.parse(text))) throw invalid(); return text }
const optionalTimestamp = (value: unknown): string | null => value == null ? null : timestamp(value)
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
  return { ...amounts(data), currencyCode, currencyLabel: optionalString(field(data, 'currencyLabel')), rowCount: integer(field(data, 'rowCount')) }
}

function world(value: unknown): PayablesWorld {
  const data = record(value), world = field(data, 'world'), status = field(data, 'status')
  if (!['fenix', 'amg'].includes(String(world)) || !['unavailable', 'confirmed'].includes(String(status))) throw invalid()
  const buckets = array(field(data, 'buckets')).map(bucket)
  if (new Set(buckets.map(item => item.currencyCode)).size !== buckets.length) throw invalid()
  const confirmed = status === 'confirmed'
  if (!confirmed && buckets.length) throw invalid()
  const requestedKeys = field(data, 'requestedKeys') == null ? null : integer(field(data, 'requestedKeys'))
  const returnedKeys = field(data, 'returnedKeys') == null ? null : integer(field(data, 'returnedKeys'))
  if (requestedKeys !== null && returnedKeys !== null && returnedKeys > requestedKeys) throw invalid()
  const scopeComplete = bool(field(data, 'scopeComplete'))
  if (confirmed && (!scopeComplete || requestedKeys === null || returnedKeys === null
    || buckets.reduce((total, item) => total + item.rowCount, 0) !== requestedKeys)) throw invalid()
  return {
    world: world as PayablesWorld['world'], status: status as PayablesWorld['status'],
    reason: optionalString(field(data, 'reason')),
    publicationId: confirmed ? uuid(field(data, 'publicationId')) : null,
    sourceCutoffUtc: confirmed ? timestamp(field(data, 'sourceCutoffUtc')) : optionalTimestamp(field(data, 'sourceCutoffUtc')),
    capturedAtUtc: confirmed ? timestamp(field(data, 'capturedAtUtc')) : optionalTimestamp(field(data, 'capturedAtUtc')),
    publishedAtUtc: confirmed ? timestamp(field(data, 'publishedAtUtc')) : optionalTimestamp(field(data, 'publishedAtUtc')),
    scopeComplete, scope: string(field(data, 'scope')),
    requestedKeys, returnedKeys,
    excludedKeys: field(data, 'excludedKeys') == null ? null : integer(field(data, 'excludedKeys')),
    buckets,
  }
}

export function normalizePayablesSnapshot(value: unknown): PayablesSnapshot {
  const data = record(value), worlds = array(field(data, 'worlds')).map(world)
  if (worlds.length !== 2 || new Set(worlds.map(item => item.world)).size !== 2) throw invalid()
  return { readAtUtc: timestamp(field(data, 'readAtUtc')), worlds }
}

export function normalizePayablesRows(value: unknown, request: PayablesRowsRequest): PayablesRows {
  const data = record(value), total = integer(field(data, 'total'))
  if (field(data, 'world') !== request.world || field(data, 'publicationId') !== request.publicationId
    || field(data, 'currencyCode') !== request.currencyCode || field(data, 'offset') !== request.offset || field(data, 'limit') !== request.limit) throw invalid()
  const rows = array(field(data, 'rows')).map(value => {
    const row = record(value)
    const balance = amounts(row)
    if (balance.payable !== Math.max(-balance.signedBalance, 0) || balance.advance !== Math.max(balance.signedBalance, 0)) throw invalid()
    return { ...balance, id: string(field(row, 'id')), partyKind: integer(field(row, 'partyKind')),
      supplierCode: string(field(row, 'supplierCode')), supplierName: optionalString(field(row, 'supplierName')),
      agreementId: string(field(row, 'agreementId')), agreementName: optionalString(field(row, 'agreementName')),
      organizationName: optionalString(field(row, 'organizationName')) }
  })
  if (rows.length !== Math.min(request.limit, Math.max(0, total - request.offset)) || new Set(rows.map(row => row.id)).size !== rows.length || rows.some(row => !row.id)) throw invalid()
  return { ...request, total, sourceCutoffUtc: timestamp(field(data, 'sourceCutoffUtc')), aggregate: amounts(field(data, 'aggregate')), rows }
}

export async function getPayablesSnapshot(workspace: PayablesWorkspace, signal?: AbortSignal): Promise<PayablesSnapshot> {
  return normalizePayablesSnapshot(await apiRequest<unknown>('/dashboards/payables', { query: { workspace }, signal }))
}

export async function getPayablesRows(request: PayablesRowsRequest, signal?: AbortSignal): Promise<PayablesRows> {
  return normalizePayablesRows(await apiRequest<unknown>('/dashboards/payables/rows', { query: request, signal }), request)
}
