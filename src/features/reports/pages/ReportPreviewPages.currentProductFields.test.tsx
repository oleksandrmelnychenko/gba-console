import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { exportStockReportPreview, previewStockReport } from '../api/reportsApi'
import { longProductRequest, longProductResponse } from '../data/currentProductFields.long-server-fixture'
import attributes from '../data/currentProductFields.server-fixture.json'
import details from '../data/documentDetails.server-fixture.json'
import { ReportPreviewPages } from './ReportPreviewPages'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
beforeEach(() => { api.mockReset() })
afterEach(cleanup)
it('requests five-row pages for long current fields and moves 0→5→0 through the same immutable report and totals', async () => {
  const first = longProductResponse(0), second = longProductResponse(5)
  expect(first.Preview.Page.Limit).toBe(5)
  expect(second.ResultSha256).toBe(first.ResultSha256)
  expect(second.RequestSha256).toBe(first.RequestSha256)
  expect(second.Preview.Totals.Values).toEqual(first.Preview.Totals.Values)
  api.mockResolvedValue([{ ...details.dataset, workbookPresentation: attributes.capability }]); const [dataset] = await getReportDatasets()
  api.mockResolvedValue([{ Id: 'long-server-product-fixture', Revision: 1, UpdatedAtUtc: '2026-10-29T00:00:00Z', Name: 'Довгий опис', Data: longProductRequest }])
  const [saved] = await getServerReportTemplates(), request = saved.Data
  api.mockImplementation(async (url, options) => {
    if (url === '/report/stocks/preview/capabilities') return { Version: 2, ExplicitExport: true, MaximumPageRows: 200, TimeToLiveSeconds: 900 }
    if (url === '/report/stocks/preview') return first
    if (url === `/report/stocks/preview/${first.ResultId}`) return options?.query?.rowOffset === 5 ? second : first
    if (url === `/report/stocks/preview/${first.ResultId}/export`) return { ...first, DocumentURL: '/files/full-report.xlsx' }
    throw new Error(`Unexpected route: ${url}`)
  })
  const initial = await previewStockReport(request, dataset)
  expect(api).toHaveBeenLastCalledWith('/report/stocks/preview', expect.objectContaining({ query: { rowOffset: 0, rowLimit: 5, previewVersion: 2 } }))
  render(<MantineProvider env="test"><ReportPreviewPages initial={initial.preview} request={request} /></MantineProvider>)
  expect(screen.getByText('1–5 із 50')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Наступні рядки' }))
  await screen.findByText('6–10 із 50')
  expect(api).toHaveBeenLastCalledWith(`/report/stocks/preview/${first.ResultId}`, expect.objectContaining({ query: { rowOffset: 5, rowLimit: 5, columnOffset: 0, columnLimit: 1 } }))
  fireEvent.click(screen.getByRole('button', { name: 'Попередні рядки' }))
  await screen.findByText('1–5 із 50')
  expect(api).toHaveBeenLastCalledWith(`/report/stocks/preview/${first.ResultId}`, expect.objectContaining({ query: { rowOffset: 0, rowLimit: 5, columnOffset: 0, columnLimit: 1 } }))
  expect(api.mock.calls.filter(([url]) => url === '/report/stocks/preview')).toHaveLength(1)
  await exportStockReportPreview(initial.preview.ResultSession!)
  expect(api).toHaveBeenLastCalledWith(`/report/stocks/preview/${first.ResultId}/export`, expect.objectContaining({ method: 'POST', body: {} }))
})
