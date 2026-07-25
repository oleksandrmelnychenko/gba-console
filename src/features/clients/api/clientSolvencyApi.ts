import { apiRequest } from '../../../shared/api/apiClient'
import type {
  CurrencyExposure,
  ForwardRisk,
  ForwardRiskStatus,
  SolvencyBatch,
  SolvencyBatchError,
  SolvencyCharts,
  SolvencyScore,
  TurnoverExposurePoint,
  TrendPoint,
} from '../solvencyTypes'

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const CENT_EPSILON = 1e-7

export class SolvencyContractError extends Error {
  constructor(path: string, reason: string) {
    super(`Некоректна відповідь AI Solvency (${path}): ${reason}`)
    this.name = 'SolvencyContractError'
  }
}

export async function getClientSolvencyScore(
  clientNetId: string,
  signal?: AbortSignal,
): Promise<SolvencyScore> {
  const requestedNetId = requireGuid(clientNetId, 'request.client_net_uid')
  const result = await apiRequest<unknown>('/solvency/get', {
    query: {
      clientNetId: requestedNetId,
    },
    ...(signal ? { signal } : {}),
  })

  return normalizeScore(result, requestedNetId, 'score')
}

export async function getClientSolvencyCharts(
  clientId: number,
  signal?: AbortSignal,
): Promise<SolvencyCharts> {
  requirePositiveInteger(clientId, 'request.client_id')
  const result = await apiRequest<unknown>('/solvency/charts', {
    query: {
      clientId,
    },
    ...(signal ? { signal } : {}),
  })

  return normalizeCharts(result, clientId)
}

export async function getClientSolvencyScoresBatch(
  clientIds: number[],
  signal?: AbortSignal,
): Promise<SolvencyBatch> {
  if (clientIds.length === 0 || clientIds.length > 500) {
    throw new SolvencyContractError('request.client_ids', 'must contain from 1 to 500 IDs')
  }
  const requestedIds = new Set<number>()
  clientIds.forEach((clientId, index) => {
    requirePositiveInteger(clientId, `request.client_ids[${index}]`)
    if (requestedIds.has(clientId)) {
      throw new SolvencyContractError(`request.client_ids[${index}]`, 'duplicate client')
    }
    requestedIds.add(clientId)
  })

  const result = await apiRequest<unknown>('/solvency/scores/batch', {
    method: 'POST',
    body: clientIds,
    ...(signal ? { signal } : {}),
  })

  return normalizeBatch(result, requestedIds)
}

function normalizeBatch(result: unknown, requestedIds: Set<number>): SolvencyBatch {
  const payload = requireRecord(result, 'batch')
  const results = requireArray(payload.results, 'batch.results').map((value, index) =>
    normalizeScore(value, null, `batch.results[${index}]`))
  const errors = requireArray(payload.errors, 'batch.errors').map((value, index) =>
    normalizeBatchError(value, `batch.errors[${index}]`))
  const count = requireNonNegativeInteger(payload.count, 'batch.count')
  const failed = requireNonNegativeInteger(payload.failed, 'batch.failed')

  if (count !== results.length || failed !== errors.length) {
    throw new SolvencyContractError('batch', 'count proofs do not match result arrays')
  }
  if (count + failed !== requestedIds.size) {
    throw new SolvencyContractError('batch', 'does not account for every requested client')
  }

  const returnedIds = new Set<number>()
  for (const [index, row] of [...results, ...errors].entries()) {
    if (!requestedIds.has(row.client_id)) {
      throw new SolvencyContractError(`batch.identity[${index}]`, 'client was not requested')
    }
    if (returnedIds.has(row.client_id)) {
      throw new SolvencyContractError(`batch.identity[${index}]`, 'duplicate client result')
    }
    returnedIds.add(row.client_id)
  }

  return { results, errors, count, failed }
}

function normalizeBatchError(value: unknown, path: string): SolvencyBatchError {
  const error = requireRecord(value, path)

  return {
    client_id: requirePositiveInteger(error.client_id, `${path}.client_id`),
    error: requireNonEmptyString(error.error, `${path}.error`),
  }
}

