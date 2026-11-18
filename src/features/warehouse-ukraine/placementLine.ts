import { translate } from '../../shared/i18n/translate'
import { formatPlacementAddress } from '../../shared/placements/placementAddress'

type PlacementLineSource = {
  CellNumber?: string | null
  Qty?: number | null
  RowNumber?: string | null
  StorageNumber?: string | null
}

const quantityFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3 })

/**
 * One placement of an order line, worded like the storages page (WH2-24):
 * «Без розміщення. Кількість 5» / «Позиція A-1-2. Кількість 3» instead of «N-N-N - 5».
 */
export function formatOrderPlacementLine(placement: PlacementLineSource): string {
  const address = formatPlacementAddress(placement)
  const qty = typeof placement.Qty === 'number' && Number.isFinite(placement.Qty) ? placement.Qty : 0
  const quantity = `${translate('Кількість')} ${quantityFormatter.format(qty)}`

  if (!address) {
    return quantity
  }

  return address === translate('Без розміщення')
    ? `${address}. ${quantity}`
    : `${translate('Позиція')} ${address}. ${quantity}`
}
