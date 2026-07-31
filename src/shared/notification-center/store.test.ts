import { beforeEach, describe, expect, it } from 'vitest'
import {
  addConsoleNotification,
  clearConsoleNotifications,
  getConsoleNotificationState,
  markAllConsoleNotificationsRead,
  markConsoleNotificationRead,
  resetConsoleNotificationStoreForTests,
} from './store'
import type { ConsoleNotification } from './types'

const notification: ConsoleNotification = {
  createdAt: '2026-07-31T08:15:00.000Z',
  id: 'ecommerce-order:sale-1',
  kind: 'ecommerce-order',
  message: 'Ін00001234 · Shop Client',
  route: '/sales-online-shop',
  title: 'Нове замовлення з інтернет-магазину',
}

describe('console notification store', () => {
  beforeEach(() => {
    localStorage.clear()
    resetConsoleNotificationStoreForTests()
  })

  it('deduplicates events and isolates them by authenticated user', () => {
    expect(addConsoleNotification('user-a', notification)).toBe(true)
    expect(addConsoleNotification('user-a', notification)).toBe(false)
    expect(addConsoleNotification('user-b', { ...notification, id: 'sale-for-b' })).toBe(true)

    expect(getConsoleNotificationState('user-a').items.map((item) => item.id)).toEqual([
      'ecommerce-order:sale-1',
    ])
    expect(getConsoleNotificationState('user-b').items.map((item) => item.id)).toEqual([
      'sale-for-b',
    ])
  })

  it('persists notifications and read state across store reloads', () => {
    addConsoleNotification('user-a', notification)
    markConsoleNotificationRead('user-a', notification.id)
    resetConsoleNotificationStoreForTests()

    expect(getConsoleNotificationState('user-a').items[0]).toMatchObject({
      id: notification.id,
      readAt: expect.any(String),
    })
  })

  it('marks all notifications as read and can clear the journal', () => {
    addConsoleNotification('user-a', notification)
    addConsoleNotification('user-a', { ...notification, id: 'ecommerce-order:sale-2' })

    markAllConsoleNotificationsRead('user-a')
    expect(getConsoleNotificationState('user-a').items.every((item) => Boolean(item.readAt))).toBe(true)

    clearConsoleNotifications('user-a')
    expect(getConsoleNotificationState('user-a').items).toEqual([])
  })
})
