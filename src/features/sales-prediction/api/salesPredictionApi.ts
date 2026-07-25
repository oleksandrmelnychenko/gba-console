import { apiRequest } from '../../../shared/api/apiClient'
import { normalizeAiHistoryLineage } from '../../../shared/ai/aiHistoryLineage'
import type {
  SalesForecastHistoryItem,
  SalesForecastHistoryStatus,
  SalesForecastIdentityStatus,
  SalesForecastRequestOptions,
  SalesForecastResponse,
  SalesForecastResponseStatus,
  SalesForecastScope,
  SalesPredictionClientOption,
  SalesPredictionPoint,
  SalesPredictionProductOption,
} from '../types'

const FORECAST_SCOPES: SalesForecastScope[] = ['ByClient', 'ByProduct', 'ByClientAndProduct']
const RESPONSE_STATUSES: SalesForecastResponseStatus[] = [
  'excluded_entity',
  'insufficient_history',
  'no_scope',
  'partial',
  'ready',
  'unknown_identity',
]
const HISTORY_STATUSES: SalesForecastHistoryStatus[] = [
  'excluded_synthetic',
  'insufficient_history',
  'not_requested',
  'sufficient',
  'unknown_identity',
]
const IDENTITY_STATUSES: SalesForecastIdentityStatus[] = [
  'excluded_synthetic',
  'not_requested',
  'resolved',
  'unknown',
]
const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const CENT_EPSILON = 1e-7

export class SalesForecastContractError extends Error {
  constructor(path: string, reason: string) {
    super(`Некоректна відповідь AI Forecast (${path}): ${reason}`)
    this.name = 'SalesForecastContractError'
  }
}

export async function getPredictionByClient(
  clientNetId: string,
  signalOrOptions?: AbortSignal | SalesForecastRequestOptions,
): Promise<SalesPredictionPoint[]> {
  const response = await getSalesForecast(clientNetId, undefined, resolveRequestOptions(signalOrOptions))
  return response.ByClient
}

export async function getPredictionByProduct(
  productNetId: string,
  signalOrOptions?: AbortSignal | SalesForecastRequestOptions,
): Promise<SalesPredictionPoint[]> {
  const response = await getSalesForecast(undefined, productNetId, resolveRequestOptions(signalOrOptions))
  return response.ByProduct
}

export async function getPredictionByClientAndProduct(
  clientNetId: string,
  productNetId: string,
  signalOrOptions?: AbortSignal | SalesForecastRequestOptions,
): Promise<SalesPredictionPoint[]> {
  const response = await getSalesForecast(clientNetId, productNetId, resolveRequestOptions(signalOrOptions))
  return response.ByClientAndProduct
}

export async function getSalesForecast(
  clientNetId?: string,
  productNetId?: string,
  options: SalesForecastRequestOptions = {},
): Promise<SalesForecastResponse> {
  const requestedClientNetId = normalizeRequestedGuid(clientNetId, 'request.client_net_id')
  const requestedProductNetId = normalizeRequestedGuid(productNetId, 'request.product_net_id')

  if (requestedClientNetId === null && requestedProductNetId === null) {
    throw new SalesForecastContractError('request', 'client or product identity is required')
  }

  if (options.months !== undefined && (!Number.isSafeInteger(options.months) || options.months <= 0)) {
    throw new SalesForecastContractError('request.months', 'must be a positive integer')
  }
  if (options.asOfDate !== undefined) {
    requireIsoDate(options.asOfDate, 'request.as_of_date')
  }

  const result = await apiRequest<unknown>('/sales/prediction/get', {
    query: {
      clientNetId: requestedClientNetId ?? undefined,
      productNetId: requestedProductNetId ?? undefined,
      months: options.months,
      asOfDate: options.asOfDate,
      useCache: options.useCache,
    },
    ...(options.signal ? { signal: options.signal } : {}),
  })

  return normalizeSalesForecast(result, {
    asOfDate: options.asOfDate,
    clientNetId: requestedClientNetId,
    months: options.months,
    productNetId: requestedProductNetId,
  })
}

export async function searchPredictionClients(
  searchValue: string,
  signal?: AbortSignal,
): Promise<SalesPredictionClientOption[]> {
  const result = await apiRequest<unknown>('/clients/search/all/sales/', {
    query: { searchValue: searchValue.trim() },
    signal,
  })

  return normalizeArray(result) as SalesPredictionClientOption[]
}

export async function searchPredictionProducts(
  searchValue: string,
  signal?: AbortSignal,
): Promise<SalesPredictionProductOption[]> {
  const result = await apiRequest<unknown>('/products/search/vendorcodeandsales', {
    query: { limit: 20, offset: 0, searchValue: searchValue.trim() },
    signal,
  })

  return normalizeArray(result) as SalesPredictionProductOption[]
}

