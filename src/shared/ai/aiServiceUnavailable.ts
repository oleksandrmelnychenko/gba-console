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

// Per browser session (until reload): once a service said it is not configured, its
// callers skip further requests instead of re-firing them on every list load.
const unavailableServices = new Set<string>()

export function markAiServiceUnavailable(service: string): void {
  unavailableServices.add(service)
}

export function isAiServiceKnownUnavailable(service: string): boolean {
  return unavailableServices.has(service)
}

export function resetAiServiceAvailabilityForTests(): void {
  unavailableServices.clear()
}
