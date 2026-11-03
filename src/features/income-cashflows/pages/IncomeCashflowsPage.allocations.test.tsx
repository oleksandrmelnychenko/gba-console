import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { buildIncomeCashflowRow } from '../incomeCashflowRows'
import { allocationGuid, allocationPayment, allocationSummary, unknownAllocationSummary } from '../incomePaymentAllocationTestData'
import type { IncomePaymentOrder } from '../types'
import { IncomeCashflowDetailDrawer } from './IncomeCashflowsPage'

function show(order: IncomePaymentOrder) {
  return render(<MemoryRouter><MantineProvider><I18nProvider>
    <IncomeCashflowDetailDrawer opened row={buildIncomeCashflowRow(order)} onClose={vi.fn()} />
  </I18nProvider></MantineProvider></MemoryRouter>)
}
const money = (value: number) => new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value).replace(/\s/g, ' ')

describe('income payment detail allocation amounts', () => {
  it('renders five exact allocations plus a separate33.57UAH residual without mixing EUR', async () => {
    show(allocationPayment())
    const table = await screen.findByRole('table')
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(5)
    expect(within(rows[0]).getByText('SALE-1')).toBeTruthy()
    expect(within(rows[0]).getByText(money(639.84)).parentElement?.textContent).toContain('UAH')
    expect(within(rows[0]).getByText(money(12.281)).parentElement?.textContent).toContain('EUR')
    expect(screen.getByText('Нерозподілено')).toBeTruthy()
    expect(screen.getByText(money(33.57)).parentElement?.textContent).toContain('UAH')
    expect(screen.getByText(money(8366.43)).parentElement?.textContent).toContain('UAH')
    expect(within(table).queryByText(money(999999))).toBeNull()
    expect(screen.getByText('Нерозподілена сума не прив’язана до продажів.')).toBeTruthy()
  })
  it('keeps amounts with their junction when server proof rows are reversed', async () => {
    const order = allocationPayment(); order.AllocationSummary!.Rows.reverse(); show(order)
    const rows = within(await screen.findByRole('table')).getAllByRole('row').slice(1)
    expect(within(rows[0]).getByText('SALE-1')).toBeTruthy()
    expect(within(rows[0]).getByText(money(639.84))).toBeTruthy()
    expect(within(rows[0]).queryByText(money(482.98))).toBeNull()
  })
  it.each(['absent', 'unknown', 'mismatched'] as const)('shows unavailable for %s proof and never substitutes sale totals', async mode => {
    const order = allocationPayment()
    if (mode === 'absent') delete order.AllocationSummary
    if (mode === 'unknown') order.AllocationSummary = unknownAllocationSummary()
    if (mode === 'mismatched') order.IncomePaymentOrderSales![0].NetUid = allocationGuid(999)
    show(order)
    const table = await screen.findByRole('table')
    expect(screen.getByText('Суми розподілу не підтверджені. Нерозподілений залишок не визначено.')).toBeTruthy()
    expect(within(table).getAllByText('Не визначено')).toHaveLength(10)
    expect(within(table).queryByText(money(12.281))).toBeNull()
    expect(within(table).queryByText(money(999999))).toBeNull()
    expect(screen.queryByText(money(33.57))).toBeNull()
  })
  it('shows a proven full residual even when no sale is allocated', () => {
    const order = allocationPayment(); order.IncomePaymentOrderSales = []
    order.AllocationSummary = { ...allocationSummary(), Rows: [], AllocatedPaymentAmount: 0, AllocatedAccountingBaseAmount: 0, UnallocatedPaymentAmount: 8400 }
    show(order)
    expect(screen.getByText('Нерозподілено')).toBeTruthy()
    expect(screen.getAllByText(money(0))).toHaveLength(2)
    expect(screen.queryByRole('table')).toBeNull()
  })
  it('does not create an unallocated customer panel for exchange operations', () => {
    const order = allocationPayment(); order.OperationType = 11; order.IncomePaymentOrderSales = []
    order.AllocationSummary = { ...unknownAllocationSummary(), Applicable: false, Reason: 'SaleAllocationNotApplicable' }
    show(order)
    expect(screen.queryByText('Нерозподілено')).toBeNull()
    expect(screen.queryByText('Рахунки та продажі')).toBeNull()
    expect(screen.queryByRole('table')).toBeNull()
  })
})
