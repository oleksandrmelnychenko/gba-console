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

  it('refuses zero, fractions, exponents and more than 9999 places instead of truncating them (WH2-01)', () => {
    const shipmentList = shipment(5)
    const key = getShipmentQtyPlacesEditKey(shipmentList.ShipmentListItems[0], 0)

    expect(() => buildShipmentCarryOutPayload(shipmentList, { [key]: '0' })).toThrow('Кількість місць має бути не менше 1')
    expect(() => buildShipmentCarryOutPayload(shipmentList, { [key]: '2.5' })).toThrow('Кількість місць має бути цілим числом')
    expect(() => buildShipmentCarryOutPayload(shipmentList, { [key]: '1e3' })).toThrow('Кількість місць має бути цілим числом')
    expect(() => buildShipmentCarryOutPayload(shipmentList, { [key]: '99999999999' })).toThrow('Кількість місць має бути не більше 9999')
    expect(() => buildShipmentCarryOutPayload(shipmentList, { [key]: '-3' })).toThrow('Кількість місць не може бути від’ємною')
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
