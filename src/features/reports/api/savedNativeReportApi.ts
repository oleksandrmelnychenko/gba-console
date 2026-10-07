import { ApiError, unwrapApiResponse } from '../../../shared/api/apiClient'
import { apiRequestStream, assertApiStreamCurrent, type ApiStreamSession } from '../../../shared/api/apiStreamClient'
import { normalizeNativeReportPreview, type NativeReportPreview } from '../data/nativeReportPreview'
import { savedNativeReportSources } from '../data/savedNativeReport'
import type { ReportResult } from '../types'
import { normalizeReportResult } from '../utils'

export type SavedNativeReportTarget = {
  id: string
  revision: number
  dataSource: number
  expectedDefinitionSha256?: string
}
export type SavedNativeReportBinding = { id: string; revision: number; definitionSha256: string }
export type SavedNativeReportResult = { result: ReportResult; binding: SavedNativeReportBinding; preview?: NativeReportPreview }
export type SavedNativeReportContext = { session: ApiStreamSession; signal: AbortSignal }

const guid = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i
const sha256 = /^[a-f\d]{64}$/i
const maximumResponseBytes = 16 * 1024 * 1024
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const invalidBinding = () => new Error('Сервер повернув результат іншого збереженого варіанта. Оновіть список шаблонів.')

function targetPath(target: SavedNativeReportTarget, action: 'preview' | 'generate'): string {
  if (!guid.test(target.id) || /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(target.id)
    || !Number.isSafeInteger(target.revision) || target.revision < 1 || target.revision > 2147483647
    || !Object.hasOwn(savedNativeReportSources, target.dataSource)
    || (target.expectedDefinitionSha256 !== undefined && !sha256.test(target.expectedDefinitionSha256)))
    throw new Error('Некоректний збережений варіант звіту.')
  return `/report/templates/${target.id}/revisions/${target.revision}/${action}`
}

async function readPayload(response: Response, signal: AbortSignal): Promise<unknown> {
  if (!response.body || response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json')
    throw new Error('Сервер повернув непідтримуваний формат звіту.')
  const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true })
  const abort = () => { void reader.cancel().catch(() => undefined) }
  signal.addEventListener('abort', abort, { once: true })
  let byteCount = 0, text = ''
  try {
    while (true) {
      assertApiStreamCurrent(response, signal)
      const next = await reader.read()
      assertApiStreamCurrent(response, signal)
      if (next.done) break
      byteCount += next.value.byteLength
      if (byteCount > maximumResponseBytes) throw new Error('Сервер перевищив допустимий розмір перегляду звіту.')
      text += decoder.decode(next.value, { stream: true })
    }
    text += decoder.decode()
    return unwrapApiResponse<unknown>(JSON.parse(text))
  } finally {
    signal.removeEventListener('abort', abort)
    void reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}

function binding(response: Response, target: SavedNativeReportTarget): SavedNativeReportBinding {
  const id = response.headers.get('Gba-Report-Template-Id')
  const revision = response.headers.get('Gba-Report-Template-Revision')
  const definitionSha256 = response.headers.get('Gba-Report-Definition-Sha256')
  if (id?.toLowerCase() !== target.id.toLowerCase() || revision !== String(target.revision)
    || !definitionSha256 || !sha256.test(definitionSha256)
    || (target.expectedDefinitionSha256 !== undefined && definitionSha256.toLowerCase() !== target.expectedDefinitionSha256.toLowerCase()))
    throw invalidBinding()
  return { id: target.id, revision: target.revision, definitionSha256: definitionSha256.toLowerCase() }
}

async function run(target: SavedNativeReportTarget, context: SavedNativeReportContext, action: 'preview' | 'generate'): Promise<SavedNativeReportResult> {
  const captured = { ...target }, path = targetPath(captured, action)
  // Route identities are the command. Never send the editor's ReportsModel or a replacement body.
  const response = await apiRequestStream(action === 'preview' ? `${path}?rowOffset=0&rowLimit=50` : path,
    { ...context, method: 'POST' })
  try {
    const actual = binding(response, captured)
    const payload = await readPayload(response, context.signal)
    assertApiStreamCurrent(response, context.signal)
    if (!record(payload) || typeof payload.DocumentURL !== 'string' || typeof payload.PdfDocumentURL !== 'string')
      throw new Error('Сервер повернув некоректні файли збереженого звіту.')
    if (action === 'generate') return { result: normalizeReportResult(payload), binding: actual }
    if (!record(payload.Preview) || typeof payload.Preview.RequestSha256 !== 'string'
      || payload.Preview.RequestSha256.toLowerCase() !== actual.definitionSha256
      || response.headers.get('Gba-Report-Request-Sha256')?.toLowerCase() !== actual.definitionSha256)
      throw invalidBinding()
    const preview = normalizeNativeReportPreview(payload)
    if (preview.Page.Offset !== 0 || preview.Page.Limit !== 50
      || response.headers.get('Gba-Report-Result-Sha256')?.toLowerCase() !== preview.ResultSha256.toLowerCase()
      || preview.Request?.DataSource !== savedNativeReportSources[captured.dataSource]
      || (captured.dataSource === 39 && !preview.CurrentVparivanieProducts))
      throw invalidBinding()
    return { result: normalizeReportResult(payload), binding: actual, preview }
  } finally {
    void response.body?.cancel().catch(() => undefined)
  }
}

export const previewSavedNativeReport = (target: SavedNativeReportTarget, context: SavedNativeReportContext) => run(target, context, 'preview')
export const generateSavedNativeReport = (target: SavedNativeReportTarget, context: SavedNativeReportContext) => run(target, context, 'generate')

export function savedNativeReportError(cause: unknown): string {
  if (cause instanceof ApiError && cause.status === 409)
    return 'Сервер не може сформувати цей збережений варіант. Оновіть список шаблонів і перевірте доступність даних.'
  return cause instanceof Error ? cause.message : 'Не вдалося сформувати збережений звіт.'
}
