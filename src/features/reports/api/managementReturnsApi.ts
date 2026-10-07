import { ApiError, unwrapApiResponse } from '../../../shared/api/apiClient'
import { apiRequestStream, assertApiStreamCurrent } from '../../../shared/api/apiStreamClient'
import { readSession } from '../../../shared/auth/session'
import { createManagementReturnsRequest, invalidManagementReturns, isManagementReturnsCapabilities, normalizeManagementReturnsReport,
  type ManagementReturnsCapabilities, type ManagementReturnsReport, type ManagementReturnsWindows } from '../data/managementReturns'

const route = '/report/constructors/management-returns'
const maximumBytes = 16 * 1024 * 1024 // Same bounded preview transport as the accepted native report reader.
async function readPayload(response: Response, signal: AbortSignal): Promise<unknown> {
  if (!response.body || response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw invalidManagementReturns()
  const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true })
  const abort = () => { void reader.cancel().catch(() => undefined) }
  signal.addEventListener('abort', abort, { once: true })
  let text = '', bytes = 0
  try {
    while (true) {
      assertApiStreamCurrent(response, signal); const next = await reader.read(); assertApiStreamCurrent(response, signal)
      if (next.done) break
      bytes += next.value.byteLength; if (bytes > maximumBytes) throw invalidManagementReturns()
      text += decoder.decode(next.value, { stream: true })
    }
    text += decoder.decode(); const value = unwrapApiResponse<unknown>(JSON.parse(text)); assertApiStreamCurrent(response, signal); return value
  } catch {
    assertApiStreamCurrent(response, signal)
    throw invalidManagementReturns()
  } finally { signal.removeEventListener('abort', abort); void reader.cancel().catch(() => undefined); reader.releaseLock() }
}
async function request(path: string, callerKey: string, signal: AbortSignal, body?: string) {
  signal.throwIfAborted()
  const session = readSession()
  if (!callerKey || session?.userNetUid !== callerKey) throw new ApiError('Дочекайтеся завантаження користувача.', 401, null)
  return apiRequestStream(path, { session: { userNetUid: session.userNetUid, csrfToken: session.csrfToken }, signal,
    method: body === undefined ? 'GET' : 'POST', body })
}
export async function getManagementReturnsCapabilities(callerKey: string, signal: AbortSignal): Promise<ManagementReturnsCapabilities> {
  const response = await request(`${route}/capabilities`, callerKey, signal)
  try { const value = await readPayload(response, signal); if (!isManagementReturnsCapabilities(value)) throw invalidManagementReturns(); return value }
  finally { void response.body?.cancel().catch(() => undefined) }
}
/** One preview produces inline values and caller-bound files; ambiguous outcomes are never retried here. */
export async function previewManagementReturns(capability: ManagementReturnsCapabilities, windows: ManagementReturnsWindows,
  callerKey: string, signal: AbortSignal): Promise<ManagementReturnsReport> {
  const command = createManagementReturnsRequest(capability, windows)
  const response = await request(`${route}/preview`, callerKey, signal, JSON.stringify(command))
  try {
    const report = normalizeManagementReturnsReport(await readPayload(response, signal), command)
    if (response.headers.get('Gba-Report-Request-Sha256') !== report.RequestSha256
      || response.headers.get('Gba-Report-Result-Sha256') !== report.ResultSha256) throw invalidManagementReturns()
    assertApiStreamCurrent(response, signal); return report
  } finally { void response.body?.cancel().catch(() => undefined) }
}
