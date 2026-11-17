import type { AuthSession } from './types'

export const AUTH_SESSION_CHANGED_EVENT = 'gba-console-auth-session-changed'
export const AUTH_UNAUTHORIZED_EVENT = 'gba-console-auth-unauthorized'

const STORAGE_KEY = 'gba_console_session'

export function readSession(): AuthSession | null {
  const raw = localStorage.getItem(STORAGE_KEY)

  if (!raw) {
    return null
  }

  try {
    const session = JSON.parse(raw) as AuthSession
    return session?.csrfToken || session?.userNetUid || session?.user ? session : null
  } catch {
    clearSession()
    return null
  }
}

export function saveSession(session: AuthSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  dispatchSessionChanged()
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY)
  dispatchSessionChanged()
}

/** True when a cross-tab `storage` event may have changed the stored session (null key = storage cleared). */
export function isSessionStorageEvent(event: Pick<StorageEvent, 'key'>): boolean {
  return event.key === null || event.key === STORAGE_KEY
}

export function notifyUnauthorized(): void {
  window.dispatchEvent(new CustomEvent(AUTH_UNAUTHORIZED_EVENT))
}

function dispatchSessionChanged(): void {
  window.dispatchEvent(new CustomEvent(AUTH_SESSION_CHANGED_EVENT))
}
