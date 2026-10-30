import { defaultDatasetRequest, datasetGroupings, datasetFilters } from '../data/reportDatasets'
import { REPORT_FILTER_CONDITIONS } from '../data/reportOptions'
import actualStock from '../data/stockQuantityFilter.server-fixture.json'
import { normalizeNativeReportPreview } from '../data/nativeReportPreview'
import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach,beforeEach,expect,it,vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { previewStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets,getServerReportTemplates,parseReportDatasets } from '../api/reportWorkspaceApi'
import { netDataset } from '../data/reportDatasets.test-fixtures'
import { stockQuantityDataset,stockQuantityRequest } from '../data/stockQuantityFilter.test-fixtures'
import { positiveClosingQuantity } from '../data/stockQuantityFilter'
import { changeReportPeriod } from '../testing/reportPeriod'
import { ReportsStocksPage } from './ReportsStocksPage'
vi.mock('../../auth/useAuth',()=>({useAuth:()=>({user:null,hasPermission:()=>true})}))
vi.mock('../api/reportsApi',async original=>({...await original<typeof import('../api/reportsApi')>(),previewStockReport:vi.fn(),searchDatasetReportValues:vi.fn()}))
vi.mock('../api/reportWorkspaceApi',async original=>({...await original<typeof import('../api/reportWorkspaceApi')>(),getReportDatasets:vi.fn(),getServerReportTemplates:vi.fn()}))
beforeEach(()=>{
 vi.clearAllMocks();localStorage.clear();sessionStorage.clear();Object.defineProperty(HTMLElement.prototype,'scrollIntoView',{configurable:true,value:vi.fn()})
 vi.mocked(getReportDatasets).mockResolvedValue([netDataset,stockQuantityDataset]);vi.mocked(getServerReportTemplates).mockResolvedValue([]);vi.mocked(searchDatasetReportValues).mockResolvedValue([])
 vi.mocked(previewStockReport).mockResolvedValue({result:{document:{},raw:{}},preview:{Version:1,ResultSha256:'a'.repeat(64),PresentationOnly:true,Request:null,Page:{Offset:0,Limit:50,TotalVisibleRows:0,ReturnedRows:0,HasMore:false},RowSchema:[],ColumnSchema:[],Rows:[],Columns:[],Cells:[]}})
})
afterEach(cleanup)
async function ready(){const view=render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage/></I18nProvider></MantineProvider>);fireEvent.click(await screen.findByRole('button',{name:'Відкрити gba:stock-period-constructor:v1'}));await screen.findByRole('checkbox',{name:'Кінцевий залишок: кількість > 0'});return view}
it('opts in explicitly, retains dates, and blocks missing measure until repaired without clearing filter',async()=>{
 const view=await ready();const checkbox=screen.getByRole('checkbox',{name:'Кінцевий залишок: кількість > 0'});expect(checkbox).toHaveProperty('checked',false)
 fireEvent.click(checkbox);changeReportPeriod({from:'2026-09-02',to:'2026-09-04'})
 await act(async()=>fireEvent.submit(view.container.querySelector('form')!));await waitFor(()=>expect(previewStockReport).toHaveBeenCalledOnce())
 expect(vi.mocked(previewStockReport).mock.calls[0][0]).toMatchObject({dataSource:45,from:'2026-09-02',to:'2026-09-04',stockQuantityFilter:positiveClosingQuantity})
 fireEvent.click(screen.getByRole('checkbox',{name:/^Кінцевий залишок: кількість$/}));expect(checkbox).toHaveProperty('checked',true)
 expect(screen.getAllByText(/виберіть показник «Кінцевий залишок/).length).toBeGreaterThan(0)
 expect(screen.getByRole('button',{name:'Застосувати й показати'})).toHaveProperty('disabled',true)
 await act(async()=>fireEvent.submit(view.container.querySelector('form')!));expect(previewStockReport).toHaveBeenCalledOnce()
 fireEvent.click(checkbox);await act(async()=>fireEvent.submit(view.container.querySelector('form')!));await waitFor(()=>expect(previewStockReport).toHaveBeenCalledTimes(2));expect(vi.mocked(previewStockReport).mock.calls[1][0]).not.toHaveProperty('stockQuantityFilter')
})
it('loads an unsupported saved setting on an old server and lets the user explicitly remove it',async()=>{
 vi.mocked(getReportDatasets).mockResolvedValue([netDataset,{...stockQuantityDataset,stockQuantityFilter:undefined}]);vi.mocked(getServerReportTemplates).mockResolvedValue([{Id:'saved-stock',Revision:1,Name:'Збережений поріг',Data:{...stockQuantityRequest(),stockQuantityFilter:positiveClosingQuantity}}])
 const view=render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage/></I18nProvider></MantineProvider>);await screen.findByRole('button',{name:'Відкрити gba:stock-period-constructor:v1'});fireEvent.click(screen.getByRole('button',{name:'Шаблони'}));fireEvent.click(await screen.findByRole('button',{name:'Відкрити для редагування: Збережений поріг'}))
 const checkbox=await screen.findByRole('checkbox',{name:'Кінцевий залишок: кількість > 0'});expect(checkbox).toHaveProperty('checked',true);expect(screen.getAllByText(/Сервер ще не підтримує відбір/).length).toBeGreaterThan(0)
 await act(async()=>fireEvent.submit(view.container.querySelector('form')!));expect(previewStockReport).not.toHaveBeenCalled()
 fireEvent.click(checkbox);await act(async()=>fireEvent.submit(view.container.querySelector('form')!));await waitFor(()=>expect(previewStockReport).toHaveBeenCalledOnce());expect(vi.mocked(previewStockReport).mock.calls[0][0]).not.toHaveProperty('stockQuantityFilter')
})

