import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { createStockReport, previewStockReport, searchDatasetReportValues } from './reportsApi'
import { getReportDatasets, saveServerReportTemplate } from './reportWorkspaceApi'
import { defaultDatasetRequest } from '../data/reportDatasets'
import { importedDiscountDataset } from '../data/importedSaleDiscount.test-fixtures'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
beforeEach(() => vi.clearAllMocks())

it('accepts full positive Int64 decimal-string lookup identities without numeric rounding', async () => {
  vi.mocked(apiRequest).mockResolvedValueOnce([importedDiscountDataset])
  expect(await getReportDatasets()).toEqual([importedDiscountDataset])
  vi.mocked(apiRequest).mockResolvedValueOnce([{ Id: '9007199254740993', Name: 'Договір' }])
  expect(await searchDatasetReportValues(32, 9, { value: 'Договір', offset: 0, limit: 30 }))
    .toEqual([{ Id: '9007199254740993', Name: 'Договір' }])
  vi.mocked(apiRequest).mockResolvedValueOnce([{ Id: '9223372036854775808', Name: 'Договір' }])
  await expect(searchDatasetReportValues(32, 9, { value: '', offset: 0, limit: 30 })).rejects.toThrow(/некоректні/)
  vi.mocked(apiRequest).mockResolvedValueOnce([{ Id: 42, Name: 'Договір' }])
  await expect(searchDatasetReportValues(32, 9, { value: '', offset: 0, limit: 30 })).rejects.toThrow(/некоректні/)
})

it('blocks generation, preview and template save until an exact agreement is selected', async () => {
  const request = defaultDatasetRequest(importedDiscountDataset, '2026-09-01', '2026-09-23')
  await expect(createStockReport(request)).rejects.toThrow(/Договір клієнта/)
  await expect(previewStockReport(request)).rejects.toThrow(/Договір клієнта/)
  await expect(saveServerReportTemplate({ Name: 'Discount', Data: request })).rejects.toThrow(/Договір клієнта/)
  expect(apiRequest).not.toHaveBeenCalled()
})
