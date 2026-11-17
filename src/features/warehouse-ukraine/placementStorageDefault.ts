import type { PlacementStorage } from './placementsTypes'

/**
 * Which storage the «Склад» select of an order placement starts with.
 *
 * «Оприходувати» sends the goods to whatever is selected, so the select never
 * falls back to "the first storage in the list": that silently sent the rest
 * of a partly received order to another storage. The order of preference is
 * the user's own pick (kept across reloads), then the storage this order has
 * already been received to; with neither, nothing is selected and the income
 * actions stay disabled until the user picks.
 */
export function resolvePlacementStorageId(
  currentStorageNetId: string | null | undefined,
  storages: PlacementStorage[],
  receivedStorageNetId: string | null | undefined,
): string | null {
  return findStorageNetId(storages, currentStorageNetId) ?? findStorageNetId(storages, receivedStorageNetId)
}

function findStorageNetId(storages: PlacementStorage[], netId: string | null | undefined): string | null {
  const wanted = netId?.trim().toLowerCase()

  if (!wanted) {
    return null
  }

  return storages.find((storage) => storage.NetUid?.toLowerCase() === wanted)?.NetUid || null
}
