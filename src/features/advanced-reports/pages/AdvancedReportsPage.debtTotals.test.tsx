import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  getAdvancedReportCurrencies,
  getAdvancedReportPaymentMovements,
  getAdvancedReports,
  searchAdvancedReportPaymentRegisters,
} from '../api/advancedReportsApi'
import { AdvancedReportsPage } from './AdvancedReportsPage'

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

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: (permission: string) => allowedPermissions.has(permission),
  }),
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({ footer }: { footer?: ReactNode }) => <div>{footer}</div>,
}))

vi.mock('../api/advancedReportsApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/advancedReportsApi')>(),
  getAdvancedReportCurrencies: vi.fn(),
  getAdvancedReportPaymentMovements: vi.fn(),
  getAdvancedReports: vi.fn(),
  searchAdvancedReportPaymentRegisters: vi.fn(),
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/accounting/advanced-reports']}>
      <MantineProvider env="test">
        <I18nProvider>
          <Routes>
            <Route path="/accounting/advanced-reports" element={<AdvancedReportsPage />} />
            <Route path="/accounting/outgoing-cashflow/:id/advanced-report/view" element={<div>report-target</div>} />
          </Routes>
        </I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}

describe('advanced reports debt totals', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    allowedPermissions.add(PermissionKeys.SystemPages.AdvancedReports.View)
    vi.clearAllMocks()
    vi.mocked(getAdvancedReportCurrencies).mockResolvedValue([
      { Code: 'EUR', Name: 'Євро', NetUid: 'eur' },
      { Code: 'UAH', Name: 'Гривня', NetUid: 'uah' },
    ])
    vi.mocked(getAdvancedReportPaymentMovements).mockResolvedValue([])
    vi.mocked(searchAdvancedReportPaymentRegisters).mockResolvedValue([])
    vi.mocked(getAdvancedReports).mockResolvedValue({ Collection: [], NegativeDifferenceAmount: 25, PositiveDifferenceAmount: 100 })
  })

  it('does not add debts in different currencies until one currency is filtered', async () => {
    renderPage()

    expect(await screen.findByText('Оберіть валюту, щоб побачити кредиторську та дебіторську заборгованість')).toBeTruthy()
    expect(screen.queryByText(/Кредиторська заборгованість/)).toBeNull()
    expect(screen.queryByText(/Дебіторська заборгованість/)).toBeNull()

    fireEvent.click(await screen.findByRole('combobox', { name: 'Валюта' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Євро' }))

    await waitFor(() => expect(getAdvancedReports).toHaveBeenLastCalledWith(expect.objectContaining({ currencyNetId: 'eur' })))
    expect((await screen.findByText(/Кредиторська заборгованість/)).textContent).toMatch(/EUR/)
    expect(screen.getByText(/Дебіторська заборгованість/).textContent).toMatch(/EUR/)
  })
})
