import type { SupplyReturnClient } from './types'

/** One supplier name in the list and in the details (WH2-19): the full name first. */
export function getSupplierDisplayName(supplier?: SupplyReturnClient | null): string | undefined {
  return supplier?.FullName?.trim() || supplier?.SupplierName?.trim() || supplier?.Name?.trim() || undefined
}
