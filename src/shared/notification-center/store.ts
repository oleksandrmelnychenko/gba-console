import { useCallback, useMemo, useSyncExternalStore } from 'react'
import type { ConsoleNotification, ConsoleNotificationState } from './types'

const STORAGE_PREFIX = 'gba-console:notification-center:v1:'
const MAX_NOTIFICATION_COUNT = 100
const EMPTY_STATE: ConsoleNotificationState = { items: [] }

const states = new Map<string, ConsoleNotificationState>()
const listeners = new Map<string, Set<() => void>>()
let storageBridgeAttached = false

function normalizeUserKey(userKey: string | undefined): string {
  return userKey?.trim().toLowerCase() || 'authenticated-user'
}

function storageKey(userKey: string): string {
  return `${STORAGE_PREFIX}${userKey}`
}

function readState(userKey: string): ConsoleNotificationState {
  const cached = states.get(userKey)
  if (cached) {
    return cached
  }

  const state = readStoredState(userKey)
  states.set(userKey, state)
  return state
}

function readStoredState(userKey: string): ConsoleNotificationState {
  if (typeof window === 'undefined') {
    return EMPTY_STATE
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey(userKey))
    if (!rawValue) {
      return { items: [] }
    }

    const parsed = JSON.parse(rawValue) as Partial<ConsoleNotificationState>
    if (!Array.isArray(parsed.items)) {
      return { items: [] }
    }

    const items = parsed.items
      .filter(isConsoleNotification)
      .slice(0, MAX_NOTIFICATION_COUNT)

    return { items }
  } catch {
    return { items: [] }
  }
}

function isConsoleNotification(value: unknown): value is ConsoleNotification {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<ConsoleNotification>
  return typeof candidate.id === 'string'
    && typeof candidate.kind === 'string'
    && typeof candidate.createdAt === 'string'
    && typeof candidate.title === 'string'
    && typeof candidate.message === 'string'
}

function writeState(userKey: string, state: ConsoleNotificationState): void {
  states.set(userKey, state)

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(storageKey(userKey), JSON.stringify(state))
    } catch {
      // Notifications remain available in memory when browser storage is unavailable.
    }
  }

  listeners.get(userKey)?.forEach((listener) => listener())
}

function attachStorageBridge(): void {
  if (storageBridgeAttached || typeof window === 'undefined') {
    return
  }

  storageBridgeAttached = true
  window.addEventListener('storage', (event) => {
    if (!event.key?.startsWith(STORAGE_PREFIX)) {
      return
    }

    const userKey = event.key.slice(STORAGE_PREFIX.length)
    states.delete(userKey)
    readState(userKey)
    listeners.get(userKey)?.forEach((listener) => listener())
  })
}

export function addConsoleNotification(
  userKeyValue: string | undefined,
  notification: ConsoleNotification,
): boolean {
  const userKey = normalizeUserKey(userKeyValue)
  const current = readState(userKey)

  if (current.items.some((item) => item.id === notification.id)) {
    return false
  }

  writeState(userKey, {
    items: [notification, ...current.items].slice(0, MAX_NOTIFICATION_COUNT),
  })
  return true
}

export function markConsoleNotificationRead(
  userKeyValue: string | undefined,
  notificationId: string,
): void {
  const userKey = normalizeUserKey(userKeyValue)
  const current = readState(userKey)
  const readAt = new Date().toISOString()
  let changed = false
  const items = current.items.map((item) => {
    if (item.id !== notificationId || item.readAt) {
      return item
    }

    changed = true
    return { ...item, readAt }
  })

  if (changed) {
    writeState(userKey, { items })
  }
}

export function markAllConsoleNotificationsRead(userKeyValue: string | undefined): void {
  const userKey = normalizeUserKey(userKeyValue)
  const current = readState(userKey)
  if (!current.items.some((item) => !item.readAt)) {
    return
  }

  const readAt = new Date().toISOString()
  writeState(userKey, {
    items: current.items.map((item) => item.readAt ? item : { ...item, readAt }),
  })
}

export function clearConsoleNotifications(userKeyValue: string | undefined): void {
  writeState(normalizeUserKey(userKeyValue), { items: [] })
}

export function subscribeConsoleNotifications(
  userKeyValue: string | undefined,
  listener: () => void,
): () => void {
  const userKey = normalizeUserKey(userKeyValue)
  attachStorageBridge()
  const userListeners = listeners.get(userKey) ?? new Set<() => void>()
  userListeners.add(listener)
  listeners.set(userKey, userListeners)

  return () => {
    userListeners.delete(listener)
    if (userListeners.size === 0) {
      listeners.delete(userKey)
    }
  }
}

export function getConsoleNotificationState(userKeyValue: string | undefined): ConsoleNotificationState {
  return readState(normalizeUserKey(userKeyValue))
}

export function useConsoleNotificationCenter(userKeyValue: string | undefined) {
  const userKey = normalizeUserKey(userKeyValue)
  const subscribe = useCallback(
    (listener: () => void) => subscribeConsoleNotifications(userKey, listener),
    [userKey],
  )
  const getSnapshot = useCallback(() => getConsoleNotificationState(userKey), [userKey])
  const state = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_STATE)
  const unreadCount = useMemo(
    () => state.items.reduce((count, item) => count + (item.readAt ? 0 : 1), 0),
    [state.items],
  )

  return {
    clear: () => clearConsoleNotifications(userKey),
    items: state.items,
    markAllRead: () => markAllConsoleNotificationsRead(userKey),
    markRead: (notificationId: string) => markConsoleNotificationRead(userKey, notificationId),
    unreadCount,
  }
}

export function resetConsoleNotificationStoreForTests(): void {
  states.clear()
  listeners.clear()
}
