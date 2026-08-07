import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  addConsoleNotification,
  getConsoleNotificationState,
  resetConsoleNotificationStoreForTests,
} from '../../../shared/notification-center/store'
import { NotificationCenter } from './NotificationCenter'

function CurrentRoute() {
  return <span data-testid="current-route">{useLocation().pathname}</span>
}

describe('NotificationCenter', () => {
  beforeEach(() => {
    localStorage.clear()
    resetConsoleNotificationStoreForTests()
    addConsoleNotification('user-a', {
      createdAt: '2026-07-31T08:15:00.000Z',
      id: 'ecommerce-order:sale-1',
      kind: 'ecommerce-order',
      message: 'Ін00001234 · Shop Client · 9 090,00 UAH · 3 поз.',
      route: '/sales-online-shop',
      title: 'Нове замовлення з інтернет-магазину',
    })
  })

  it('shows unread ecommerce orders and opens the target screen', async () => {
    render(
      <MantineProvider>
        <I18nProvider>
          <MemoryRouter initialEntries={['/dashboard']}>
            <NotificationCenter userKey="user-a" />
            <CurrentRoute />
          </MemoryRouter>
        </I18nProvider>
      </MantineProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: /Сповіщення: 1 непрочитаних/ }))
    const notificationTitle = await screen.findByText('Нове замовлення з інтернет-магазину')
    expect(screen.getByText((_, element) => (
      element?.classList.contains('console-notification-message') === true
      && element.textContent?.includes('Ін00001234 · Shop Client · 9 090,00 UAH · 3 поз.') === true
    ))).not.toBeNull()
    expect(screen.getByText('Ін00001234').classList.contains('console-notification-order-number-tag')).toBe(true)
    expect(screen.getByText('Shop Client').classList.contains('console-notification-message-strong')).toBe(true)
    expect(screen.getByText('3 поз.').classList.contains('console-notification-message-strong')).toBe(true)
    expect(document.querySelector('.console-notification-time')?.textContent).toMatch(/^\d{2}\.\d{2}\s\d{2}:\d{2}$/)

    fireEvent.click(notificationTitle)

    expect(screen.getByTestId('current-route').textContent).toBe('/sales-online-shop')
    expect(getConsoleNotificationState('user-a').items[0].readAt).toEqual(expect.any(String))
  })
})
