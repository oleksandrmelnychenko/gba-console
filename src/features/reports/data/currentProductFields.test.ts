import { expect, it } from 'vitest'
import { normalizeNativeReportPreview } from './nativeReportPreview'
import { bindWorkbookPreview } from './workbookPreview'
import { normalizeWorkbookDataset, workbookConfigurationError } from './workbookPresentation'
import { productCapability, productDataset, productPreview, productRequest } from './currentProductFields.test-fixtures'
import { workbookPreview } from './workbookPresentation.test-fixtures'

it('admits only explicit v2 capability and named profiles with an exact product row without mutating settings', () => {
  expect(normalizeWorkbookDataset(productDataset as unknown as Record<string, unknown>)).toEqual(productDataset)
  for (const profile of ['sales', 'grossProfit']) expect(workbookConfigurationError(productRequest(profile), productDataset)).toBeNull()
  for (const profile of ['', 'legacy', 'Sales']) expect(workbookConfigurationError(productRequest(profile), productDataset)).toBeTruthy()
  for (const change of [{ version: 1 }, { attributeKind: 'historicalProduct' }, { requiredRowGroupings: [7] }, { supportedReportProfiles: ['sales'] }, { additionalFields: [] }])
    expect(normalizeWorkbookDataset({ ...productDataset, workbookPresentation: { ...productCapability, ...change } })).toBeNull()
  const request = productRequest(), copy = structuredClone(request)
  request.sorted.Col = request.sorted.Row; request.sorted.Row = [{ type: 4, key: 'Organization', label: 'Організація' }]
  expect(workbookConfigurationError(request, productDataset)).toContain('Додайте')
  expect(request.workbookPresentation).toEqual(copy.workbookPresentation)
  expect(workbookConfigurationError(copy, { ...productDataset, workbookPresentation: undefined })).toContain('сервер')
})
it('keeps ordered attributes and exact long identity alongside unchanged unknown financial cells', () => {
  const raw = productPreview(), copy = structuredClone(raw)
  const preview = normalizeNativeReportPreview({ Preview: raw })
  bindWorkbookPreview(productRequest(), preview)
  expect(preview.WorkbookPresentation?.selection.additionalFields).toEqual([66, 2])
  expect(preview.Rows[0].Values[0].Identity?.Value).toBe('9223372036854775807')
  expect(preview.Cells).toEqual(copy.Cells)
  expect(raw).toEqual(copy)
})
it('rejects stale results, row order, missing evidence, mixed states and v1 currency weakening', () => {
  for (const mutate of [
    (raw: ReturnType<typeof productPreview>) => { raw.workbookPresentation.resultSha256 = 'f'.repeat(64) },
    (raw: ReturnType<typeof productPreview>) => { raw.workbookPresentation.rows[0].rowSourceIndex = 0 },
    (raw: ReturnType<typeof productPreview>) => { raw.workbookPresentation.rows[0].values[0].inputSha256 = null },
    (raw: ReturnType<typeof productPreview>) => { raw.workbookPresentation.rows[0].values[0] = { type: 66, state: 'mixed', values: ['a', 'b'], inputSha256: 'c'.repeat(64) } },
    (raw: ReturnType<typeof productPreview>) => { raw.workbookPresentation.rows[0].currencyWitnesses = workbookPreview().workbookPresentation.rows[0].currencyWitnesses },
  ]) { const raw = productPreview(); mutate(raw); expect(() => normalizeNativeReportPreview({ Preview: raw })).toThrow() }
  const old = workbookPreview(); old.workbookPresentation.rows[0].currencyWitnesses = []
  expect(() => normalizeNativeReportPreview({ Preview: old })).toThrow()
  const preview = normalizeNativeReportPreview({ Preview: productPreview() })
  expect(() => bindWorkbookPreview({ ...productRequest(), reportProfile: undefined }, preview)).toThrow()
  expect(() => bindWorkbookPreview({ ...productRequest(), workbookPresentation: { version: 2, additionalFields: [2, 66], ordering: null } }, preview)).toThrow()
})
it('retains known empty text and requires unavailable fields for synthetic products or mismatched duplicate product axes', () => {
  const raw = productPreview(); raw.workbookPresentation.rows[0].values[1].values = ['']
  expect(normalizeNativeReportPreview({ Preview: raw }).WorkbookPresentation?.rows[0].values[1].state).toBe('known')
  raw.Rows[0].Values[0].Identity.Value = '-1'
  expect(() => normalizeNativeReportPreview({ Preview: raw })).toThrow()
  raw.workbookPresentation.rows[0].values.forEach(value => { value.state = 'unavailable'; value.values = [] })
  expect(normalizeNativeReportPreview({ Preview: raw }).WorkbookPresentation?.rows[0].values[0].state).toBe('unavailable')
  const mismatch = productPreview()
  mismatch.RowSchema.push({ Identity: 'Product', Caption: 'Товар', KeyKind: 'Numeric' })
  mismatch.Rows[0].Values.push({ Caption: 'Інший', Identity: { Kind: 'signedInteger', Value: '12', Provenance: 'rowAxisKey' } })
  expect(() => normalizeNativeReportPreview({ Preview: mismatch })).toThrow()
})
it('binds each page by source index instead of assuming first page indices', () => {
  const raw = productPreview(); raw.Page = { Offset: 50, Limit: 50, TotalVisibleRows: 51, ReturnedRows: 1, HasMore: false }
  raw.Rows[0].SourceIndex = 50; raw.Rows[0].Ordinal = 50; raw.Cells[0].RowSourceIndex = 50
  raw.workbookPresentation.rows[0].rowSourceIndex = 50
  expect(normalizeNativeReportPreview({ Preview: raw }).WorkbookPresentation?.rows[0].rowSourceIndex).toBe(50)
})
