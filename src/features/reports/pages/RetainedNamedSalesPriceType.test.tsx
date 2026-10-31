import { MantineProvider } from '@mantine/core'
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { apiRequest } from '../../../shared/api/apiClient'
import type { ReportRequestBody } from '../types'
import { InlineReportSelection, ReportSelectionsCard, SelectionValuePicker } from './ReportsStocksPage'
import { namedPriceDataset, namedPriceRequest } from '../data/namedPriceType.test-fixtures'
import { namedSalesPriceTypeError, salesConstructorDataset, type SalesConstructorProfile } from '../data/salesConstructorProfiles'
import { datasetFilters } from '../data/reportDatasets'
import { useAppliedReportSettings } from '../hooks/useAppliedReportSettings'
import { exportStockReportPreview, validateStockReportRequest } from '../api/reportsApi'
import { saveServerReportTemplate } from '../api/reportWorkspaceApi'
vi.mock('../../../shared/api/apiClient',()=>({apiRequest:vi.fn()}))
const api=vi.mocked(apiRequest)
function Form({profile='sales',checked=true}:{profile?:SalesConstructorProfile;checked?:boolean}){
 const [request,setRequest]=useState(()=>namedPriceRequest(profile,0,checked)),selection=request.selections[0],error=namedSalesPriceTypeError(request)
 return <MantineProvider env="test"><I18nProvider>{selection?<InlineReportSelection dataset={namedPriceDataset} request={request} selection={selection} selections={request.selections} index={0} dataSource={2} from={request.from} to={request.to} filterFieldOptions={datasetFilters(salesConstructorDataset(namedPriceDataset,profile),request)} onChange={action=>{setRequest(current=>({...current,selections:action.kind==='delete'?[]:action.kind==='replace'?[action.selection]:current.selections}))}}/>:null}<button disabled={!!error}>Generate proof control</button><output data-testid="request">{JSON.stringify(request)}</output></I18nProvider></MantineProvider>
}
const request=()=>JSON.parse(screen.getByTestId('request').textContent!)as ReportRequestBody
beforeEach(()=>{api.mockReset();api.mockResolvedValue([])})
afterEach(cleanup)
it.each(['sales','grossProfit']as const)('shows stored %s field11 and allows ordinary uncheck without a pricing lookup/profile downgrade',async profile=>{
 render(<Form profile={profile}/>);expect(screen.getByText('Збережений тип ціни [9007199254740993]')).toBeTruthy();expect(screen.getAllByText(/потребує збереженого історичного типу/).length).toBeGreaterThan(0);expect((screen.getByRole('button',{name:'Generate proof control'})as HTMLButtonElement).disabled).toBe(true)
 const before=request();await userEvent.click(screen.getByRole('checkbox',{name:'Увімкнути умову 1'}));expect(request()).toEqual({...before,selections:[{...before.selections[0],IsChecked:false}]});expect(request().reportProfile).toBe(profile);expect((screen.getByRole('button',{name:'Generate proof control'})as HTMLButtonElement).disabled).toBe(false);expect(api).not.toHaveBeenCalled()
 await userEvent.click(screen.getByRole('checkbox',{name:'Увімкнути умову 1'}));expect((screen.getByRole('button',{name:'Generate proof control'})as HTMLButtonElement).disabled).toBe(true);expect(request().selections[0].Values).toEqual(before.selections[0].Values)
})
it.each(['sales','grossProfit']as const)('allows explicit deletion of retained %s filter11 without changing the named profile',async profile=>{
 render(<Form profile={profile}/>);await userEvent.click(screen.getByRole('button',{name:'Видалити умову 1'}));expect(request().selections).toEqual([]);expect(request().reportProfile).toBe(profile);expect((screen.getByRole('button',{name:'Generate proof control'})as HTMLButtonElement).disabled).toBe(false);expect(api).not.toHaveBeenCalled()
})
it('keeps an initially inactive retained price condition visible and ignored without hydration',()=>{
 render(<Form checked={false}/>);expect(screen.getByText('Збережений тип ціни [9007199254740993]')).toBeTruthy();expect(screen.getByText(/Збережену умову вимкнено/)).toBeTruthy();expect(request().selections[0].IsChecked).toBe(false);expect(api).not.toHaveBeenCalled()
})
it('keeps generic unprofiled2 on the legacy current-price control rather than the named retained view',async()=>{
 const base=namedPriceRequest();delete base.reportProfile
 render(<MantineProvider env="test"><I18nProvider><SelectionValuePicker dataSource={2} request={base} dataset={namedPriceDataset} selection={base.selections[0]} selections={base.selections} from={base.from} to={base.to} onChange={()=>{}}/></I18nProvider></MantineProvider>)
 await waitFor(()=>expect(api).toHaveBeenCalled());expect(screen.queryByText(/потребує збереженого історичного типу/)).toBeNull();expect(api.mock.calls.every(call=>call[0]!=='/report/datasets/price-comparison/filters/lookup')).toBe(true)
})

