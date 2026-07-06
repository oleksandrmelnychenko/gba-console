import type { DirectSalesReturnProduct, SalesReturnItemStatusValue, SalesReturnStorage } from './types'

const DEFECT_RETURN_STATUS: SalesReturnItemStatusValue = 6

export type DirectReturnStorageKind = 'defective' | 'regular'

export type DirectReturnStorageRequirement = {
  kind: DirectReturnStorageKind | null
  mixed: boolean
}

export function getDirectReturnStorageRequirement(
  items: DirectSalesReturnProduct[],
  draftStatus?: SalesReturnItemStatusValue,
): DirectReturnStorageRequirement {
  const kinds = new Set<DirectReturnStorageKind>()

  items.forEach((item) => {
    kinds.add(getDirectReturnStorageKind(item.status))
  })

  if (typeof draftStatus === 'number') {
    kinds.add(getDirectReturnStorageKind(draftStatus))
  }

  if (kinds.size === 0) {
    return { kind: null, mixed: false }
  }

  if (kinds.size > 1) {
    return { kind: null, mixed: true }
  }

  return { kind: [...kinds][0], mixed: false }
}

export function filterDirectReturnStorages(
  storages: SalesReturnStorage[],
  items: DirectSalesReturnProduct[],
  draftStatus?: SalesReturnItemStatusValue,
): SalesReturnStorage[] {
  const requirement = getDirectReturnStorageRequirement(items, draftStatus)

  if (!requirement.kind || requirement.mixed) {
    return []
  }

  return storages.filter((storage) => isDirectReturnStorageAllowed(storage, requirement.kind))
}

export function isDirectReturnStorageAllowed(
  storage: SalesReturnStorage | null,
  kind: DirectReturnStorageKind | null,
): boolean {
  if (!storage || !kind) {
    return false
  }

  return kind === 'defective' ? storage.ForDefective === true : storage.ForDefective !== true
}

function getDirectReturnStorageKind(status: SalesReturnItemStatusValue): DirectReturnStorageKind {
  return status === DEFECT_RETURN_STATUS ? 'defective' : 'regular'
}
