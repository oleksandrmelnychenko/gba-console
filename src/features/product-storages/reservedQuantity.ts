import type { ProductStorageAvailability } from './types'

/**
 * Stock reserved by open bills on this storage: the physical stock in lots (LotQty) minus the free part (Amount).
 * Amount is the free quantity («Вільно») — the same number sales and write-offs check; «Наявність» and «Залишки по
 * партіям» show the physical quantity, so the storage page shows both and the difference as «Резерв».
 */
export function getReservedQuantity(availability: ProductStorageAvailability): number {
  const lots = typeof availability.LotQty === 'number' && Number.isFinite(availability.LotQty) ? availability.LotQty : null
  const free = typeof availability.Amount === 'number' && Number.isFinite(availability.Amount) ? availability.Amount : 0

  if (lots === null) {
    return 0
  }

  const reserved = lots - free
  return reserved > 0.0005 ? Math.round(reserved * 1000) / 1000 : 0
}
