import { describe, expect, it } from 'vitest'
import { allocationGuid, allocationPayment, allocationSummary, unknownAllocationSummary } from './incomePaymentAllocationTestData'
import { incomePaymentAllocationView, normalizeIncomePaymentAllocationSummary } from './incomePaymentAllocationSummary'

describe('typed income allocation proof', () => {
  it('preserves separate source UAH and accounting EUR amounts without deriving conversion', () => {
    const order = allocationPayment(), view = incomePaymentAllocationView(order)
    expect(view.summary?.AllocatedPaymentAmount).toBe(8366.43)
    expect(view.summary?.UnallocatedPaymentAmount).toBe(33.57)
    expect(view.allocation(order.IncomePaymentOrderSales![0])).toMatchObject({ PaymentAmount: 639.84, AccountingBaseAmount: 12.281 })
  })
  it('matches by stable junction identity after source or UI row order changes', () => {
    const order = allocationPayment(); order.AllocationSummary!.Rows.reverse(); order.IncomePaymentOrderSales!.reverse()
    const view = incomePaymentAllocationView(order)
    expect(view.allocation(order.IncomePaymentOrderSales![0])?.PaymentAmount).toBe(482.98)
  })
  it.each(['missing', 'duplicate', 'extra', 'sale-drift'] as const)('rejects %s row identity rather than matching by position', mode => {
    const order = allocationPayment()
    if (mode === 'missing') order.IncomePaymentOrderSales![0].NetUid = undefined
    if (mode === 'duplicate') order.IncomePaymentOrderSales![0].NetUid = order.IncomePaymentOrderSales![1].NetUid
    if (mode === 'extra') order.IncomePaymentOrderSales!.push({ NetUid: allocationGuid(999), Amount: 1 })
    if (mode === 'sale-drift') order.IncomePaymentOrderSales![0].Sale!.NetUid = allocationGuid(999)
    expect(incomePaymentAllocationView(order).summary).toBeNull()
    expect(incomePaymentAllocationView(order).allocation(order.IncomePaymentOrderSales![0])).toBeNull()
  })
  it('rejects changed header amount or currency', () => {
    const order = allocationPayment(); order.Amount = 8401
    expect(incomePaymentAllocationView(order).summary).toBeNull()
    order.Amount = 8400; order.Currency = { Code: 'EUR' }
    expect(incomePaymentAllocationView(order).summary).toBeNull()
  })
  it('normalizes only currency code casing, never currency or FX itself', () => {
    const order = allocationPayment(); order.Currency = { Code: ' uah ' }
    expect(incomePaymentAllocationView(order).summary?.PaymentCurrencyCode).toBe('UAH')
  })
  it('unknown proof stays unknown despite legacy amount, EUR amount or sale total', () => {
    const order = allocationPayment(); order.AllocationSummary = unknownAllocationSummary(); order.EuroAmount = 200
    expect(incomePaymentAllocationView(order)).toMatchObject({ applicable: true, summary: null })
    expect(incomePaymentAllocationView(order).allocation(order.IncomePaymentOrderSales![0])).toBeNull()
  })
  it('not-applicable FX does not become an unallocated customer payment', () => {
    const order = allocationPayment(); order.OperationType = 11; order.IncomePaymentOrderSales = []
    order.AllocationSummary = { ...unknownAllocationSummary(), Applicable: false, Reason: 'SaleAllocationNotApplicable' }
    expect(incomePaymentAllocationView(order).applicable).toBe(false)
  })
  it('known zero allocation and full residual remain explicit zero and full amount', () => {
    const order = allocationPayment(); order.IncomePaymentOrderSales = []
    order.AllocationSummary = { ...allocationSummary(), Rows: [], AllocatedPaymentAmount: 0, AllocatedAccountingBaseAmount: 0, UnallocatedPaymentAmount: 8400 }
    expect(incomePaymentAllocationView(order).summary?.AllocatedPaymentAmount).toBe(0)
    expect(incomePaymentAllocationView(order).summary?.UnallocatedPaymentAmount).toBe(8400)
  })
  it.each([NaN, Infinity, -1, '12.3', null])('rejects nonmonetary known totals: %s', value => {
    expect(normalizeIncomePaymentAllocationSummary({ ...allocationSummary(), UnallocatedPaymentAmount: value })).toBeNull()
  })
  it('rejects duplicate proof identities, fake EUR residual and mixed known flags', () => {
    const duplicate = allocationSummary(); duplicate.Rows[1].AllocationNetUid = duplicate.Rows[0].AllocationNetUid
    expect(normalizeIncomePaymentAllocationSummary(duplicate)).toBeNull()
    const residual = allocationSummary(); residual.Rows[5].AccountingBaseAmount = 1
    expect(normalizeIncomePaymentAllocationSummary(residual)).toBeNull()
    expect(normalizeIncomePaymentAllocationSummary({ ...allocationSummary(), PaymentAmountsKnown: false })).toBeNull()
    expect(normalizeIncomePaymentAllocationSummary({ ...unknownAllocationSummary(), AllocatedPaymentAmount: 0 })).toBeNull()
  })
  it('does not accept amounts without their currency or an invented base currency', () => {
    expect(normalizeIncomePaymentAllocationSummary({ ...allocationSummary(), PaymentCurrencyCode: '' })).toBeNull()
    expect(normalizeIncomePaymentAllocationSummary({ ...allocationSummary(), AccountingBaseCurrencyCode: 'UAH' })).toBeNull()
    expect(normalizeIncomePaymentAllocationSummary({ ...allocationSummary(), PaymentCurrencyCode: 'XYZ' })).toBeNull()
    expect(normalizeIncomePaymentAllocationSummary({ ...allocationSummary(), PaymentCurrencyCode: 'XXX' })).toBeNull()
  })
})
