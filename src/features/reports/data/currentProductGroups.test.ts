import { expect, it } from 'vitest'
import { currentProductCapability, readProductGroupListCapability, readWorkbookCapability, readWorkbookSelection, workbookConfigurationError } from './workbookPresentation'
import { normalizeNativeReportPreview } from './nativeReportPreview'
import { bindWorkbookPreview } from './workbookPreview'
import { productCapability, productDataset, productPreview, productRequest } from './currentProductFields.test-fixtures'
import { productGroupsCapability, productGroupsDataset, productGroupsPreview, productGroupsRequest } from './currentProductGroups.test-fixtures'

it('keeps the exact v2 capability and templates while opting into the additive v3 field', () => {
  expect(readWorkbookCapability(productGroupsDataset.workbookPresentation, 2)).toEqual(readWorkbookCapability(productCapability, 2))
  expect(currentProductCapability(productGroupsDataset)?.version).toBe(3)
  expect(currentProductCapability(productDataset)?.version).toBe(2)
  expect(workbookConfigurationError(productRequest(), productGroupsDataset)).toBeNull()
  expect(workbookConfigurationError(productGroupsRequest(), productGroupsDataset)).toBeNull()
  expect(workbookConfigurationError(productGroupsRequest(), productDataset)).not.toBeNull()
  expect(readWorkbookSelection({ version: 2, additionalFields: [67], ordering: null })).not.toBeNull()
  expect(workbookConfigurationError({ ...productRequest(), workbookPresentation: { version: 2, additionalFields: [67], ordering: null } }, productGroupsDataset)).not.toBeNull()
  expect(readProductGroupListCapability({ ...productGroupsCapability, version: 2 })).toBeNull()
  expect(readProductGroupListCapability({ ...productGroupsCapability, attributeKind: 'currentProductScalar' })).toBeNull()
  expect(currentProductCapability({ ...productDataset, currentProductGroupLists: { ...productGroupsCapability, additionalFields: [] } })?.version).toBe(2)
})
it('keeps exact typed list identities including equal captions and binds selection order to the response', () => {
  const preview = normalizeNativeReportPreview({ Preview: productGroupsPreview() })
  bindWorkbookPreview(productGroupsRequest(), preview)
  expect(preview.WorkbookPresentation?.rows[0].values[1].references?.map(group => group.id)).toEqual(['9007199254740993', '9223372036854775807'])
  expect(() => bindWorkbookPreview({ ...productGroupsRequest(), workbookPresentation: { version: 3, additionalFields: [67, 66, 2], ordering: null } }, preview)).toThrow()
  expect(() => normalizeNativeReportPreview({ Preview: productPreview() })).not.toThrow()
})
it.each(['duplicateId', 'duplicateUid', 'reverse', 'numberId', 'leadingZero', 'zeroGuid', 'badUtf16', 'unknownState', 'scalarValues', 'missingReferences', 'oversize', 'missingHash'])(
  'rejects malformed or incomplete list witness %s', mode => {
    const raw = productGroupsPreview(), value = raw.workbookPresentation.rows[0].values[1]
    if (mode === 'duplicateId') value.references![1].id = value.references![0].id
    if (mode === 'duplicateUid') value.references![1].netUid = value.references![0].netUid
    if (mode === 'reverse') value.references!.reverse()
    if (mode === 'numberId') Object.assign(value.references![0], { id: 123 })
    if (mode === 'leadingZero') value.references![0].id = '01'
    if (mode === 'zeroGuid') value.references![0].netUid = '00000000-0000-0000-0000-000000000000'
    if (mode === 'badUtf16') value.references![0].caption = String.fromCharCode(0xd800)
    if (mode === 'unknownState') value.state = 'mixed'
    if (mode === 'scalarValues') value.values = ['Перша група']
    if (mode === 'missingReferences') delete value.references
    if (mode === 'oversize') value.references = Array.from({ length: 20 }, (_, i) => ({ id: String(i + 1), netUid: `${String(i + 1).padStart(8, '0')}-1111-1111-1111-111111111111`, caption: 'я'.repeat(4096) }))
    if (mode === 'missingHash') value.inputSha256 = null
    expect(() => normalizeNativeReportPreview({ Preview: raw })).toThrow()
  })
