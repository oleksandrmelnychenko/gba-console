import type { SalesUkraineUpdateDataCarrier } from '../types'

export const CARRIER_HISTORY_CHANGED_FIELD = {
  transporter: 1 << 0,
  city: 1 << 1,
  department: 1 << 2,
  shipmentDate: 1 << 3,
  fullName: 1 << 4,
  mobilePhone: 1 << 5,
  comment: 1 << 6,
  isCashOnDelivery: 1 << 7,
  cashOnDeliveryAmount: 1 << 8,
  hasDocument: 1 << 9,
  ownTtnNumber: 1 << 10,
  ttnDocument: 1 << 11,
  ttn: 1 << 12,
} as const

export type CarrierHistoryChangedField =
  (typeof CARRIER_HISTORY_CHANGED_FIELD)[keyof typeof CARRIER_HISTORY_CHANGED_FIELD]

export function hasCarrierHistoryField(
  entry: SalesUkraineUpdateDataCarrier | null | undefined,
  field: CarrierHistoryChangedField,
): boolean {
  return hasCarrierHistoryMask(entry) && (entry.ChangedFields & field) === field
}

export function hasCarrierHistoryMask(
  entry: SalesUkraineUpdateDataCarrier | null | undefined,
): entry is SalesUkraineUpdateDataCarrier & { ChangedFields: number } {
  const value = entry?.ChangedFields

  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}
