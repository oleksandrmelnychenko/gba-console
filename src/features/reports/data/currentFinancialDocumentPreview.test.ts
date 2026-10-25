import { expect, it } from 'vitest'
import { documentLayouts, documentPreviewPayload, documentRequest } from './currentFinancialDocumentAxes.test-fixtures'
import { normalizeNativeReportPreview } from './nativeReportPreview'
import { bindProfitPreviewGrouping } from './workbookPreview'
import { validFinancialDocumentIdentity } from './currentFinancialDocumentPreview'

const normalize = (raw: ReturnType<typeof documentPreviewPayload>) => normalizeNativeReportPreview({ Preview: raw })
it.each(documentLayouts)('binds document layout %j / %j without changing signed money or typed keys', (rows, cols) => {
  const preview = normalize(documentPreviewPayload(rows, cols))
  expect(() => bindProfitPreviewGrouping(documentRequest(rows, cols), preview)).not.toThrow()
  expect(preview.Cells[0].Value.Value).toBe('-7.00')
})
it.each(['sale:42', 'return:42', 'sale:9007199254740993', 'return:9223372036854775807'])('retains exact qualified identity %s', Value => {
  const raw = documentPreviewPayload();raw.Rows[0].Values[0].Identity = { Kind: 'text', Value, Provenance: 'rowAxisKey' }
  expect(normalize(raw).Rows[0].Values[0].Identity?.Value).toBe(Value)
})
it.each(['sale:0', 'sale:-1', 'sale:01', 'sale:1.0', 'sale:9223372036854775808', 'SALE:1', 'return: 1', '1', 'other:42', 'sale:1\n'])('rejects malformed document key %j', Value => {
  const raw = documentPreviewPayload();raw.Rows[0].Values[0].Identity.Value = Value
  expect(() => normalize(raw)).toThrow('ключі документів')
})
it('rejects null/numeric identities and schema substitution, even in empty or saved previews', () => {
  for (const Identity of [{ Kind: 'null', Value: null, Provenance: 'rowAxisKey' },
    { Kind: 'signedInteger', Value: '42', Provenance: 'rowAxisKey' }]) {
    expect(validFinancialDocumentIdentity(Identity)).toBe(false)
    const raw = documentPreviewPayload();raw.Rows[0].Values[0].Identity = Identity
    expect(() => normalize(raw)).toThrow('ключі документів')
  }
  const schema = documentPreviewPayload();schema.RowSchema[0].KeyKind = 'Integer';schema.Rows = [];schema.Cells = []
  schema.Page.ReturnedRows = 0;schema.Page.TotalVisibleRows = 0
  expect(() => normalize(schema)).toThrow('ключі документів')
  const swapped = documentPreviewPayload();swapped.RowSchema[0].Identity = 'Organization'
  expect(() => bindProfitPreviewGrouping(documentRequest(), normalize(swapped))).toThrow()
  const mode = documentPreviewPayload([81], []);mode.Request.ProfitReadMode = 1
  expect(() => normalize(mode)).toThrow('ключі документів')
})
it('preserves absent cells independently from unknown money and never turns unknown document IDs into zero', () => {
  const raw = documentPreviewPayload([5], [81]);raw.Cells[0].Value = { Kind: 'null', Value: null, Provenance: 'producerCell' }
  const knownDocumentUnknownMoney = normalize(raw)
  expect(knownDocumentUnknownMoney.Cells[0].Value).toMatchObject({ Kind: 'null', Value: null })
  raw.Cells = []
  expect(normalize(raw).Cells).toEqual([])
  raw.Columns[0].Values[0].Identity.Value = null
  expect(() => normalize(raw)).toThrow('ключі документів')
})
it('retains workbook form settings with document rows without inventing article/top values', () => {
  const raw = { ...documentPreviewPayload([81, 5], []), workbookPresentation: { version: 1, resultSha256: 'a'.repeat(64),
    selection: { version: 1, additionalFields: [2, 3], ordering: 'MonthAscending' },
    fields: [{ type: 2, caption: 'Артикул', placement: 'retainedSetting' }, { type: 3, caption: 'Топ', placement: 'retainedSetting' }], rows: [] } }
  const preview = normalizeNativeReportPreview({ Preview: raw })
  expect(preview.WorkbookPresentation?.fields).toHaveLength(2)
  expect(preview.WorkbookPresentation?.rows).toEqual([])
  expect(() => bindProfitPreviewGrouping(documentRequest([81, 5], []), preview)).not.toThrow()
  raw.Request.ProfitReadMode = 1
  expect(() => normalizeNativeReportPreview({ Preview: raw })).toThrow()
})
