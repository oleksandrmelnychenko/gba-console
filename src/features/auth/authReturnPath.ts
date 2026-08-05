const AUTH_RETURN_PATH_KEY = 'gba:auth:return-path'

export type AuthReturnLocation = {
  hash?: string
  pathname: string
  search?: string
}

export function rememberAuthReturnPath(location: AuthReturnLocation | string): void {
  const path = sanitizeAuthReturnPath(
    typeof location === 'string'
      ? location
      : `${location.pathname}${location.search || ''}${location.hash || ''}`,
  )

  if (!path) {
    return
  }

  try {
    window.sessionStorage.setItem(AUTH_RETURN_PATH_KEY, path)
  } catch {
    // Authentication must continue even when browser storage is unavailable.
  }
}

export function consumeAuthReturnPath(fallback = '/dashboard'): string {
  try {
    const path = sanitizeAuthReturnPath(window.sessionStorage.getItem(AUTH_RETURN_PATH_KEY))
    window.sessionStorage.removeItem(AUTH_RETURN_PATH_KEY)

    return path || fallback
  } catch {
    return fallback
  }
}

export function clearAuthReturnPath(): void {
  try {
    window.sessionStorage.removeItem(AUTH_RETURN_PATH_KEY)
  } catch {
    // Explicit logout must still complete when browser storage is unavailable.
  }
}

export function sanitizeAuthReturnPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return null
  }

  try {
    const url = new URL(value, window.location.origin)

    if (url.origin !== window.location.origin || url.pathname === '/login') {
      return null
    }

    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}
