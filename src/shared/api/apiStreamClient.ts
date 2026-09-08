import { ApiError, apiUrl, getApiLanguage } from './apiClient'
import { clearSession, notifyUnauthorized, readSession, saveSession } from '../auth/session'
import type { AuthSession } from '../auth/types'
import { getTimeZoneHeader } from '../date/dateTime'

export interface ApiStreamSession { readonly userNetUid: string; readonly csrfToken?: string }
export interface ApiStreamOptions {
  readonly session: ApiStreamSession
  readonly signal: AbortSignal
  readonly method?: 'GET' | 'POST'
  readonly body?: string
}
const refreshes = new Map<string, { promise: Promise<AuthSession>; signal: AbortSignal }>()
const responseGenerations = new WeakMap<Response, string>()
const generation = (session: Pick<AuthSession, 'userNetUid' | 'csrfToken'> | null) => JSON.stringify([session?.userNetUid ?? null, session?.csrfToken ?? null])
function requireGeneration(expected: string): void {
  if (generation(readSession()) !== expected) throw new DOMException('Authentication changed', 'AbortError')
}
function discard(response: Response): void { void response.body?.cancel().catch(() => undefined) }
export function assertApiStreamCurrent(response: Response, signal: AbortSignal): void {
  signal.throwIfAborted()
  const expected = responseGenerations.get(response)
  if (!expected) throw new DOMException('Unknown response context', 'AbortError')
  requireGeneration(expected)
}
function unauthorized(expected: string, signal: AbortSignal): never {
  signal.throwIfAborted(); requireGeneration(expected)
  clearSession(); notifyUnauthorized()
  throw new ApiError('Сесію завершено. Увійдіть повторно.', 401, null)
}

/** Refresh is non-financial conventional API JSON, capped independently before parsing. */
async function refreshPayload(response: Response, signal: AbortSignal): Promise<unknown> {
  if (!response.body) throw new ApiError('Некоректна відповідь сесії.', 401, null)
  const reader = response.body.getReader(), bytes = new Uint8Array(16_384)
  const abort = () => { void reader.cancel().catch(() => undefined) }
  signal.addEventListener('abort', abort, { once: true })
  let count = 0
  try {
    while (true) {
      signal.throwIfAborted()
      const next = await reader.read()
      signal.throwIfAborted()
      if (next.done) break
      if (next.value.byteLength > bytes.length - count) throw new ApiError('Некоректна відповідь сесії.', 401, null)
      bytes.set(next.value, count); count += next.value.byteLength
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, count))) as unknown
  } finally { signal.removeEventListener('abort', abort); void reader.cancel().catch(() => undefined); reader.releaseLock() }
}

async function refreshSession(captured: ApiStreamSession, language: string, timezone: Record<string, string>, signal: AbortSignal): Promise<AuthSession> {
  const key = generation(captured)
  signal.throwIfAborted(); requireGeneration(key)
  const existing = refreshes.get(key)
  if (existing && !existing.signal.aborted) return existing.promise
  const promise = (async () => {
    if (!captured.csrfToken) unauthorized(key, signal)
    const previous = readSession()!
    const response = await fetch(apiUrl('/usermanagement/token/refresh', language), {
      method: 'POST', credentials: 'include', cache: 'no-store', redirect: 'error', signal,
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': captured.csrfToken!, ...timezone }, body: '{}',
    })
    try { signal.throwIfAborted(); requireGeneration(key) } catch (error) { discard(response); throw error }
    if (!response.ok) { discard(response); unauthorized(key, signal) }
    let payload: unknown
    try { payload = await refreshPayload(response, signal) } catch { signal.throwIfAborted(); unauthorized(key, signal) }
    signal.throwIfAborted(); requireGeneration(key)
    const envelope = payload && typeof payload === 'object' ? payload as Record<string, unknown> : null
    const value = envelope && 'Body' in envelope ? envelope.Body : envelope
    const token = value && typeof value === 'object' ? value as Record<string, unknown> : null
    const owner = token?.UserNetUid ?? token?.userNetUid ?? captured.userNetUid
    const csrf = token?.CsrfToken ?? token?.csrfToken
    if (owner !== captured.userNetUid || typeof csrf !== 'string' || !csrf) unauthorized(key, signal)
    const next = { ...previous, userNetUid: captured.userNetUid, csrfToken: csrf }
    signal.throwIfAborted(); requireGeneration(key)
    saveSession(next)
    return next
  })()
  const entry = { promise, signal }
  refreshes.set(key, entry)
  try { return await promise } finally { if (refreshes.get(key) === entry) refreshes.delete(key) }
}

/** Opt-in uncached response stream. Existing apiRequest/dedupe/refresh behavior is independent. */
export async function apiRequestStream(path: string, options: ApiStreamOptions): Promise<Response> {
  const captured = { userNetUid: options.session.userNetUid, csrfToken: options.session.csrfToken }
  if (!captured.userNetUid) throw new ApiError('Дочекайтеся завантаження користувача.', 401, null)
  const signal = options.signal, method = options.method ?? 'GET', body = options.body
  const language = getApiLanguage(), timezone = { ...getTimeZoneHeader() }, url = apiUrl(path, language)
  let expected = generation(captured), session: ApiStreamSession = captured
  const headers = new Headers({ Accept: 'application/json', ...timezone })
  if (body !== undefined) headers.set('Content-Type', 'application/json')
  for (let attempt = 0; attempt < 2; attempt++) {
    signal.throwIfAborted(); requireGeneration(expected)
    const requestHeaders = new Headers(headers)
    if (method === 'POST' && session.csrfToken) requestHeaders.set('X-CSRF-Token', session.csrfToken)
    let response: Response
    try {
      response = await fetch(url, { method, body, headers: requestHeaders, credentials: 'include', cache: 'no-store', redirect: 'error', signal })
    } catch (error) {
      signal.throwIfAborted(); requireGeneration(expected)
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      throw new ApiError('Сервер недоступний. Спробуйте ще раз пізніше.', 0, null)
    }
    try { signal.throwIfAborted(); requireGeneration(expected) } catch (error) { discard(response); throw error }
    if (response.status === 401 && attempt === 0) {
      discard(response)
      const refreshed = await refreshSession(session, language, timezone, signal)
      signal.throwIfAborted()
      session = { userNetUid: captured.userNetUid, csrfToken: refreshed.csrfToken }
      expected = generation(session)
      requireGeneration(expected)
      continue
    }
    if (!response.ok) {
      discard(response)
      if (response.status === 401) unauthorized(expected, signal)
      throw new ApiError('Не вдалося завантажити дані звіту.', response.status, null, response.headers)
    }
    responseGenerations.set(response, expected)
    return response
  }
  throw new ApiError('Сесію завершено. Увійдіть повторно.', 401, null)
}
