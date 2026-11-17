const NOT_CONFIGURED_CODES = /ai_service_not_configured|ai_source_environment_misconfigured/i

export const AI_SERVICE_NOT_CONFIGURED_TEXT = 'Сервіс аналітики (ШІ) не налаштовано'

function errorText(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return typeof error === 'string' ? error : ''
}

function errorPayloadText(error: unknown): string {
  if (!error || typeof error !== 'object' || !('payload' in error)) {
    return ''
  }

  try {
    return JSON.stringify(error.payload) ?? ''
  } catch {
    return ''
  }
}

/**
 * A 503 the server returns when the AI service (ProductsApi, SolvencyApi, …) has no
 * URL configured. Waiting will not fix it, and its raw text is not for end users.
 */
export function isAiServiceNotConfigured(error: unknown): boolean {
  const status = error && typeof error === 'object' && 'status' in error ? error.status : undefined

  if (status !== undefined && status !== 503) {
    return false
  }

  return NOT_CONFIGURED_CODES.test(errorText(error)) || NOT_CONFIGURED_CODES.test(errorPayloadText(error))
}

// Per browser tab session: once a service said it is not configured, its callers skip further
// requests instead of re-firing them on every list load — also after a page reload (sessionStorage;
// the in-memory set covers private windows or blocked storage).
const STORAGE_KEY = 'gba.console.aiServicesNotConfigured'
const unavailableServices = new Set<string>()

function readStoredServices(): string[] {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

export function markAiServiceUnavailable(service: string): void {
  unavailableServices.add(service)
  try {
    const stored = new Set(readStoredServices())
    stored.add(service)
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...stored]))
  } catch {
    // Storage unavailable: the in-memory set still covers this page load.
  }
}

export function isAiServiceKnownUnavailable(service: string): boolean {
  return unavailableServices.has(service) || readStoredServices().includes(service)
}

export function resetAiServiceAvailabilityForTests(): void {
  unavailableServices.clear()
  try {
    window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
