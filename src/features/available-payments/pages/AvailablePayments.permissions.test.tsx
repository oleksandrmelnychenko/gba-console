import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  createAvailablePaymentOutcome,
  getAvailablePaymentAccountingCashFlow,
  getAvailablePaymentMovements,
  getAvailablePaymentsOrganizations,
  getGroupedPaymentTasks,
  mergeAvailablePaymentTasks,
  searchAvailablePaymentRegisters,
  setAvailablePaymentTaskToActive,
} from '../api/availablePaymentsApi'
import { AvailablePaymentsDetailDrawer } from '../components/AvailablePaymentsDetailDrawer'
import { buildTaskModels } from '../models/paymentTaskModelMapper'
import {
  TaskStatusValue,
  type AvailablePaymentTaskModel,
  type GroupedPaymentTask,
} from '../types'
import { AvailablePaymentsPage } from './AvailablePaymentsPage'

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

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, footer, opened, title }: {
    children: ReactNode
    footer?: ReactNode
    opened: boolean
    title?: ReactNode
  }) => opened ? <section><h2>{title}</h2>{children}{footer}</section> : null,
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({ columns, data, renderExpandedRow, tableId }: {
    columns: Array<{ cell?: (item: never) => ReactNode; id: string }>
    data: never[]
    renderExpandedRow?: (item: never) => ReactNode
    tableId: string
  }) => (
    <div data-testid={tableId}>
      {data.map((item, index) => (
        <div key={index}>
          {columns.map((column) => <span key={column.id}>{column.cell?.(item)}</span>)}
          {renderExpandedRow?.(item)}
        </div>
      ))}
    </div>
  ),
}))

vi.mock('../models/availablePaymentOutcomeOperation', () => ({
  createAvailablePaymentOutcomeOperation: () => ({
    complete: vi.fn(),
    getOrCreate: vi.fn().mockResolvedValue('operation-1'),
    handleFailure: vi.fn(),
    hasPending: () => false,
    reconcile: vi.fn().mockResolvedValue('none'),
  }),
}))

vi.mock('../api/availablePaymentsApi', () => ({
  calculateAvailablePaymentConvertedAmount: vi.fn(),
  createAvailablePaymentMovement: vi.fn(),
  createAvailablePaymentOutcome: vi.fn(),
  getAvailablePaymentAccountingCashFlow: vi.fn(),
  getAvailablePaymentExchangeRate: vi.fn(),
  getAvailablePaymentMovements: vi.fn(),
  getAvailablePaymentTaskByNetId: vi.fn(),
  getAvailablePaymentsOrganizations: vi.fn(),
  getGroupedPaymentTasks: vi.fn(),
  mergeAvailablePaymentTasks: vi.fn(),
  searchAvailablePaymentMovements: vi.fn(),
  searchAvailablePaymentRegisters: vi.fn(),
  setAvailablePaymentTaskToActive: vi.fn(),
}))

const baseGroup = createGroup(true)

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/accounting/available-payments']}>
      <MantineProvider>
        <I18nProvider>
          <AvailablePaymentsPage />
        </I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}

