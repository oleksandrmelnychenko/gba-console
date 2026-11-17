import { MantineProvider } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { OutgoingCashflowCreatePage } from './OutgoingCashflowCreatePage'

vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }))

vi.mock('../../auth/components/PermissionGate', () => ({
  PermissionGate: ({ children }: { children: ReactNode }) => children,
}))

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('../components/OutgoingCreateModeSelector', () => ({
  OutgoingCreateModeSelector: () => <div>create-mode-selector</div>,
}))

vi.mock('../components/OutgoingCashOrderForm', () => ({
  OutgoingCashOrderForm: ({ onCreated }: { onCreated: () => void }) => <button type="button" onClick={onCreated}>create</button>,
}))

vi.mock('../components/OutgoingPaymentGroupForm', () => ({
  OutgoingPaymentGroupForm: () => <div>group-create-form</div>,
}))

describe('outgoing cashflow toasts', () => {
  it('says the order was created instead of repeating the form title', async () => {
    render(
      <MemoryRouter initialEntries={['/accounting/outgoing-cashflow/new/simple?type=0']}>
        <MantineProvider>
          <I18nProvider>
            <Routes>
              <Route path="/accounting/outgoing-cashflow/new/*" element={<OutgoingCashflowCreatePage />} />
              <Route path="/accounting/outgoing-cashflow" element={<div>registry</div>} />
            </Routes>
          </I18nProvider>
        </MantineProvider>
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'create' }))

    await waitFor(() => expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({ color: 'green', message: 'Видатковий ордер створено' })))
    expect(notifications.show).not.toHaveBeenCalledWith(expect.objectContaining({ message: 'Створення нового видаткового ордера' }))
  })
})
