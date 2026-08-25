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
