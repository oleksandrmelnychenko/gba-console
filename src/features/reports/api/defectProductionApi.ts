import { ApiError, unwrapApiResponse } from '../../../shared/api/apiClient'
import { apiRequestStream, assertApiStreamCurrent } from '../../../shared/api/apiStreamClient'
import { readSession } from '../../../shared/auth/session'
import { createDefectProductionRequest, invalidDefectProduction, isDefectProductionCapabilities, normalizeDefectProductionReport,
  DEFECT_PRODUCTION_ROUTE, type DefectProductionCapabilities, type DefectProductionReport } from '../data/defectProduction'

const maximumBytes = 1024 * 1024 // Four bounded exact fractions plus the scalar publication proof.
async function readPayload(response: Response, signal: AbortSignal): Promise<unknown> {
  if (!response.body || response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw invalidDefectProduction()
  const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true })
  const abort = () => { void reader.cancel().catch(() => undefined) }
  signal.addEventListener('abort', abort, { once: true })
  let text = '', bytes = 0
  try {
    while (true) {
      assertApiStreamCurrent(response, signal); const next = await reader.read(); assertApiStreamCurrent(response, signal)
      if (next.done) break
      bytes += next.value.byteLength; if (bytes > maximumBytes) throw invalidDefectProduction()
      text += decoder.decode(next.value, { stream: true })
    }
    text += decoder.decode(); const value = unwrapApiResponse<unknown>(JSON.parse(text)); assertApiStreamCurrent(response, signal); return value
  } catch {
    assertApiStreamCurrent(response, signal)
    throw invalidDefectProduction()
  } finally { signal.removeEventListener('abort', abort); void reader.cancel().catch(() => undefined); reader.releaseLock() }
}
async function request(path: string, callerKey: string, signal: AbortSignal, body?: string) {
  signal.throwIfAborted()
  const session = readSession()
  if (!callerKey || session?.userNetUid !== callerKey) throw new ApiError('Дочекайтеся завантаження користувача.', 401, null)
  return apiRequestStream(path, { session: { userNetUid: session.userNetUid, csrfToken: session.csrfToken }, signal,
    method: body === undefined ? 'GET' : 'POST', body })
}
export async function getDefectProductionCapabilities(callerKey: string, signal: AbortSignal): Promise<DefectProductionCapabilities> {
  const response = await request(`${DEFECT_PRODUCTION_ROUTE}/capabilities`, callerKey, signal)
  try { const value = await readPayload(response, signal); if (!isDefectProductionCapabilities(value)) throw invalidDefectProduction(); return value }
  finally { void response.body?.cancel().catch(() => undefined) }
}
/** One preview produces inline values and caller-bound files; ambiguous outcomes are never retried here. */
export async function previewDefectProduction(capability: DefectProductionCapabilities, month: string,
  callerKey: string, signal: AbortSignal): Promise<DefectProductionReport> {
  const command = createDefectProductionRequest(capability, month)
  const response = await request(`${DEFECT_PRODUCTION_ROUTE}/preview`, callerKey, signal, JSON.stringify(command))
  try {
    const report = normalizeDefectProductionReport(await readPayload(response, signal), command)
    if (response.headers.get('Gba-Report-Request-Sha256') !== report.RequestSha256
      || response.headers.get('Gba-Report-Result-Sha256') !== report.ResultSha256) throw invalidDefectProduction()
    assertApiStreamCurrent(response, signal); return report
  } finally { void response.body?.cancel().catch(() => undefined) }
}
