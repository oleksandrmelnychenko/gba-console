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
  status: number
  payload: unknown

  constructor(message: string, status: number, payload: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
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

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  return sendApiRequest<T>(path, options, true)
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

    throw new ApiError(getErrorMessage(payload, response.status, errorMessages), response.status, payload)
  }

  return unwrapApiResponse<T>(payload)
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
  return error instanceof DOMException && error.name === 'AbortError'
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
