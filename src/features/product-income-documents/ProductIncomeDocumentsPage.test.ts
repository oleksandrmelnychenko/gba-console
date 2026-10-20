import { describe, expect, it } from 'vitest'
import type { ProductIncomeDocument } from './types'
import {
  getIncomeReturnTotals,
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
      type: 'Прихідна накладна на Україну',
    })
  })

  it('uses Ukraine supply order item product data in document item rows', () => {
    const document = incomeDocument({
      ProductIncomeItems: [
        {
          SupplyOrderUkraineItem: {
            Product: {
              Name: 'Ukraine product',
              VendorCode: 'UK-100',
            },
          },
        },
      ],
    })
    const item = document.ProductIncomeItems?.[0]

    expect(item ? getItemProductCode(item) : undefined).toBe('UK-100')
    expect(item ? getItemProductName(item) : undefined).toBe('Ukraine product')
  })

  it('maps Ukraine supply order date and customs date like legacy', () => {
    const document = incomeDocument({
      ProductIncomeItems: [
        {
          SupplyOrderUkraineItem: {
            SupplyOrderUkraine: {
              FromDate: '2026-06-01T10:00:00Z',
              InvDate: '2026-06-03T12:00:00Z',
              InvNumber: 'UK-INV-1',
            },
          },
        },
      ],
    })

    const row = mapDocumentRow(document)

    expect(row).toMatchObject({
      invDate: '2026-06-01T10:00:00Z',
      invNumber: 'UK-INV-1',
      specificationDate: '2026-06-03T12:00:00Z',
      type: 'Прихідна накладна на Україну',
    })
  })

  it('keeps Ukraine-source reconciliation order date and customs date split', () => {
    const document = incomeDocument({
      ProductIncomeItems: [
        {
          ActReconciliationItem: {
            ActReconciliation: {
              FromDate: '2026-06-01T10:00:00Z',
              InvDate: '2026-06-04T12:00:00Z',
              InvNumber: 'ACT-UK-1',
              SupplyOrderUkraine: {
                FromDate: '2026-06-02T10:00:00Z',
                InvDate: '2026-06-05T12:00:00Z',
                InvNumber: 'UK-INV-2',
              },
            },
          },
        },
      ],
    })

    const row = mapDocumentRow(document)

    expect(row).toMatchObject({
      invDate: '2026-06-02T10:00:00Z',
      invNumber: 'UK-INV-2',
      specificationDate: '2026-06-05T12:00:00Z',
      type: 'Прихідна накладна на Україну',
    })
  })

  it('falls back to net price for resident packing invoices without VAT total', () => {
    const document = incomeDocument({
      TotalNetPrice: 1250,
      ProductIncomeItems: [
        {
          PackingListPackageOrderItem: {
            PackingList: {
              SupplyInvoice: {
                SupplyOrder: {
                  Client: {
                    IsNotResident: false,
                    Name: 'Resident supplier',
                  },
                },
              },
            },
          },
        },
      ],
    })

    expect(mapDocumentRow(document).amount).toBe(1250)
  })

  it('keeps VAT total preferred for resident packing invoices', () => {
    const document = incomeDocument({
      TotalNetPrice: 1250,
      TotalNetWithVat: 1500,
      ProductIncomeItems: [
        {
          PackingListPackageOrderItem: {
            PackingList: {
              SupplyInvoice: {
                SupplyOrder: {
                  Client: {
                    IsNotResident: false,
                  },
                },
              },
            },
          },
        },
      ],
    })

    expect(mapDocumentRow(document).amount).toBe(1500)
  })

  it('uses net price for non-resident packing invoices', () => {
    const document = incomeDocument({
      TotalNetPrice: 1250,
      TotalNetWithVat: 1500,
      ProductIncomeItems: [
        {
          PackingListPackageOrderItem: {
            PackingList: {
              SupplyInvoice: {
                SupplyOrder: {
                  Client: {
                    IsNotResident: true,
                  },
                },
              },
            },
          },
        },
      ],
    })

    expect(mapDocumentRow(document).amount).toBe(1250)
  })
})

