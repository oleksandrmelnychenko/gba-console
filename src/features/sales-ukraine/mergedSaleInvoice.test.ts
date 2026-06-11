import { describe, expect, it } from 'vitest'
import {
  buildMergedSaleInvoiceDrafts,
  buildMergedSaleInvoicePayload,
  hasCurrentUnmergedSale,
  hasMergedMainClient,
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

describe('merged sale main client guards', () => {
  it('detects a main client only when a merge client is neither sub-client nor trade point', () => {
    expect(hasMergedMainClient([])).toBe(false)
    expect(
      hasMergedMainClient([
        { InputSale: saleForClient({ IsSubClient: true, IsTradePoint: false }) },
        { InputSale: saleForClient({ IsSubClient: false, IsTradePoint: true }) },
      ]),
    ).toBe(false)
    expect(
      hasMergedMainClient([
        { InputSale: saleForClient({ IsSubClient: true, IsTradePoint: false }) },
        { InputSale: saleForClient({ IsSubClient: false, IsTradePoint: false }) },
      ]),
    ).toBe(true)
    expect(hasMergedMainClient([{ InputSale: { NetUid: 'sale-1' } }])).toBe(false)
  })

  it('treats only a sale body with positive id as a current unmerged sale', () => {
    expect(hasCurrentUnmergedSale(null)).toBe(false)
    expect(hasCurrentUnmergedSale(undefined)).toBe(false)
    expect(hasCurrentUnmergedSale({})).toBe(false)
    expect(hasCurrentUnmergedSale({ Id: 0 })).toBe(false)
    expect(hasCurrentUnmergedSale({ Id: 17 })).toBe(true)
  })
})

function saleForClient(client: { IsSubClient: boolean; IsTradePoint: boolean }): SalesUkraineSale {
  return { ClientAgreement: { Client: client } } as SalesUkraineSale
}

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
