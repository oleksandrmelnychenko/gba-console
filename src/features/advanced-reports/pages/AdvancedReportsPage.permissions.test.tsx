import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { AdvancedReportRow } from '../types'
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
  DataTable: ({
    data,
    onRowClick,
  }: {
    data: AdvancedReportRow[]
    onRowClick: (row: AdvancedReportRow) => void
  }) => (
    <div>
      {data.map((row) => (
        <button key={row.id} type="button" onClick={() => onRowClick(row)}>
          {`advanced-report-row-${row.id}`}
        </button>
      ))}
    </div>
  ),
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
      <MantineProvider>
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

describe('advanced reports permissions', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getAdvancedReportCurrencies).mockResolvedValue([])
    vi.mocked(getAdvancedReportPaymentMovements).mockResolvedValue([])
    vi.mocked(searchAdvancedReportPaymentRegisters).mockResolvedValue([])
    vi.mocked(getAdvancedReports).mockResolvedValue({
      Collection: [{ AdvanceNumber: 'AR-1', IsUnderReport: true, NetUid: 'order-1' }],
      NegativeDifferenceAmount: 0,
      PositiveDifferenceAmount: 0,
    })
  })

  it('does not mount the registry model without page access', async () => {
    renderPage()

    expect(await screen.findByText('У вашої ролі немає права переглядати авансові звіти.')).toBeTruthy()
    expect(getAdvancedReports).not.toHaveBeenCalled()
    expect(getAdvancedReportCurrencies).not.toHaveBeenCalled()
  })

  it('requires report.open before navigating from an under-report row', async () => {
    allowedPermissions.add(PermissionKeys.SystemPages.AdvancedReports.View)
    renderPage()

    const row = await screen.findByRole('button', { name: 'advanced-report-row-order-1' })
    fireEvent.click(row)
    expect(screen.queryByText('report-target')).toBeNull()

    allowedPermissions.add(PermissionKeys.AdvancedReports.Report.Open)
    fireEvent.click(row)
    expect(await screen.findByText('report-target')).toBeTruthy()
  })
})
