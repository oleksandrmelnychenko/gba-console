import { expect, it } from 'vitest'
import { normalizeNativeReportPreview, previewScalarText } from './nativeReportPreview'
import { currentVparivaniePreview } from './currentVparivanie.test-fixtures'

it('binds all seven nullable product attrs to exact visible row set and same server result', () => {
  const original = currentVparivaniePreview()
  const normalized = normalizeNativeReportPreview({ Preview: original })
  expect(normalized.CurrentVparivanieProducts).toEqual(original.CurrentVparivanieProducts)
  original.CurrentVparivanieProducts.Rows[0].Name = 'mutated'
  expect(normalized.CurrentVparivanieProducts?.Rows[0].Name).toBe('<script>name</script>')
  expect(normalized.CurrentVparivanieProducts?.Rows[0].Description).toBe('')
  expect(normalized.CurrentVparivanieProducts?.Rows[0].OE).toBeNull()
  expect(normalized.Cells.map(cell => previewScalarText(cell.Value))).toEqual(['0', '-2.00000000', '∅', '3.00000001'])
})
it.each(['missing', 'other-result', 'wrong-version', 'missing-row', 'extra-row', 'duplicate-row', 'unknown-field',
  'missing-field', 'number-field', 'malformed-utf8', 'duplicate-axis', 'snapshot', 'wrong-source', 'three-measures'])('refuses invalid page attribution %s', scenario => {
  const preview = currentVparivaniePreview()
  const rows = preview.CurrentVparivanieProducts.Rows
  switch (scenario) {
    case 'missing': Reflect.deleteProperty(preview, 'CurrentVparivanieProducts'); break
    case 'other-result': preview.CurrentVparivanieProducts.ResultSha256 = 'b'.repeat(64); break
    case 'wrong-version': preview.CurrentVparivanieProducts.Version = 2; break
    case 'missing-row': rows.length = 0; break
    case 'extra-row': rows.push({ ...rows[0], RowSourceIndex: 13 }); break
    case 'duplicate-row': rows.push(rows[0]); preview.Rows.push({ ...preview.Rows[0], Ordinal: 1, SourceIndex: 13 }); preview.Page.ReturnedRows = 2; break
    case 'unknown-field': Object.assign(rows[0], { Owner: 'inferred' }); break
    case 'missing-field': Reflect.deleteProperty(rows[0], 'Top'); break
    case 'number-field': Object.assign(rows[0], { Article: 123 }); break
    case 'malformed-utf8': rows[0].Name = '\ud800'; break
    case 'duplicate-axis': preview.Rows.push({ ...preview.Rows[0], Ordinal: 1 }); preview.Page.ReturnedRows = 2; rows.push(rows[0]); break
    case 'snapshot': preview.Request.IsCurrentSnapshot = true; break
    case 'wrong-source': preview.Request.DataSource = 'NativeVparivanie'; break
    case 'three-measures': preview.Request.Measures = ['Остатки', 'Продажи', 'Контрагенты']; break
  }
  expect(() => normalizeNativeReportPreview({ Preview: preview })).toThrow()
})
it('accepts complete empty page without inventing product or zero cell', () => {
  const preview = currentVparivaniePreview()
  preview.Rows = []; preview.Cells = []; preview.CurrentVparivanieProducts.Rows = []
  preview.Page.ReturnedRows = 0; preview.Page.TotalVisibleRows = 0
  const normalized = normalizeNativeReportPreview({ Preview: preview })
  expect(normalized.CurrentVparivanieProducts?.Rows).toEqual([])
  expect(normalized.Cells).toEqual([])
})
