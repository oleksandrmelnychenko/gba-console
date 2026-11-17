import { translate } from '../i18n/translate'

type PlacementParts = {
  CellNumber?: string | null
  RowNumber?: string | null
  StorageNumber?: string | null
}

const NO_PLACEMENT_PART = 'N'

/**
 * Readable placement address «стелаж-ряд-комірка». The server's default
 * no-location placement is stored as N-N-N; users see «Без розміщення».
 */
export function formatPlacementAddress(placement: PlacementParts | null | undefined): string {
  if (!placement) {
    return ''
  }

  const parts = [placement.StorageNumber, placement.RowNumber, placement.CellNumber]
    .map((part) => (part ?? '').trim())
    .filter(Boolean)

  if (parts.length === 0) {
    return ''
  }

  if (parts.every((part) => part.toUpperCase() === NO_PLACEMENT_PART)) {
    return translate('Без розміщення')
  }

  return parts.join('-')
}

type PlacementQty = {
  address: string
  qty: number
}

/**
 * One entry per address with the quantities added up: a lot split over two
 * «N-N-N» rows reads «Без розміщення: 1», not «Без розміщення: 0,5, Без
 * розміщення: 0,5». Entries keep their first-seen order.
 */
export function mergePlacementQuantities<T>(
  entries: readonly T[],
  getPlacement: (entry: T) => PlacementParts | null | undefined,
  getQty: (entry: T) => number | null | undefined,
): PlacementQty[] {
  const merged = new Map<string, PlacementQty>()

  for (const entry of entries) {
    const address = formatPlacementAddress(getPlacement(entry))
    const qty = getQty(entry)
    const current = merged.get(address) || { address, qty: 0 }

    current.qty = Math.round((current.qty + (typeof qty === 'number' && Number.isFinite(qty) ? qty : 0)) * 1000) / 1000
    merged.set(address, current)
  }

  return Array.from(merged.values())
}
