import { ApiError, unwrapApiResponse } from '../../../shared/api/apiClient'
import { apiRequestStream, assertApiStreamCurrent } from '../../../shared/api/apiStreamClient'
import { readSession } from '../../../shared/auth/session'
import { createManagementOrdersRequest, invalidManagementOrders, isManagementOrdersCapabilities, normalizeManagementOrdersReport,
  MANAGEMENT_ORDERS_ROUTE, type ManagementOrdersCapabilities, type ManagementOrdersReport } from '../data/managementOrders'

const maximumBytes = 16 * 1024 * 1024 // Same bounded preview transport as the accepted native report reader.
async function readPayload(response: Response, signal: AbortSignal): Promise<unknown> {
  if (!response.body || response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw invalidManagementOrders()
  const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true })
  const abort = () => { void reader.cancel().catch(() => undefined) }
  signal.addEventListener('abort', abort, { once: true })
  let text = '', bytes = 0
  try {
    while (true) {
      assertApiStreamCurrent(response, signal); const next = await reader.read(); assertApiStreamCurrent(response, signal)
      if (next.done) break
      bytes += next.value.byteLength; if (bytes > maximumBytes) throw invalidManagementOrders()
      text += decoder.decode(next.value, { stream: true })
    }
    text += decoder.decode(); const value = unwrapApiResponse<unknown>(JSON.parse(text)); assertApiStreamCurrent(response, signal); return value
  } catch {
    assertApiStreamCurrent(response, signal)
    throw invalidManagementOrders()
  } finally { signal.removeEventListener('abort', abort); void reader.cancel().catch(() => undefined); reader.releaseLock() }
}
async function request(path: string, callerKey: string, signal: AbortSignal, body?: string) {
  signal.throwIfAborted()
  const session = readSession()
  if (!callerKey || session?.userNetUid !== callerKey) throw new ApiError('Дочекайтеся завантаження користувача.', 401, null)
  return apiRequestStream(path, { session: { userNetUid: session.userNetUid, csrfToken: session.csrfToken }, signal,
    method: body === undefined ? 'GET' : 'POST', body })
}
export async function getManagementOrdersCapabilities(callerKey: string, signal: AbortSignal): Promise<ManagementOrdersCapabilities> {
  const response = await request(`${MANAGEMENT_ORDERS_ROUTE}/capabilities`, callerKey, signal)
  try { const value = await readPayload(response, signal); if (!isManagementOrdersCapabilities(value)) throw invalidManagementOrders(); return value }
  finally { void response.body?.cancel().catch(() => undefined) }
}
/** One preview produces inline values and caller-bound files; ambiguous outcomes are never retried here. */
export async function previewManagementOrders(capability: ManagementOrdersCapabilities, month: string,
  callerKey: string, signal: AbortSignal): Promise<ManagementOrdersReport> {
  const command = createManagementOrdersRequest(capability, month)
  const response = await request(`${MANAGEMENT_ORDERS_ROUTE}/preview`, callerKey, signal, JSON.stringify(command))
  try {
    const report = normalizeManagementOrdersReport(await readPayload(response, signal), command)
    if (response.headers.get('Gba-Report-Request-Sha256') !== report.RequestSha256
      || response.headers.get('Gba-Report-Result-Sha256') !== report.ResultSha256) throw invalidManagementOrders()
    assertApiStreamCurrent(response, signal); return report
  } finally { void response.body?.cancel().catch(() => undefined) }
}
