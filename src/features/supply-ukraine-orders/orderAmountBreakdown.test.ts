import { describe, expect, it } from 'vitest'
import {
  getDirectOrderAmountBreakdown,
  getInvoiceAmountBreakdown,
  getPackingListAmountBreakdown,
  getToUkraineOrderAmountBreakdown,
} from './orderAmountBreakdown'

describe('order amount breakdowns', () => {
  it('keeps net, VAT and VAT-inclusive totals distinct for direct orders', () => {
    expect(getDirectOrderAmountBreakdown({
      TotalNetPrice: 8471.10,
      TotalVat: 1694.22,
    })).toEqual({
      net: 8471.10,
      vat: 1694.22,
      withVat: 10165.32,
    })
  })

  it('prefers the explicit VAT-inclusive invoice total', () => {
    expect(getInvoiceAmountBreakdown({
      NetPrice: 99999,
      TotalNetPrice: 8471.10,
      TotalNetPriceWithVat: 0,
      TotalVatAmount: 1694.22,
      TotalValueWithVat: 10165.32,
    })).toEqual({
      net: 8471.10,
      vat: 1694.22,
      withVat: 10165.32,
    })
  })

  it('uses the hydrated detail total when the list-only total is zero', () => {
    expect(getInvoiceAmountBreakdown({
      TotalNetPrice: 8471.10,
      TotalNetPriceWithVat: 10165.32,
      TotalVatAmount: 1694.22,
      TotalValueWithVat: 0,
    })).toEqual({
      net: 8471.10,
      vat: 1694.22,
      withVat: 10165.32,
    })
  })

  it('uses explicit packing-list VAT totals without relabelling gross cost', () => {
    expect(getPackingListAmountBreakdown({
      TotalGrossPrice: 9000,
      TotalNetPrice: 8471.10,
      TotalNetPriceWithVat: 10165.32,
      TotalVatAmount: 1694.22,
    })).toEqual({
      net: 8471.10,
      vat: 1694.22,
      withVat: 10165.32,
    })
  })

  it('returns comparable invoice totals for orders to Ukraine', () => {
    expect(getToUkraineOrderAmountBreakdown({
      TotalGrossPriceLocal: 11000,
      TotalNetPriceLocal: 8471.10,
      TotalNetPriceLocalWithVat: 10165.32,
      TotalVatAmount: 1694.22,
    })).toEqual({
      net: 8471.10,
      vat: 1694.22,
      withVat: 10165.32,
    })
  })
})
