import fixture from '../data/customerGroupAgreement.server-fixture.json'
import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { apiRequest } from '../../../shared/api/apiClient'
import { getReportDatasets, getServerReportTemplates, parseReportDatasets, saveServerReportTemplate } from '../api/reportWorkspaceApi'
import { previewStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { defaultDatasetRequest } from '../data/reportDatasets'
import type { ReportTemplate } from '../types'
import { changeReportPeriod } from '../testing/reportPeriod'
import { ReportsStocksPage } from './ReportsStocksPage'
vi.mock('../../auth/useAuth',()=>({useAuth:()=>({hasPermission:()=>true})}))
vi.mock('../../../shared/api/apiClient',async original=>({...await original<typeof import('../../../shared/api/apiClient')>(),apiRequest:vi.fn()}))
vi.mock('../api/reportWorkspaceApi',async original=>({...await original<typeof import('../api/reportWorkspaceApi')>(),getReportDatasets:vi.fn(),getServerReportTemplates:vi.fn(),saveServerReportTemplate:vi.fn()}))
vi.mock('../api/reportsApi',async original=>({...await original<typeof import('../api/reportsApi')>(),searchDatasetReportValues:vi.fn(),previewStockReport:vi.fn()}))
// Provisional additive metadata only; replace with actual serialized backend fixture after SQL passes.
const dataset=parseReportDatasets([{...fixture.dataset,Filters:[...fixture.dataset.Filters,{Type:4,Name:'Поточні прямі групи товару',Selectable:true}]}])[0]
function template(condition=2,checked=true):ReportTemplate{
 const data=defaultDatasetRequest(dataset,'2026-10-01','2026-10-27')
 data.customerGroups={Version:1,Groups:[{Name:'Еталон',ClientIds:[71,72]},{Name:'Набір B',ClientIds:[72,73]}]}
 data.sorted.Row=[{type:5,key:'Product',label:'Товар'}];data.sorted.Col=[{type:82,key:'CustomerComparisonSource',label:'Джерело даних'}]
 data.sorted.Measurements=[112,109,114].map(Type=>({Type,Name:String(Type),parentName:String(Type),IsChecked:true}))
 data.selections=[{IsChecked:checked,SelectedField:{Type:4,Name:'ProductGroup'},FilterCondition:{Type:condition,Name:condition===0?'Дорівнює':condition===1?'Не дорівнює':'У списку'},Values:JSON.parse(String.raw`[{"Data":"{\"Id\":\"9007199254740993\"}","Name":"Стара назва","Value":0},{"Data":{"Id":"9223372036854775807"},"Name":"Архівна група","Value":0}]`)}]
 return{Id:'group-exact',Revision:1,UpdatedAtUtc:'2026-10-30T00:00:00Z',Name:'Набори з групою',Data:data}
}
beforeEach(()=>{
 vi.clearAllMocks();localStorage.clear();sessionStorage.clear();Object.defineProperty(HTMLElement.prototype,'scrollIntoView',{configurable:true,value:vi.fn()})
 vi.mocked(getReportDatasets).mockResolvedValue([dataset]);vi.mocked(getServerReportTemplates).mockResolvedValue([template()]);vi.mocked(saveServerReportTemplate).mockImplementation(async value=>({...value,Revision:2}))
 vi.mocked(searchDatasetReportValues).mockImplementation(async(_source,_field,params)=>params.value.startsWith('id:')?[{Id:Number(params.value.slice(3)),Name:'Клієнт'+params.value}]:[])
 vi.mocked(apiRequest).mockResolvedValue([])
})
afterEach(cleanup)
async function ready(){render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage/></I18nProvider></MantineProvider>);fireEvent.click(await screen.findByRole('button',{name:'Відкрити Порівняння роботи клієнтів.xls'}));await waitFor(()=>expect(screen.getByRole('button',{name:'Відкрити Порівняння роботи клієнтів.xls'})).toHaveProperty('ariaCurrent','true'))}
async function restore(){await ready();fireEvent.click(screen.getByRole('button',{name:'Шаблони'}));fireEvent.click(await screen.findByRole('button',{name:'Відкрити для редагування: Набори з групою'}));await screen.findByRole('group',{name:'Умова відбору 1'})}
it('only offers Group4 when actual source44 metadata admits it',async()=>{
 vi.mocked(getReportDatasets).mockResolvedValue([{...dataset,Filters:dataset.Filters.filter(f=>f.Type!==4)}]);await ready();fireEvent.click(screen.getByRole('button',{name:'Додати умову'}));fireEvent.click(screen.getByRole('combobox',{name:'Поле'}));expect(screen.queryByRole('option',{name:'Поточні прямі групи товару'})).toBeNull()
})
it('restores and saves exact big IDs/rawJSON without directory expansion or clearing cohorts/date/order',async()=>{
 await restore();expect(vi.mocked(apiRequest).mock.calls.every(([path,options])=>path==='/report/datasets/lookup'&&options?.query?.field===4)).toBe(true);const group=screen.getByRole('group',{name:'Умова відбору 1'});fireEvent.click(within(group).getByRole('combobox',{name:'Умова'}))
 expect(screen.getAllByRole('option').map(x=>x.textContent)).toEqual(['Дорівнює','Не дорівнює','У списку','Не у списку']);fireEvent.click(screen.getByRole('option',{name:'У списку'}));changeReportPeriod({from:'2026-09-01',to:'2026-09-30'})
 fireEvent.click(screen.getByRole('button',{name:'Шаблони'}));fireEvent.click(screen.getByRole('button',{name:'Оновити шаблон'}));await waitFor(()=>expect(saveServerReportTemplate).toHaveBeenCalledOnce())
 const saved=vi.mocked(saveServerReportTemplate).mock.calls[0][0].Data,original=template().Data
 expect(saved).toMatchObject({from:'2026-09-01',to:'2026-09-30',customerGroups:original.customerGroups,selections:original.selections})
 expect(saved.sorted.Row.map(x=>x.type)).toEqual([5]);expect(saved.sorted.Col.map(x=>x.type)).toEqual([82]);expect(saved.sorted.Measurements.map(x=>x.Type)).toEqual([112,109,114])
})
it.each([0,1])('blocks invalid group condition%d Apply and Save while permitting explicit list repair',async condition=>{
 vi.mocked(getServerReportTemplates).mockResolvedValue([template(condition)]);await restore();expect(screen.getByRole('button',{name:'Застосувати й показати'})).toHaveProperty('disabled',true)
 fireEvent.click(screen.getByRole('button',{name:'Шаблони'}));expect(screen.getByRole('button',{name:'Оновити шаблон'})).toHaveProperty('disabled',true);expect(screen.getByRole('button',{name:'Новий шаблон'})).toHaveProperty('disabled',true);expect(saveServerReportTemplate).not.toHaveBeenCalled()
 fireEvent.click(screen.getByRole('button',{name:'Закрити'}));fireEvent.click(within(screen.getByRole('group',{name:'Умова відбору 1'})).getByRole('combobox',{name:'Умова'}));fireEvent.click(screen.getByRole('option',{name:'У списку'}));expect(screen.getByRole('button',{name:'Застосувати й показати'})).toHaveProperty('disabled',false)
 fireEvent.click(screen.getByRole('button',{name:'Шаблони'}));fireEvent.click(screen.getByRole('button',{name:'Оновити шаблон'}));await waitFor(()=>expect(saveServerReportTemplate).toHaveBeenCalledOnce());expect(vi.mocked(saveServerReportTemplate).mock.calls[0][0].Data.selections).toEqual(template().Data.selections)
})
it('retains a disabled invalid group row without blocking Apply or template save',async()=>{
 const t=template(0,false);t.Data.selections[0].Values=JSON.parse('[{"Data":{"Id":"9223372036854775808"},"Name":"Архів","Value":0}]');vi.mocked(getServerReportTemplates).mockResolvedValue([t]);await restore();expect(screen.getByRole('button',{name:'Застосувати й показати'})).toHaveProperty('disabled',false)
 fireEvent.click(screen.getByRole('button',{name:'Шаблони'}));fireEvent.click(screen.getByRole('button',{name:'Оновити шаблон'}));await waitFor(()=>expect(saveServerReportTemplate).toHaveBeenCalledOnce());expect(vi.mocked(saveServerReportTemplate).mock.calls[0][0].Data.selections).toEqual(t.Data.selections)
})

it('shows missing-master generation refusal without replacing the saved group or presenting an empty financial result',async()=>{
 const message='Вибрану товарну групу не знайдено в довіднику GBA. Відбір не застосовано; оновіть вибір груп.'
 vi.mocked(previewStockReport).mockRejectedValueOnce(new Error(message));await restore();fireEvent.click(screen.getByRole('button',{name:'Застосувати й показати'}));await screen.findByText(message)
 expect(previewStockReport).toHaveBeenCalledOnce();expect(screen.queryByRole('table')).toBeNull();expect(screen.getByRole('button',{name:'Застосувати й показати'})).toHaveProperty('disabled',false)
 fireEvent.click(screen.getByRole('button',{name:'Шаблони'}));fireEvent.click(screen.getByRole('button',{name:'Оновити шаблон'}));await waitFor(()=>expect(saveServerReportTemplate).toHaveBeenCalledOnce())
 expect(vi.mocked(saveServerReportTemplate).mock.calls[0][0].Data).toMatchObject({customerGroups:template().Data.customerGroups,selections:template().Data.selections,from:'2026-10-01',to:'2026-10-27'})
})
