import type { WizardAvailabilityRow, WizardTotalProductAvailabilities } from './newSaleWizardApi'
import { getWizardProductNumber, getWizardSellableQty, getWizardStorageQty, type WizardSaleProduct } from './wizardSaleProduct'

export type WizardAvailabilityKey =
  | 'AvailableQtyUkReSale'
  | 'InAccount'
  | 'OnWayToPl'
  | 'OnWayToUkr'
  | 'StoragePl'
  | 'StorageUkrNotVat'
  | 'StorageUkrVat'

const TOTAL_KEY_ALIASES: Partial<Record<WizardAvailabilityKey, string>> = {
  OnWayToUkr: 'AvailabilityInvoice',
}

export function getWizardAvailabilityRows(
  availabilities: WizardTotalProductAvailabilities | null | undefined,
  key: WizardAvailabilityKey,
): WizardAvailabilityRow[] {
  if (!availabilities) {
    return []
  }

  switch (key) {
    case 'AvailableQtyUkReSale':
      return availabilities.AvailableQtyUkReSale ?? []
    case 'InAccount':
      return availabilities.InAccounts ?? []
    case 'OnWayToPl':
      return availabilities.OnWayToPl ?? []
    case 'OnWayToUkr':
      return availabilities.AvailabilityInvoiceModel ?? []
    case 'StoragePl':
      return availabilities.InStoragePl ?? []
    case 'StorageUkrNotVat':
      return availabilities.InStorageUkrNotVat ?? []
    case 'StorageUkrVat':
      return availabilities.InStorageUkrVat ?? []
  }
}

export function getWizardAvailabilityChipCount(
  availabilities: WizardTotalProductAvailabilities | null | undefined,
  key: WizardAvailabilityKey,
  index: number,
): number {
  return getWizardAvailabilityValue(availabilities, key, index) ?? 0
}

export function getWizardDetailedSellableQty(
  product: WizardSaleProduct,
  isVatSale: boolean,
  availabilities: WizardTotalProductAvailabilities | null | undefined,
): number | undefined {
  if (!availabilities) {
    return getWizardSellableQty(product, isVatSale)
  }

  const storage = getWizardDetailedStorageQty(product, isVatSale, availabilities)

  if (isVatSale) {
    return storage
  }

  const reSale = getWizardAvailabilityValue(availabilities, 'AvailableQtyUkReSale', 6)

  return storage != null || reSale != null ? (storage ?? 0) + (reSale ?? 0) : getWizardSellableQty(product, isVatSale)
}

export function getWizardDetailedStorageQty(
  product: WizardSaleProduct,
  isVatSale: boolean,
  availabilities: WizardTotalProductAvailabilities | null | undefined,
): number | undefined {
  if (!availabilities) {
    return getWizardStorageQty(product, isVatSale)
  }

  if (isVatSale) {
    return getWizardAvailabilityValue(availabilities, 'StorageUkrVat', 1) ?? getWizardStorageQty(product, isVatSale)
  }

  return getWizardAvailabilityValue(availabilities, 'StorageUkrNotVat', 2) ?? getWizardStorageQty(product, isVatSale)
}

function getWizardAvailabilityValue(
  availabilities: WizardTotalProductAvailabilities | null | undefined,
  key: WizardAvailabilityKey,
  index: number,
): number | undefined {
  const rows = getWizardAvailabilityRows(availabilities, key)

  if (rows.length > 0) {
    return rows.reduce((sum, row) => sum + (getWizardProductNumber(row.Amount) ?? 0), 0)
  }

  return readTotalAvailability(availabilities?.TotalAvailabilities, key, index)
}

function readTotalAvailability(
  totals: Record<string, number> | undefined,
  key: WizardAvailabilityKey,
  index: number,
): number | undefined {
  if (!totals) {
    return undefined
  }

  const alias = TOTAL_KEY_ALIASES[key]
  const byAlias = alias ? totals[alias] : undefined

  if (typeof byAlias === 'number') {
    return byAlias
  }

  const byName = totals[key]

  if (typeof byName === 'number') {
    return byName
  }

  const byIndex = totals[String(index)]

  return typeof byIndex === 'number' ? byIndex : undefined
}
