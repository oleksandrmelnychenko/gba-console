import type { ShipmentList, ShipmentListItem } from './shipmentTypes'

export class ShipmentQtyPlacesValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ShipmentQtyPlacesValidationError'
  }
}

export const SHIPMENT_QTY_PLACES_MAX = 9999

/**
 * «К-сть місць» is a whole number of parcels from 1 to 9999. Returns the
 * Ukrainian reason when the typed text is not; «2.5» and «1e3» are refused,
 * never truncated to 2 / 1.
 */
export function getQtyPlacesError(value: string | number | null | undefined): string | null {
  const text = typeof value === 'number' ? String(value) : (value ?? '').trim()

  if (!text) {
    return null
  }

  if (/^-/.test(text)) {
    return 'Кількість місць не може бути від’ємною'
  }

  if (!/^\d+$/.test(text)) {
    return 'Кількість місць має бути цілим числом'
  }

  const qty = Number(text)

  if (qty < 1) {
    return 'Кількість місць має бути не менше 1'
  }

  return qty > SHIPMENT_QTY_PLACES_MAX ? 'Кількість місць має бути не більше 9999' : null
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

    const qtyPlacesError = draft.trim() ? getQtyPlacesError(draft) : 'Кількість місць має бути не менше 1'

    if (qtyPlacesError) {
      throw new ShipmentQtyPlacesValidationError(qtyPlacesError)
    }

    const qtyPlaces = Number(draft.trim())

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
