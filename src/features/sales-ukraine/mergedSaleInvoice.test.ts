import { describe, expect, it } from 'vitest'
import {
  buildMergedSaleInvoiceDrafts,
  buildMergedSaleInvoicePayload,
  hasSelectedMergedSaleItems,
} from './mergedSaleInvoice'
import type { SalesUkraineSale } from './types'

describe('merged sale invoice helpers', () => {
  it('initializes merged-sale drafts with every item selected at its sale quantity', () => {
    const drafts = buildMergedSaleInvoiceDrafts([{ InputSale: saleWithItems('sale-1', [2, 3]) }])

    expect(drafts['sale-1']).toEqual({
      selected: true,
      items: {
        'item-0': { selected: true, qty: 2 },
        'item-1': { selected: true, qty: 3 },
      },
    })
  })

  it('builds a partial invoice payload with only selected rows and edited quantities', () => {
    const sale = saleWithItems('sale-1', [5, 4])
    const payload = buildMergedSaleInvoicePayload(sale, {
      selected: true,
      items: {
        'item-0': { selected: true, qty: '2' },
        'item-1': { selected: false, qty: 4 },
      },
    })

    expect(payload.Order?.OrderItems).toHaveLength(1)
    expect(payload.Order?.OrderItems?.[0]).toMatchObject({ NetUid: 'item-0', Qty: 2 })
    expect(sale.Order?.OrderItems?.[0].Qty).toBe(5)
  })

  it('reports no invoiceable rows when all merged-sale items are cleared', () => {
    const sale = saleWithItems('sale-1', [1])

    expect(
      hasSelectedMergedSaleItems(sale, {
        selected: false,
        items: { 'item-0': { selected: false, qty: 1 } },
      }),
    ).toBe(false)
  })
})

function saleWithItems(netUid: string, quantities: number[]): SalesUkraineSale {
  return {
    NetUid: netUid,
    Order: {
      OrderItems: quantities.map((qty, index) => ({
        NetUid: `item-${index}`,
        Product: { NetUid: `product-${index}` },
        Qty: qty,
      })),
    },
  }
}
