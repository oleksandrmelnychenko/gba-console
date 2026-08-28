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
          <button type="button" onClick={() => onRowClick?.(item)}>
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

describe('Income cashflows canonical permission guards', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getIncomeCashflowCurrencies).mockResolvedValue([])
    vi.mocked(getIncomeCashflowOrganizations).mockResolvedValue([])
    vi.mocked(searchIncomeCashflowRegistryPaymentRegisters).mockResolvedValue([])
    vi.mocked(getIncomeCashflows).mockResolvedValue([incomeOrder])
    vi.mocked(cancelIncomeCashflow).mockResolvedValue(incomeOrder)
  })

  it('does not mount registry resources without page.view', () => {
    renderPage()

    expect(screen.getByText('Немає права переглядати прибуткові ордери')).toBeTruthy()
    expect(getIncomeCashflows).not.toHaveBeenCalled()
    expect(getIncomeCashflowOrganizations).not.toHaveBeenCalled()
  })

  it('keeps create, details, reassign, and cancel controls independent', async () => {
    allowedPermissions.add(pagePermission)
    const pageOnly = renderPage()
    await waitFor(() => expect(getIncomeCashflows).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: 'Новий' })).toBeNull()
    expect(screen.queryByLabelText('Деталі')).toBeNull()
    expect(screen.queryByLabelText('Переназначити клієнта')).toBeNull()
    expect(screen.queryByLabelText('Скасувати')).toBeNull()
    pageOnly.unmount()

    allowedPermissions.add(incomePermissions.IncomeOrder.CreateSupplierReturn)
    const createOnly = renderPage()
    expect(await screen.findByRole('button', { name: 'Новий' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Новий' }))
    expect(await screen.findAllByText('Повернення постачальника')).toHaveLength(2)
    expect(screen.queryByRole('menuitem', { name: 'Оплата покупця' })).toBeNull()
    createOnly.unmount()

    allowedPermissions.delete(incomePermissions.IncomeOrder.CreateSupplierReturn)
    allowedPermissions.add(incomePermissions.Order.OpenDetails)
    const detailsOnly = renderPage()
    expect(await screen.findByLabelText('Деталі')).toBeTruthy()
    expect(screen.queryByLabelText('Переназначити клієнта')).toBeNull()
    expect(screen.queryByLabelText('Скасувати')).toBeNull()
    detailsOnly.unmount()

    allowedPermissions.delete(incomePermissions.Order.OpenDetails)
    allowedPermissions.add(incomePermissions.Order.ReassignClient)
    const reassignOnly = renderPage()
    expect(await screen.findByLabelText('Переназначити клієнта')).toBeTruthy()
    expect(screen.queryByLabelText('Деталі')).toBeNull()
    expect(screen.queryByLabelText('Скасувати')).toBeNull()
    reassignOnly.unmount()

    allowedPermissions.delete(incomePermissions.Order.ReassignClient)
    allowedPermissions.add(incomePermissions.Order.Cancel)
    renderPage()
    expect(await screen.findByLabelText('Скасувати')).toBeTruthy()
    expect(screen.queryByLabelText('Деталі')).toBeNull()
    expect(screen.queryByLabelText('Переназначити клієнта')).toBeNull()
  })

  it('loads the exact registry with page permission without a foreign payments denial', async () => {
    allowedPermissions.add(pagePermission)
    renderPage()

    await waitFor(() => expect(getIncomeCashflows).toHaveBeenCalled())
    await waitFor(() => {
      expect(searchIncomeCashflowRegistryPaymentRegisters).toHaveBeenCalledWith('')
    })
    expect(screen.queryByText('Недостатньо прав для цієї дії.')).toBeNull()
  })

  it('still surfaces a genuine forbidden response from the income registry', async () => {
    allowedPermissions.add(pagePermission)
    vi.mocked(getIncomeCashflows).mockRejectedValue(
      new Error('Недостатньо прав для цієї дії.'),
    )
    renderPage()

    expect(await screen.findByText('Недостатньо прав для цієї дії.')).toBeTruthy()
  })

  it('rechecks cancel permission in the final handler', async () => {
    allowedPermissions.add(pagePermission)
    allowedPermissions.add(incomePermissions.Order.Cancel)
    renderPage()

    const cancelButton = await screen.findByLabelText('Скасувати')
    fireEvent.click(cancelButton)
    const confirmButton = within(await screen.findByRole('dialog')).getByRole('button', {
      name: 'Скасувати',
    })
    allowedPermissions.delete(incomePermissions.Order.Cancel)
    fireEvent.click(confirmButton)

    expect(cancelIncomeCashflow).not.toHaveBeenCalled()
  })
})
