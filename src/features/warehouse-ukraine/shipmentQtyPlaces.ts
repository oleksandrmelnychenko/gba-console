import type { ShipmentList, ShipmentListItem } from './shipmentTypes'

export class ShipmentQtyPlacesValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ShipmentQtyPlacesValidationError'
  }
}

export function getShipmentQtyPlacesEditKey(item: ShipmentListItem, index: number): string {
  return String(item.NetUid || item.Id || index)
}

export function applyShipmentQtyPlacesEdits(
  shipmentList: ShipmentList,
  qtyEdits: Readonly<Record<string, string>>,
): ShipmentList {
  let hasChanges = false
  const shipmentListItems = shipmentList.ShipmentListItems.map((item, index) => {
    const draft = qtyEdits[getShipmentQtyPlacesEditKey(item, index)]

    if (draft === undefined) {
      return item
    }

    const qtyPlaces = Number.parseInt(draft, 10)

    if (!Number.isFinite(qtyPlaces) || qtyPlaces < 0) {
      throw new ShipmentQtyPlacesValidationError(
        'Кількість місць має бути скінченним невід’ємним числом',
      )
    }

    if (qtyPlaces === item.QtyPlaces) {
      return item
    }

    hasChanges = true

    return {
      ...item,
      IsDirty: true,
      QtyPlaces: qtyPlaces,
    }
  })

  return hasChanges ? { ...shipmentList, ShipmentListItems: shipmentListItems } : shipmentList
}

export function buildShipmentCarryOutPayload(
  shipmentList: ShipmentList,
  qtyEdits: Readonly<Record<string, string>>,
): ShipmentList {
  return {
    ...applyShipmentQtyPlacesEdits(shipmentList, qtyEdits),
    IsSent: true,
  }
}