function normalizeScore(value: unknown, expectedNetId: string | null, path: string): SolvencyScore {
  const score = requireRecord(value, path) as Partial<SolvencyScore>
  const clientId = requirePositiveInteger(score.client_id, `${path}.client_id`)
  const clientNetUid = score.client_net_uid === null
    ? null
    : requireGuid(score.client_net_uid, `${path}.client_net_uid`)

  if (expectedNetId !== null && clientNetUid !== expectedNetId) {
    throw new SolvencyContractError(`${path}.client_net_uid`, 'does not echo the requested client')
  }
  if (expectedNetId === null && clientNetUid !== null) {
    throw new SolvencyContractError(`${path}.client_net_uid`, 'batch score must not claim a NetUID')
  }

  const currencyBreakdown = score.currency_breakdown === null
    ? null
    : requireArray(score.currency_breakdown, `${path}.currency_breakdown`).map((row, index) =>
        normalizeCurrencyExposure(row, `${path}.currency_breakdown[${index}]`))
  if (currencyBreakdown !== null) {
    const currencyIds = new Set(currencyBreakdown.map((row) => row.currency_id))
    if (currencyIds.size !== currencyBreakdown.length) {
      throw new SolvencyContractError(`${path}.currency_breakdown`, 'duplicate currency')
    }
  }

  if (typeof score.applicable !== 'boolean') {
    throw new SolvencyContractError(`${path}.applicable`, 'expected a boolean')
  }
  if (score.data_sufficiency !== 'ok' && score.data_sufficiency !== 'insufficient') {
    throw new SolvencyContractError(
      `${path}.data_sufficiency`,
      'expected ok or insufficient',
    )
  }
  const forwardRiskStatus = requireForwardRiskStatus(
    score.forward_risk_status,
    `${path}.forward_risk_status`,
  )
  const forwardRiskReason = score.forward_risk_reason === null
    ? null
    : requireNonEmptyString(score.forward_risk_reason, `${path}.forward_risk_reason`)
  const forwardRisk = normalizeForwardRisk(score.forward_risk, `${path}.forward_risk`)
  if (
    forwardRiskStatus === 'available'
      ? forwardRisk === null || forwardRiskReason !== null
      : forwardRisk !== null || forwardRiskReason === null
  ) {
    throw new SolvencyContractError(
      `${path}.forward_risk_status`,
      'status, value, and reason disagree',
    )
  }
  requireNullableNumberInRange(score.score, `${path}.score`, 0, 100, true)
  requireNullableNumberInRange(score.pd, `${path}.pd`, 0, 1)
  requireNullableFiniteNumber(score.raw_score, `${path}.raw_score`)
  requirePositiveInteger(score.window_months, `${path}.window_months`)
  requireNonEmptyString(score.model_version, `${path}.model_version`)
  const sourceHistoryStart = requireIsoDate(
    score.source_history_start,
    `${path}.source_history_start`,
  )
  const effectiveStart = requireIsoDate(score.effective_start, `${path}.effective_start`)
  const asOfDate = requireIsoDate(score.as_of_date, `${path}.as_of_date`)
  if (sourceHistoryStart > effectiveStart || effectiveStart > asOfDate) {
    throw new SolvencyContractError(`${path}.effective_start`, 'history dates are inverted')
  }
  if (typeof score.history_complete !== 'boolean') {
    throw new SolvencyContractError(`${path}.history_complete`, 'expected a boolean')
  }
  if (
    score.applicable
    && score.data_sufficiency === 'insufficient'
    && (
      score.score !== null
      || score.rating !== null
      || score.pd !== null
      || score.contributions !== null
      || forwardRisk !== null
      || score.currency_breakdown !== null
    )
  ) {
    throw new SolvencyContractError(path, 'insufficient data contains a fabricated score')
  }

  return {
    ...(score as SolvencyScore),
    client_id: clientId,
    client_net_uid: clientNetUid,
    currency_breakdown: currencyBreakdown,
    forward_risk: forwardRisk,
    forward_risk_status: forwardRiskStatus,
    forward_risk_reason: forwardRiskReason,
    source_history_start: sourceHistoryStart,
    effective_start: effectiveStart,
    history_complete: score.history_complete,
    as_of_date: asOfDate,
  }
}

function normalizeForwardRisk(value: unknown, path: string): ForwardRisk | null {
  if (value === null) {
    return null
  }
  const risk = requireRecord(value, path)
  if (
    risk.band !== 'low' &&
    risk.band !== 'medium' &&
    risk.band !== 'high' &&
    risk.band !== 'very_high'
  ) {
    throw new SolvencyContractError(`${path}.band`, 'contains an unsupported value')
  }

  return {
    band: risk.band,
    pd: requireNumberInRange(risk.pd, `${path}.pd`, 0, 1),
  }
}

function requireForwardRiskStatus(value: unknown, path: string): ForwardRiskStatus {
  if (value !== 'available' && value !== 'not_applicable' && value !== 'model_unavailable') {
    throw new SolvencyContractError(path, 'contains an unsupported value')
  }
  return value
}

function normalizeCurrencyExposure(value: unknown, path: string): CurrencyExposure {
  const row = requireRecord(value, path)

  return {
    currency_id: requirePositiveInteger(row.currency_id, `${path}.currency_id`),
    turnover_eur: requireMoney(row.turnover_eur, `${path}.turnover_eur`),
    exposure_eur: requireMoney(row.exposure_eur, `${path}.exposure_eur`),
  }
}

