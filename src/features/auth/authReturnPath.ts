const AUTH_RETURN_PATH_KEY = 'gba:auth:return-path'
// Who lost the session on that page, and when: the path is honoured only for the same user, and only for a while.
const AUTH_RETURN_OWNER_KEY = 'gba:auth:return-path-owner'
// Set by an explicit «Вийти» in this tab. A page that bounces to /login afterwards (browser Back reloading an older
// entry, a late 401) is not a lost session, so it must not become the landing page of the next login.
const AUTH_SIGNED_OUT_KEY = 'gba:auth:signed-out'
const AUTH_RETURN_PATH_MAX_AGE_MS = 30 * 60 * 1000

export type AuthReturnLocation = {
  hash?: string
  pathname: string
  search?: string
}

type AuthReturnOwner = {
  at: number
  user: string | null
}

export function rememberAuthReturnPath(location: AuthReturnLocation | string, userKey?: string | null): void {
  const path = sanitizeAuthReturnPath(
    typeof location === 'string'
      ? location
      : `${location.pathname}${location.search || ''}${location.hash || ''}`,
  )

  if (!path) {
    return
  }

  try {
    // After «Вийти», browser Back reloads older entries of this tab; they must not become the next landing page.
    // A link typed or opened after signing out is still remembered (that is a real deep link).
    if (window.sessionStorage.getItem(AUTH_SIGNED_OUT_KEY) && isBackForwardDocumentLoad()) {
      return
    }

    const owner: AuthReturnOwner = { at: Date.now(), user: userKey || null }
    window.sessionStorage.setItem(AUTH_RETURN_PATH_KEY, path)
    window.sessionStorage.setItem(AUTH_RETURN_OWNER_KEY, JSON.stringify(owner))
  } catch {
    // Authentication must continue even when browser storage is unavailable.
  }
}

/**
 * The page to open after a login. A remembered path is used only when it was left by the same user (or by an
 * anonymous deep link) within the last 30 minutes; anything else lands on the fallback.
 */
export function consumeAuthReturnPath(fallback = '/dashboard', userKey?: string | null): string {
  try {
    const path = sanitizeAuthReturnPath(window.sessionStorage.getItem(AUTH_RETURN_PATH_KEY))
    const owner = readOwner(window.sessionStorage.getItem(AUTH_RETURN_OWNER_KEY))
    clearStorage()

    if (!path || !owner || Date.now() - owner.at > AUTH_RETURN_PATH_MAX_AGE_MS) {
      return fallback
    }

    if (owner.user && userKey && owner.user.toLowerCase() !== userKey.toLowerCase()) {
      return fallback
    }

    return path
  } catch {
    return fallback
  }
}

export function clearAuthReturnPath(): void {
  try {
    clearStorage()
  } catch {
    // Explicit logout must still complete when browser storage is unavailable.
  }
}

/** Explicit sign-out: forget the return path and stop remembering new ones until the next login. */
export function markExplicitSignOut(): void {
  try {
    clearStorage()
    window.sessionStorage.setItem(AUTH_SIGNED_OUT_KEY, '1')
  } catch {
    // Explicit logout must still complete when browser storage is unavailable.
  }
}

function isBackForwardDocumentLoad(): boolean {
  try {
    const [entry] = window.performance?.getEntriesByType?.('navigation') ?? []

    return (entry as PerformanceNavigationTiming | undefined)?.type === 'back_forward'
  } catch {
    return false
  }
}

function clearStorage(): void {
  window.sessionStorage.removeItem(AUTH_RETURN_PATH_KEY)
  window.sessionStorage.removeItem(AUTH_RETURN_OWNER_KEY)
  window.sessionStorage.removeItem(AUTH_SIGNED_OUT_KEY)
}

function readOwner(value: string | null): AuthReturnOwner | null {
  if (!value) {
    return null
  }

  try {
    const owner = JSON.parse(value) as Partial<AuthReturnOwner>

    return typeof owner?.at === 'number'
      ? { at: owner.at, user: typeof owner.user === 'string' ? owner.user : null }
      : null
  } catch {
    return null
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
