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
