import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach,beforeEach,expect,it,vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getReportDatasets,getServerReportTemplates } from '../api/reportWorkspaceApi'
import { previewStockReport } from '../api/reportsApi'
import { positiveClosingQuantity } from '../data/stockQuantityFilter'
import fixture from '../data/stockQuantityFilter.server-fixture.json'
import { ReportPreviewPages } from './ReportPreviewPages'
vi.mock('../../../shared/api/apiClient',()=>({apiRequest:vi.fn()}))
const api=vi.mocked(apiRequest)
beforeEach(()=>{api.mockReset()});afterEach(cleanup)
it('binds actual grouped positive quantities and unknown money to one cached result, preserving tiny positive rows',async()=>{
 api.mockResolvedValue([fixture.dataset]);const [dataset]=await getReportDatasets()
 api.mockResolvedValue([{Id:'positive-stock',Revision:1,Name:'Додатні групи',Data:fixture.request}]);const [saved]=await getServerReportTemplates()
 const request=saved.Data, before=structuredClone(request), first=fixture.page0, second=fixture.page1
 expect(request.StockQuantityFilter).toEqual(positiveClosingQuantity)
 expect(first.RequestSha256).toBe(second.RequestSha256);expect(first.ResultSha256).toBe(second.ResultSha256)
 expect(first.Preview.Totals.Values).toEqual(second.Preview.Totals.Values)
 api.mockImplementation(async(url,options)=>{
  if(url==='/report/stocks/preview/capabilities')return{Version:2,ExplicitExport:true,MaximumPageRows:200,TimeToLiveSeconds:900}
  if(url==='/report/stocks/preview')return first
  if(url===`/report/stocks/preview/${first.ResultId}`)return options?.query?.rowOffset===1?second:first
  throw new Error(`Unexpected route ${url}`)
 })
 const initial=await previewStockReport(request,dataset)
 expect(api).toHaveBeenLastCalledWith('/report/stocks/preview',expect.objectContaining({body:request,query:{rowOffset:0,rowLimit:50,previewVersion:2}}))
 expect(initial.preview.Cells).toEqual(first.Preview.Cells)
 const column=first.Preview.Columns.find(item=>item.Values.some(value=>value.Identity.Value==='StockPeriodClosingQuantity'))
 if(!column)throw new Error('Missing actual closing quantity column')
 expect(first.Preview.Cells.find(cell=>cell.ColumnSourceIndex===column.SourceIndex)?.Value.Value).toBe('0.00400000')
 expect(second.Preview.Cells.find(cell=>cell.ColumnSourceIndex===column.SourceIndex)?.Value.Value).toBe('3.00000000')
 expect(first.Preview.Totals.Values.find(cell=>cell.ColumnSourceIndex===column.SourceIndex)?.Value.Value).toBe('3.00400000')
 for(const field of ['StockPeriodClosingValue','StockPeriodClosingVat']){
  const money=first.Preview.Columns.find(item=>item.Values.some(value=>value.Identity.Value===field))
  if(!money)throw new Error('Missing actual money column')
  expect(first.Preview.Totals.Values.find(cell=>cell.ColumnSourceIndex===money.SourceIndex)?.Value.Kind).toBe('null')
 }
 expect(initial.preview.Request?.Filters).toContainEqual({Field:'Кінцевий залишок: кількість',Condition:'більше',Values:['0'],IgnoredReason:null})
 render(<MantineProvider env="test"><ReportPreviewPages initial={initial.preview} request={request}/></MantineProvider>)
 expect(screen.getByRole('rowheader',{name:'Склад малий'})).toBeTruthy()
 expect(screen.getByText('1–1 із 2')).toBeTruthy()
 fireEvent.click(screen.getByRole('button',{name:'Наступні рядки'}));await screen.findByText('2–2 із 2')
 expect(screen.getByRole('rowheader',{name:'Склад позитивний'})).toBeTruthy()
 expect(api).toHaveBeenLastCalledWith(`/report/stocks/preview/${first.ResultId}`,expect.objectContaining({query:{rowOffset:1,rowLimit:50,columnOffset:0,columnLimit:12}}))
 fireEvent.click(screen.getByRole('button',{name:'Попередні рядки'}));await screen.findByText('1–1 із 2')
 expect(api.mock.calls.filter(([url])=>url==='/report/stocks/preview')).toHaveLength(1)
 expect(request).toEqual(before)
})
