import stockFixture from '../data/stockQuantityFilter.server-fixture.json'
import { stockQuantityFilterSupported } from '../data/stockQuantityFilter'
import { currentProductCapability } from '../data/workbookPresentation'
import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { previewStockReport } from '../api/reportsApi'
import fixture from '../data/currentProductColumns.server-fixture.json'
import previous from '../data/currentProductGroups.server-fixture.json'
import { ReportPreviewPages } from './ReportPreviewPages'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api=vi.mocked(apiRequest)
beforeEach(()=>{api.mockReset()});afterEach(cleanup)
async function requestFromServer(raw:unknown){api.mockResolvedValue([{Id:'actual-v4',Revision:1,Name:'Реквізити товару',Data:raw}]);return (await getServerReportTemplates())[0].Data}
it('binds actual ten-field escaped HTTP pages0→2→0 with exact field order, financial cells and snapshot',async()=>{
 api.mockResolvedValue(fixture.datasets);const datasets=await getReportDatasets();expect(datasets).toHaveLength(42)
 const stock= datasets.find(item=>item.DataSource===45)
 expect(stockQuantityFilterSupported(stock)).toBe(true)
 expect(stock?.stockQuantityFilter).toEqual(stockFixture.dataset.stockQuantityFilter)
 const dataset=datasets.find(item=>item.DataSource===2)
 if(!dataset)throw new Error('Missing actual source2 dataset')
 expect(currentProductCapability(dataset)?.additionalFields.find(field=>field.type===70)?.caption).toBe('Нотатки (поточний товар)')
 expect(dataset.workbookPresentation).toEqual(previous.dataset.workbookPresentation)
 expect(dataset.currentProductGroupLists).toEqual(previous.dataset.currentProductGroupLists)
 const request=await requestFromServer(fixture.request), first=fixture.page0, second=fixture.page2
 expect(second.ResultSha256).toBe(first.ResultSha256);expect(second.RequestSha256).toBe(first.RequestSha256)
 expect(second.Preview.Totals.Values).toEqual(first.Preview.Totals.Values)
 api.mockImplementation(async(url,options)=>{
  if(url==='/report/stocks/preview/capabilities')return{Version:2,ExplicitExport:true,MaximumPageRows:200,TimeToLiveSeconds:900}
  if(url==='/report/stocks/preview')return first
  if(url===`/report/stocks/preview/${first.ResultId}`)return options?.query?.rowOffset===2?second:first
  throw new Error(`Unexpected route ${url}`)
 })
 const initial=await previewStockReport(request,dataset)
 expect(api).toHaveBeenLastCalledWith('/report/stocks/preview',expect.objectContaining({query:{rowOffset:0,rowLimit:2,previewVersion:2},body:request}))
 expect(initial.preview.Cells).toEqual(first.Preview.Cells)
 expect(initial.preview.WorkbookPresentation?.selection.additionalFields).toEqual([2,3,65,66,67,68,69,70,73,74])
 const values=initial.preview.WorkbookPresentation!.rows[0].values
 expect(values.filter(value=>value.type!==67).every(value=>value.values[0].length===4096)).toBe(true)
 expect(values.find(value=>value.type===67)?.references).toEqual(first.Preview.workbookPresentation.rows[0].values.find(value=>value.type===67)?.references)
 render(<MantineProvider env="test"><ReportPreviewPages initial={initial.preview} request={request}/></MantineProvider>)
 expect(screen.getByText('1–2 із 4')).toBeTruthy()
 const headers=screen.getAllByRole('columnheader').map(node=>node.textContent)
 for(const field of first.Preview.workbookPresentation.fields)expect(headers).toContain(field.caption)
 fireEvent.click(screen.getByRole('button',{name:'Наступні рядки'}));await screen.findByText('3–4 із 4')
 expect(api).toHaveBeenLastCalledWith(`/report/stocks/preview/${first.ResultId}`,expect.objectContaining({query:{rowOffset:2,rowLimit:2,columnOffset:0,columnLimit:1}}))
 fireEvent.click(screen.getByRole('button',{name:'Попередні рядки'}));await screen.findByText('1–2 із 4')
 expect(api).toHaveBeenLastCalledWith(`/report/stocks/preview/${first.ResultId}`,expect.objectContaining({query:{rowOffset:0,rowLimit:2,columnOffset:0,columnLimit:1}}))
 expect(api.mock.calls.filter(([url])=>url==='/report/stocks/preview')).toHaveLength(1)
})
it('renders actual Notes independently from Description and preserves empty strings versus unknown scalar values',async()=>{
 const request=await requestFromServer(fixture.statesRequest)
 api.mockResolvedValue(fixture.states);const {preview}=await previewStockReport(request)
 expect(preview.Cells).toEqual(fixture.states.Preview.Cells)
 const rows=preview.WorkbookPresentation!.rows
 expect(rows[0].values.find(value=>value.type===70)?.values).toEqual(['Comment, not description'])
 expect(rows[1].values.find(value=>value.type===69)).toMatchObject({state:'known',values:['']})
 expect(rows[1].values.find(value=>value.type===70)).toMatchObject({state:'null',values:[]})
 render(<MantineProvider env="test"><ReportPreviewPages initial={preview} request={request}/></MantineProvider>)
 expect(screen.getByRole('rowheader',{name:'Comment, not description'})).toBeTruthy()
 expect(screen.getByRole('columnheader',{name:'Нотатки (поточний товар)'})).toBeTruthy()
 expect(screen.getByRole('columnheader',{name:'Опис (поточний товар)'})).toBeTruthy()
 expect(screen.queryByText('NameUA')).toBeNull()
})
