import type { WizardAvailabilityRow, WizardTotalProductAvailabilities } from './newSaleWizardApi'
import type { WizardDetailChip, WizardDetailRow } from './wizardProductDetailModel'
import { getWizardAvailabilityChipCount, getWizardAvailabilityRows } from './wizardSaleAvailability'
import { getWizardProductNumber } from './wizardSaleProduct'

// Display order differs from the numeric keys in legacy availability totals.
export const WIZARD_PRODUCT_AVAILABILITY_CHIPS = [
  { index: 0, key: 'InAccount', label: 'В рахунках' },
  { index: 1, key: 'StorageUkrVat', label: 'Склади Україна (ПДВ)' },
  { index: 2, key: 'StorageUkrNotVat', label: 'Склади Україна' },
  { index: 6, key: 'AvailableQtyUkReSale', label: 'Перепродаж' },
  { index: 3, key: 'StoragePl', label: 'Склади Польща' },
  { index: 4, key: 'OnWayToPl', label: 'До Польщі' },
  { index: 5, key: 'OnWayToUkr', label: 'До України' },
] as const

export function getDefaultWizardProductChipIndex(isVatSale: boolean): number {
  return isVatSale ? 1 : 2
}

export function buildWizardProductAvailabilityChips(
  availabilities: WizardTotalProductAvailabilities | null | undefined,
  translate: (label: string) => string,
): WizardDetailChip[] {
  return WIZARD_PRODUCT_AVAILABILITY_CHIPS.map(({ index, key, label }) => ({
    count: getWizardAvailabilityChipCount(availabilities, key, index),
    key,
    name: translate(label),
  }))
}

export function getWizardProductChipRows(
  availabilities: WizardTotalProductAvailabilities | null | undefined,
  chipIndex: number | null,
): WizardAvailabilityRow[] {
  const key = chipIndex === null ? undefined : WIZARD_PRODUCT_AVAILABILITY_CHIPS[chipIndex]?.key
  return key ? getWizardAvailabilityRows(availabilities, key) : []
}

export function buildWizardProductAvailabilityRows(
  availabilities: WizardTotalProductAvailabilities | null | undefined,
  chipIndex: number | null,
): WizardDetailRow[] {
  return getWizardProductChipRows(availabilities, chipIndex).map((row) => ({
    amount: getWizardProductNumber(row.Amount) ?? 0,
    analyst: row.OrderItem?.User?.LastName ?? '',
    key: String(row.NetId || row.OrderItem?.NetUid || row.OrderItem?.Id || `${row.Name || ''}|${row.RegionCode || ''}`),
    name: row.Name ?? '',
    regionCode: row.RegionCode ?? '',
  }))
}
