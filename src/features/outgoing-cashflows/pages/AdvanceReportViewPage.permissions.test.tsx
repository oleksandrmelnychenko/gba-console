import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  getAdvanceReportOrder,
  updateAdvanceReportOrder,
} from '../api/advanceReportApi'
import { AdvanceReportViewPage } from './AdvanceReportViewPage'

const allowedPermissions = new Set<string>()

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}))

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

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: (permission: string) => allowedPermissions.has(permission),
  }),
}))

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, footer, title }: { children: ReactNode; footer?: ReactNode; title: ReactNode }) => (
    <div>
      <div>{title}</div>
      {children}
      {footer}
    </div>
  ),
}))

vi.mock('../../../shared/ui/AppModal', () => ({
  AppModal: ({ children, opened }: { children: ReactNode; opened: boolean }) => opened ? <div>{children}</div> : null,
  AppModalFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('../api/advanceReportApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/advanceReportApi')>(),
  getAdvanceReportOrder: vi.fn(),
  updateAdvanceReportOrder: vi.fn(),
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/accounting/outgoing-cashflow/order-1/advanced-report/view']}>
      <MantineProvider>
        <I18nProvider>
          <Routes>
            <Route path="/accounting/outgoing-cashflow/:id/advanced-report/view" element={<AdvanceReportViewPage />} />
            <Route path="/accounting/outgoing-cashflow" element={<div>outgoing-list</div>} />
          </Routes>
        </I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}

describe('advance report view permissions', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getAdvanceReportOrder).mockResolvedValue({
      AdvanceNumber: 'AR-1',
      Amount: 100,
      CompanyCarFuelings: [{ Id: 1, NetUid: 'fuel-1', TotalPriceWithVat: 100 }],
      NetUid: 'order-1',
    })
    vi.mocked(updateAdvanceReportOrder).mockResolvedValue({ NetUid: 'order-1' })
  })

  it('does not load report details without report.open', async () => {
    renderPage()

    expect(await screen.findByText('У вашої ролі немає права переглядати авансовий звіт.')).toBeTruthy()
    expect(getAdvanceReportOrder).not.toHaveBeenCalled()
  })

  it('renders report.open access as read-only without report.edit', async () => {
    allowedPermissions.add(PermissionKeys.AdvancedReports.Report.Open)
    renderPage()

    await waitFor(() => expect(getAdvanceReportOrder).toHaveBeenCalledWith('order-1'))
    expect(screen.queryByRole('button', { name: 'Зберегти' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Додати товар / послугу' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Додати пальне' })).toBeNull()
  })

  it('rechecks report.edit before a late save', async () => {
    allowedPermissions.add(PermissionKeys.AdvancedReports.Report.Open)
    allowedPermissions.add(PermissionKeys.AdvancedReports.Report.Edit)
    renderPage()

    const save = await screen.findByRole('button', { name: 'Зберегти' })
    allowedPermissions.delete(PermissionKeys.AdvancedReports.Report.Edit)
    fireEvent.click(save)
    expect(updateAdvanceReportOrder).not.toHaveBeenCalled()

    allowedPermissions.add(PermissionKeys.AdvancedReports.Report.Edit)
    fireEvent.click(save)
    await waitFor(() => expect(updateAdvanceReportOrder).toHaveBeenCalled())
  })
})
