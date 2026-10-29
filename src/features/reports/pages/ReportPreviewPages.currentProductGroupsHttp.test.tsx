import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { previewStockReport } from '../api/reportsApi'
import fixture from '../data/currentProductGroups.server-fixture.json'
import { ReportPreviewPages } from './ReportPreviewPages'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
beforeEach(() => { api.mockReset() })
afterEach(cleanup)

async function requestFromServer(raw: unknown) {
  api.mockResolvedValue([{ Id: 'groups-server-fixture', Revision: 1, Name: 'Поточні групи', Data: raw }])
  const [saved] = await getServerReportTemplates()
  return saved.Data
}

it('binds actual v3 HTTP lists and five-row cached pages without changing money, field order or snapshot', async () => {
  api.mockResolvedValue([fixture.dataset])
  const [dataset] = await getReportDatasets()
  const request = await requestFromServer(fixture.request)
  const first = fixture.page0, second = fixture.page5
  expect(dataset.workbookPresentation).toEqual(fixture.dataset.workbookPresentation)
  expect(first.Preview.workbookPresentation.version).toBe(3)
  expect(second.ResultSha256).toBe(first.ResultSha256)
  expect(second.RequestSha256).toBe(first.RequestSha256)
  expect(second.Preview.Totals.Values).toEqual(first.Preview.Totals.Values)
  api.mockImplementation(async (url, options) => {
    if (url === '/report/stocks/preview/capabilities') return { Version: 2, ExplicitExport: true, MaximumPageRows: 200, TimeToLiveSeconds: 900 }
    if (url === '/report/stocks/preview') return first
    if (url === `/report/stocks/preview/${first.ResultId}`) return options?.query?.rowOffset === 5 ? second : first
    throw new Error(`Unexpected route: ${url}`)
  })
  const initial = await previewStockReport(request, dataset)
  expect(api).toHaveBeenLastCalledWith('/report/stocks/preview', expect.objectContaining({ query: { rowOffset: 0, rowLimit: 5, previewVersion: 2 }, body: request }))
  expect(initial.preview.Cells).toEqual(first.Preview.Cells)
  expect(initial.preview.WorkbookPresentation?.selection.additionalFields).toEqual([2, 3, 65, 66, 67])
  expect(initial.preview.WorkbookPresentation?.rows[0].values[4].references).toEqual(first.Preview.workbookPresentation.rows[0].values[4].references)
  const captions = first.Preview.workbookPresentation.rows[0].values[4].references!.map(reference => reference.caption)
  expect(captions).toHaveLength(3)
  expect(captions[0]!.length).toBe(4096)
  render(<MantineProvider env="test"><ReportPreviewPages initial={initial.preview} request={request} /></MantineProvider>)
  expect(screen.getByText('1–5 із 10')).toBeTruthy()
  const groupList = screen.getAllByRole('list', { name: 'Групи поточного товару' })[0]
  expect(within(groupList).getAllByRole('listitem').map(item => item.textContent)).toEqual(captions)
  fireEvent.click(screen.getByRole('button', { name: 'Наступні рядки' }))
  await screen.findByText('6–10 із 10')
  expect(api).toHaveBeenLastCalledWith(`/report/stocks/preview/${first.ResultId}`, expect.objectContaining({ query: { rowOffset: 5, rowLimit: 5, columnOffset: 0, columnLimit: 1 } }))
  fireEvent.click(screen.getByRole('button', { name: 'Попередні рядки' }))
  await screen.findByText('1–5 із 10')
  expect(api).toHaveBeenLastCalledWith(`/report/stocks/preview/${first.ResultId}`, expect.objectContaining({ query: { rowOffset: 0, rowLimit: 5, columnOffset: 0, columnLimit: 1 } }))
  expect(api.mock.calls.filter(([url]) => url === '/report/stocks/preview')).toHaveLength(1)
})

it('renders actual known empty and unavailable list states without inventing a group or a zero', async () => {
  const request = await requestFromServer(fixture.statesRequest)
  api.mockResolvedValue(fixture.states)
  const { preview } = await previewStockReport(request)
  expect(preview.Cells).toEqual(fixture.states.Preview.Cells)
  const states = preview.WorkbookPresentation!.rows.map(row => row.values.find(value => value.type === 67)!)
  expect(states.map(value => value.state)).toEqual(['known', 'known', 'unavailable'])
  expect(states[0].references?.map(value => value.id)).toEqual(['2', '3', '4', '9'])
  expect(states[1].references).toEqual([])
  expect(states[2].references).toEqual([])
  render(<MantineProvider env="test"><ReportPreviewPages initial={preview} request={request} /></MantineProvider>)
  expect(screen.getByText('Немає груп')).toBeTruthy()
  const list = screen.getByRole('list', { name: 'Групи поточного товару' })
  expect(within(list).getAllByRole('listitem').map(item => item.textContent)).toEqual(['Same', 'Full', 'Без назви', 'Same'])
})
