import type { NativeReportPreview, NativeReportPreviewScalar } from './nativeReportPreview'

/** A sale and a return may have the same numeric ID; retain their qualified native text identities. */
export function validFinancialDocumentIdentity(identity?: NativeReportPreviewScalar): boolean {
  if (!identity || identity.Kind !== 'text' || typeof identity.Value !== 'string' || typeof identity.Provenance !== 'string') return false
  const key = /^(sale|return):([1-9]\d{0,18})$/.exec(identity.Value)
  return key !== null && key[0] === identity.Value && BigInt(key[2]) <= 9223372036854775807n
}

/** Also validates template-generated previews that do not have a local editor request. */
export function validateFinancialDocumentPreview(preview: NativeReportPreview): void {
  type Schema = { Identity?: string; DisplayKind?: string; KeyKind?: string; Captioned?: boolean }
  const rows = preview.RowSchema as Schema[], columns = preview.ColumnSchema as Schema[]
  const isDocument = (field: Schema) => field.Identity === 'CurrentFinancialDocument'
  if (![...rows, ...columns].some(isDocument)) return
  const invalid = (schema: Schema[], values: NativeReportPreview['Rows']) => schema.some((field, index) => isDocument(field)
    && (field.DisplayKind !== 'Text' || field.KeyKind !== 'Text' || field.Captioned !== true
      || values.some(row => !validFinancialDocumentIdentity(row.Values[index]?.Identity))))
  if (preview.Request?.DataSource !== 'NativeDayOrganizationGrossProfit' || preview.Request.ProfitReadMode !== 0
    || invalid(rows, preview.Rows) || invalid(columns, preview.Columns))
    throw new Error('Сервер повернув непідтверджені ключі документів фінансового звіту.')
}
