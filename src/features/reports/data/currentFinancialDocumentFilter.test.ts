import { expect, it } from 'vitest'
import { currentFinancialDocumentFilterCapability, financialDocumentReference, financialDocumentKey } from './currentFinancialDocumentFilter'
import { documentFilterCapability, documentFilterDataset, documentFilterRequest } from './currentFinancialDocumentFilter.test-fixtures'
import { datasetConfigurationError, datasetFilters } from './reportDatasets'
import { financialFilterConditionTypes } from './currentFinancialFilterConditions'
import { reportConfigurationError } from './reportConfiguration'
import { encodeReportWorkspaceDraft, decodeReportWorkspaceDraft } from './reportWorkspaceDraft'
import { reportWorkspaceDraftCompatibility } from './reportWorkspaceDraftCompatibility'

it.each([0, 1, 2, 4])('supports condition %i independently of old five-field capability without conflating own sale/return IDs', condition => {
  const data = documentFilterRequest(condition, condition === 0 || condition === 1 ? [{ kind: 'return', id: '9223372036854775807' }] : undefined)
  const before = structuredClone(data)
  expect(datasetConfigurationError(data, documentFilterDataset)).toBeNull()
  expect(financialFilterConditionTypes(documentFilterDataset, data, 12)).toEqual([0, 1, 2, 4])
  expect(financialFilterConditionTypes(documentFilterDataset, data, 1)).toEqual([0, 2])
  expect(data).toEqual(before)
})
it.each([undefined, null, {}, { ...documentFilterCapability, version: 2 }, { ...documentFilterCapability, lookupPath: '/report/datasets/lookup' },
  { ...documentFilterCapability, conditions: [0, 2] }, { ...documentFilterCapability, field: { Type: 13, Name: 'Документ', Selectable: true } },
])('rejects unsupported capability %# and retains the selection', capability => {
  const dataset = { ...documentFilterDataset, currentFinancialDocumentFilter: capability }, data = documentFilterRequest()
  expect(currentFinancialDocumentFilterCapability(dataset)).toBeUndefined()
  expect(datasetFilters(dataset, data).some(option => option.field.Type === 12)).toBe(false)
  expect(datasetConfigurationError(data, dataset)).toContain('сервер не підтвердив')
  expect(data.selections).toEqual(documentFilterRequest().selections)
})
it.each([{ profitReadMode: 1 }, { profitReadMode: undefined }, { dayOrganizationBasis: 1 }, { dayOrganizationBasis: undefined }])(
  'refuses unsupported mode without dropping fields, dates or identities %#', mode => {
    const data = { ...documentFilterRequest(), ...mode }, before = structuredClone(data)
    expect(datasetFilters(documentFilterDataset, data).map(item => item.field.Type)).toEqual([0, 1, 2, 6, 9])
    expect(reportConfigurationError(data, documentFilterDataset)).toContain('лише для поточних документів')
    expect(data).toEqual(before)
  })
it('adds only current35 field12; base metadata, source38 and historical choices stay unchanged', () => {
  expect(documentFilterDataset.Filters.map(f => f.Type)).toEqual([0, 1, 2, 6, 9])
  expect(datasetFilters(documentFilterDataset, documentFilterRequest()).map(f => f.field.Type)).toEqual([0, 1, 2, 6, 9, 12])
  expect(datasetFilters(documentFilterDataset).map(f => f.field.Type)).toEqual([0, 1, 2, 6, 9])
  expect(currentFinancialDocumentFilterCapability({ ...documentFilterDataset, DataSource: 38 })).toBeUndefined()
})
it.each([null, 42, 'sale:42', { kind: 'Sale', id: '42' }, { kind: 'sale', id: '01' }, { kind: 'sale', id: '0' },
  { kind: 'sale', id: '-1' }, { kind: 'sale', id: '9223372036854775808' }, { kind: 'sale', id: 9007199254740992 },
  { kind: 'sale', id: '42', Name: 'wrapper' }, { kind: 'sale', id: '42', Id: '43' },
  '{"kind":"sale","id":"42","id":"43"}', '{"kind":"sale","id":9007199254740993}', '{"kind":"sale","id":1e2}', '{"kind":"sale","id":1.0}',
])('rejects malformed or ambiguous references %#', value => expect(financialDocumentReference(value)).toBeNull())
it('accepts exact string Int64 and safe legacy numbers, preserving qualified identity', () => {
  expect(financialDocumentReference('{"Kind":"return","ID":"9223372036854775807"}')).toEqual({ kind: 'return', id: '9223372036854775807' })
  expect(financialDocumentReference({ kind: 'sale', id: 42 })).toEqual({ kind: 'sale', id: '42' })
  expect(financialDocumentKey({ kind: 'sale', id: '42' })).not.toBe(financialDocumentKey({ kind: 'return', id: '42' }))
})
it('enforces cardinality, total bound and canonical refs while allowing duplicate list entries', () => {
  for (const condition of [0, 1, 3, 5, 6, 7]) expect(datasetConfigurationError(documentFilterRequest(condition), documentFilterDataset)).not.toBeNull()
  expect(datasetConfigurationError(documentFilterRequest(2, []), documentFilterDataset)).not.toBeNull()
  expect(datasetConfigurationError(documentFilterRequest(4, Array.from({ length: 101 }, () => ({ kind: 'sale', id: '42' }))), documentFilterDataset)).not.toBeNull()
  expect(datasetConfigurationError(documentFilterRequest(4, [{ kind: 'sale', id: '42' }, { kind: 'sale', id: '42' }]), documentFilterDataset)).toBeNull()
})
it('restores exact JSON draft refs and dates, including a valid unfinished document picker', () => {
  const data = documentFilterRequest(), snapshot = { name: 'Документи', data, measurements: [], activeTemplate: null, previousPeriod: { from: data.from, to: data.to } }
  const encoded = encodeReportWorkspaceDraft({ version: 1, ownerId: 'test', savedAt: '2026-10-25T00:00:00.000Z', snapshot })
  expect(encoded.ok).toBe(true); if (!encoded.ok) throw Error('Expected valid draft')
  const restored = decodeReportWorkspaceDraft(encoded.value, 'test'); expect(restored.ok).toBe(true)
  if (!restored.ok) throw Error('Expected readable draft')
  expect(restored.data.snapshot).toEqual(snapshot)
  expect(reportWorkspaceDraftCompatibility(restored.data.snapshot, documentFilterDataset)).toBeNull()
  restored.data.snapshot.data.from = '2026-10-18'
  expect(restored.data.snapshot.data.selections).toEqual(data.selections)
  expect(reportWorkspaceDraftCompatibility({ ...snapshot, data: documentFilterRequest(0, []) }, documentFilterDataset)).toBeNull()
})
