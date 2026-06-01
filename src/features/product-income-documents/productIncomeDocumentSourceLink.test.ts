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
})

function incomeDocument(document: ProductIncomeDocument): ProductIncomeDocument {
  return document
}