type ExpectedForecastRequest = {
  asOfDate?: string
  clientNetId: string | null
  months?: number
  productNetId: string | null
}

function normalizeSalesForecast(result: unknown, expected: ExpectedForecastRequest): SalesForecastResponse {
  const payload = requireRecord(typeof result === 'string' ? safeParse(result) : result, 'response')
  const series = Object.fromEntries(
    FORECAST_SCOPES.map((scope) => [scope, normalizeForecastPoints(payload[scope], scope)]),
  ) as Record<SalesForecastScope, SalesPredictionPoint[]>
  const meta = requireRecord(payload.meta, 'meta')
  const requested = requireRecord(meta.requested, 'meta.requested')
  const resolved = requireRecord(meta.resolved, 'meta.resolved')
  const identity = requireRecord(meta.identity, 'meta.identity')
  const historyRecord = requireRecord(meta.history, 'meta.history')

  const status = requireEnum(meta.status, RESPONSE_STATUSES, 'meta.status')
  const asOf = requireIsoDate(meta.as_of, 'meta.as_of')
  const requestedAsOf = requireIsoDate(meta.requested_as_of, 'meta.requested_as_of')
  if (requestedAsOf !== asOf) {
    throw new SalesForecastContractError('meta.requested_as_of', 'must equal the resolved business date')
  }
  if (expected.asOfDate !== undefined && requestedAsOf !== expected.asOfDate) {
    throw new SalesForecastContractError('meta.requested_as_of', 'does not echo request.as_of_date')
  }
  const historyLineage = normalizeAiHistoryLineage(
    meta,
    'meta',
    createSalesForecastContractError,
    {
      asOf,
      ...(expected.asOfDate ? { expectedAsOf: expected.asOfDate } : {}),
    },
  )

  const horizonMonths = requirePositiveInteger(meta.horizon_months, 'meta.horizon_months')
  if (expected.months !== undefined && horizonMonths !== expected.months) {
    throw new SalesForecastContractError('meta.horizon_months', 'does not echo request.months')
  }

  if (meta.currency !== 'EUR') {
    throw new SalesForecastContractError('meta.currency', 'must be EUR')
  }

  const requestedClientNetId = requireNullableGuid(requested.client_net_id, 'meta.requested.client_net_id')
  const requestedProductNetId = requireNullableGuid(requested.product_net_id, 'meta.requested.product_net_id')
  if (requestedClientNetId !== expected.clientNetId || requestedProductNetId !== expected.productNetId) {
    throw new SalesForecastContractError('meta.requested', 'does not echo requested identities')
  }

  const clientIdentity = requireEnum(identity.client, IDENTITY_STATUSES, 'meta.identity.client')
  const productIdentity = requireEnum(identity.product, IDENTITY_STATUSES, 'meta.identity.product')
  const resolvedClientId = requireNullablePositiveInteger(resolved.client_id, 'meta.resolved.client_id')
  const resolvedProductId = requireNullablePositiveInteger(resolved.product_id, 'meta.resolved.product_id')
  const resolvedClientNetId = requireNullableGuid(resolved.client_net_id, 'meta.resolved.client_net_id')
  const resolvedProductNetId = requireNullableGuid(resolved.product_net_id, 'meta.resolved.product_net_id')

  assertIdentityProof(
    requestedClientNetId,
    resolvedClientId,
    resolvedClientNetId,
    clientIdentity,
    'meta.identity.client',
  )
  assertIdentityProof(
    requestedProductNetId,
    resolvedProductId,
    resolvedProductNetId,
    productIdentity,
    'meta.identity.product',
  )

  const historyWindowMonths = requirePositiveInteger(
    meta.history_window_months,
    'meta.history_window_months',
  )
  const minimumNonZeroMonths = requirePositiveInteger(
    meta.minimum_non_zero_months,
    'meta.minimum_non_zero_months',
  )
  if (minimumNonZeroMonths > historyWindowMonths) {
    throw new SalesForecastContractError(
      'meta.minimum_non_zero_months',
      'cannot exceed history_window_months',
    )
  }

  const history = Object.fromEntries(
    FORECAST_SCOPES.map((scope) => {
      const item = normalizeHistoryItem(
        historyRecord[scope],
        `meta.history.${scope}`,
        historyWindowMonths,
        minimumNonZeroMonths,
      )
      assertSeriesMatchesHistory(series[scope], item, horizonMonths, scope)
      return [scope, item]
    }),
  ) as Record<SalesForecastScope, SalesForecastHistoryItem>

  assertResponseStatus(status, history, clientIdentity, productIdentity)

  return {
    ...series,
    meta: {
      ...historyLineage,
      status,
      as_of: asOf,
      requested_as_of: requestedAsOf,
      horizon_months: horizonMonths,
      currency: 'EUR',
      model_version: requireNonEmptyString(meta.model_version, 'meta.model_version'),
      source_fingerprint: requireNonEmptyString(meta.source_fingerprint, 'meta.source_fingerprint'),
      requested: {
        client_net_id: requestedClientNetId,
        product_net_id: requestedProductNetId,
      },
      resolved: {
        client_id: resolvedClientId,
        client_net_id: resolvedClientNetId,
        product_id: resolvedProductId,
        product_net_id: resolvedProductNetId,
      },
      identity: {
        client: clientIdentity,
        product: productIdentity,
      },
      history_window_months: historyWindowMonths,
      minimum_non_zero_months: minimumNonZeroMonths,
      history,
    },
  }
}

