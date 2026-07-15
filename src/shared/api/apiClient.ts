import { getTimeZoneHeader, toQueryString, type QueryParams } from '../date/dateTime'
import { clearSession, notifyUnauthorized, readSession, saveSession } from '../auth/session'
import type { AuthSession } from '../auth/types'
import { API_BASE_URL, API_LANGUAGE } from '../config/env'
import { translate } from '../i18n/translate'

const DEFAULT_LANGUAGE = 'uk'
const CSRF_HEADER_NAME = 'X-CSRF-Token'

type ApiEnvelope<T> = {
  Body?: T
  Message?: string
  Status?: number
}

type TokenResponse = {
  UserNetUid?: string
  userNetUid?: string
  CsrfToken?: string
  csrfToken?: string
}

type InFlightGetRequest = {
  abortTimer: ReturnType<typeof setTimeout> | null
  controller: AbortController
  promise: Promise<unknown>
  settled: boolean
  subscribers: number
}

export type ApiErrorMessages = Partial<Record<number, string>> & {
  default?: string
  network?: string
}

export type ApiRequestOptions = Omit<RequestInit, 'body' | 'credentials'> & {
  auth?: boolean
  body?: unknown
  errorMessages?: ApiErrorMessages
  query?: QueryParams
  language?: string
}

export class ApiError extends Error {
  readonly headers: Headers
  readonly payload: unknown
  readonly status: number

  constructor(message: string, status: number, payload: unknown, headers?: HeadersInit) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
    this.headers = new Headers(headers)
  }
}

export function getApiLanguage() {
  return API_LANGUAGE || DEFAULT_LANGUAGE
}

export function apiUrl(path: string, language: string, query?: QueryParams) {
  const baseUrl = API_BASE_URL

  if (!baseUrl) {
    throw new Error('VITE_API_BASE_URL is not configured')
  }

  return new URL(`/api/v1/${language}${path}${toQueryString(query)}`, getAbsoluteBaseUrl(baseUrl)).toString()
}

export function unwrapApiResponse<T>(payload: unknown): T {
  if (payload && typeof payload === 'object' && 'Body' in payload) {
    return (payload as { Body: T }).Body
  }

  return payload as T
}

const inFlightGetRequests = new Map<string, InFlightGetRequest>()
const GET_DEDUPE_ABORT_DELAY_MS = 50
/* A GET that never settles (stalled backend/proxy response) would otherwise
   sit in the dedupe map forever: every retry with the same params joins the
   zombie promise and the screen hangs with no error — reload included, since
   the key is identical. Cap shared GETs so the entry aborts with a network
   error, clears from the map, and the next attempt opens a fresh request. */
const GET_DEDUPE_TIMEOUT_MS = 120_000

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  if (shouldDeduplicateGetRequest(options)) {
    return deduplicatedGetRequest<T>(path, options)
  }

  return sendApiRequest<T>(path, options, true)
}

function deduplicatedGetRequest<T>(path: string, options: ApiRequestOptions): Promise<T> {
  const key = getGetRequestKey(path, options)
  const callerSignal = options.signal

  if (callerSignal?.aborted) {
    return Promise.reject(createAbortError())
  }

  let request = inFlightGetRequests.get(key)

  if (request?.controller.signal.aborted) {
    inFlightGetRequests.delete(key)
    request = undefined
  }

  if (!request) {
    request = createInFlightGetRequest<T>(key, path, options)
    inFlightGetRequests.set(key, request)
  } else if (request.abortTimer) {
    clearTimeout(request.abortTimer)
    request.abortTimer = null
  }

  request.subscribers += 1

  return withCallerSignal<T>(request.promise as Promise<T>, callerSignal, () => releaseGetRequest(request))
}

function createInFlightGetRequest<T>(key: string, path: string, options: ApiRequestOptions): InFlightGetRequest {
  const controller = new AbortController()
  const request: InFlightGetRequest = {
    abortTimer: null,
    controller,
    promise: Promise.resolve(null),
    settled: false,
    subscribers: 0,
  }
  const timeoutTimer = setTimeout(() => {
    if (!request.settled && !controller.signal.aborted) {
      /* Abort with a network ApiError as the reason so subscribers see the
         regular "server unavailable" message instead of a raw AbortError. */
      controller.abort(
        new ApiError(
          options.errorMessages?.network || translate('Сервер недоступний. Спробуйте ще раз пізніше.'),
          0,
          null,
        ),
      )
    }
  }, GET_DEDUPE_TIMEOUT_MS)

  request.promise = sendApiRequest<T>(
    path,
    {
      ...options,
      signal: controller.signal,
    },
    true,
  ).finally(() => {
    request.settled = true
    clearTimeout(timeoutTimer)

    if (request.abortTimer) {
      clearTimeout(request.abortTimer)
      request.abortTimer = null
    }

    inFlightGetRequests.delete(key)
  })

  return request
}

function releaseGetRequest(request: InFlightGetRequest) {
  request.subscribers = Math.max(0, request.subscribers - 1)

  if (request.subscribers > 0 || request.settled || request.controller.signal.aborted || request.abortTimer) {
    return
  }

  request.abortTimer = setTimeout(() => {
    request.abortTimer = null

    if (request.subscribers === 0 && !request.settled && !request.controller.signal.aborted) {
      request.controller.abort()
    }
  }, GET_DEDUPE_ABORT_DELAY_MS)
}

