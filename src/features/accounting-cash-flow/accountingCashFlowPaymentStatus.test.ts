import { describe, expect, it } from 'vitest'
import {
  getAccountingCashFlowPaymentStatus,
  getAccountingCashFlowRecordPaymentStatus,
} from './accountingCashFlowPaymentStatus'

describe('accounting cash flow payment status', () => {
  it('reads sale invoice payment status from selected cash-flow documents', () => {
    expect(
      getAccountingCashFlowPaymentStatus({
        Sale: {
          BaseSalePaymentStatus: {
            SalePaymentStatusType: 0,
          },
        },
      })?.label,
    ).toBe('Не оплачено')

    expect(
      getAccountingCashFlowPaymentStatus({
        Sale: {
          BaseSalePaymentStatus: {
            SalePaymentStatusType: '1',
          },
        },
      })?.label,
    ).toBe('Оплачено')

    expect(
      getAccountingCashFlowPaymentStatus({
        Sale: {
          BaseSalePaymentStatus: {
            SalePaymentStatusType: 3,
          },
        },
      })?.label,
    ).toBe('Оплачено частково')
  })

  it('reads resale and payment task status variants without exposing raw enum values', () => {
    expect(
      getAccountingCashFlowPaymentStatus({
        UpdatedReSaleModel: {
          BaseSalePaymentStatus: {
            SalePaymentStatusType: 2,
          },
        },
      })?.kind,
    ).toBe('paid')

    expect(
      getAccountingCashFlowPaymentStatus({
        SupplyPaymentTask: {
          IsPayed: false,
        },
      })?.kind,
    ).toBe('unpaid')

    expect(
      getAccountingCashFlowRecordPaymentStatus({
        InvoiceStatus: 'PartialPaid',
      })?.kind,
    ).toBe('partial')
  })

  it('does not guess a payment status when the backend does not provide payment fields', () => {
    expect(
      getAccountingCashFlowPaymentStatus({
        CurrentValue: 100,
        Name: 'Неоплачена накладна без явного payment поля',
        Type: 13,
      }),
    ).toBeNull()
  })
})
