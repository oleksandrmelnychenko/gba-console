import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  cancelIncomeCashflow,
  getIncomeCashflowCurrencies,
  getIncomeCashflowOrganizations,
  getIncomeCashflows,
  searchIncomeCashflowRegistryPaymentRegisters,
} from '../api/incomeCashflowsApi'
import { IncomeCashflowsPage } from './IncomeCashflowsPage'
import { notifications } from '@mantine/notifications'

vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }))

const allowedPermissions = new Set<string>()

vi.mock('../../auth/components/PermissionGate', () => ({
  PermissionGate: ({ children, fallback = null, permissionKey }: {
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
  DataTable: ({ columns, data, onRowClick, tableId }: {
    columns: Array<{ cell?: (item: never) => ReactNode; id: string }>
    data: never[]
    onRowClick?: (item: never) => void
    tableId: string
  }) => (
    <div data-testid={tableId}>
      {data.map((item, index) => (
        <div key={index}>
          <button disabled={!onRowClick} type="button" onClick={() => onRowClick?.(item)}>
            Відкрити рядок
          </button>
          {columns.map((column) => (
            <span key={column.id}>{column.cell?.(item)}</span>
          ))}
        </div>
      ))}
    </div>
  ),
}))

vi.mock('../api/incomeCashflowsApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/incomeCashflowsApi')>(),
  cancelIncomeCashflow: vi.fn(),
  getIncomeCashflowByNetId: vi.fn(),
  getIncomeCashflowClientAgreements: vi.fn(),
  getIncomeCashflowCurrencies: vi.fn(),
  getIncomeCashflowOrganizations: vi.fn(),
  getIncomeCashflows: vi.fn(),
  searchIncomeCashflowClientPayers: vi.fn(),
  searchIncomeCashflowRegistryPaymentRegisters: vi.fn(),
  updateIncomeCashflowClient: vi.fn(),
}))

const pagePermission = PermissionKeys.SystemPages.IncomeCashflows.View
const incomePermissions =
  PermissionKeys.FinancialAdministration.IncomeCashflows

const incomeOrder = {
  Amount: 250,
  AssignedPaymentOrders: [],
  Created: new Date().toISOString(),
  FromDate: new Date().toISOString(),
  IsCanceled: false,
  NetUid: '11111111-1111-4111-8111-111111111111',
  Number: 'IN-1',
  OperationType: 0,
}

function renderPage(initialEntry = '/accounting/income-cashflows') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <MantineProvider>
        <I18nProvider>
          <IncomeCashflowsPage />
        </I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}

describe("Income order cancel feedback", () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getIncomeCashflowCurrencies).mockResolvedValue([])
    vi.mocked(getIncomeCashflowOrganizations).mockResolvedValue([])
    vi.mocked(searchIncomeCashflowRegistryPaymentRegisters).mockResolvedValue([])
    vi.mocked(getIncomeCashflows).mockResolvedValue([incomeOrder])
    vi.mocked(cancelIncomeCashflow).mockResolvedValue(incomeOrder)
  })

  async function openCancelDialog() {
    allowedPermissions.add(pagePermission)
    allowedPermissions.add(incomePermissions.Order.Cancel)
    renderPage()
    fireEvent.click(await screen.findByLabelText('Скасувати'))
    return screen.findByRole('dialog')
  }

  it('warns that the debt of the sales the order paid will reopen', async () => {
    vi.mocked(getIncomeCashflows).mockResolvedValue([{
      ...incomeOrder,
      Client: { Name: 'CH2' },
      IncomePaymentOrderSales: [{ Amount: 10, Sale: { SaleNumber: { Value: 'QAUНо00000017' } } }],
    }])
    const dialog = await openCancelDialog()

    expect(within(dialog).getByText(/QAUНо00000017: після скасування його борг відновиться/)).toBeTruthy()
  })

  it('confirms a successful cancel with a toast', async () => {
    const dialog = await openCancelDialog()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Скасувати' }))

    await waitFor(() => expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({ color: 'green', message: 'Ордер скасовано: IN-1' })))
  })

  it('shows the server reason when the cancel is refused', async () => {
    vi.mocked(cancelIncomeCashflow).mockRejectedValue(new Error('Для відміни операції, спочатку анулюйте прибутковий, з номером QAU0000000018'))
    const dialog = await openCancelDialog()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Скасувати' }))

    await waitFor(() => expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({
      color: 'red',
      message: 'Для відміни операції, спочатку анулюйте прибутковий, з номером QAU0000000018',
      title: 'Ордер не скасовано',
    })))
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
})
