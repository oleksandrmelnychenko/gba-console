import type { NativeReportPreview, NativeReportPreviewScalar } from './nativeReportPreview'

/** These are typed native keys, not captions or browser-local dates. */
export function validFinancialProductTimeIdentity(type: number, identity?: NativeReportPreviewScalar): boolean {
  if (!identity || typeof identity.Provenance !== 'string') return false
  if (type === 5) return identity.Kind === 'null' && identity.Value === null
    || identity.Kind === 'signedInteger' && typeof identity.Value === 'string'
      && /^[1-9]\d{0,18}$/.test(identity.Value) && BigInt(identity.Value) <= 9223372036854775807n
  if (type === 0) return identity.Kind === 'signedInteger' && typeof identity.Value === 'string'
    && /^[1-9]\d{0,3}$/.test(identity.Value) && Number(identity.Value) <= 9999
  if (type !== 1 && type !== 2) return false
  if (identity.Kind !== 'dateTime' || typeof identity.Value !== 'string') return false
  const bucket = /^(\d{4})-(\d{2})-01T00:00:00(?:\.0{1,7})?$/.exec(identity.Value)
  if (!bucket) return false
  const year = Number(bucket[1]), month = Number(bucket[2])
  return year >= 1 && year <= 9999 && month >= 1 && month <= 12 && (type !== 1 || [1, 4, 7, 10].includes(month))
}

/** Saved-template previews also pass through this normalizer, without an editor request body. */
export function validateFinancialProductTimePreview(preview: NativeReportPreview): void {
  if (preview.Request?.DataSource !== 'NativeDayOrganizationGrossProfit') return
  const types: Readonly<Record<string, number>> = { Year: 0, Quarter: 1, Month: 2, Product: 5 }
  const rows = preview.RowSchema as { Identity?: string }[], columns = preview.ColumnSchema
  const hasNewAxes = [...rows, ...columns].some(field => field.Identity !== undefined && Object.hasOwn(types, field.Identity))
  if (!hasNewAxes) return
  const invalid = (schema: typeof rows, values: NativeReportPreview['Rows']) => values.some(row => schema.some((field, index) =>
    field.Identity !== undefined && Object.hasOwn(types, field.Identity)
      && !validFinancialProductTimeIdentity(types[field.Identity], row.Values[index]?.Identity)))
  if (preview.Request.ProfitReadMode !== 0 || invalid(rows, preview.Rows) || invalid(columns, preview.Columns))
    throw new Error('Сервер повернув непідтверджені ключі товару або періоду фінансового звіту.')
}