function renderDrawer(group = baseGroup, markedModels: AvailablePaymentTaskModel[] = []) {
  return render(
    <MemoryRouter>
      <MantineProvider>
        <I18nProvider>
          <AvailablePaymentsDetailDrawer
            filesByTaskId={{}}
            group={group}
            markedModels={markedModels}
            markedTaskIds={markedModels.map((model) => model.id)}
            outcomeRequest={null}
            typePaymentTask={0}
            onChanged={vi.fn()}
            onClearMarked={vi.fn()}
            onClose={vi.fn()}
            onFilesChanged={vi.fn()}
            onTaskUpdated={vi.fn()}
            onToggleMarked={vi.fn()}
          />
        </I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}

describe('Available payments canonical permission guards', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getGroupedPaymentTasks).mockResolvedValue({
      GroupedPaymentTasks: [],
      PriceTotals: [],
      TotalGrossPrice: 0,
    })
    vi.mocked(getAvailablePaymentsOrganizations).mockResolvedValue([])
    vi.mocked(getAvailablePaymentMovements).mockResolvedValue([])
    vi.mocked(searchAvailablePaymentRegisters).mockResolvedValue([])
    vi.mocked(getAvailablePaymentAccountingCashFlow).mockResolvedValue({ AccountingCashFlowHeadItems: [] })
  })

  it('does not mount page data without page.view', async () => {
    renderPage()

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(getGroupedPaymentTasks).not.toHaveBeenCalled()
    expect(getAvailablePaymentsOrganizations).not.toHaveBeenCalled()

    allowedPermissions.add(PermissionKeys.FinancialAdministration.AvailablePayments.Page.View)
    renderPage()

    await waitFor(() => expect(getGroupedPaymentTasks).toHaveBeenCalled())
    expect(getAvailablePaymentsOrganizations).toHaveBeenCalled()
  })

  it('keeps outcome, merge, mark-available, and cash-flow controls independent', async () => {
    const noActions = renderDrawer()
    expect(screen.queryByRole('tab', { name: 'Рух коштів' })).toBeNull()
    expect(screen.queryByRole('tab', { name: 'Оплата' })).toBeNull()
    expect(screen.queryByLabelText('Вибрати платіжну задачу')).toBeNull()
    noActions.unmount()

    allowedPermissions.add(PermissionKeys.FinancialAdministration.AvailablePayments.OutcomeOrder.Create)
    const outcomeOnly = renderDrawer()
    fireEvent.click(screen.getByRole('tab', { name: 'Оплата' }))
    expect(screen.getByRole('button', { name: 'Створити видатковий' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Перевести в оплату' })).toBeNull()
    outcomeOnly.unmount()

    allowedPermissions.clear()
    allowedPermissions.add(PermissionKeys.FinancialAdministration.AvailablePayments.CashFlow.Open)
    const cashFlowOnly = renderDrawer()
    fireEvent.click(screen.getByRole('tab', { name: 'Рух коштів' }))
    await waitFor(() => expect(getAvailablePaymentAccountingCashFlow).toHaveBeenCalled())
    cashFlowOnly.unmount()

    allowedPermissions.clear()
    allowedPermissions.add(PermissionKeys.FinancialAdministration.AvailablePayments.Task.Merge)
    const mergeGroup = createGroup(false, 2)
    const mergeModels = buildTaskModels(mergeGroup, (key) => key)
    renderDrawer(mergeGroup, mergeModels)
    expect(screen.getByRole('button', { name: 'Об’єднати задачі' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Створити видатковий' })).toBeNull()
  })

  it('rechecks permissions in final handlers after the rendered control becomes stale', async () => {
    allowedPermissions.add(PermissionKeys.FinancialAdministration.AvailablePayments.OutcomeOrder.Create)
    const outcomeView = renderDrawer()
    const paymentTab = screen.getByRole('tab', { name: 'Оплата' })
    fireEvent.click(paymentTab)
    const outcomeButton = screen.getByRole('button', { name: 'Створити видатковий' })
    allowedPermissions.delete(PermissionKeys.FinancialAdministration.AvailablePayments.OutcomeOrder.Create)
    fireEvent.click(outcomeButton)
    expect(searchAvailablePaymentRegisters).not.toHaveBeenCalled()
    expect(createAvailablePaymentOutcome).not.toHaveBeenCalled()
    outcomeView.unmount()

    const unavailableGroup = createGroup(false)
    allowedPermissions.add(PermissionKeys.FinancialAdministration.AvailablePayments.Task.MarkAvailable)
    const markView = renderDrawer(unavailableGroup)
    fireEvent.click(screen.getByRole('tab', { name: 'Оплата' }))
    const markAvailable = screen.getByRole('button', { name: 'Перевести в оплату' })
    allowedPermissions.delete(PermissionKeys.FinancialAdministration.AvailablePayments.Task.MarkAvailable)
    fireEvent.click(markAvailable)
    expect(setAvailablePaymentTaskToActive).not.toHaveBeenCalled()
    markView.unmount()

    const mergeGroup = createGroup(false, 2)
    const mergeModels = buildTaskModels(mergeGroup, (key) => key)
    allowedPermissions.add(PermissionKeys.FinancialAdministration.AvailablePayments.Task.Merge)
    renderDrawer(mergeGroup, mergeModels)
    const mergeButton = screen.getByRole('button', { name: 'Об’єднати задачі' })
    allowedPermissions.delete(PermissionKeys.FinancialAdministration.AvailablePayments.Task.Merge)
    fireEvent.click(mergeButton)
    expect(mergeAvailablePaymentTasks).not.toHaveBeenCalled()
  })
})

function createGroup(isAvailableForPayment: boolean, taskCount = 1): GroupedPaymentTask {
  const taskNetUids = [
    '6b705f30-89a3-4c57-b74c-908082528865',
    '1d48a5df-2fed-4921-af93-c3b7f562a3a4',
  ]

  return {
    PayToDate: '2026-08-19T00:00:00Z',
    SupplyPaymentTasks: Array.from({ length: taskCount }, (_, index) => ({
        ContainerServices: [
          {
            ContainerNumber: `CONT-${index + 1}`,
            ContainerOrganization: { Name: 'Перевізник', NetUid: 'carrier-1' },
            GrossPrice: 100,
            NetPrice: 100,
            Number: `CS-${index + 1}`,
            SupplyOrganizationAgreement: {
              Currency: { Code: 'EUR', Id: 2, NetUid: 'currency-1' },
              NetUid: 'agreement-1',
              Organization: { Name: 'GBA', NetUid: 'organization-1' },
            },
          },
        ],
        GrossPrice: 100,
        Id: 42 + index,
        IsAvailableForPayment: isAvailableForPayment,
        NetPrice: 100,
        NetUid: taskNetUids[index],
        SupplyPaymentTaskDocuments: [{ Id: index + 1, NetUid: `doc-${index + 1}` }],
        TaskStatus: TaskStatusValue.NotDone,
      })),
  }
}
