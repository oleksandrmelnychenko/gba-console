import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getSettlementCounterpartyGroups } from './counterpartyGroupsApi'
import { getReportDatasets } from './reportWorkspaceApi'
import { createStockReport, previewStockReport } from './reportsApi'
import { groupedSettlementRequest } from '../data/groupedSettlementPeriod.test-fixtures'
import { groupDataset, groupId, groupSelection } from '../data/sourceCounterpartyGroups.test-fixtures'
import { currentVparivaniePreview } from '../data/currentVparivanie.test-fixtures'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
beforeEach(() => api.mockReset())

it('admits the optional group cap and searches exact current folder choices with cancellation', async () => {
  api.mockResolvedValue([groupDataset]); await expect(getReportDatasets()).resolves.toEqual([groupDataset])
  const signal = new AbortController().signal
  api.mockResolvedValue([{ Id: groupId(1), Name: 'Покупці Київ' }])
  await expect(getSettlementCounterpartyGroups('Київ', 0, 30, signal)).resolves.toEqual([{ Id: groupId(1), Name: 'Покупці Київ' }])
  expect(api).toHaveBeenLastCalledWith('/report/datasets/41/counterparty-groups', { query: { value: 'Київ', offset: 0, limit: 30 }, signal })
  api.mockResolvedValue([{ Id: 1, Name: 'wrong native ID' }]); await expect(getSettlementCounterpartyGroups()).rejects.toThrow('некоректну')
})

it('captures source group lists before preview await and sends the identical scope to XLSX/PDF run', async () => {
  const Preview = currentVparivaniePreview(); Reflect.deleteProperty(Preview, 'CurrentVparivanieProducts')
  Preview.Request.DataSource = 'NativeSettlementPeriod'
  let complete!: (value: unknown) => void
  api.mockImplementationOnce(() => new Promise(resolve => { complete = resolve }))
  const current = { ...groupedSettlementRequest(), sourceCounterpartyGroups: structuredClone(groupSelection) }
  const expected = structuredClone(current); const pending = previewStockReport(current)
  current.sourceCounterpartyGroups.ExcludeGroupIds.push(groupId(3))
  complete({ Preview }); await pending
  expect(api.mock.calls[0][1]?.body).toEqual(expected)
  api.mockResolvedValue({ DocumentURL: '/groups.xlsx', PdfDocumentURL: '/groups.pdf' })
  await createStockReport(expected); expect(api.mock.calls[1][1]?.body).toEqual(expected)
})
