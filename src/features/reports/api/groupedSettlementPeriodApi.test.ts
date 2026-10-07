import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { createStockReport, previewStockReport, searchDatasetReportValues } from './reportsApi'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from './reportWorkspaceApi'
import { groupedSettlementDataset as dataset, groupedSettlementRequest as request } from '../data/groupedSettlementPeriod.test-fixtures'
import { requestGroupedSettlementPeriod } from '../data/groupedSettlementPeriod'
import { currentVparivaniePreview } from '../data/currentVparivanie.test-fixtures'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
beforeEach(() => api.mockReset())

it('admits separate grouped capabilities and reads only exact current native lookup identities', async () => {
  api.mockResolvedValue([dataset])
  await expect(getReportDatasets()).resolves.toEqual([dataset])
  api.mockResolvedValue([{ Id: '9007199254740993', Name: 'Native agreement [9007199254740993]' }])
  await expect(searchDatasetReportValues(41, 9, { value: 'Native', offset: 0, limit: 30 })).resolves.toMatchObject([{ Id: '9007199254740993' }])
  expect(api).toHaveBeenLastCalledWith('/report/datasets/lookup', expect.objectContaining({
    query: { dataSource: 41, field: 9, value: 'Native', offset: 0, limit: 30 },
  }))
})

it('roundtrips a Pascal grouped template without adding an exact agreement and rejects double aliases', async () => {
  const current = request()
  const wire = { Id: crypto.randomUUID(), Revision: 1, Name: 'Buyer period', UpdatedAtUtc: '2026-09-13T00:00:00Z', Data: {
    DataSource: 41, From: current.from, To: current.to, Sorted: current.sorted, Selections: [],
    GroupedSettlementPeriod: current.groupedSettlementPeriod, SourceBuyerSubtree: current.sourceBuyerSubtree,
  } }
  api.mockResolvedValue([wire])
  const [saved] = await getServerReportTemplates()
  expect(requestGroupedSettlementPeriod(saved.Data)).toEqual(current.groupedSettlementPeriod)
  expect(saved.Data).not.toHaveProperty('settlementPeriod')
  api.mockResolvedValue(wire)
  await saveServerReportTemplate(saved)
  expect(api).toHaveBeenLastCalledWith('/report/templates/save', expect.objectContaining({ body: expect.objectContaining({ Data: saved.Data }) }))
  api.mockClear()
  await expect(createStockReport({ ...current, GroupedSettlementPeriod: current.groupedSettlementPeriod })).rejects.toThrow('двічі')
  expect(api).not.toHaveBeenCalled()
})

it('captures grouped scope and filters before preview await and shares the exact request with XLSX/PDF run', async () => {
  const Preview = currentVparivaniePreview()
  Reflect.deleteProperty(Preview, 'CurrentVparivanieProducts')
  Preview.Request.DataSource = 'NativeSettlementPeriod'
  let complete!: (value: unknown) => void
  api.mockImplementationOnce(() => new Promise(resolve => { complete = resolve }))
  const current = request()
  const pending = previewStockReport(current)
  const expected = structuredClone(current)
  Reflect.set(current.groupedSettlementPeriod as object, 'SourceWorld', 'Amg')
  current.sorted.Row.pop()
  complete({ Preview })
  await expect(pending).resolves.toMatchObject({ preview: { Request: { DataSource: 'NativeSettlementPeriod' } } })
  expect(api.mock.calls[0][1]?.body).toEqual(expected)
  api.mockResolvedValue({ DocumentURL: '/reports/selected.xlsx', PdfDocumentURL: '/reports/selected.pdf' })
  await createStockReport(expected)
  expect(api.mock.calls[1][1]?.body).toEqual(expected)
})
