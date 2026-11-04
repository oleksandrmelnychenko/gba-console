export type PhysicalQuantityException = {
  StorageId: number
  ProductId: number
  DocumentId: number
  DocumentKind: number
  DocumentNumber: string
  OccurredAtUtc: string
  Direction: 'Incoming' | 'Outgoing'
  UnclassifiedQuantity: number
  Reason: 'unconfirmed_batch'
}
export type PhysicalQuantityState = {
  QuantityKnown?: boolean | null
  UnclassifiedQuantity?: number | null
  QuantityStatus?: string | null
}
export function readPhysicalQuantityExceptions(value: unknown): PhysicalQuantityException[] {
  if (value == null) return []
  if (!Array.isArray(value)) throw new Error('Сервер повернув некоректне пояснення непідтвердженої кількості.')
  return value.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)
      || ![item.StorageId, item.ProductId, item.DocumentId].every(id => Number.isSafeInteger(id) && id > 0)
      || !Number.isSafeInteger(item.DocumentKind) || item.DocumentKind < 0
      || typeof item.DocumentNumber !== 'string'
      || typeof item.OccurredAtUtc !== 'string' || !item.OccurredAtUtc.endsWith('Z') || !Number.isFinite(Date.parse(item.OccurredAtUtc))
      || !['Incoming', 'Outgoing'].includes(item.Direction)
      || typeof item.UnclassifiedQuantity !== 'number' || !Number.isFinite(item.UnclassifiedQuantity) || item.UnclassifiedQuantity <= 0
      || item.Reason !== 'unconfirmed_batch') {
      throw new Error('Сервер повернув некоректне пояснення непідтвердженої кількості.')
    }
    return item as PhysicalQuantityException
  })
}
export function physicalQuantityValue(row: PhysicalQuantityState, value: number | null | undefined): number | null | undefined {
  return row.QuantityKnown === false || row.QuantityStatus === 'unconfirmed_batch' ? null : value
}
