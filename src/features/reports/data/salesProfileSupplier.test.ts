import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { createStockReport } from '../api/reportsApi'
import { normalizeSavedTemplate, parseReportDatasets } from '../api/reportWorkspaceApi'
import { datasetConfigurationError, datasetGroupings, defaultDatasetRequest } from './reportDatasets'
import { salesConstructorDataset, salesConstructorRequest, salesConstructorWorkbook } from './salesConstructorProfiles'
import { supplierField, supplierProfileDataset as dataset } from './salesProfileSupplier.test-fixtures'
import type { ReportDataset } from '../types'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
beforeEach(() => vi.mocked(apiRequest).mockReset())
const chosen = (profile: 'sales' | 'grossProfit') => {
  const request = salesConstructorRequest(defaultDatasetRequest(dataset, '2026-10-19', '2026-10-27'), salesConstructorWorkbook(profile), dataset)
  return { ...request, sorted: { ...request.sorted, Row: [{ type: 21, key: 'Supplier', label: supplierField.Name }], Col: [], Measurements: request.sorted.Measurements.slice().reverse() } }
}
it.each(['sales', 'grossProfit'] as const)('admits server Supplier only for %s and retains exact saved axis/measure wire', async profile => {
  const parsed = parseReportDatasets([dataset])[0]
  const base = JSON.stringify(parsed)
  const effective = salesConstructorDataset(parsed, profile)!
  expect(effective.Groupings.at(-1)).toEqual(supplierField)
  expect(effective.Groupings.slice(0, -1)).toEqual(parsed.Groupings)
  expect(datasetGroupings(parsed)).not.toContainEqual(expect.objectContaining({ type: 21 }))
  expect(datasetGroupings(parsed, chosen(profile))).toContainEqual(expect.objectContaining({ type: 21, label: 'Постачальник' }))
  expect(datasetConfigurationError(chosen(profile), parsed)).toBeNull()
  const saved = normalizeSavedTemplate({ Id: 'supplier-template', Revision: 1, UpdatedAtUtc: '2026-10-29T00:00:00Z', Name: 'Постачальники', Data: { DataSource: 2, From: chosen(profile).from, To: chosen(profile).to, Sorted: chosen(profile).sorted, Selections: [], ReportProfile: profile } })
  expect(saved.Data.sorted.Row).toEqual(chosen(profile).sorted.Row)
  expect(datasetConfigurationError(saved.Data, parsed)).toBeNull()
  vi.mocked(apiRequest).mockResolvedValue({ DocumentURL: '/files/report.xlsx' })
  await createStockReport(saved.Data, parsed)
  expect(apiRequest).toHaveBeenCalledWith('/report/stocks/generate', expect.objectContaining({ body: expect.objectContaining({ reportProfile: profile,
    sorted: expect.objectContaining({ Row: chosen(profile).sorted.Row, Measurements: chosen(profile).sorted.Measurements }) }) }))
  expect(JSON.stringify(parsed)).toBe(base)
})
it('deduplicates already advertised fields without changing base captions or measure order', () => {
  const base = { ...dataset, Groupings: [...dataset.Groupings, { ...supplierField, Name: 'Існуюча назва' }] }
  const effective = salesConstructorDataset(base, 'sales')!
  expect(effective.Groupings).toEqual(base.Groupings)
  expect(effective.Measurements.map(field => field.Type)).toEqual(salesConstructorDataset({ ...base, profileGroupings: undefined }, 'sales')!.Measurements.map(field => field.Type))
})
it.each([undefined, {}, { grossProfit: [supplierField] }, { sales: [] }, { sales: [{ ...supplierField, Selectable: false }] }, { sales: [{ ...supplierField, Type: '21' }] }])(
  'keeps saved Supplier settings blocked when sales capability is missing or malformed: %j', profileGroupings => {
    const old = { ...dataset, profileGroupings }
    expect(datasetGroupings(old, chosen('sales')).some(field => field.type === 21)).toBe(false)
    expect(datasetConfigurationError(chosen('sales'), old)).not.toBeNull()
  })
it.each([undefined, '', 'unknown', { invalid: true }])('never promotes a profile-only axis for profile %j', profile => {
  expect(salesConstructorDataset(dataset, profile)!.Groupings.some(field => field.Type === 21)).toBe(false)
})
it('does not use another source or unadvertised profile as authority', () => {
  for (const modified of [{ ...dataset, DataSource: 3 }, { ...dataset, reportProfiles: [] }, { ...dataset, reportProfiles: ['grossProfit'] }])
    expect(salesConstructorDataset(modified, 'sales')!.Groupings.some(field => field.Type === 21)).toBe(false)
})
it.each([
  { other: [supplierField] }, { sales: [supplierField, supplierField] }, { sales: [{ ...supplierField, Type: 12 }] },
  { sales: [{ ...supplierField, Name: '' }] }, { sales: [{ Type: 21, Name: 'Постачальник' }] },
  { sales: '21' }, [], null,
])('rejects malformed HTTP profile capability rather than enabling supplier: %j', profileGroupings => {
  expect(() => parseReportDatasets([{ ...dataset, profileGroupings }])).toThrow('некоректний список')
})
it('rejects profile capabilities attached to another dataset in HTTP metadata', () => {
  expect(() => parseReportDatasets([{ ...dataset, DataSource: 3 } as ReportDataset])).toThrow('некоректний список')
})