describe('income return totals', () => {
  it('uses the partial returned lines instead of stale original-order document totals', () => {
    const document = incomeDocument({
      TotalNetPrice: 9999,
      TotalNetWithVat: 11998.8,
      TotalQty: 100,
      Currency: { Code: 'UAH' },
      ProductIncomeItems: [
        {
          Qty: 50,
          SaleReturnItem: {
            Amount: 50.34,
            AmountLocal: 0,
            Qty: 1,
            SaleReturn: { Number: 'RETURN-PARTIAL' },
            OrderItem: { Order: { Sale: { ClientAgreement: { Agreement: { Currency: { Code: 'UAH' } } } } } },
          },
        },
        { Qty: 50, SaleReturnItem: { Amount: 6.13, AmountLocal: 0, Qty: 2 } },
      ],
    })

    expect(getIncomeReturnTotals(document).amount).toBeCloseTo(56.47, 8)
    expect(getIncomeReturnTotals(document)).toMatchObject({ qty: 3, currency: 'EUR' })
    const row = mapDocumentRow(document)
    expect(row.amount).toBeCloseTo(56.47, 8)
    expect(row).toMatchObject({ qty: 3, currency: 'EUR', invNumber: 'RETURN-PARTIAL' })
  })

  it('excludes deleted return lines and unrelated inventory lines', () => {
    const document = incomeDocument({ ProductIncomeItems: [
      { Deleted: true, Qty: 999, SaleReturnItem: { Amount: 999, Qty: 999 } },
      { Qty: 300, Product: { Name: 'Unrelated inventory' } },
      { Qty: 2.5, SaleReturnItem: { Amount: 12.5, SaleReturn: { Number: 'RETURN-ACTIVE' } } },
    ] })
    expect(getIncomeReturnTotals(document)).toEqual({ amount: 12.5, qty: 2.5, currency: 'EUR' })
    expect(mapDocumentRow(document)).toMatchObject({ amount: 12.5, qty: 2.5 })
  })

  it('preserves real zero amounts and quantities instead of substituting document totals', () => {
    const document = incomeDocument({ TotalNetPrice: 900, TotalQty: 99, ProductIncomeItems: [
      { Qty: 99, SaleReturnItem: { Amount: 0, Qty: 0, SaleReturn: { Number: 'ZERO' } } },
    ] })
    expect(getIncomeReturnTotals(document)).toEqual({ amount: 0, qty: 0, currency: 'EUR' })
    expect(mapDocumentRow(document)).toMatchObject({ amount: 0, qty: 0, currency: 'EUR' })
  })

  it.each([undefined, Number.NaN, Number.POSITIVE_INFINITY])('keeps an incomplete amount unknown (%s) rather than presenting a partial sum', (amount) => {
    const document = incomeDocument({ TotalNetPrice: 999, ProductIncomeItems: [
      { SaleReturnItem: { Amount: 10, Qty: 1, SaleReturn: { Number: 'INCOMPLETE' } } },
      { SaleReturnItem: { Amount: amount, Qty: 2 } },
    ] })
    expect(getIncomeReturnTotals(document)).toEqual({ amount: undefined, qty: 3, currency: 'EUR' })
    expect(mapDocumentRow(document).amount).toBeUndefined()
  })

  it('keeps missing quantities unknown without discarding the independently known amount', () => {
    expect(getIncomeReturnTotals(incomeDocument({ TotalQty: 99, ProductIncomeItems: [
      { SaleReturnItem: { Amount: 10, Qty: 1 } },
      { SaleReturnItem: { Amount: 20 } },
    ] }))).toEqual({ amount: 30, qty: undefined, currency: 'EUR' })
  })

  it('does not turn an empty active return set into a zero-valued document', () => {
    expect(getIncomeReturnTotals(incomeDocument({ TotalNetPrice: 100, TotalQty: 5, ProductIncomeItems: [
      { Deleted: true, SaleReturnItem: { Amount: 100, Qty: 5 } },
    ] }))).toEqual({ amount: undefined, qty: undefined, currency: 'EUR' })
  })
})

function incomeDocument(document: ProductIncomeDocument): ProductIncomeDocument {
  return document
}
