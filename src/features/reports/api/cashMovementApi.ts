import { apiRequestStream, assertApiStreamCurrent } from '../../../shared/api/apiStreamClient'
import { readSession } from '../../../shared/auth/session'
import { createCashMovementArticleChoicesRequest, invalidCashMovementChoices, normalizeCashMovementArticleChoices,
  type CashMovementArticleChoices } from '../data/cashMovementArticleChoices'
import { ApiError, apiRequest, unwrapApiResponse } from '../../../shared/api/apiClient'
import { CASH_MOVEMENT_DEFINITIONS, cashMovementKind, createCashMovementRequest, isCashMovementCapabilities, normalizeCashMovementReport,
  type CashMovementCapabilities, type CashMovementKind, type CashMovementReport } from '../data/cashMovement'

export async function getCashMovementCapabilities(kind: CashMovementKind, signal?: AbortSignal): Promise<CashMovementCapabilities> {
  const value = await apiRequest<unknown>(`${CASH_MOVEMENT_DEFINITIONS[kind].Route}/capabilities`, { signal, dedupe: false })
  if (!isCashMovementCapabilities(value, kind)) throw new Error('Сервер не підтвердив параметри цієї форми руху коштів.')
  return value
}
async function requestCashMovement(path: string, callerKey: string, signal: AbortSignal, body: string) {
  signal.throwIfAborted()
  const session = readSession()
  if (!callerKey || session?.userNetUid !== callerKey) throw new ApiError('Дочекайтеся завантаження користувача.', 401, null)
  return apiRequestStream(path, { session: { userNetUid: session.userNetUid, csrfToken: session.csrfToken }, signal, method: 'POST', body })
}
async function readCashMovementPayload(response: Response, signal: AbortSignal, limit: number): Promise<unknown> {
  if (!response.body || response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw invalidCashMovementChoices()
  const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true })
  const abort = () => { void reader.cancel().catch(() => undefined) }
  signal.addEventListener('abort', abort, { once: true })
  let text = '', bytes = 0
  try {
    while (true) {
      assertApiStreamCurrent(response, signal); const next = await reader.read(); assertApiStreamCurrent(response, signal)
      if (next.done) break
      bytes += next.value.byteLength; if (bytes > limit) throw invalidCashMovementChoices()
      text += decoder.decode(next.value, { stream: true })
    }
    text += decoder.decode(); const value = unwrapApiResponse<unknown>(JSON.parse(text)); assertApiStreamCurrent(response, signal); return value
  } catch { assertApiStreamCurrent(response, signal); throw invalidCashMovementChoices() }
  finally { signal.removeEventListener('abort', abort); void reader.cancel().catch(() => undefined); reader.releaseLock() }
}
/** One report observation binds inline values and files; refused or ambiguous submissions are not retried here. */
export async function previewCashMovement(capability: CashMovementCapabilities, period: string, callerKey: string,
  signal: AbortSignal, articleChoiceKey?: string | null): Promise<CashMovementReport> {
  const command = createCashMovementRequest(capability, period, articleChoiceKey), kind = cashMovementKind(capability)!
  const response = await requestCashMovement(`${CASH_MOVEMENT_DEFINITIONS[kind].Route}/preview`, callerKey, signal, JSON.stringify(command))
  try {
    const report = normalizeCashMovementReport(await readCashMovementPayload(response, signal, 32 * 1024 * 1024), command)
    if (response.headers.get('Gba-Report-Request-Sha256') !== report.RequestSha256
      || response.headers.get('Gba-Report-Result-Sha256') !== report.ResultSha256) throw invalidCashMovementChoices()
    assertApiStreamCurrent(response, signal); return report
  } finally { void response.body?.cancel().catch(() => undefined) }
}
/** An optional filter list cannot fabricate catalogue rows or prevent an unfiltered report. */
export async function getCashMovementArticleChoices(capability: CashMovementCapabilities, period: string, callerKey: string,
  signal: AbortSignal, continuationKey: string | null = null): Promise<CashMovementArticleChoices> {
  const command = createCashMovementArticleChoicesRequest(capability, period, continuationKey), kind = cashMovementKind(capability)!
  const response = await requestCashMovement(`${CASH_MOVEMENT_DEFINITIONS[kind].Route}/article-choices`, callerKey, signal, JSON.stringify(command))
  try {
    const page = normalizeCashMovementArticleChoices(await readCashMovementPayload(response, signal, 2 * 1024 * 1024), command)
    assertApiStreamCurrent(response, signal); return page
  } finally { void response.body?.cancel().catch(() => undefined) }
}
