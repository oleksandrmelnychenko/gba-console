import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { createStockReport, previewStockReport } from './reportsApi'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from './reportWorkspaceApi'
import { cashPeriodDataset, cashPeriodRequest, cashPeriodScope, cashPeriodManagementDataset,
  cashPeriodManagementRequest, cashPeriodManagementScope } from '../data/cashPeriod.test-fixtures'
import { currentVparivaniePreview } from '../data/currentVparivanie.test-fixtures'
import { cashPeriodConfigurationError } from '../data/cashPeriod'
import { retainStoredTemplateFields } from '../data/reportTemplateDraft'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
beforeEach(() => api.mockReset())

it('requires the exact advertised capability and fixed four by four shape', async () => {
  api.mockResolvedValue([cashPeriodDataset])
  await expect(getReportDatasets()).resolves.toEqual([cashPeriodDataset])
  api.mockResolvedValue([{ ...cashPeriodDataset, cashPeriod: undefined }])
  await expect(getReportDatasets()).rejects.toThrow('некоректний список')
  api.mockResolvedValue([{ ...cashPeriodDataset, Filters: [{ Type: 40, Name: 'Wrong' }] }])
  await expect(getReportDatasets()).rejects.toThrow('некоректний список')
  api.mockResolvedValue([{ ...cashPeriodDataset, DataSource: 39 }])
  await expect(getReportDatasets()).rejects.toThrow('некоректний список')
})

it('accepts v2 eight columns and preserves legacy four columns on a v2 server', async () => {
  api.mockResolvedValue([cashPeriodManagementDataset])
  await expect(getReportDatasets()).resolves.toEqual([cashPeriodManagementDataset])
  const eight = cashPeriodManagementRequest()
  expect(eight.sorted.Measurements.map(field => field.Type)).toEqual([84, 85, 86, 87, 92, 93, 94, 95])
  expect(cashPeriodConfigurationError(eight, cashPeriodManagementDataset, '2026-09-27')).toBeNull()
  expect(cashPeriodConfigurationError(cashPeriodRequest(), cashPeriodManagementDataset, '2026-09-27')).toBeNull()
  expect(cashPeriodConfigurationError(eight, cashPeriodDataset, '2026-09-27')).toMatch(/ще не підтримує/)
  expect(cashPeriodConfigurationError({ ...eight, sorted: cashPeriodRequest().sorted },
    cashPeriodManagementDataset, '2026-09-27')).toMatch(/фіксована/)
  expect(cashPeriodConfigurationError({ ...eight, cashPeriod: { ...cashPeriodManagementScope,
    CurrencyBasis: 'AccountCurrency' } }, cashPeriodManagementDataset, '2026-09-27')).toMatch(/точний рахунок/)
})

it('submits eight columns and exact v2 currency basis without adding a client currency assumption', async () => {
  const request = cashPeriodManagementRequest()
  api.mockResolvedValue({ document: {} })
  await createStockReport(request)
  expect(api).toHaveBeenCalledWith('/report/stocks/generate', expect.objectContaining({
    method: 'POST', body: request,
  }))
  expect(request.cashPeriod).toEqual(cashPeriodManagementScope)
})

it('accepts only completed Kyiv periods up to 31 inclusive days with an exact leg', () => {
  const request = cashPeriodRequest()
  expect(cashPeriodConfigurationError(request, cashPeriodDataset, '2026-09-27')).toBeNull()
  expect(cashPeriodConfigurationError({ ...request, from: '2026-09-01', to: '2026-10-01' }, cashPeriodDataset, '2026-10-02')).toBeNull()
  expect(cashPeriodConfigurationError({ ...request, from: '2026-09-01', to: '2026-10-02' }, cashPeriodDataset, '2026-10-03')).toMatch(/31 день/)
  expect(cashPeriodConfigurationError({ ...request, to: '2026-09-27' }, cashPeriodDataset, '2026-09-27')).toMatch(/завершені/)
  expect(cashPeriodConfigurationError({ ...request, cashPeriod: { ...cashPeriodScope, CurrencyRegisterId: Number(cashPeriodScope.CurrencyRegisterId) } }, cashPeriodDataset, '2026-09-27')).toMatch(/точний рахунок/)
  expect(cashPeriodConfigurationError({ ...request, cashPeriod: { ...cashPeriodScope, CurrencyBasis: 'ManagementCurrency' } }, cashPeriodDataset, '2026-09-27')).toMatch(/точний рахунок/)
  expect(cashPeriodConfigurationError({ ...request, dataSource: 36, cashPeriod: undefined, CashPeriod: cashPeriodScope }, undefined, '2026-09-27')).toMatch(/лише/)
  expect(cashPeriodConfigurationError({ ...request, selections: [{ IsChecked: false }] as typeof request.selections }, cashPeriodDataset, '2026-09-27')).toMatch(/фіксована/)
})

it('retains exact Int64 string and NetUID through a PascalCase saved template', async () => {
  const data = cashPeriodRequest()
  const wire = { Id: crypto.randomUUID(), Revision: 2, Name: 'Period cash', Data: {
    DataSource: 40, From: data.from, To: data.to, Sorted: data.sorted,
    Selections: [], CashPeriod: cashPeriodScope,
  } }
  api.mockResolvedValue([wire])
  const [template] = await getServerReportTemplates()
  expect(template.Data).toEqual(data)
  api.mockResolvedValue(wire)
  await saveServerReportTemplate(template)
  expect(api).toHaveBeenLastCalledWith('/report/templates/save', {
    method: 'POST', body: { Id: wire.Id, Revision: 2, Name: wire.Name, Data: data },
  })
})

it('removes a cleared saved account instead of silently reusing its old identity', () => {
  const stored = cashPeriodRequest()
  const draft = { ...stored, cashPeriod: undefined }
  const merged = retainStoredTemplateFields(stored, draft)
  expect(merged.cashPeriod).toBeUndefined()
  expect(cashPeriodConfigurationError(merged, cashPeriodDataset, '2026-09-27')).toMatch(/точний рахунок/)
})

it('refuses unavailable scope and wrong preview before showing another report', async () => {
  const request = cashPeriodRequest()
  await expect(createStockReport({ ...request, cashPeriod: undefined })).rejects.toThrow('точний рахунок')
  expect(api).not.toHaveBeenCalled()
  const Preview = currentVparivaniePreview()
  Preview.Request.DataSource = 'NativeAccountBalances'
  Reflect.deleteProperty(Preview, 'CurrentVparivanieProducts')
  api.mockResolvedValue({ Preview })
  await expect(previewStockReport(request)).rejects.toThrow('іншого набору')
  expect(api).toHaveBeenCalledOnce()
})
