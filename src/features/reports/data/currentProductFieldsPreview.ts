import type { NativeReportPreview } from './nativeReportPreview'
import type { WorkbookPreview, WorkbookRow } from './workbookPreview'
import { currentProductFields, readWorkbookSelection, workbookHasText, workbookText, type WorkbookField } from './workbookPresentation'

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const keys = (value: Record<string, unknown>, names: string[]) => Object.keys(value).sort().join(',') === names.toSorted().join(',')
const hash = (value: unknown): value is string => typeof value === 'string' && /^[a-f\d]{64}$/.test(value)
const fail = (): never => { throw new Error('Сервер не підтвердив поточні поля товару та їхню прив’язку до результату.') }

/** Version2 has product evidence, never relaxed version1 currency witnesses. */
export function readCurrentProductPreview(raw: Record<string, unknown>, preview: NativeReportPreview): WorkbookPreview {
  if (preview.Request?.DataSource !== 'NativeSalesNet' || !keys(raw, ['version', 'resultSha256', 'selection', 'fields', 'rows'])
    || raw.version !== 2 || raw.resultSha256 !== preview.ResultSha256 || !hash(raw.resultSha256)
    || new TextEncoder().encode(JSON.stringify(raw)).length > 1048576) return fail()
  const selection = record(raw.selection) && keys(raw.selection, ['version', 'additionalFields', 'ordering']) ? readWorkbookSelection(raw.selection) : null
  if (!selection || selection.version !== 2 || selection.ordering !== null
    || selection.additionalFields.some(type => !currentProductFields.some(field => field[0] === type))
    || !Array.isArray(raw.fields) || raw.fields.length !== selection.additionalFields.length
    || !Array.isArray(raw.rows) || raw.rows.length !== preview.Rows.length) return fail()
  const schema = preview.RowSchema as Array<{ Identity?: string; KeyKind?: string }>
  const productAxes = schema.flatMap((field, index) => ['Product', 'ProductName'].includes(field.Identity ?? '') ? [index] : [])
  if (!productAxes.length || productAxes.some(index => schema[index].KeyKind !== 'Numeric')) return fail()
  const fields: WorkbookField[] = raw.fields.map((field, index) => {
    if (!record(field) || !keys(field, ['type', 'caption', 'placement']) || field.type !== selection.additionalFields[index]
      || field.placement !== 'column' || !workbookText(field.caption) || !workbookHasText(field.caption)) return fail()
    return { type: field.type as number, caption: field.caption, placement: 'column' }
  })
  const seen = new Set<string>()
  const rows: WorkbookRow[] = raw.rows.map((row, index) => {
    if (!record(row) || !keys(row, ['rowSourceIndex', 'rowKeySha256', 'values', 'currencyWitnesses'])
      || row.rowSourceIndex !== preview.Rows[index].SourceIndex || !hash(row.rowKeySha256) || seen.has(row.rowKeySha256)
      || !Array.isArray(row.currencyWitnesses) || row.currencyWitnesses.length !== 0
      || !Array.isArray(row.values) || row.values.length !== fields.length) return fail()
    seen.add(row.rowKeySha256)
    const ids = productAxes.map(axis => preview.Rows[index].Values[axis]?.Identity)
    const positive = ids.map(identity => identity?.Kind === 'signedInteger' && typeof identity.Value === 'string'
      && /^[1-9]\d{0,18}$/.test(identity.Value) && BigInt(identity.Value) <= 9223372036854775807n ? identity.Value : null)
    if (positive.some(Boolean) && (positive.some(id => id === null) || new Set(positive).size !== 1)) return fail()
    const exactProduct = positive.every(Boolean)
    const values = row.values.map((value, fieldIndex) => {
      if (!record(value) || !keys(value, ['type', 'state', 'values', 'inputSha256']) || value.type !== fields[fieldIndex].type
        || !['known', 'null', 'unavailable'].includes(String(value.state)) || !hash(value.inputSha256)
        || !Array.isArray(value.values) || !value.values.every(workbookText)
        || (value.state === 'known' ? value.values.length !== 1 : value.values.length !== 0)
        || !exactProduct && value.state !== 'unavailable') return fail()
      return { type: value.type as number, state: value.state as 'known' | 'null' | 'unavailable', values: [...value.values], inputSha256: value.inputSha256 }
    })
    return { rowSourceIndex: row.rowSourceIndex as number, rowKeySha256: row.rowKeySha256, values, currencyWitnesses: [] }
  })
  return { version: 2, resultSha256: raw.resultSha256, selection, fields, rows }
}
