import { describe, expect, it } from 'vitest'
import type { ProductIncomeDocument } from './types'
import {
  getItemProductCode,
  getItemProductName,
  getOverviewKind,
  mapDocumentRow,
} from './productIncomeDocumentRows'

describe('ProductIncomeDocumentsPage helpers', () => {
  it('keeps thin act reconciliation incomes in the act reconciliation flow', () => {
    const document = incomeDocument({
      FromDate: '2026-06-02T10:00:00Z',
      Number: 'PI-100',
      Storage: {
        Organization: {
          Name: 'Concord',
        },
      },
      ProductIncomeItems: [
        {
          Qty: 4,
          ActReconciliationItem: {
            Comment: 'act-row',
            Product: {
              Name: 'Act product',
              VendorCode: 'ACT-1',
            },
          },
        },
      ],
    })
    const item = document.ProductIncomeItems?.[0]

    expect(getOverviewKind(document)).toBe('actReconciliation')
    expect(item ? getItemProductCode(item) : undefined).toBe('ACT-1')
    expect(item ? getItemProductName(item) : undefined).toBe('Act product')
    expect(mapDocumentRow(document)).toMatchObject({
      comment: 'act-row',
      invDate: '2026-06-02T10:00:00Z',
      invNumber: 'PI-100',
      organization: 'Concord',
      qty: 4,
      type: 'Акт звірки',
    })
  })

  it('ignores deleted income items when deriving overview kind and row data', () => {
    const document = incomeDocument({
      NetUid: 'income-1',
      ProductIncomeItems: [
        {
          Deleted: true,
          PackingListPackageOrderItem: {
            Qty: 99,
          },
        },
        {
          Qty: 3,
          SupplyOrderUkraineItem: {
            SupplyOrderUkraine: {
              InvNumber: 'UK-1',
              Supplier: {
                Name: 'Supplier',
              },
            },
          },
        },
      ],
    })

    expect(getOverviewKind(document)).toBe('document')
    expect(mapDocumentRow(document)).toMatchObject({
      client: 'Supplier',
      invNumber: 'UK-1',
      qty: 3,
      type: 'Прихідний інвойс в Україну',
    })
  })
})

function incomeDocument(document: ProductIncomeDocument): ProductIncomeDocument {
  return document
}