function normalizeCharts(result: unknown, expectedClientId: number): SolvencyCharts {
  const charts = requireRecord(result, 'charts') as Partial<SolvencyCharts>
  const clientId = requirePositiveInteger(charts.client_id, 'charts.client_id')
  if (clientId !== expectedClientId) {
    throw new SolvencyContractError('charts.client_id', 'does not echo the requested client')
  }
  const sourceHistoryStart = requireIsoDate(
    charts.source_history_start,
    'charts.source_history_start',
  )
  const effectiveStart = requireIsoDate(charts.effective_start, 'charts.effective_start')
  const asOfDate = requireIsoDate(charts.as_of_date, 'charts.as_of_date')
  if (sourceHistoryStart > effectiveStart || effectiveStart > asOfDate) {
    throw new SolvencyContractError('charts.effective_start', 'history dates are inverted')
  }
  if (typeof charts.history_complete !== 'boolean') {
    throw new SolvencyContractError('charts.history_complete', 'expected a boolean')
  }

  const turnoverVsExposure = requireArray(
    charts.turnover_vs_exposure,
    'charts.turnover_vs_exposure',
  ).map((row, index) => normalizeTurnoverExposure(row, `charts.turnover_vs_exposure[${index}]`))
  const turnoverTrend = requireArray(charts.turnover_trend, 'charts.turnover_trend')
    .map((row, index) => normalizeTrend(row, `charts.turnover_trend[${index}]`))

  if (turnoverVsExposure.length !== turnoverTrend.length) {
    throw new SolvencyContractError('charts.turnover_trend', 'timeline length mismatch')
  }
  turnoverVsExposure.forEach((row, index) => {
    const trend = turnoverTrend[index]
    if (row.period !== trend.period || row.turnover_eur !== trend.turnover_eur) {
      throw new SolvencyContractError(`charts.turnover_trend[${index}]`, 'turnover timeline mismatch')
    }
  })

  const agingBars = requireArray(charts.open_invoice_aging_bars, 'charts.open_invoice_aging_bars')
    .map((value, index) => {
      const row = requireRecord(value, `charts.open_invoice_aging_bars[${index}]`)
      return {
        bucket: requireNonEmptyString(row.bucket, `charts.open_invoice_aging_bars[${index}].bucket`),
        count: requireNonNegativeInteger(row.count, `charts.open_invoice_aging_bars[${index}].count`),
        amount_eur: row.amount_eur === null
          ? null
          : requireMoney(row.amount_eur, `charts.open_invoice_aging_bars[${index}].amount_eur`),
      }
    })

  return {
    ...(charts as SolvencyCharts),
    client_id: clientId,
    source_history_start: sourceHistoryStart,
    effective_start: effectiveStart,
    history_complete: charts.history_complete,
    as_of_date: asOfDate,
    open_invoice_aging_bars: agingBars,
    turnover_vs_exposure: turnoverVsExposure,
    turnover_trend: turnoverTrend,
  }
}

function normalizeTurnoverExposure(value: unknown, path: string): TurnoverExposurePoint {
  const row = requireRecord(value, path)

  return {
    period: requireNonEmptyString(row.period, `${path}.period`),
    turnover_eur: requireMoney(row.turnover_eur, `${path}.turnover_eur`),
    exposure_eur: requireMoney(row.exposure_eur, `${path}.exposure_eur`),
  }
}

function normalizeTrend(value: unknown, path: string): TrendPoint {
  const row = requireRecord(value, path)

  return {
    period: requireNonEmptyString(row.period, `${path}.period`),
    turnover_eur: requireMoney(row.turnover_eur, `${path}.turnover_eur`),
  }
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SolvencyContractError(path, 'expected an object')
  }

  return value as Record<string, unknown>
}

function requireIsoDate(value: unknown, path: string): string {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) {
    throw new SolvencyContractError(path, 'expected an ISO date')
  }
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    throw new SolvencyContractError(path, 'invalid calendar date')
  }
  return value
}

function requireArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new SolvencyContractError(path, 'expected an array')
  }

  return value
}

function requireNonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new SolvencyContractError(path, 'expected a non-empty string')
  }

  return value
}

function requireGuid(value: unknown, path: string): string {
  const guid = requireNonEmptyString(value, path).toLowerCase()
  if (!GUID_PATTERN.test(guid)) {
    throw new SolvencyContractError(path, 'must be a GUID')
  }

  return guid
}

function requirePositiveInteger(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new SolvencyContractError(path, 'must be a positive integer')
  }

  return value
}

function requireNumberInRange(
  value: unknown,
  path: string,
  minimum: number,
  maximum: number,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new SolvencyContractError(path, `must be between ${minimum} and ${maximum}`)
  }

  return value
}

function requireNonNegativeInteger(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new SolvencyContractError(path, 'must be a non-negative integer')
  }

  return value
}

function requireNullableNumberInRange(
  value: unknown,
  path: string,
  minimum: number,
  maximum: number,
  integer = false,
): number | null {
  if (value === null) {
    return null
  }
  if (
    typeof value !== 'number'
    || !Number.isFinite(value)
    || value < minimum
    || value > maximum
    || (integer && !Number.isInteger(value))
  ) {
    throw new SolvencyContractError(path, `must be null or between ${minimum} and ${maximum}`)
  }

  return value
}

function requireNullableFiniteNumber(value: unknown, path: string): number | null {
  if (value === null) {
    return null
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new SolvencyContractError(path, 'must be null or a finite number')
  }

  return value
}

function requireMoney(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new SolvencyContractError(path, 'must be a finite non-negative amount')
  }
  if (Math.abs(value * 100 - Math.round(value * 100)) > CENT_EPSILON) {
    throw new SolvencyContractError(path, 'must be rounded to cents')
  }

  return value
}
