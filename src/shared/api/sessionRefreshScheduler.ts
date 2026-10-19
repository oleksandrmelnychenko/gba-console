import { AUTH_SESSION_CHANGED_EVENT, readSession } from '../auth/session'
import { refreshAuthSession } from './apiClient'

const SESSION_STORAGE_KEY = 'gba_console_session'
const REFRESH_LEAD_MS = 120_000
const MINIMUM_DELAY_MS = 1_000
const RETRY_DELAY_MS = 30_000

export function nextRefreshDelay(expiresAt: string, now = Date.now()): number | null {
  const expiresAtMs = Date.parse(expiresAt)

  if (!Number.isFinite(expiresAtMs)) {
    return null
  }

  const remaining = expiresAtMs - now
  const lead = Math.min(REFRESH_LEAD_MS, Math.max(0, remaining) / 4)

  return Math.max(MINIMUM_DELAY_MS, remaining - lead)
}

export function startSessionRefreshScheduler(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  let stopped = false
  let running = false

  const clear = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  const schedule = (delayOverride?: number) => {
    clear()

    const session = readSession()
    const expiresAt = session?.accessTokenExpiresAt

    if (stopped || running || !session?.csrfToken || !expiresAt) {
      return
    }

    const delay = delayOverride ?? nextRefreshDelay(expiresAt)

    if (delay === null) {
      return
    }

    timer = setTimeout(() => {
      void run(expiresAt)
    }, delay)
  }

  const run = async (observedExpiresAt: string) => {
    timer = null
    running = true

    try {
      await refreshAuthSession(observedExpiresAt)
      running = false
      schedule()
    } catch {
      running = false
      schedule(RETRY_DELAY_MS)
    }
  }

  const onSessionChanged = () => schedule()
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === SESSION_STORAGE_KEY) {
      schedule()
    }
  }
  const onVisible = () => {
    if (document.visibilityState === 'visible') {
      schedule()
    }
  }

  window.addEventListener(AUTH_SESSION_CHANGED_EVENT, onSessionChanged)
  window.addEventListener('storage', onStorage)
  window.addEventListener('online', onSessionChanged)
  document.addEventListener('visibilitychange', onVisible)
  schedule()

  return () => {
    stopped = true
    clear()
    window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, onSessionChanged)
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('online', onSessionChanged)
    document.removeEventListener('visibilitychange', onVisible)
  }
}
