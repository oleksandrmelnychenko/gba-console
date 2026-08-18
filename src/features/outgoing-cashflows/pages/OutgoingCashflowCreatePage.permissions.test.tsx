import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { OutgoingCashflowCreatePage } from './OutgoingCashflowCreatePage'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/components/PermissionGate', () => ({
  PermissionGate: ({
    children,
    fallback = null,
    permissionKey,
  }: {
    children: ReactNode
    fallback?: ReactNode
    permissionKey: string
  }) => allowedPermissions.has(permissionKey) ? children : fallback,
}))

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('../components/OutgoingCreateModeSelector', () => ({
  OutgoingCreateModeSelector: () => <div>create-mode-selector</div>,
}))

vi.mock('../components/OutgoingCashOrderForm', () => ({
  OutgoingCashOrderForm: () => <div>simple-create-form</div>,
}))

vi.mock('../components/OutgoingPaymentGroupForm', () => ({
  OutgoingPaymentGroupForm: () => <div>group-create-form</div>,
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/accounting/outgoing-cashflow/new']}>
      <MantineProvider>
        <I18nProvider>
          <Routes>
            <Route path="/accounting/outgoing-cashflow/new" element={<OutgoingCashflowCreatePage />} />
          </Routes>
        </I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}

describe('outgoing cashflow create page permissions', () => {
  beforeEach(() => {
    allowedPermissions.clear()
  })

  it('requires both page.view and order.create before mounting the create workflow', () => {
    const first = renderPage()
    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(screen.queryByText('create-mode-selector')).toBeNull()

    first.unmount()
    allowedPermissions.add(PermissionKeys.SystemPages.OutgoingCashflows.View)
    const second = renderPage()
    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(screen.queryByText('create-mode-selector')).toBeNull()

    second.unmount()
    allowedPermissions.add(PermissionKeys.OutgoingCashflows.Order.Create)
    renderPage()
    expect(screen.getByText('create-mode-selector')).toBeTruthy()
  })
})
