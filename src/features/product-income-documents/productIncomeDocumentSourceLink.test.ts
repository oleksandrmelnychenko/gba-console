import { describe, expect, it } from 'vitest'
import { getProductIncomeDocumentSourceLink } from './productIncomeDocumentSourceLink'
import type { ProductIncomeDocument } from './types'

describe('getProductIncomeDocumentSourceLink', () => {
  it('links act reconciliation incomes to the act reconciliation detail route', () => {
    const document = incomeDocument({
      ProductIncomeItems: [
        {
          ActReconciliationItem: {
            ActReconciliation: {
              NetUid: 'reconciliation-1',
            },
          },
        },
      ],
    })

    expect(getProductIncomeDocumentSourceLink(document)).toBe('/ukraine/act/reconcoliation/reconciliation-1')
  })

  it('uses the act reconciliation NetUid instead of the income document NetUid', () => {
    const document = incomeDocument({
      NetUid: 'income-1',
      ProductIncomeItems: [
        {
          ActReconciliationItem: {
            ActReconciliation: {
              NetUid: 'reconciliation-1',
            },
          },
        },
      ],
    })

    expect(getProductIncomeDocumentSourceLink(document)).toBe('/ukraine/act/reconcoliation/reconciliation-1')
  })

  it('preserves the supply order product placement link', () => {
    const document = incomeDocument({
      NetUid: 'income-1',
      ProductIncomeItems: [
        {
          PackingListPackageOrderItem: {},
        },
      ],
    })

    expect(getProductIncomeDocumentSourceLink(document)).toBe('/supply-orders/product-placement/income-1')
  })

  it('links supply order placement when the first item has no source data', () => {
    const document = incomeDocument({
      NetUid: 'income-1',
      ProductIncomeItems: [
        {},
        {
          PackingListPackageOrderItem: {},
        },
      ],
    })

    expect(getProductIncomeDocumentSourceLink(document)).toBe('/supply-orders/product-placement/income-1')
  })

  it('preserves the Ukraine supply order product income link', () => {
    const document = incomeDocument({
      NetUid: 'income-1',
      ProductIncomeItems: [
        {
          SupplyOrderUkraineItem: {},
        },
      ],
    })

    expect(getProductIncomeDocumentSourceLink(document)).toBe('/orders/ukraine/income-1/product-income')
  })

  it('links Ukraine supply order income when the first item has no source data', () => {
    const document = incomeDocument({
      NetUid: 'income-1',
      ProductIncomeItems: [
        {},
        {
          SupplyOrderUkraineItem: {},
        },
      ],
    })

    expect(getProductIncomeDocumentSourceLink(document)).toBe('/orders/ukraine/income-1/product-income')
  })

  it('links capitalizations to the exact capitalization document', () => {
    const document = incomeDocument({
      ProductIncomeItems: [
        {
          ProductCapitalizationItem: {
            ProductCapitalization: {
              NetUid: 'capitalization-1',
            },
          },
        },
      ],
    })

    expect(getProductIncomeDocumentSourceLink(document)).toBe('/products/capitalization?netId=capitalization-1')
  })

  it('encodes capitalization NetUid in the source link', () => {
    const document = incomeDocument({
      ProductIncomeItems: [
        {
          ProductCapitalizationItem: {
            ProductCapitalization: {
              NetUid: 'capitalization/1 2',
            },
          },
        },
      ],
    })

    expect(getProductIncomeDocumentSourceLink(document)).toBe('/products/capitalization?netId=capitalization%2F1%202')
  })

  it('does not link sale returns to the create screen', () => {
    const document = incomeDocument({
      ProductIncomeItems: [
        {
          SaleReturnItem: {},
        },
      ],
    })

    expect(getProductIncomeDocumentSourceLink(document)).toBeNull()
  })

  it('preserves null when a non-reconciliation source needs the income document NetUid', () => {
    const document = incomeDocument({
      ProductIncomeItems: [
        {
          PackingListPackageOrderItem: {},
        },
      ],
    })

    expect(getProductIncomeDocumentSourceLink(document)).toBeNull()
  })

  it('ignores deleted income items when resolving the source route', () => {
    const document = incomeDocument({
      NetUid: 'income-1',
      ProductIncomeItems: [
        {
          Deleted: true,
          PackingListPackageOrderItem: {},
        },
        {
          SupplyOrderUkraineItem: {},
        },
      ],
    })

    expect(getProductIncomeDocumentSourceLink(document)).toBe('/orders/ukraine/income-1/product-income')
  })
})

function incomeDocument(document: ProductIncomeDocument): ProductIncomeDocument {
  return document
}
