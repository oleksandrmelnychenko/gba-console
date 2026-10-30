import { ApiError } from '../../../../shared/api/apiClient'

export type CrossSellFailure = 'agreementUnavailable' | 'unknown'
export const CROSS_SELL_AGREEMENT_UNAVAILABLE = 'Для вибраного договору рекомендації недоступні. Перевірте активність договору та доступ до нього.'

/** Only an authoritative recommendation error can explain agreement admission. */
export function crossSellFailure(error: unknown): CrossSellFailure {
  const payload = error instanceof ApiError ? error.payload : null
  return error instanceof ApiError && error.status === 404 && payload !== null && typeof payload === 'object'
    && !Array.isArray(payload) && 'ErrorCode' in payload && payload.ErrorCode === 'ai_agreement_unavailable'
    ? 'agreementUnavailable' : 'unknown'
}