it('keeps a saved date axis and threshold visible until the user explicitly repairs the grouping',async()=>{
 const request=stockQuantityRequest();request.sorted.Row.unshift({type:0,key:'Year',label:'Рік'})
 vi.mocked(getServerReportTemplates).mockResolvedValue([{Id:'date-stock',Revision:1,Name:'Залишок за роком',Data:{...request,stockQuantityFilter:positiveClosingQuantity}}])
 const view=await ready();fireEvent.click(screen.getByRole('button',{name:'Шаблони'}));fireEvent.click(await screen.findByRole('button',{name:'Відкрити для редагування: Залишок за роком'}))
 const checkbox=screen.getByRole('checkbox',{name:'Кінцевий залишок: кількість > 0'});expect(checkbox).toHaveProperty('checked',true)
 expect(screen.getAllByText(/приберіть групування за роком/).length).toBeGreaterThan(0)
 changeReportPeriod({from:'2026-10-01',to:'2026-10-27'})
 await act(async()=>fireEvent.submit(view.container.querySelector('form')!));expect(previewStockReport).not.toHaveBeenCalled()
 fireEvent.click(screen.getByRole('button',{name:'Видалити Рік'}))
 await act(async()=>fireEvent.submit(view.container.querySelector('form')!));await waitFor(()=>expect(previewStockReport).toHaveBeenCalledOnce())
 expect(vi.mocked(previewStockReport).mock.calls[0][0]).toMatchObject({from:'2026-10-01',to:'2026-10-27',stockQuantityFilter:positiveClosingQuantity,sorted:{Row:[{type:29}]}})
})

it('keeps the applied actual filtered table when draft checkbox and dates change without another Generate',async()=>{
 const [dataset]=parseReportDatasets([actualStock.dataset])
 vi.mocked(getReportDatasets).mockResolvedValue([netDataset,dataset])
 // The server fixture request has null UI labels. Populate presentation labels only,
 // using actual metadata and exact selected IDs, while keeping its financial selection.
 const data=defaultDatasetRequest(dataset,actualStock.request.From,actualStock.request.To)
 const warehouse=datasetGroupings(dataset).find(row=>row.type===29)
 if(!warehouse)throw new Error('Missing actual warehouse metadata')
 data.sorted.Row=[warehouse];data.sorted.Col=[]
 data.sorted.Measurements=actualStock.request.Sorted.Measurements.map(measure=>{
  const field=dataset.Measurements.find(item=>item.Type===measure.Type)
  if(!field)throw new Error('Missing actual measurement metadata')
  return {Type:field.Type,Name:field.Name,parentName:field.Name,IsChecked:measure.IsChecked}
 })
 data.selections=actualStock.request.Selections.map(selection=>{
  const field=datasetFilters(dataset).find(item=>item.field.Type===selection.SelectedField.Type)
  const condition=REPORT_FILTER_CONDITIONS.find(item=>item.Type===selection.FilterCondition.Type)
  if(!field||!condition)throw new Error('Missing actual filter metadata')
  return {...selection,SelectedField:field.field,FilterCondition:condition,
   Values:selection.Values.map(value=>({...value,Name:String(value.Data.Id)}))}
 })
 data.StockQuantityFilter=actualStock.request.StockQuantityFilter
 const template={Id:'actual-positive',Revision:1,Name:'Додатні фактичні групи',Data:data}
 vi.mocked(getServerReportTemplates).mockResolvedValue([template])
 vi.mocked(previewStockReport).mockResolvedValue({result:{document:{},raw:{}},preview:normalizeNativeReportPreview(actualStock.page0)})
 const view=await ready();fireEvent.click(screen.getByRole('button',{name:'Шаблони'}));fireEvent.click(await screen.findByRole('button',{name:'Відкрити для редагування: Додатні фактичні групи'}))
 await act(async()=>fireEvent.submit(view.container.querySelector('form')!));await waitFor(()=>expect(previewStockReport).toHaveBeenCalledOnce())
 const region=await screen.findByRole('region',{name:'Попередній перегляд звіту'})
 const table=region.querySelector('table');if(!table)throw new Error('Missing actual preview table')
 const applied=table.outerHTML
 expect(vi.mocked(previewStockReport).mock.calls[0][0]).toMatchObject({stockQuantityFilter:positiveClosingQuantity})
 fireEvent.click(screen.getByRole('checkbox',{name:'Кінцевий залишок: кількість > 0'}))
 changeReportPeriod({from:'2026-10-20',to:'2026-10-27'})
 expect(screen.getByRole('checkbox',{name:'Кінцевий залишок: кількість > 0'})).toHaveProperty('checked',false)
 expect(region.querySelector('table')?.outerHTML).toBe(applied)
 expect(previewStockReport).toHaveBeenCalledOnce()
 expect(template.Data.StockQuantityFilter).toEqual(positiveClosingQuantity)
})
