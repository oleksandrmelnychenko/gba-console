import type { DirectOrderStorageCopy } from './directOrderStorageCopies'
import type { DirectSupplyOrder, SupplyUkraineOrderRow } from './types'

export function canOpenDirectProductIncomeFromOrder(
  order: Pick<DirectSupplyOrder, 'HasArrivedDeliveryProtocol' | 'NetUid'> | null | undefined,
  hasPermission: boolean,
): boolean {
  return hasPermission &&
    Boolean(order?.NetUid) &&
    order?.HasArrivedDeliveryProtocol === true
}

export function canOpenDirectProductIncomeFromRow(
  row: Pick<SupplyUkraineOrderRow, 'directOrder' | 'kind' | 'netUid'> | null | undefined,
  hasPermission: boolean,
): boolean {
  return hasPermission &&
    row?.kind === 'direct' &&
    Boolean(row.netUid) &&
    row.directOrder?.HasArrivedDeliveryProtocol === true
}

export function canOpenDirectProductIncomeFromCopy(
  row: Pick<SupplyUkraineOrderRow, 'directOrder' | 'kind'> | null | undefined,
  copy: Pick<DirectOrderStorageCopy, 'hasArrivedDeliveryProtocol' | 'netUid'>,
  hasPermission: boolean,
): boolean {
  const hasArrivedDeliveryProtocol = copy.hasArrivedDeliveryProtocol ?? row?.directOrder?.HasArrivedDeliveryProtocol === true

  return hasPermission &&
    row?.kind === 'direct' &&
    Boolean(copy.netUid) &&
    hasArrivedDeliveryProtocol
}

export function hasArrivedDeliveryProtocolForInvoice(
  invoice: {
    DeliveryProductProtocol?: {
      Deleted?: boolean
      IsCompleted?: boolean
    } | null
  } | null | undefined,
): boolean {
  return invoice?.DeliveryProductProtocol?.IsCompleted === true &&
    invoice.DeliveryProductProtocol.Deleted !== true
}
