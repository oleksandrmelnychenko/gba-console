import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { createStockReport } from './reportsApi'
import { getServerReportTemplates, saveServerReportTemplate } from './reportWorkspaceApi'
import { stockQuantityDataset, stockQuantityRequest } from '../data/stockQuantityFilter.test-fixtures'
import { positiveClosingQuantity } from '../data/stockQuantityFilter'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
beforeEach(() => { api.mockReset() })
it('restores and saves the exact threshold with selected axes and period, without injecting absent legacy values', async () => {
  const request = stockQuantityRequest()
  const wire = { Id: 'stock', Revision: 1, Name: 'Додатні групи', Data: { DataSource: 45, From: request.from, To: request.to,
    Sorted: request.sorted, Selections: [], StockQuantityFilter: positiveClosingQuantity } }
  api.mockResolvedValue([wire]); const [saved] = await getServerReportTemplates()
  expect(saved.Data.StockQuantityFilter).toEqual(positiveClosingQuantity)
  saved.Data.from = '2026-10-01'
  api.mockResolvedValue({ ...wire, Revision: 2, Data: { ...wire.Data, From: saved.Data.from } })
  await saveServerReportTemplate(saved, undefined, stockQuantityDataset)
  expect(api).toHaveBeenLastCalledWith('/report/templates/save', expect.objectContaining({ body: expect.objectContaining({ Data: saved.Data }) }))
  api.mockResolvedValue({ document: {} }); await createStockReport(stockQuantityRequest())
  expect(api).toHaveBeenLastCalledWith('/report/stocks/generate', expect.objectContaining({ body: expect.not.objectContaining({ stockQuantityFilter: expect.anything() }) }))
})
it('refuses run and save for wrong measure or column grouping before any dispatch and retains all settings', async () => {
  const request = { ...stockQuantityRequest(), stockQuantityFilter: positiveClosingQuantity }
  request.sorted.Col = [{ type: 0, key: 'Year', label: 'Рік' }]
  const before = structuredClone(request)
  await expect(createStockReport(request)).rejects.toThrow('без групування колонок')
  await expect(saveServerReportTemplate({ Name: 'Збережений', Data: request }, undefined, stockQuantityDataset)).rejects.toThrow('без групування колонок')
  expect(api).not.toHaveBeenCalled(); expect(request).toEqual(before)
  request.sorted.Col = []; request.sorted.Measurements[0].IsChecked = false
  await expect(createStockReport(request)).rejects.toThrow('показник')
  expect(api).not.toHaveBeenCalled()
})
