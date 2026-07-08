import type { DirectSupplyOrder, SupplyUkraineOrderRow } from './types'

export function canOpenDirectProductIncomeFromOrder(
  order: Pick<DirectSupplyOrder, 'NetUid'> | null | undefined,
  hasPermission: boolean,
): boolean {
  return hasPermission && Boolean(order?.NetUid)
}

export function canOpenDirectProductIncomeFromRow(
  row: Pick<SupplyUkraineOrderRow, 'kind' | 'netUid'> | null | undefined,
  hasPermission: boolean,
): boolean {
  return hasPermission && row?.kind === 'direct' && Boolean(row.netUid)
}
