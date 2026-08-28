import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import {
  calculateAdvanceReportDocumentStructure,
} from '../api/advanceReportApi'
import {
  cancelOutgoingCashflow,
  getOutgoingCashflowCurrencies,
  getOutgoingCashflowOrganizations,
  getOutgoingCashflowPaymentMovements,
  getOutgoingCashflows,
  searchOutgoingCashflowRegistryPaymentRegisters,
} from '../api/outgoingCashflowsApi'
import type { OutgoingCashflowRow } from '../types'
import { OutgoingCashflowsPage } from './OutgoingCashflowsPage'

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

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({
    columns,
    data,
    onRowClick,
  }: {
    columns: DataTableColumn<OutgoingCashflowRow>[]
    data: OutgoingCashflowRow[]
    onRowClick: (row: OutgoingCashflowRow) => void
  }) => (
    <div>
      {data.map((row) => (
        <div key={row.id}>
          <button type="button" onClick={() => onRowClick(row)}>{`outgoing-row-${row.id}`}</button>
          {columns.at(-1)?.cell?.(row)}
        </div>
      ))}
    </div>
  ),
}))

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, opened, title }: { children: ReactNode; opened: boolean; title: ReactNode }) =>
    opened ? <div><div>{title}</div>{children}</div> : null,
}))

vi.mock('../../../shared/ui/AppModal', () => ({
  AppModal: ({ children, opened, title }: { children: ReactNode; opened: boolean; title: ReactNode }) =>
    opened ? <div><div>{title}</div>{children}</div> : null,
}))

vi.mock('../api/outgoingCashflowsApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/outgoingCashflowsApi')>(),
  cancelOutgoingCashflow: vi.fn(),
  getOutgoingCashflowCurrencies: vi.fn(),
  getOutgoingCashflowOrganizations: vi.fn(),
  getOutgoingCashflowPaymentMovements: vi.fn(),
  getOutgoingCashflows: vi.fn(),
  searchOutgoingCashflowRegistryPaymentRegisters: vi.fn(),
}))

vi.mock('../api/advanceReportApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/advanceReportApi')>(),
  calculateAdvanceReportDocumentStructure: vi.fn(),
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/accounting/outgoing-cashflow']}>
      <MantineProvider>
        <I18nProvider>
          <Routes>
            <Route path="/accounting/outgoing-cashflow" element={<OutgoingCashflowsPage />} />
            <Route path="/accounting/outgoing-cashflow/new/*" element={<div>create-target</div>} />
            <Route path="/accounting/outgoing-cashflow/:id/advanced-report/view" element={<div>report-target</div>} />
          </Routes>
        </I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}

describe('outgoing cashflows permissions', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getOutgoingCashflowCurrencies).mockResolvedValue([])
    vi.mocked(getOutgoingCashflowOrganizations).mockResolvedValue([])
    vi.mocked(getOutgoingCashflowPaymentMovements).mockResolvedValue([])
    vi.mocked(searchOutgoingCashflowRegistryPaymentRegisters).mockResolvedValue([])
    vi.mocked(getOutgoingCashflows).mockResolvedValue({
      Collection: [{
        IsUnderReport: true,
        NetUid: 'order-1',
        Number: 'ВКО-1',
      }],
      NegativeDifferenceAmount: 0,
      PositiveDifferenceAmount: 0,
    })
    vi.mocked(calculateAdvanceReportDocumentStructure).mockResolvedValue({ NetUid: 'order-1' })
    vi.mocked(cancelOutgoingCashflow).mockResolvedValue({ NetUid: 'order-1' })
  })

  it('does not mount the registry model without page.view', async () => {
    renderPage()

    expect(await screen.findByText('Доступ заборонено')).toBeTruthy()
    expect(getOutgoingCashflows).not.toHaveBeenCalled()
    expect(getOutgoingCashflowCurrencies).not.toHaveBeenCalled()
  })

  it('keeps page-only access read-only and exposes each independent action only with its key', async () => {
    allowedPermissions.add(PermissionKeys.SystemPages.OutgoingCashflows.View)
    const rendered = renderPage()

    expect(await screen.findByRole('button', { name: 'outgoing-row-order-1' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Новий' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Скасувати' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Редагувати звіт' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Структура документів' })).toBeNull()

    rendered.unmount()
    allowedPermissions.add(PermissionKeys.OutgoingCashflows.Order.Create)
    allowedPermissions.add(PermissionKeys.OutgoingCashflows.Order.Cancel)
    allowedPermissions.add(PermissionKeys.AdvancedReports.Report.Open)
    allowedPermissions.add(PermissionKeys.AdvancedReports.DocumentStructure.Open)
    renderPage()

    expect(await screen.findByRole('button', { name: 'Новий' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Скасувати' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Редагувати звіт' })).toBeTruthy()
    const structure = screen.getByRole('button', { name: 'Структура документів' })
    fireEvent.click(structure)
    await waitFor(() => expect(calculateAdvanceReportDocumentStructure).toHaveBeenCalled())
  })

  it('loads the exact registry with page permission without a foreign payments denial', async () => {
    allowedPermissions.add(PermissionKeys.SystemPages.OutgoingCashflows.View)
    renderPage()

    expect(await screen.findByRole('button', { name: 'outgoing-row-order-1' })).toBeTruthy()
    await waitFor(() => {
      expect(searchOutgoingCashflowRegistryPaymentRegisters).toHaveBeenCalledWith('')
    })
    expect(screen.queryByText('Недостатньо прав для цієї дії.')).toBeNull()
  })

  it('still surfaces a genuine forbidden response from the outgoing registry', async () => {
    allowedPermissions.add(PermissionKeys.SystemPages.OutgoingCashflows.View)
    vi.mocked(getOutgoingCashflows).mockRejectedValue(
      new Error('Недостатньо прав для цієї дії.'),
    )
    renderPage()

    expect(await screen.findByText('Недостатньо прав для цієї дії.')).toBeTruthy()
  })

  it('rechecks order.cancel after confirmation was opened', async () => {
    allowedPermissions.add(PermissionKeys.SystemPages.OutgoingCashflows.View)
    allowedPermissions.add(PermissionKeys.OutgoingCashflows.Order.Cancel)
    renderPage()

    const opener = await screen.findByRole('button', { name: 'Скасувати' })
    fireEvent.click(opener)
    allowedPermissions.delete(PermissionKeys.OutgoingCashflows.Order.Cancel)
    const confirm = screen.getAllByRole('button', { name: 'Скасувати' }).at(-1)
    expect(confirm).toBeTruthy()
    fireEvent.click(confirm!)

    expect(cancelOutgoingCashflow).not.toHaveBeenCalled()
  })
})