it('preserves known empty and unavailable and refuses any list on a v2 scalar response', () => {
  const raw = productGroupsPreview(), value = raw.workbookPresentation.rows[0].values[1]
  value.references = []
  expect(normalizeNativeReportPreview({ Preview: raw }).WorkbookPresentation?.rows[0].values[1].state).toBe('known')
  value.state = 'unavailable'
  expect(normalizeNativeReportPreview({ Preview: raw }).WorkbookPresentation?.rows[0].values[1].state).toBe('unavailable')
  raw.workbookPresentation.version = 2; raw.workbookPresentation.selection.version = 2
  expect(() => normalizeNativeReportPreview({ Preview: raw })).toThrow()
})

it.each(['я', '<', '😀'])('enforces the canonical conservative byte boundary for %s without truncating the list', character => {
  const raw = productGroupsPreview(), value = raw.workbookPresentation.rows[0].values[1]
  value.references = [4096, 4096, 2650].map((length, index) => ({ id: String(index + 1),
    netUid: `${String(index + 1).padStart(8, '0')}-1111-1111-1111-111111111111`, caption: character.repeat(length / character.length) }))
  expect(() => normalizeNativeReportPreview({ Preview: raw })).not.toThrow()
  value.references[2].caption += 'x'
  expect(() => normalizeNativeReportPreview({ Preview: raw })).toThrow()
})
it('rejects four full Cyrillic captions even when raw UTF8 JSON is below64KiB', () => {
  const raw = productGroupsPreview(), value = raw.workbookPresentation.rows[0].values[1]
  value.references = Array.from({ length: 4 }, (_, i) => ({ id: String(i + 1), netUid: `${String(i + 1).padStart(8, '0')}-1111-1111-1111-111111111111`, caption: 'я'.repeat(4096) }))
  expect(new TextEncoder().encode(JSON.stringify(value.references)).length).toBeLessThan(65536)
  expect(() => normalizeNativeReportPreview({ Preview: raw })).toThrow()
})

it('does not admit lists outside the named product-row profile or attach them to another result', () => {
  const body = productGroupsRequest()
  expect(workbookConfigurationError({ ...body, reportProfile: undefined }, productGroupsDataset)).not.toBeNull()
  expect(workbookConfigurationError({ ...body, sorted: { ...body.sorted, Row: [], Col: body.sorted.Row } }, productGroupsDataset)).not.toBeNull()
  const wrongSource = productGroupsPreview(); wrongSource.Request.DataSource = 'NativePurchases'
  expect(() => normalizeNativeReportPreview({ Preview: wrongSource })).toThrow()
  const stale = productGroupsPreview(); stale.workbookPresentation.resultSha256 = 'f'.repeat(64)
  expect(() => normalizeNativeReportPreview({ Preview: stale })).toThrow()
})
it('requires unavailable current fields for a synthetic row and keeps v2 scalar keys strict', () => {
  const raw = productGroupsPreview()
  raw.Rows[0].Values[0].Identity.Value = '-1'
  expect(() => normalizeNativeReportPreview({ Preview: raw })).toThrow()
  for (const value of raw.workbookPresentation.rows[0].values) {
    value.state = 'unavailable'; value.values = []
    if (value.type === 67) value.references = []
  }
  expect(normalizeNativeReportPreview({ Preview: raw }).WorkbookPresentation?.rows[0].values.every(value => value.state === 'unavailable')).toBe(true)
  const old = productPreview(); old.workbookPresentation.rows[0].values[0].references = []
  expect(() => normalizeNativeReportPreview({ Preview: old })).toThrow()
})
