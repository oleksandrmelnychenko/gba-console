import { ApiError, unwrapApiResponse } from '../../../shared/api/apiClient'
import { apiRequestStream, assertApiStreamCurrent } from '../../../shared/api/apiStreamClient'
import { readSession } from '../../../shared/auth/session'
import { createPlannedCashRequest, invalidPlannedCash, isPlannedCashCapabilities, normalizePlannedCashReport,
  PLANNED_CASH_ROUTE, PLANNED_CASH_FORMS, type PlannedCashKind, type PlannedCashFilters, type PlannedCashCapabilities, type PlannedCashReport } from '../data/plannedCash'

const maximumBytes = 32 * 1024 * 1024 // Bounded grouped deliveries; no partial body or unbound files.
async function readPayload(response: Response, signal: AbortSignal): Promise<unknown> {
  if (!response.body || response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw invalidPlannedCash()
  const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true })
  const abort = () => { void reader.cancel().catch(() => undefined) }
  signal.addEventListener('abort', abort, { once: true })
  let text = '', bytes = 0
  try {
    while (true) {
      assertApiStreamCurrent(response, signal); const next = await reader.read(); assertApiStreamCurrent(response, signal)
      if (next.done) break
      bytes += next.value.byteLength; if (bytes > maximumBytes) throw invalidPlannedCash()
      text += decoder.decode(next.value, { stream: true })
    }
    text += decoder.decode(); const value = unwrapApiResponse<unknown>(JSON.parse(text)); assertApiStreamCurrent(response, signal); return value
  } catch {
    assertApiStreamCurrent(response, signal)
    throw invalidPlannedCash()
  } finally { signal.removeEventListener('abort', abort); void reader.cancel().catch(() => undefined); reader.releaseLock() }
}
async function request(path: string, callerKey: string, signal: AbortSignal, body?: string) {
  signal.throwIfAborted()
  const session = readSession()
  if (!callerKey || session?.userNetUid !== callerKey) throw new ApiError('Дочекайтеся завантаження користувача.', 401, null)
  return apiRequestStream(path, { session: { userNetUid: session.userNetUid, csrfToken: session.csrfToken }, signal,
    method: body === undefined ? 'GET' : 'POST', body })
}
export async function getPlannedCashCapabilities(kind: PlannedCashKind, callerKey: string, signal: AbortSignal): Promise<PlannedCashCapabilities> {
  const response = await request(`${PLANNED_CASH_ROUTE}/${PLANNED_CASH_FORMS[kind].Route}/capabilities`, callerKey, signal)
  try { const value = await readPayload(response, signal); if (!isPlannedCashCapabilities(value) || value.Kind !== kind) throw invalidPlannedCash(); return value }
  finally { void response.body?.cancel().catch(() => undefined) }
}
/** One preview produces inline values and caller-bound files; ambiguous outcomes are never retried here. */
export async function previewPlannedCash(capability: PlannedCashCapabilities, filters: PlannedCashFilters,
  callerKey: string, signal: AbortSignal): Promise<PlannedCashReport> {
  const command = createPlannedCashRequest(capability, filters)
  const response = await request(`${PLANNED_CASH_ROUTE}/${PLANNED_CASH_FORMS[capability.Kind].Route}/preview`, callerKey, signal, JSON.stringify(command))
  try {
    const report = normalizePlannedCashReport(await readPayload(response, signal), command)
    if (response.headers.get('Gba-Report-Request-Sha256') !== report.RequestSha256
      || response.headers.get('Gba-Report-Result-Sha256') !== report.ResultSha256) throw invalidPlannedCash()
    assertApiStreamCurrent(response, signal); return report
  } finally { void response.body?.cancel().catch(() => undefined) }
}
