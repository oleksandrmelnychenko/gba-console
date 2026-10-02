import { ApiError, unwrapApiResponse } from '../../../shared/api/apiClient'
import { apiRequestStream, assertApiStreamCurrent } from '../../../shared/api/apiStreamClient'
import { readSession } from '../../../shared/auth/session'
import { createInventoryTurnoverRequest, invalidInventoryTurnover, isInventoryTurnoverCapabilities, normalizeInventoryTurnoverReport,
  INVENTORY_TURNOVER_ROUTE, type InventoryTurnoverCapabilities, type InventoryTurnoverReport } from '../data/inventoryTurnover'

const maximumBytes = 1024 * 1024 // Four bounded exact fractions and the server input witness.
async function readPayload(response: Response, signal: AbortSignal): Promise<unknown> {
  if (!response.body || response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw invalidInventoryTurnover()
  const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true })
  const abort = () => { void reader.cancel().catch(() => undefined) }
  signal.addEventListener('abort', abort, { once: true })
  let text = '', bytes = 0
  try {
    while (true) {
      assertApiStreamCurrent(response, signal); const next = await reader.read(); assertApiStreamCurrent(response, signal)
      if (next.done) break
      bytes += next.value.byteLength; if (bytes > maximumBytes) throw invalidInventoryTurnover()
      text += decoder.decode(next.value, { stream: true })
    }
    text += decoder.decode(); const value = unwrapApiResponse<unknown>(JSON.parse(text)); assertApiStreamCurrent(response, signal); return value
  } catch {
    assertApiStreamCurrent(response, signal)
    throw invalidInventoryTurnover()
  } finally { signal.removeEventListener('abort', abort); void reader.cancel().catch(() => undefined); reader.releaseLock() }
}
async function request(path: string, callerKey: string, signal: AbortSignal, body?: string) {
  signal.throwIfAborted()
  const session = readSession()
  if (!callerKey || session?.userNetUid !== callerKey) throw new ApiError('Дочекайтеся завантаження користувача.', 401, null)
  return apiRequestStream(path, { session: { userNetUid: session.userNetUid, csrfToken: session.csrfToken }, signal,
    method: body === undefined ? 'GET' : 'POST', body })
}
export async function getInventoryTurnoverCapabilities(callerKey: string, signal: AbortSignal): Promise<InventoryTurnoverCapabilities> {
  const response = await request(`${INVENTORY_TURNOVER_ROUTE}/capabilities`, callerKey, signal)
  try { const value = await readPayload(response, signal); if (!isInventoryTurnoverCapabilities(value)) throw invalidInventoryTurnover(); return value }
  finally { void response.body?.cancel().catch(() => undefined) }
}
/** One preview produces inline values and caller-bound files; ambiguous outcomes are never retried here. */
export async function previewInventoryTurnover(capability: InventoryTurnoverCapabilities, month: string,
  callerKey: string, signal: AbortSignal): Promise<InventoryTurnoverReport> {
  const command = createInventoryTurnoverRequest(capability, month)
  const response = await request(`${INVENTORY_TURNOVER_ROUTE}/preview`, callerKey, signal, JSON.stringify(command))
  try {
    const report = normalizeInventoryTurnoverReport(await readPayload(response, signal), command)
    if (response.headers.get('Gba-Report-Request-Sha256') !== report.RequestSha256
      || response.headers.get('Gba-Report-Result-Sha256') !== report.ResultSha256) throw invalidInventoryTurnover()
    assertApiStreamCurrent(response, signal); return report
  } finally { void response.body?.cancel().catch(() => undefined) }
}
