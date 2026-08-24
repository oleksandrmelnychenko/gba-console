import { describe, expect, it } from 'vitest'
import type { ClientInDebt } from './types'
import {
  buildIncomeCashflowSaleTargets,
  resolveIncomeCashflowPaymentTargets,
  selectIncomeCashflowDebtTargets,
} from './incomeCashflowDebtTargets'

const debts: ClientInDebt[] = [
  {
    NetUid: 'debt-sale',
    Sale: {
      Id: 11,
      NetUid: 'sale-11',
    },
  },
  {
    NetUid: 'debt-resale',
    ReSale: {
      Id: 22,
      NetUid: 'resale-22',
    },
  },
]

describe('income cash-flow debt targets', () => {
  it('does not silently substitute every visible debt', () => {
    expect(selectIncomeCashflowDebtTargets(debts, [])).toEqual([])
    expect(buildIncomeCashflowSaleTargets(debts, [])).toEqual([])
  })

  it('links a fully covered customer debt when auto allocation is off', () => {
    const debt: ClientInDebt = {
      Debt: { Total: 9533.39 },
      NetUid: 'bug-1172-debt',
      Sale: {
        Id: 1172,
        NetUid: 'bug-1172-sale',
      },
    }

    expect(
      resolveIncomeCashflowPaymentTargets({
        autoAllocate: false,
        debts: [debt],
        paymentAmountInDebtCurrency: 9533.39,
        selectedDebtValues: [],
      }),
    ).toEqual({
      clientDebts: [debt],
      saleTargets: [{ Sale: debt.Sale }],
    })
  })

  it('keeps an ambiguous partial payment on the agreement balance', () => {
    const partialDebts: ClientInDebt[] = [
      {
        Debt: { Total: 6000 },
        NetUid: 'first-debt',
        SaleId: 31,
      },
      {
        Debt: { Total: 3533.39 },
        NetUid: 'second-debt',
        SaleId: 32,
      },
    ]

    expect(
      resolveIncomeCashflowPaymentTargets({
        autoAllocate: false,
        debts: partialDebts,
        paymentAmountInDebtCurrency: 5000,
        selectedDebtValues: [],
      }),
    ).toEqual({
      clientDebts: [],
      saleTargets: [],
    })
  })

  it('targets every verified debt when the payment covers the total or auto allocation is requested', () => {
    const coveredDebts: ClientInDebt[] = [
      {
        Debt: { Total: 6000 },
        NetUid: 'covered-sale',
        SaleId: 41,
      },
      {
        Debt: { Total: 3533.39 },
        NetUid: 'covered-resale',
        ReSaleId: 42,
      },
    ]

    expect(
      resolveIncomeCashflowPaymentTargets({
        autoAllocate: false,
        debts: coveredDebts,
        paymentAmountInDebtCurrency: 9533.39,
        selectedDebtValues: [],
      }).saleTargets,
    ).toEqual([{ SaleId: 41 }, { ReSaleId: 42 }])

    expect(
      resolveIncomeCashflowPaymentTargets({
        autoAllocate: true,
        debts: coveredDebts,
        paymentAmountInDebtCurrency: null,
        selectedDebtValues: [],
      }).saleTargets,
    ).toEqual([{ SaleId: 41 }, { ReSaleId: 42 }])
  })

  it('preserves an explicit target instead of widening it to every debt', () => {
    expect(
      resolveIncomeCashflowPaymentTargets({
        autoAllocate: false,
        debts,
        paymentAmountInDebtCurrency: 999999,
        selectedDebtValues: ['debt-sale'],
      }).saleTargets,
    ).toEqual([{ Sale: debts[0].Sale }])
  })

  it('serializes only explicitly selected sale and resale targets', () => {
    expect(
      buildIncomeCashflowSaleTargets(debts, [
        'debt-sale',
        'debt-resale',
      ]),
    ).toEqual([
      {
        Sale: debts[0].Sale,
      },
      {
        ReSale: debts[1].ReSale,
      },
    ])
  })

  it('serializes the id-only debt shape returned by the agreements endpoint', () => {
    const idOnlyDebts: ClientInDebt[] = [
      {
        AgreementId: 7,
        NetUid: 'id-only-sale',
        SaleId: 31,
      },
      {
        AgreementId: 7,
        NetUid: 'id-only-resale',
        ReSaleId: 32,
      },
    ]

    expect(
      buildIncomeCashflowSaleTargets(idOnlyDebts, [
        'id-only-sale',
        'id-only-resale',
      ]),
    ).toEqual([
      { SaleId: 31 },
      { ReSaleId: 32 },
    ])
  })

  it('never forges server-owned junction amounts', () => {
    const targets = buildIncomeCashflowSaleTargets(debts, [
      'debt-sale',
      'debt-resale',
    ])

    for (const target of targets) {
      expect(target).not.toHaveProperty('Amount')
      expect(target).not.toHaveProperty('ExchangeRate')
      expect(target).not.toHaveProperty('OverpaidAmount')
    }
  })
})
