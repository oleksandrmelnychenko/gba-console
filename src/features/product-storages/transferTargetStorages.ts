import type { ProductStorageStorage } from './types'

export type StorageOption = { label: string; value: string }

/**
 * Target storages for a transfer from `fromStorage`. A normal transfer offers other storages of the SAME
 * organisation only (chaos3 N3-01; the server refuses the rest). A management operation
 * («Управлінська операція», with its permission) may target any organisation — existing behaviour.
 */
export function buildToStorageOptions(
  storages: ProductStorageStorage[],
  fromStorage: ProductStorageStorage | null,
  { allowOtherOrganizations = false }: { allowOtherOrganizations?: boolean } = {},
): StorageOption[] {
  return storages.reduce<StorageOption[]>((options, storage) => {
    if (
      !storage.NetUid
      || isSameStorage(storage, fromStorage)
      || (!allowOtherOrganizations && !isSameStorageOrganization(storage, fromStorage))
    ) {
      return options
    }

    options.push({
      label: [storage.Name, storage.Organization?.Name ? `(${storage.Organization.Name})` : ''].filter(Boolean).join(' '),
      value: storage.NetUid,
    })

    return options
  }, [])
}

export function isSameStorage(firstStorage?: ProductStorageStorage | null, secondStorage?: ProductStorageStorage | null): boolean {
  if (!firstStorage || !secondStorage) {
    return false
  }

  if (firstStorage.NetUid && secondStorage.NetUid) {
    return firstStorage.NetUid === secondStorage.NetUid
  }

  return Boolean(firstStorage.Id && secondStorage.Id && firstStorage.Id === secondStorage.Id)
}

/** Same organisation; compares ids when both sides have one, otherwise organisation NetUids. */
export function isSameStorageOrganization(
  storage: ProductStorageStorage,
  fromStorage: ProductStorageStorage | null,
): boolean {
  const fromId = getStorageOrganizationId(fromStorage)
  const fromNetUid = fromStorage?.Organization?.NetUid || ''

  if (!fromId && !fromNetUid) {
    // Source organisation unknown: nothing to compare against (the server still checks).
    return true
  }

  const targetId = getStorageOrganizationId(storage)

  if (fromId && targetId) {
    return fromId === targetId
  }

  const targetNetUid = storage.Organization?.NetUid || ''

  return Boolean(fromNetUid && targetNetUid && fromNetUid === targetNetUid)
}

function getStorageOrganizationId(storage?: ProductStorageStorage | null): number | null {
  const organizationId = storage?.OrganizationId ?? storage?.Organization?.Id

  return organizationId ? organizationId : null
}