async function sendApiRequest<T>(path: string, options: ApiRequestOptions, allowRefresh: boolean): Promise<T> {
  const auth = options.auth !== false
  const { auth: _auth, body, errorMessages, language, query, ...requestOptions } = options
  void _auth

  let response: Response

  try {
    response = await fetch(apiUrl(path, language || getApiLanguage(), query), {
      ...requestOptions,
      credentials: 'include',
      headers: buildHeaders(options),
      body: buildBody(body),
    })
  } catch (requestError) {
    if (isAbortError(requestError)) {
      throw requestError
    }

    throw new ApiError(errorMessages?.network || translate('Сервер недоступний. Спробуйте ще раз пізніше.'), 0, null)
  }

  if (response.status === 401 && auth && allowRefresh) {
    const refreshedSession = await refreshStoredSession()

    if (refreshedSession) {
      return sendApiRequest<T>(path, options, false)
    }
  }

  const payload = await readPayload(response)

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      clearSession()
      notifyUnauthorized()
    }

    throw new ApiError(
      getErrorMessage(payload, response.status, errorMessages),
      response.status,
      payload,
      response.headers,
    )
  }

  return unwrapApiResponse<T>(payload)
}

function shouldDeduplicateGetRequest(options: ApiRequestOptions): boolean {
  const method = (options.method || 'GET').toUpperCase()

  return method === 'GET' && typeof options.body === 'undefined'
}

function getGetRequestKey(path: string, options: ApiRequestOptions): string {
  const authKey = options.auth === false ? 'anon' : 'auth'

  return `${authKey}:${apiUrl(path, options.language || getApiLanguage(), options.query)}`
}

function withCallerSignal<T>(
  promise: Promise<T>,
  signal: AbortSignal | null | undefined,
  release: () => void,
): Promise<T> {
  if (!signal) {
    return promise.finally(release)
  }

  if (signal.aborted) {
    release()
    return Promise.reject(createAbortError())
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false

    const cleanup = () => {
      if (settled) {
        return
      }

      settled = true
      signal.removeEventListener('abort', abort)
      release()
    }

    const abort = () => {
      cleanup()
      reject(createAbortError())
    }

    signal.addEventListener('abort', abort, { once: true })

    promise.then(
      (value) => {
        cleanup()
        resolve(value)
      },
      (error: unknown) => {
        cleanup()
        reject(error)
      },
    )
  })
}

let refreshPromise: Promise<AuthSession | null> | null = null

async function refreshStoredSession(): Promise<AuthSession | null> {
  if (refreshPromise) {
    return refreshPromise
  }

  refreshPromise = refreshStoredSessionCore().finally(() => {
    refreshPromise = null
  })

  return refreshPromise
}

async function refreshStoredSessionCore(): Promise<AuthSession | null> {
  const session = readSession()

  if (!session?.csrfToken) {
    clearSession()
    notifyUnauthorized()
    return null
  }

  const response = await fetch(apiUrl('/usermanagement/token/refresh', getApiLanguage()), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      [CSRF_HEADER_NAME]: session.csrfToken,
      ...getTimeZoneHeader(),
    },
    body: JSON.stringify({}),
  })

  const payload = await readPayload(response)

  if (!response.ok) {
    clearSession()
    notifyUnauthorized()
    return null
  }

  const token = unwrapApiResponse<TokenResponse | null>(payload)
  const nextSession = toAuthSession(token, session)
  saveSession(nextSession)

  return nextSession
}

function toAuthSession(token: TokenResponse | null, previous?: AuthSession): AuthSession {
  return {
    userNetUid: token?.UserNetUid || token?.userNetUid || previous?.userNetUid,
    csrfToken: token?.CsrfToken || token?.csrfToken || previous?.csrfToken,
    user: previous?.user,
  }
}

function buildHeaders(options: ApiRequestOptions): HeadersInit {
  const headers = new Headers(options.headers)
  const session = readSession()
  const isFormData = options.body instanceof FormData

  if (options.body && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  Object.entries(getTimeZoneHeader()).forEach(([key, value]) => headers.set(key, value))

  if (isUnsafeMethod(options.method) && session?.csrfToken) {
    headers.set(CSRF_HEADER_NAME, session.csrfToken)
  }

  return headers
}

function buildBody(body: unknown): BodyInit | undefined {
  if (typeof body === 'undefined') {
    return undefined
  }

  if (body instanceof FormData || body instanceof Blob || typeof body === 'string') {
    return body
  }

  return JSON.stringify(body)
}

async function readPayload(response: Response): Promise<unknown> {
  const text = await response.text()

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function getErrorMessage(payload: unknown, status: number, errorMessages?: ApiErrorMessages): string {
  const configuredMessage = errorMessages?.[status] || (status >= 500 ? errorMessages?.[500] : undefined)

  if (configuredMessage) {
    return configuredMessage
  }

  if (payload && typeof payload === 'object') {
    const envelope = payload as ApiEnvelope<unknown>

    if (typeof envelope.Message === 'string' && envelope.Message) {
      return envelope.Message
    }
  }

  if (status === 401 || status === 403) {
    return translate('Сесію завершено. Увійдіть повторно.')
  }

  return errorMessages?.default || translate('Не вдалося виконати запит')
}

function isUnsafeMethod(method?: string): boolean {
  const normalizedMethod = (method || 'GET').toUpperCase()
  return normalizedMethod === 'POST' || normalizedMethod === 'PUT' || normalizedMethod === 'PATCH' || normalizedMethod === 'DELETE'
}

function isAbortError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'name' in error && error.name === 'AbortError')
}

function createAbortError(): Error {
  if (typeof DOMException !== 'undefined') {
    return new DOMException('The operation was aborted.', 'AbortError')
  }

  const error = new Error('The operation was aborted.')
  error.name = 'AbortError'

  return error
}

function getAbsoluteBaseUrl(baseUrl: string): string {
  if (/^https?:\/\//i.test(baseUrl)) {
    return baseUrl
  }

  if (typeof window !== 'undefined') {
    return new URL(baseUrl, window.location.origin).toString()
  }

  return 'http://localhost/'
}
