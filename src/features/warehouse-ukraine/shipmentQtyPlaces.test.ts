import { describe, expect, it } from 'vitest'
import type { ShipmentList } from './shipmentTypes'
import {
  buildShipmentCarryOutPayload,
  getShipmentQtyPlacesEditKey,
} from './shipmentQtyPlaces'

describe('warehouse Ukraine shipment carry-out quantity contract', () => {
  it('carries out with the pending table value 5 instead of the previously persisted 0', () => {
    const shipmentList = shipment(0)
    const item = shipmentList.ShipmentListItems[0]

    const payload = buildShipmentCarryOutPayload(shipmentList, {
      [getShipmentQtyPlacesEditKey(item, 0)]: '5',
    })

    expect(payload.IsSent).toBe(true)
    expect(payload.ShipmentListItems[0]).toMatchObject({
      IsDirty: true,
      QtyPlaces: 5,
    })
    expect(shipmentList.ShipmentListItems[0].QtyPlaces).toBe(0)
  })

  it('keeps an explicitly entered zero as zero when carrying out', () => {
    const shipmentList = shipment(5)
    const item = shipmentList.ShipmentListItems[0]

    const payload = buildShipmentCarryOutPayload(shipmentList, {
      [getShipmentQtyPlacesEditKey(item, 0)]: '0',
    })

    expect(payload.IsSent).toBe(true)
    expect(payload.ShipmentListItems[0]).toMatchObject({
      IsDirty: true,
      QtyPlaces: 0,
    })
  })
})

function shipment(qtyPlaces: number): ShipmentList {
  return {
    Id: 10,
    NetUid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    IsSent: false,
    ShipmentListItems: [
      {
        Id: 30,
        NetUid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        QtyPlaces: qtyPlaces,
        Sale: {
          Id: 20,
          NetUid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        },
      },
    ],
  }
}
