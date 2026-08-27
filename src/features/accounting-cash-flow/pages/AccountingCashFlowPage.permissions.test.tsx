import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  exportCounterpartyAccountingCashFlowDocument,
  getAccountingCashFlow,
  getAccountingCashFlowCounterparty,
} from '../api/accountingCashFlowApi'
import { getIncomeCashflowForAccountingCashFlow } from '../../income-cashflows/api/incomeCashflowsApi'
import { getSalesUkraineSaleDetails } from '../../sales-ukraine/api/salesUkraineApi'
import type { AccountingCashFlowHeadItem } from '../types'
import { ClientAccountingCashFlowPage } from './AccountingCashFlowPage'

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
    data: AccountingCashFlowHeadItem[]
    onRowClick: (item: AccountingCashFlowHeadItem) => void
  }) => (
    <div>
      {data.map((item, index) => (
        <button key={index} type="button" onClick={() => onRowClick(item)}>
          {`cash-flow-row-${index}`}
        </button>
      ))}
    </div>
  ),
}))

vi.mock('../api/accountingCashFlowApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/accountingCashFlowApi')>(),
  exportCounterpartyAccountingCashFlowDocument: vi.fn(),
  getAccountingCashFlow: vi.fn(),
  getAccountingCashFlowCounterparty: vi.fn(),
}))

vi.mock('../../income-cashflows/api/incomeCashflowsApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../income-cashflows/api/incomeCashflowsApi')>(),
  getIncomeCashflowForAccountingCashFlow: vi.fn(),
}))

vi.mock('../../sales-ukraine/api/salesUkraineApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../sales-ukraine/api/salesUkraineApi')>(),
  getSalesUkraineSaleDetails: vi.fn(),
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/clients/accounting-cash-flow/client-1']}>
      <MantineProvider>
        <I18nProvider>
          <Routes>
            <Route path="/clients/accounting-cash-flow/:id" element={<ClientAccountingCashFlowPage />} />
          </Routes>
        </I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}

describe('accounting cash-flow permissions', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getAccountingCashFlowCounterparty).mockResolvedValue({
      ClientAgreements: [{ NetUid: 'agreement-1' }],
      NetUid: 'client-1',
    })
    vi.mocked(getAccountingCashFlow).mockResolvedValue({ AccountingCashFlowHeadItems: [] })
    vi.mocked(getIncomeCashflowForAccountingCashFlow).mockResolvedValue(null)
    vi.mocked(getSalesUkraineSaleDetails).mockResolvedValue(null)
  })

  it('does not mount the data model without accounting cash-flow access', async () => {
    renderPage()

    expect(await screen.findByText('У вашої ролі немає права переглядати взаєморозрахунки.')).toBeTruthy()
    expect(getAccountingCashFlowCounterparty).not.toHaveBeenCalled()
    expect(getAccountingCashFlow).not.toHaveBeenCalled()
  })

  it('rechecks export permission after the page and agreement have loaded', async () => {
    allowedPermissions.add(PermissionKeys.Clients.AccountingCashFlow.Open)
    allowedPermissions.add(PermissionKeys.Clients.AccountingCashFlow.Export)
    renderPage()

    const exportButton = await screen.findByRole('button', { name: 'Експорт / друк' })
    allowedPermissions.delete(PermissionKeys.Clients.AccountingCashFlow.Export)
    fireEvent.click(exportButton)

    expect(exportCounterpartyAccountingCashFlowDocument).not.toHaveBeenCalled()
  })

  it('requires the target permission before loading sale or income details', async () => {
    allowedPermissions.add(PermissionKeys.Clients.AccountingCashFlow.Open)
    vi.mocked(getAccountingCashFlow).mockResolvedValue({
      AccountingCashFlowHeadItems: [
        { Sale: { NetUid: 'sale-1' }, Type: 13 },
        { IncomePaymentOrder: { NetUid: 'income-1' }, Type: 12 },
      ],
    })
    renderPage()

    const saleRow = await screen.findByRole('button', { name: 'cash-flow-row-0' })
    const incomeRow = await screen.findByRole('button', { name: 'cash-flow-row-1' })

    fireEvent.click(saleRow)
    fireEvent.click(incomeRow)
    expect(getSalesUkraineSaleDetails).not.toHaveBeenCalled()
    expect(getIncomeCashflowForAccountingCashFlow).not.toHaveBeenCalled()

    allowedPermissions.add(PermissionKeys.SalesUkraine.Sale.OpenDetails)
    allowedPermissions.add(PermissionKeys.SystemPages.IncomeCashflows.View)
    fireEvent.click(saleRow)
    fireEvent.click(incomeRow)

    await waitFor(() => {
      expect(getSalesUkraineSaleDetails).toHaveBeenCalledWith('sale-1')
      expect(getIncomeCashflowForAccountingCashFlow).toHaveBeenCalledWith('income-1')
    })
  })
})
