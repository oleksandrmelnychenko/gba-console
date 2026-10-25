import type { ReportRequestBody } from '../types'
import { currencyCapability, currencySelection } from './reportPresentationCurrency.test-fixtures'
import { expect, it } from 'vitest'
import { currentFinancialBuyerManagerFilterCapability, financialBuyerManagerReference } from './currentFinancialBuyerManagerFilter'
import { buyerManagerCapability, buyerManagerDataset, buyerManagerRequest, managerId, unassignedManagerId } from './currentFinancialBuyerManagerFilter.test-fixtures'
import { documentFilterCapability, documentFilterRequest } from './currentFinancialDocumentFilter.test-fixtures'
import { datasetConfigurationError, datasetFilters } from './reportDatasets'
import { financialFilterConditionTypes } from './currentFinancialFilterConditions'
import { reportConfigurationError } from './reportConfiguration'
import { encodeReportWorkspaceDraft, decodeReportWorkspaceDraft } from './reportWorkspaceDraft'
import { reportWorkspaceDraftCompatibility } from './reportWorkspaceDraftCompatibility'

it.each([0, 1, 2, 4])('supports manager condition %i independently of the original five-field marker', condition => {
  const data = buyerManagerRequest(condition, condition === 0 || condition === 1 ? [managerId] : undefined), before = structuredClone(data)
  expect(datasetConfigurationError(data, buyerManagerDataset)).toBeNull()
  expect(financialFilterConditionTypes(buyerManagerDataset, data, 60)).toEqual([0, 1, 2, 4])
  expect(financialFilterConditionTypes(buyerManagerDataset, data, 1)).toEqual([0, 2])
  expect(data).toEqual(before)
})
it('preserves non-symmetric SQL GUID bytes and distinguishes explicit zero from invalid identity', () => {
  expect(financialBuyerManagerReference({ Id: managerId })).toEqual({ Id: '33221100554477668899AABBCCDDEEFF' })
  expect(financialBuyerManagerReference(`{"id":"${managerId.toLowerCase()}"}`)).toEqual({ Id: managerId })
  expect(financialBuyerManagerReference({ ID: unassignedManagerId })).toEqual({ Id: unassignedManagerId })
  expect(financialBuyerManagerReference({ Id: managerId })).not.toEqual({ Id: '00112233445566778899AABBCCDDEEFF' })
})
it.each([null, undefined, 123, managerId, { Id: 123 }, { Id: '0x'+managerId }, { Id: managerId+' ' }, { Id: ' '+managerId },
  { Id: '00112233-4455-6677-8899-aabbccddeeff' }, { Id: 'G'.repeat(32) }, { Id: 'A'.repeat(31) },
  { Id: managerId, Name: 'wrapper' }, { Id: managerId, id: managerId }, `{"Id":"${managerId}","Id":"${managerId}"}`,
  `{"id":33221100554477668899}`, `{"Id":"${managerId}","name":"x"}`,
])('rejects nonexact or ambiguous references %#', value => expect(financialBuyerManagerReference(value)).toBeNull())
it.each([undefined, null, {}, { ...buyerManagerCapability, valueKind: 'nativeId' }, { ...buyerManagerCapability, version: 2 },
  { ...buyerManagerCapability, conditions: [0, 2] }, { ...buyerManagerCapability, lookupPath: '/report/datasets/lookup' },
])('refuses unsupported optional capability without clearing selections %#', currentFinancialBuyerManagerFilter => {
  const dataset = { ...buyerManagerDataset, currentFinancialBuyerManagerFilter }, data = buyerManagerRequest()
  expect(currentFinancialBuyerManagerFilterCapability(dataset)).toBeUndefined()
  expect(datasetConfigurationError(data, dataset)).toContain('сервер не підтвердив')
  expect(data).toEqual(buyerManagerRequest())
})
it.each([{ profitReadMode: 1 }, { profitReadMode: undefined }, { dayOrganizationBasis: 1 }, { dayOrganizationBasis: undefined }])(
  'keeps dates and manager selections while blocking incompatible modes %#', mode => {
    const data = { ...buyerManagerRequest(), ...mode }, before = structuredClone(data)
    expect(datasetFilters(buyerManagerDataset, data).map(x => x.field.Type)).toEqual([0, 1, 2, 6, 9])
    expect(reportConfigurationError(data, buyerManagerDataset)).toContain('лише для поточних документів')
    expect(data).toEqual(before)
  })