function createSalesForecastContractError(
  path: string,
  reason: string,
): SalesForecastContractError {
  return new SalesForecastContractError(path, reason)
}

function normalizeForecastPoints(value: unknown, path: string): SalesPredictionPoint[] {
  const seenMonths = new Set<string>()

  return requireArray(value, path).map((item, index) => {
    const itemPath = `${path}[${index}]`
    const point = requireRecord(item, itemPath)
    const month = requireNonEmptyString(point.MonthNameUK, `${itemPath}.MonthNameUK`)

    if (seenMonths.has(month)) {
      throw new SalesForecastContractError(`${itemPath}.MonthNameUK`, 'duplicate forecast month')
    }
    seenMonths.add(month)

    return {
      MonthNameUK: month,
      SaleAmount: requireMoney(point.SaleAmount, `${itemPath}.SaleAmount`),
    }
  })
}

function normalizeHistoryItem(
  value: unknown,
  path: string,
  historyWindowMonths: number,
  minimumNonZeroMonths: number,
): SalesForecastHistoryItem {
  const item = requireRecord(value, path)
  const status = requireEnum(item.status, HISTORY_STATUSES, `${path}.status`)
  const monthCount = requireInteger(item.month_count, `${path}.month_count`, 0, historyWindowMonths)
  const nonZeroMonthCount = requireInteger(
    item.non_zero_month_count,
    `${path}.non_zero_month_count`,
    0,
    monthCount,
  )
  const totalEur = requireMoney(item.total_eur, `${path}.total_eur`)
  const sufficient = requireBoolean(item.sufficient, `${path}.sufficient`)

  if ((nonZeroMonthCount > 0) !== (totalEur > 0)) {
    throw new SalesForecastContractError(path, 'history activity and total_eur disagree')
  }
  if (sufficient !== (status === 'sufficient')) {
    throw new SalesForecastContractError(path, 'status and sufficient flag disagree')
  }
  if (sufficient !== (nonZeroMonthCount >= minimumNonZeroMonths)) {
    throw new SalesForecastContractError(path, 'sufficiency does not match the configured minimum')
  }
  if (
    ['excluded_synthetic', 'not_requested', 'unknown_identity'].includes(status)
    && (monthCount !== 0 || nonZeroMonthCount !== 0 || totalEur !== 0)
  ) {
    throw new SalesForecastContractError(path, 'unavailable scope must have zero history')
  }

  return {
    status,
    month_count: monthCount,
    non_zero_month_count: nonZeroMonthCount,
    total_eur: totalEur,
    sufficient,
  }
}

function assertSeriesMatchesHistory(
  points: SalesPredictionPoint[],
  history: SalesForecastHistoryItem,
  horizonMonths: number,
  path: string,
) {
  const expectedCount = history.sufficient ? horizonMonths : 0

  if (points.length !== expectedCount) {
    throw new SalesForecastContractError(path, `expected ${expectedCount} points from history proof`)
  }
}

function assertIdentityProof(
  requestedNetId: string | null,
  resolvedId: number | null,
  resolvedNetId: string | null,
  status: SalesForecastIdentityStatus,
  path: string,
) {
  if (requestedNetId === null) {
    if (status !== 'not_requested' || resolvedId !== null || resolvedNetId !== null) {
      throw new SalesForecastContractError(path, 'unrequested identity must stay unresolved')
    }
    return
  }

  if (status === 'unknown') {
    if (resolvedId !== null || resolvedNetId !== null) {
      throw new SalesForecastContractError(path, 'unknown identity must stay unresolved')
    }
    return
  }

  if (status === 'resolved' || status === 'excluded_synthetic') {
    if (resolvedId === null || resolvedNetId !== requestedNetId) {
      throw new SalesForecastContractError(path, 'resolved identity does not match the request')
    }
    return
  }

  throw new SalesForecastContractError(path, 'identity status does not match the request')
}

