import { describe, expect, it } from 'vitest'
import type { ClientInDebt } from './types'
import {
  buildIncomeCashflowSaleTargets,
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