it('adds only current35 manager choice beside document and never changes the original five fields', () => {
  const dataset = { ...buyerManagerDataset, currentFinancialDocumentFilter: documentFilterCapability }
  const data: ReportRequestBody = buyerManagerRequest()
  data.selections.push(...documentFilterRequest().selections)
  expect(datasetConfigurationError(data, dataset)).toBeNull()
  expect(dataset.Filters.map(x => x.Type)).toEqual([0, 1, 2, 6, 9])
  expect(datasetFilters(dataset, data).map(x => x.field.Type)).toEqual([0, 1, 2, 6, 9, 12, 60])
  expect(currentFinancialBuyerManagerFilterCapability({ ...dataset, DataSource: 38 })).toBeUndefined()
})
it('enforces cardinality and normalized duplicates per selection, allowing independent AND conditions', () => {
  for (const condition of [0, 1, 3, 5, 6, 7]) expect(datasetConfigurationError(buyerManagerRequest(condition), buyerManagerDataset)).not.toBeNull()
  expect(datasetConfigurationError(buyerManagerRequest(2, []), buyerManagerDataset)).not.toBeNull()
  expect(datasetConfigurationError(buyerManagerRequest(2, [managerId, managerId.toLowerCase()]), buyerManagerDataset)).not.toBeNull()
  const data = buyerManagerRequest(0, [managerId]); data.selections.push(...buyerManagerRequest(1, [managerId]).selections)
  expect(datasetConfigurationError(data, buyerManagerDataset)).toBeNull()
  expect(datasetConfigurationError(buyerManagerRequest(2, Array.from({ length: 101 }, (_, i) => i.toString(16).padStart(32, '0').toUpperCase())), buyerManagerDataset)).not.toBeNull()
})
it('preserves exact saved JSON and permits an unfinished manager picker draft', () => {
  const data = buyerManagerRequest(), snapshot = { name: 'Менеджери', data, measurements: [], activeTemplate: null, previousPeriod: { from: data.from, to: data.to } }
  const encoded = encodeReportWorkspaceDraft({ version: 1, ownerId: 'test', savedAt: '2026-10-25T00:00:00.000Z', snapshot })
  expect(encoded.ok).toBe(true); if (!encoded.ok) throw Error('Expected valid draft')
  const restored = decodeReportWorkspaceDraft(encoded.value, 'test'); expect(restored.ok).toBe(true)
  if (!restored.ok) throw Error('Expected readable draft')
  expect(restored.data.snapshot).toEqual(snapshot)
  expect(reportWorkspaceDraftCompatibility(restored.data.snapshot, buyerManagerDataset)).toBeNull()
  expect(reportWorkspaceDraftCompatibility({ ...snapshot, data: buyerManagerRequest(0, []) }, buyerManagerDataset)).toBeNull()
})

it('retains document/FX sibling settings and exact manager data through draft admission', () => {
  const dataset = { ...buyerManagerDataset, currentFinancialDocumentFilter: documentFilterCapability,
    currentFinancialPresentationCurrency: currencyCapability }
  const data: ReportRequestBody = { ...buyerManagerRequest(), presentationCurrency: currencySelection }
  data.selections.push(...documentFilterRequest(0, [{ kind: 'sale', id: '9007199254740993' }]).selections)
  const before = structuredClone(data)
  expect(datasetConfigurationError(data, dataset)).toBeNull()
  expect(reportConfigurationError(data, dataset, true)).toBeNull()
  expect(data).toEqual(before)
})

it('uses Data identity rather than the legacy numeric marker', () => {
  const data = buyerManagerRequest(0, [managerId])
  data.selections[0].Values[0].Value = 42
  expect(datasetConfigurationError(data, buyerManagerDataset)).toBeNull()
  expect(data.selections[0].Values[0].Data).toEqual({ Id: managerId })
})
