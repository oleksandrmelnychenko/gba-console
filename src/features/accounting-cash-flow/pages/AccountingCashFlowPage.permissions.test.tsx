import { documentaryOverlayFixture, documentarySummaryFixture } from '../../../shared/debt/documentaryDebtAging.test-fixtures'
import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

  it('renders root documentary aging without netting credit or reusing legacy raw days', async () => {
    allowedPermissions.add(PermissionKeys.Clients.AccountingCashFlow.Open)
    vi.mocked(getAccountingCashFlowCounterparty).mockResolvedValue({
      Id: 7, NetUid: 'client-1',
      DocumentaryDebtAging: documentaryOverlayFixture({ Agreements: [documentarySummaryFixture({
        PositiveDebtTotal: 100, CreditBalance: 100, KnownOverdueTotal: 100, KnownOverdueCount: 1,
        KnownNotOverdueCount: 0, UnknownDateDebtCount: 1, UnknownDateDebtTotal: 50,
        HasCompleteAging: false, OverdueTotal: null, MaxKnownDaysPastDue: 12,
      })] }),
      ClientAgreements: [{ AgreementId: 9, NetUid: 'agreement-1', AccountBalance: 0, Agreement: {
        Id: 9, Name: 'Договір документального боргу', NumberDaysDebt: 30,
        ClientInDebts: [{ Debt: { Days: 999999, Total: 100 } }, { Debt: { Days: 999999, Total: -100 } }],
      } }],
    })
    renderPage()
    const card = await screen.findByRole('button', { name: /Договір документального боргу/ })
    const overdueLabel = within(card).getByText('Відоме прострочення')
    const creditLabel = within(card).getByText('Кредитовий залишок')
    const overdueMetric = overdueLabel.closest('span')
    const creditMetric = creditLabel.closest('span')
    expect(overdueMetric).not.toBeNull()
    expect(creditMetric).not.toBeNull()
    expect(within(overdueMetric!).getByText('100.00')).toBeTruthy()
    expect(within(creditMetric!).getByText('100.00')).toBeTruthy()
    expect(within(card).getByText('Макс. відоме прострочення')).toBeTruthy()
    expect(within(card).getByText('12')).toBeTruthy()
    expect(within(card).getByRole('note').textContent).toContain('Без підтвердженої дати: 1')
    expect(within(card).queryByText('999969 / 30')).toBeNull()
  })

  it.each([
    { label: 'disabled control', enabled: false, limit: 0, exceeded: false },
    { label: 'missing control', enabled: undefined, limit: 0, exceeded: false },
    { label: 'missing limit', enabled: true, limit: undefined, exceeded: false },
    { label: 'enabled exceeded limit', enabled: true, limit: 100, exceeded: true },
    { label: 'enabled zero limit', enabled: true, limit: 0, exceeded: true },
    { label: 'enabled sufficient limit', enabled: true, limit: 200, exceeded: false },
  ])('honors configured amount control in documentary cards: $label', async ({ enabled, limit, exceeded }) => {
    allowedPermissions.add(PermissionKeys.Clients.AccountingCashFlow.Open)
    vi.mocked(getAccountingCashFlowCounterparty).mockResolvedValue({
      Id: 7, NetUid: 'client-1', DocumentaryDebtAging: documentaryOverlayFixture(),
      ClientAgreements: [{ AgreementId: 9, NetUid: 'agreement-1', AccountBalance: 150, Agreement: {
        Id: 9, Name: 'Договір контролю суми', IsControlAmountDebt: enabled, AmountDebt: limit,
        ClientInDebts: [{ Debt: { Days: 999999, Total: 150 } }],
      } }],
    })
    renderPage()
    const card = await screen.findByRole('button', { name: /Договір контролю суми/ })
    expect(within(card).getByText(exceeded ? 'Перевищено ліміт' : 'Активний')).toBeTruthy()
    expect(card.classList.contains('is-overdue')).toBe(exceeded)
    const balanceMetric = within(card).getByText('Баланс').closest('span')
    expect(balanceMetric).not.toBeNull()
    expect(within(balanceMetric!).getByText('150.00')).toBeTruthy()
    expect(balanceMetric!.classList.contains('is-danger')).toBe(exceeded)
    const overdueMetric = within(card).getByText('Відоме прострочення').closest('span')
    expect(within(overdueMetric!).getByText('0.00')).toBeTruthy()
    expect(within(card).queryByText('Прострочено')).toBeNull()
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
