import type { ProductStorageAvailability } from './types'

/** Label shown next to a soft-deleted product that still has stock on the storage. */
export const DELETED_PRODUCT_LABEL = 'видалений'

/**
 * A product deleted from the catalog while it still had stock stays on the storage page (and in «Залишки по
 * партіям»), marked so the user can see why it is no longer in the catalog.
 */
export function isDeletedProductAvailability(availability: ProductStorageAvailability | null | undefined): boolean {
  return availability?.Product?.Deleted === true
}
