import { describe, expect, it } from 'vitest'
import { formatIsoDatesInText, isSupplyToastQuietRoute } from './notificationText'

describe('realtime toast text', () => {
  it('shows server dates as dd.MM.yyyy, never the raw ISO value', () => {
    expect(formatIsoDatesInText('2026-11-16T00:00:00')).toBe('16.11.2026')
    expect(formatIsoDatesInText('Оплатити до 2026-11-16T14:30:00.000Z')).toBe('Оплатити до 16.11.2026 14:30')
    expect(formatIsoDatesInText('2026-11-16')).toBe('16.11.2026')
    expect(formatIsoDatesInText('Сума 10,00')).toBe('Сума 10,00')
  })

  it('keeps supply toasts off admin pages only', () => {
    for (const path of ['/users', '/users/new', '/users/roles', '/online-shop-seo/contacts', '/online-shop-cities', '/administration/vehicle-registry']) {
      expect(isSupplyToastQuietRoute(path)).toBe(true)
    }
    for (const path of ['/dashboard', '/orders/ukraine/all', '/accounting/payment-tasks', '/users-report']) {
      expect(isSupplyToastQuietRoute(path)).toBe(false)
    }
  })
})
