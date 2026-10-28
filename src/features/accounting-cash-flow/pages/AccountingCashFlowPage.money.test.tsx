import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import { getAccountingCashFlow, getAccountingCashFlowCounterparty } from '../api/accountingCashFlowApi'
import { CashFlowSummary } from '../components/CashFlowSummary'
import type { AccountingCashFlow, AccountingCashFlowHeadItem } from '../types'
import { ClientAccountingCashFlowPage } from './AccountingCashFlowPage'

vi.mock('../../auth/components/PermissionGate', () => ({
  PermissionGate: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}))
vi.mock('../api/accountingCashFlowApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/accountingCashFlowApi')>(),
  getAccountingCashFlow: vi.fn(),
  getAccountingCashFlowCounterparty: vi.fn(),
}))
// Render the page's actual cell callbacks; table virtualization is irrelevant to money display.
vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({ data, columns }: {
    data: AccountingCashFlowHeadItem[]
    columns: DataTableColumn<AccountingCashFlowHeadItem>[]
  }) => <div>{data.map((item, index) => (
    <div data-testid={`money-row-${index}`} key={item.NetUid}>
      {columns.map((column) => <span data-testid={column.id} key={column.id}>{column.cell?.(item)}</span>)}
    </div>
  ))}</div>,
}))

function renderStatement(cashFlow: AccountingCashFlow) {
  vi.mocked(getAccountingCashFlow).mockResolvedValue(cashFlow)
  return render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={['/clients/accounting-cash-flow/client-1']}>
          <Routes>
            <Route path="/clients/accounting-cash-flow/:id" element={<ClientAccountingCashFlowPage />} />
          </Routes>
        </MemoryRouter>
        <div data-testid="summary"><CashFlowSummary cashFlow={cashFlow} lastItem={cashFlow.AccountingCashFlowHeadItems?.at(-1)} /></div>
      </I18nProvider>
    </MantineProvider>,
  )
}

function metric(container: HTMLElement, label: string) {
  return within(container).getByText(label).parentElement!
}

describe('cash-flow decimal money presentation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAccountingCashFlowCounterparty).mockResolvedValue({
      NetUid: 'client-1', ClientAgreements: [{ NetUid: 'agreement-1' }],
    })
  })

  it.each([
    [0.0049, '0.00'], [0.005, '0.01'], [0.015, '0.02'], [0.3333, '0.33'],
    [-0.0049, '-0.00'], [-0.005, '-0.01'], [-0.015, '-0.02'], [-0.3333, '-0.33'],
  ])('displays raw %s consistently in debit, credit, balances and summary', async (raw, expected) => {
    const cashFlow = {
      BeforeRangeBalance: raw, AfterRangeInAmount: raw, AfterRangeOutAmount: raw,
      AccountingCashFlowHeadItems: [
        { NetUid: 'debit-1', CurrentValue: raw, CurrentBalance: raw, IsCreditValue: false },
        { NetUid: 'credit-1', CurrentValue: raw, CurrentBalance: raw, IsCreditValue: true },
      ],
    }
    const { container } = renderStatement(cashFlow)
    const debitRow = await screen.findByTestId('money-row-0')
    const creditRow = screen.getByTestId('money-row-1')
    expect(within(debitRow).getByTestId('debit').textContent).toBe(expected)
    expect(within(creditRow).getByTestId('credit').textContent).toBe(expected)
    expect(within(debitRow).getByTestId('balance').textContent).toBe(expected)
    const hero = container.querySelector<HTMLElement>('.accounting-cash-flow-metrics')!
    for (const label of ['Вхідний баланс', 'Дебет', 'Кредит', 'Кінцевий баланс']) {
      expect(within(metric(hero, label)).getByText(expected)).toBeTruthy()
    }
    const summary = screen.getByTestId('summary')
    for (const label of ['Вхідний баланс', 'Дебет за період', 'Кредит за період', 'Кінцевий баланс']) {
      expect(within(metric(summary, label)).getByText(expected.replace('.', ','))).toBeTruthy()
    }
    expect(cashFlow.AccountingCashFlowHeadItems[0].CurrentValue).toBe(raw)
  })

  it('adds sub-cent amounts before displaying the closing balance', async () => {
    const cashFlow = {
      BeforeRangeBalance: 0.0049, AfterRangeInAmount: 0.0049, AfterRangeOutAmount: 0,
      AccountingCashFlowHeadItems: [{ NetUid: 'debit-1', CurrentValue: 0.0049, IsCreditValue: false }],
    }
    const { container } = renderStatement(cashFlow)
    const row = await screen.findByTestId('money-row-0')
    expect(within(row).getByTestId('debit').textContent).toBe('0.00')
    const hero = container.querySelector<HTMLElement>('.accounting-cash-flow-metrics')!
    expect(within(metric(hero, 'Кінцевий баланс')).getByText('0.01')).toBeTruthy()
    expect(within(metric(screen.getByTestId('summary'), 'Кінцевий баланс')).getByText('0,01')).toBeTruthy()
    expect(cashFlow.BeforeRangeBalance + cashFlow.AfterRangeInAmount).toBe(0.0098)
  })
})
