import { describe, expect, it } from 'vitest'
import type { ShipmentList, ShipmentSale } from './shipmentTypes'
import {
  appendManualShipmentSales,
  getShipmentSaleKey,
  isValidManualQtyPlaces,
} from './shipmentManualSelection'

function sale(NetUid: string, Id: number): ShipmentSale {
  return { Id, NetUid, SaleNumber: { Value: NetUid } }
}

describe('shipment manual selection', () => {
  it('uses sale NetUid as the stable dedupe key', () => {
    expect(getShipmentSaleKey(sale('sale-1', 10))).toBe('sale-1')
  })

  it('appends selected sales as dirty shipment rows with requested place qty', () => {
    const shipmentList: ShipmentList = {
      ShipmentListItems: [{ QtyPlaces: 1, Sale: sale('existing-sale', 1) }],
    }

    const result = appendManualShipmentSales(shipmentList, [sale('new-sale', 2)], { 'new-sale': '3' })

    expect(result.appendedCount).toBe(1)
    expect(result.shipmentList.ShipmentListItems).toHaveLength(2)
    expect(result.shipmentList.ShipmentListItems[1]).toMatchObject({
      IsDirty: true,
      QtyPlaces: 3,
      Sale: { NetUid: 'new-sale' },
    })
  })

  it('skips duplicate sales already present in the shipment draft', () => {
    const existingSale = sale('same-sale', 1)
    const shipmentList: ShipmentList = {
      ShipmentListItems: [{ QtyPlaces: 1, Sale: existingSale }],
    }

    const result = appendManualShipmentSales(shipmentList, [existingSale, sale('new-sale', 2)])

    expect(result.appendedCount).toBe(1)
    expect(result.skippedDuplicateCount).toBe(1)
    expect(result.shipmentList.ShipmentListItems.map((item) => item.Sale.NetUid)).toEqual(['same-sale', 'new-sale'])
  })

  it('rejects invalid manual place quantities before append', () => {
    expect(isValidManualQtyPlaces('0')).toBe(true)
    expect(isValidManualQtyPlaces('12')).toBe(true)
    expect(isValidManualQtyPlaces('-1')).toBe(false)
    expect(isValidManualQtyPlaces('abc')).toBe(false)
  })
})
