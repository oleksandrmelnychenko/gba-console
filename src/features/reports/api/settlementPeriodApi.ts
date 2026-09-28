import { apiRequest } from '../../../shared/api/apiClient'
import { isSettlementFamily, isSettlementWorld, readSettlementPeriodAgreement, settlementPeriodExactId,
  readSettlementPeriodScope, validSettlementPeriodDays,
  type SettlementNativeFamily, type SettlementPeriodAgreement, type SettlementPeriodScope, type SettlementSourceWorld } from '../data/settlementPeriod'

/** Exact native choices only; lookup does not certify period coverage. */
export async function getSettlementPeriodAgreements(sourceWorld: SettlementSourceWorld, nativeFamily: SettlementNativeFamily,
  afterId = '0', limit = 30, signal?: AbortSignal): Promise<SettlementPeriodAgreement[]> {
  if (!isSettlementWorld(sourceWorld) || !isSettlementFamily(nativeFamily)
    || (afterId !== '0' && settlementPeriodExactId(afterId) === null)
    || !Number.isInteger(limit) || limit < 1 || limit > 50)
    throw new Error('Некоректна сторінка договорів взаєморозрахунків.')
  const body = await apiRequest<unknown>('/report/datasets/41/agreements', {
    query: { sourceWorld, nativeFamily, afterId, limit }, signal,
  })
  if (!Array.isArray(body) || body.length > limit) throw new Error('Сервер повернув некоректну сторінку договорів.')
  const rows = body.map(readSettlementPeriodAgreement)
  if (rows.some(row => !row || row.SourceWorld !== sourceWorld || row.NativeFamily !== nativeFamily))
    throw new Error('Сервер повернув договір без точної ідентичності або з іншої бази чи типу.')
  const agreements = rows as SettlementPeriodAgreement[]
  let last = BigInt(afterId)
  for (const row of agreements) {
    const id = BigInt(row.AgreementId)
    if (id <= last) throw new Error('Сервер повернув повторні або неупорядковані договори.')
    last = id
  }
  return agreements
}

/** One exact current OWN publication; preview and export recheck it independently. */
export async function getSettlementPeriodAvailability(scope: SettlementPeriodScope, from: string, to: string,
  signal?: AbortSignal): Promise<boolean> {
  const exact = readSettlementPeriodScope(scope)
  if (!exact || !validSettlementPeriodDays(from, to)) throw new Error('Некоректний завершений період договору.')
  const body = await apiRequest<unknown>('/report/datasets/41/availability', {
    query: { sourceWorld: exact.SourceWorld, nativeFamily: exact.NativeFamily, agreementId: exact.AgreementId,
      agreementNetUid: exact.AgreementNetUid, from, to }, signal,
  })
  if (body === null || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).sort().join(',') !== 'Available'
    || typeof (body as { Available?: unknown }).Available !== 'boolean')
    throw new Error('Сервер повернув некоректний стан покриття договору.')
  return (body as { Available: boolean }).Available
}