it('opens and saves an inactive named11 modal without spreading its raw JSON string into character keys',async()=>{
 function ModalForm(){const [data,setData]=useState(()=>namedPriceRequest('sales',0,false));return <MantineProvider env="test"><I18nProvider><ReportSelectionsCard dataSource={2} dataset={namedPriceDataset} request={data} from={data.from} to={data.to} selections={data.selections} filterFieldOptions={datasetFilters(salesConstructorDataset(namedPriceDataset,'sales'),data)} onChange={action=>{if(action.kind==='replace')setData(current=>({...current,selections:[action.selection]}))}}/><output data-testid="modal-request">{JSON.stringify(data)}</output></I18nProvider></MantineProvider>}
 render(<ModalForm/>);const before=screen.getByTestId('modal-request').textContent
 await userEvent.click(screen.getByRole('button',{name:'Редагувати'}));await screen.findByRole('dialog');await userEvent.click(screen.getByRole('button',{name:'Зберегти'}));expect(screen.getByTestId('modal-request').textContent).toBe(before);expect(api).not.toHaveBeenCalled()
})

it('exports the valid APPLIED result after DRAFT gains active11 while new Generate/save remain blocked',async()=>{
 const valid:ReportRequestBody={...namedPriceRequest(),selections:[]},invalid=namedPriceRequest(),snapshot={name:'Продажі',data:valid,measurements:[],activeTemplate:null,previousPeriod:{from:'',to:''}}
 const view=renderHook(({draft,body})=>useAppliedReportSettings('named-sales',draft,body),{initialProps:{draft:snapshot,body:valid}})
 act(()=>{view.result.current.apply()});const applied=structuredClone(view.result.current.appliedRequest)
 view.rerender({draft:{...snapshot,data:invalid},body:invalid})
 expect(view.result.current.pending).toBe(true);expect(view.result.current.appliedRequest).toEqual(applied);expect(view.result.current.appliedRequest?.selections).toEqual([])
 expect(()=>validateStockReportRequest(invalid,namedPriceDataset)).toThrow(/історичного типу/)
 await expect(saveServerReportTemplate({Name:'Недопустима чернетка',Data:invalid},undefined,namedPriceDataset)).rejects.toThrow(/історичного типу/)
 expect(api).not.toHaveBeenCalled()
 const session={ResultId:'12345678-1234-1234-1234-123456789012',RequestSha256:'a'.repeat(64),ResultSha256:'b'.repeat(64),ExpiresAtUtc:'2026-10-31T23:00:00Z'}
 api.mockResolvedValue({...session,DocumentURL:'/Data/Reports/applied.xlsx',PdfDocumentURL:'/Data/Reports/applied.pdf'})
 await exportStockReportPreview(session)
 expect(api).toHaveBeenCalledOnce();expect(api).toHaveBeenCalledWith('/report/stocks/preview/'+session.ResultId+'/export',{method:'POST',body:{},dedupe:false})
 expect(view.result.current.appliedRequest).toEqual(applied);expect(invalid.selections[0].Values[0].Data).toBe('{"Id":"9007199254740993","Archived":true}');expect(invalid.reportProfile).toBe('sales')
})