function assertResponseStatus(
  status: SalesForecastResponseStatus,
  history: Record<SalesForecastScope, SalesForecastHistoryItem>,
  clientIdentity: SalesForecastIdentityStatus,
  productIdentity: SalesForecastIdentityStatus,
) {
  const identities = [clientIdentity, productIdentity]
  if (identities.includes('excluded_synthetic')) {
    if (status !== 'excluded_entity') {
      throw new SalesForecastContractError('meta.status', 'must report excluded_entity')
    }
    return
  }
  if (identities.includes('unknown')) {
    if (status !== 'unknown_identity') {
      throw new SalesForecastContractError('meta.status', 'must report unknown_identity')
    }
    return
  }

  const applicable = FORECAST_SCOPES
    .map((scope) => history[scope])
    .filter((item) => !['excluded_synthetic', 'not_requested', 'unknown_identity'].includes(item.status))
  const sufficientCount = applicable.filter((item) => item.sufficient).length
  const expectedStatus = sufficientCount === applicable.length
    ? 'ready'
    : sufficientCount === 0
      ? 'insufficient_history'
      : 'partial'

  if (status !== expectedStatus) {
    throw new SalesForecastContractError('meta.status', `must be ${expectedStatus}`)
  }
}

function resolveRequestOptions(
  signalOrOptions?: AbortSignal | SalesForecastRequestOptions,
): SalesForecastRequestOptions {
  if (isAbortSignal(signalOrOptions)) {
    return { signal: signalOrOptions }
  }

  return signalOrOptions ?? {}
}

function isAbortSignal(value: unknown): value is AbortSignal {
  return Boolean(
    value
      && typeof value === 'object'
      && 'aborted' in value
      && typeof (value as { addEventListener?: unknown }).addEventListener === 'function',
  )
}

function normalizeRequestedGuid(value: string | undefined, path: string): string | null {
  if (value === undefined || value.trim() === '') {
    return null
  }

  return requireGuid(value, path)
}

function requireNullableGuid(value: unknown, path: string): string | null {
  if (value === null) {
    return null
  }

  return requireGuid(value, path)
}

function requireGuid(value: unknown, path: string): string {
  const normalized = requireNonEmptyString(value, path).toLowerCase()

  if (!GUID_PATTERN.test(normalized)) {
    throw new SalesForecastContractError(path, 'must be a GUID')
  }

  return normalized
}

function requireIsoDate(value: unknown, path: string): string {
  const date = requireNonEmptyString(value, path)

  if (!ISO_DATE_PATTERN.test(date)) {
    throw new SalesForecastContractError(path, 'must be an ISO date')
  }

  const [year, month, day] = date.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() + 1 !== month
    || parsed.getUTCDate() !== day
  ) {
    throw new SalesForecastContractError(path, 'must be a valid calendar date')
  }

  return date
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SalesForecastContractError(path, 'expected an object')
  }

  return value as Record<string, unknown>
}

function requireArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new SalesForecastContractError(path, 'expected an array')
  }

  return value
}

function requireNonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new SalesForecastContractError(path, 'expected a non-empty string')
  }

  return value
}

function requireBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') {
    throw new SalesForecastContractError(path, 'expected a boolean')
  }

  return value
}

function requirePositiveInteger(value: unknown, path: string): number {
  return requireInteger(value, path, 1, Number.MAX_SAFE_INTEGER)
}

function requireNullablePositiveInteger(value: unknown, path: string): number | null {
  if (value === null) {
    return null
  }

  return requirePositiveInteger(value, path)
}

function requireInteger(value: unknown, path: string, minimum: number, maximum: number): number {
  if (
    typeof value !== 'number'
    || !Number.isSafeInteger(value)
    || value < minimum
    || value > maximum
  ) {
    throw new SalesForecastContractError(path, `must be an integer from ${minimum} to ${maximum}`)
  }

  return value
}

function requireMoney(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new SalesForecastContractError(path, 'must be a finite non-negative amount')
  }
  if (Math.abs(value * 100 - Math.round(value * 100)) > CENT_EPSILON) {
    throw new SalesForecastContractError(path, 'must be rounded to cents')
  }

  return value
}

function requireEnum<T extends string>(value: unknown, values: readonly T[], path: string): T {
  if (typeof value !== 'string' || !values.includes(value as T)) {
    throw new SalesForecastContractError(path, 'contains an unsupported value')
  }

  return value as T
}

function normalizeArray(result: unknown): unknown[] {
  const parsed = typeof result === 'string' ? safeParse(result) : result

  if (Array.isArray(parsed)) {
    return parsed
  }

  if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>

    for (const key of ['Items', 'Clients', 'Products', 'Data', 'Collection']) {
      if (Array.isArray(record[key])) {
        return record[key] as unknown[]
      }
    }
  }

  return []
}

function safeParse(value: string): unknown {
  const normalized = value.trim()

  if (!normalized) {
    return null
  }

  try {
    return JSON.parse(normalized) as unknown
  } catch {
    return null
  }
}
