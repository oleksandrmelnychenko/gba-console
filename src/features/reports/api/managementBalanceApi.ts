import { ApiError, unwrapApiResponse } from '../../../shared/api/apiClient'
import { apiRequestStream, assertApiStreamCurrent } from '../../../shared/api/apiStreamClient'
import { readSession } from '../../../shared/auth/session'
import { createManagementBalanceRequest, invalidManagementBalance, isManagementBalanceCapabilities, normalizeManagementBalanceReport,
  MANAGEMENT_BALANCE_DEFINITIONS, managementBalanceKind, type ManagementBalanceKind, type ManagementBalanceCapabilities, type ManagementBalanceReport } from '../data/managementBalance'

const maximumBytes = 16 * 1024 * 1024 // Same bounded preview transport as the accepted native report reader.
async function readPayload(response: Response, signal: AbortSignal): Promise<unknown> {
  if (!response.body || response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw invalidManagementBalance()
  const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true })
  const abort = () => { void reader.cancel().catch(() => undefined) }
  signal.addEventListener('abort', abort, { once: true })
  let text = '', bytes = 0
  try {
    while (true) {
      assertApiStreamCurrent(response, signal); const next = await reader.read(); assertApiStreamCurrent(response, signal)
      if (next.done) break
      bytes += next.value.byteLength; if (bytes > maximumBytes) throw invalidManagementBalance()
      text += decoder.decode(next.value, { stream: true })
    }
    text += decoder.decode(); const value = unwrapApiResponse<unknown>(JSON.parse(text)); assertApiStreamCurrent(response, signal); return value
  } catch {
    assertApiStreamCurrent(response, signal)
    throw invalidManagementBalance()
  } finally { signal.removeEventListener('abort', abort); void reader.cancel().catch(() => undefined); reader.releaseLock() }
}
async function request(path: string, callerKey: string, signal: AbortSignal, body?: string) {
  signal.throwIfAborted()
  const session = readSession()
  if (!callerKey || session?.userNetUid !== callerKey) throw new ApiError('Дочекайтеся завантаження користувача.', 401, null)
  return apiRequestStream(path, { session: { userNetUid: session.userNetUid, csrfToken: session.csrfToken }, signal,
    method: body === undefined ? 'GET' : 'POST', body })
}
export async function getManagementBalanceCapabilities(kind: ManagementBalanceKind, callerKey: string, signal: AbortSignal): Promise<ManagementBalanceCapabilities> {
  const response = await request(`${MANAGEMENT_BALANCE_DEFINITIONS[kind].Route}/capabilities`, callerKey, signal)
  try { const value = await readPayload(response, signal); if (!isManagementBalanceCapabilities(value, kind)) throw invalidManagementBalance(); return value }
  finally { void response.body?.cancel().catch(() => undefined) }
}
/** One preview produces inline values and caller-bound files; ambiguous outcomes are never retried here. */
export async function previewManagementBalance(capability: ManagementBalanceCapabilities, period: string,
  callerKey: string, signal: AbortSignal): Promise<ManagementBalanceReport> {
  const command = createManagementBalanceRequest(capability, period)
  const response = await request(`${MANAGEMENT_BALANCE_DEFINITIONS[managementBalanceKind(capability)!].Route}/preview`, callerKey, signal, JSON.stringify(command))
  try {
    const report = normalizeManagementBalanceReport(await readPayload(response, signal), command)
    if (response.headers.get('Gba-Report-Request-Sha256') !== report.RequestSha256
      || response.headers.get('Gba-Report-Result-Sha256') !== report.ResultSha256) throw invalidManagementBalance()
    assertApiStreamCurrent(response, signal); return report
  } finally { void response.body?.cancel().catch(() => undefined) }
}
