import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getReportDatasets, getServerReportTemplates, parseReportDatasets, saveServerReportTemplate } from '../api/reportWorkspaceApi'
import { previewStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { defaultDatasetRequest } from '../data/reportDatasets'
import type { ReportTemplate } from '../types'
import { changeReportPeriod } from '../testing/reportPeriod'
import fixture from '../data/customerGroupWarehouse.server-fixture.json'
import { ReportsStocksPage } from './ReportsStocksPage'
vi.mock('../../auth/useAuth',()=>({useAuth:()=>({hasPermission:()=>true})}))
vi.mock('../api/reportWorkspaceApi',async original=>({...await original<typeof import('../api/reportWorkspaceApi')>(),getReportDatasets:vi.fn(),getServerReportTemplates:vi.fn(),saveServerReportTemplate:vi.fn()}))
vi.mock('../api/reportsApi',async original=>({...await original<typeof import('../api/reportsApi')>(),searchDatasetReportValues:vi.fn(),previewStockReport:vi.fn()}))
const dataset={...parseReportDatasets([fixture.dataset])[0],constructorPresentation:{version:1,fields:['negativeRed','grandTotals']}}
const flags={version:1,negativeRed:false,grandTotals:false}
function template(value:unknown=flags):ReportTemplate {
 const data=defaultDatasetRequest(dataset,'2026-10-01','2026-10-27')
 data.customerGroups={Version:1,Groups:[{Name:'Еталон',ClientIds:[71,72]},{Name:'Набір B',ClientIds:[72,73]}]}
 data.sorted.Row=[{type:5,key:'Product',label:'Товар'}];data.sorted.Col=[{type:82,key:'CustomerComparisonSource',label:'Джерело даних'}]
 data.sorted.Measurements=[112,109,114].map(Type=>({Type,Name:String(Type),parentName:String(Type),IsChecked:true}))
 data.selections=[]
 if(value!==undefined)data.constructorPresentation=value
 return{Id:'presentation44',Revision:1,UpdatedAtUtc:'2026-10-30T00:00:00Z',Name:'Порівняння оформлення',Data:data}
}
beforeEach(()=>{
 vi.clearAllMocks();localStorage.clear();sessionStorage.clear();Object.defineProperty(HTMLElement.prototype,'scrollIntoView',{configurable:true,value:vi.fn()})
 vi.mocked(getReportDatasets).mockResolvedValue([dataset]);vi.mocked(getServerReportTemplates).mockResolvedValue([template()]);vi.mocked(saveServerReportTemplate).mockImplementation(async value=>({...value,Revision:2}));vi.mocked(searchDatasetReportValues).mockResolvedValue([])
 vi.mocked(previewStockReport).mockResolvedValue({result:{document:{},raw:{}},preview:{Version:1,ResultSha256:'a'.repeat(64),PresentationOnly:true,Request:null,Page:{Offset:0,Limit:50,TotalVisibleRows:0,ReturnedRows:0,HasMore:false},RowSchema:[],ColumnSchema:[],Rows:[],Columns:[],Cells:[]}})
})
afterEach(cleanup)
async function restore(invalid=false){render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage/></I18nProvider></MantineProvider>);fireEvent.click(await screen.findByRole('button',{name:'Відкрити Порівняння роботи клієнтів.xls'}));await waitFor(()=>expect(screen.getByRole('button',{name:'Відкрити Порівняння роботи клієнтів.xls'})).toHaveProperty('ariaCurrent','true'));fireEvent.click(screen.getByRole('button',{name:'Шаблони'}));fireEvent.click(await screen.findByRole('button',{name:'Відкрити для редагування: Порівняння оформлення'}));if(!invalid) await waitFor(()=>expect(screen.queryByRole('button',{name:'Відкрити для редагування: Порівняння оформлення'})).toBeNull())}
it('restores flags, preserves cohorts/measure order during date change, and saves/submits explicit changed settings',async()=>{
 await restore();const red=screen.getByRole('checkbox',{name:'Від’ємні значення червоним'});expect(red).toHaveProperty('checked',false);expect(screen.getByRole('checkbox',{name:'Загальний підсумок'})).toHaveProperty('checked',false)
 fireEvent.click(red);changeReportPeriod({from:'2026-09-01',to:'2026-09-30'})
 expect(red).toHaveProperty('checked',true);expect(screen.getByRole('checkbox',{name:'Загальний підсумок'})).toHaveProperty('checked',false)
 fireEvent.click(screen.getByRole('button',{name:'Шаблони'}));fireEvent.click(screen.getByRole('button',{name:'Оновити шаблон'}));await waitFor(()=>expect(saveServerReportTemplate).toHaveBeenCalledOnce())
 const saved=vi.mocked(saveServerReportTemplate).mock.calls[0][0].Data
 expect(saved).toMatchObject({dataSource:44,from:'2026-09-01',to:'2026-09-30',customerGroups:template().Data.customerGroups,constructorPresentation:{...flags,negativeRed:true}})
 expect(saved.sorted.Measurements.map(m=>m.Type)).toEqual([112,109,114]);expect(saved.sorted.Row.map(r=>r.type)).toEqual([5]);expect(saved.sorted.Col.map(r=>r.type)).toEqual([82]);expect(saved.reportProfile).toBeUndefined()
 fireEvent.click(screen.getByRole('button',{name:'Закрити'}));fireEvent.click(screen.getByRole('button',{name:'Застосувати й показати'}));await waitFor(()=>expect(previewStockReport).toHaveBeenCalledOnce());expect(vi.mocked(previewStockReport).mock.calls[0][0]).toMatchObject(saved)
})
it('hides options on old servers, leaves absent option omitted, and refuses explicit unsupported saved flags',async()=>{
 vi.mocked(getReportDatasets).mockResolvedValue([{...dataset,constructorPresentation:undefined}]);const t=template();delete t.Data.constructorPresentation;vi.mocked(getServerReportTemplates).mockResolvedValue([t]);await restore();expect(screen.queryByRole('checkbox',{name:'Загальний підсумок'})).toBeNull()
 fireEvent.click(screen.getByRole('button',{name:'Застосувати й показати'}));await waitFor(()=>expect(previewStockReport).toHaveBeenCalledOnce());expect(vi.mocked(previewStockReport).mock.calls[0][0]).not.toHaveProperty('constructorPresentation')
})
it.each([null,{...flags,version:2}])('shows saved invalid presentation error without generating or silently rewriting (%j)',async invalid=>{
 const original=template(invalid);vi.mocked(getServerReportTemplates).mockResolvedValue([original]);await restore(true);await screen.findByText(/Непідтримуване оформлення/);expect(screen.getByRole('button',{name:'Відкрити для редагування: Порівняння оформлення'})).toBeTruthy();expect(original.Data.constructorPresentation).toEqual(invalid);expect(previewStockReport).not.toHaveBeenCalled();expect(saveServerReportTemplate).not.toHaveBeenCalled()
})

it('rejects explicit saved options on an old server without loading or replacing them',async()=>{
 vi.mocked(getReportDatasets).mockResolvedValue([{...dataset,constructorPresentation:undefined}]);const original=template();vi.mocked(getServerReportTemplates).mockResolvedValue([original]);await restore(true);await screen.findByText('Сервер ще не підтримує оформлення порівняння роботи клієнтів.');expect(screen.queryByRole('checkbox',{name:'Загальний підсумок'})).toBeNull();expect(original.Data.constructorPresentation).toEqual(flags);expect(saveServerReportTemplate).not.toHaveBeenCalled();expect(previewStockReport).not.toHaveBeenCalled()
})
