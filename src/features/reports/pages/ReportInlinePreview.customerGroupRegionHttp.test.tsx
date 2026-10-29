import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { previewStockReport } from '../api/reportsApi'
import fixture from '../data/customerGroupRegion.server-fixture.json'
import { ReportPreviewPages } from './ReportPreviewPages'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
it('binds actual source44 current-region request and cached pages without changing sets, unknown quantities or per-set grands', async () => {
  const api = vi.mocked(apiRequest)
  api.mockResolvedValue([fixture.dataset]); const [dataset] = await getReportDatasets()
  expect(dataset.Filters.find(field => field.Type === 7)).toMatchObject({ Name: 'Поточний регіон клієнта' })
  expect(dataset.Filters.find(field => field.Type === 7)?.hierarchy).toBeUndefined()
  api.mockResolvedValue([{ Id: 'region44-wire', Revision: 1, Name: 'Набори', Data: fixture.request }])
  const [template] = await getServerReportTemplates()
  api.mockResolvedValueOnce({ Version: 2, ExplicitExport: true, MaximumPageRows: 200, TimeToLiveSeconds: 900 }).mockResolvedValueOnce(fixture.page0)
  const { preview } = await previewStockReport(template.Data, dataset)
  const sent = api.mock.calls.find(([path]) => path === '/report/stocks/preview')?.[1]?.body
  expect(sent).toMatchObject({ customerGroups: fixture.request.CustomerGroups, selections: fixture.request.Selections, dataSource: 44 })
  expect(preview.Cells).toEqual(fixture.page0.Preview.Cells)
  expect(preview.Request?.IsCurrentSnapshot).toBe(false)
  expect(preview.Request?.Notes).toContain('Відбір використовує поточний регіон у картці клієнта; його зміна впливає й на звіти за минулі періоди.')
  expect(dataset.Filters.find(field => field.Type === 8)).toBeUndefined()
  expect(preview.Totals?.Values.map(cell => cell.Value.Kind === 'null' ? null : Number(cell.Value.Value))).toEqual([null,null,null,70,0,0, 0,null,null,0,-70,-100, null,null,null,70,0,0, 0,null,null,0,-70,-100])
  expect(fixture.page1.ResultSha256).toBe(fixture.page0.ResultSha256)
  expect(fixture.page1.Preview.Totals.Values).toEqual(fixture.page0.Preview.Totals.Values)
  const view = render(<MantineProvider env="test"><ReportPreviewPages initial={preview} request={template.Data} /></MantineProvider>)
  const quantity = view.container.querySelector('tbody tr:not(.report-inline-preview__group-total) td')!
  expect(quantity.textContent).toBe('∅')
  expect(quantity.getAttribute('aria-description')).toContain('Без підтвердженої одиниці документа')
  api.mockResolvedValue(fixture.page1)
  fireEvent.click(screen.getByRole('button', { name: 'Наступні рядки' }))
  await screen.findByText('2–2 із 2')
  expect(api).toHaveBeenLastCalledWith(expect.stringContaining('/report/stocks/preview/'), expect.objectContaining({ query: expect.objectContaining({ rowOffset: 1 }) }))
  api.mockResolvedValue(fixture.page0)
  fireEvent.click(screen.getByRole('button', { name: 'Попередні рядки' }))
  await screen.findByText('1–1 із 2')
  await waitFor(() => expect(api).toHaveBeenLastCalledWith(expect.stringContaining('/report/stocks/preview/'), expect.objectContaining({ query: expect.objectContaining({ rowOffset: 0 }) })))
  expect(api.mock.calls.filter(([path]) => path === '/report/stocks/preview')).toHaveLength(1)
  expect(template.Data.customerGroups).toEqual(fixture.request.CustomerGroups)
  expect(template.Data.selections).toEqual(fixture.request.Selections)
})
