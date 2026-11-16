import { MantineProvider } from '@mantine/core'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { apiRequest } from '../../../shared/api/apiClient'
import { reportProductCapability, reportProductDataset } from '../data/reportProductLookup.test-fixtures'
import { REPORT_PRODUCT_LOOKUP_SOURCES, type ReportProductLookupSource } from '../data/productLookupCapability'
import type { ReportSelectedValue } from '../types'
import { SelectionValuePicker } from './ReportsStocksPage'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest), route = '/report/datasets/products/lookup'
const target = { Id: '38041660', Name: 'Отбойник ресори', VendorCode: 'SEM14631' }
const saved = [{ Data: '{"Id":"9007199254740993","Archived":true}', Name: 'Архівний товар', Value: 0 }] as unknown as ReportSelectedValue[]
const legacyCap = { version: 1, fieldTypes: [1], identityKind: 'positiveInt64String', periodRequired: false, supportsNameAndArticleSearch: true, exactIdParameter: 'exactId', paging: 'offset', maximumPageSize: 50 }
function Form({ source=3, datasetSource=source, condition=0, initial=[], advertise=true, capability, from='2026-10-01', legacy=false }: {
  source?: ReportProductLookupSource; datasetSource?: ReportProductLookupSource; condition?: number; initial?: ReportSelectedValue[];
  advertise?: boolean; capability?: unknown; from?: string; legacy?: boolean
}) {
  const [values,setValues]=useState(initial)
  const dataset={...reportProductDataset(datasetSource),productLookup:advertise?(capability===undefined?reportProductCapability(datasetSource):capability):undefined,...(legacy?{salesProductLookup:legacyCap}:{})}
  return <MantineProvider env="test"><I18nProvider><SelectionValuePicker dataSource={source} dataset={dataset}
    from={from} to="2026-10-30" selection={{IsChecked:true,SelectedField:{Type:1,Name:'Товар'},FilterCondition:{Type:condition,Name:'Умова'},Values:values}}
    selections={[]} onChange={setValues}/><output data-testid="values">{JSON.stringify(values)}</output></I18nProvider></MantineProvider>
}
const values=()=>JSON.parse(screen.getByTestId('values').textContent!)
beforeEach(()=>{api.mockReset();Object.defineProperty(HTMLElement.prototype,'scrollIntoView',{configurable:true,value:vi.fn()})})
afterEach(cleanup)
const scalarCases=REPORT_PRODUCT_LOOKUP_SOURCES.flatMap(source=>[0,1,2,4].map(condition=>({source,condition})))
it.each(scalarCases)('selects Product1 under native report$source condition$condition through its own minimal report route',async({source,condition})=>{
 api.mockImplementation(async(path)=>{if(path!==route)throw new Error('No Products/Sales permission');return[target]})
 render(<Form source={source} condition={condition}/>)
 await waitFor(()=>expect(api).toHaveBeenCalledOnce());expect(api.mock.calls[0][1]?.query?.dataSource).toBe(source)
 await userEvent.click(screen.getByRole('combobox',{name:'Значення'}));await userEvent.click(await screen.findByRole('option',{name:'Отбойник ресори · SEM14631 [38041660]'}))
 expect(values()).toEqual([{Data:{Id:'38041660'},Name:'Отбойник ресори · SEM14631',Value:0}])
 expect(api.mock.calls.every(call=>call[0]===route&&call[1]?.query?.dataSource===source)).toBe(true)
})
it('uses only the shared report route for source3 SKU selection when the legacy transport is forbidden',async()=>{
 api.mockImplementation(async(path)=>{if(path==='/products/search/advanced')throw new Error('403 Products.Read');if(path!==route)throw new Error('Unexpected route');return[target]})
 render(<Form/>);await waitFor(()=>expect(api).toHaveBeenCalledOnce())
 await userEvent.type(screen.getByRole('combobox',{name:'Значення'}),'SEM14631')
 await userEvent.click(await screen.findByRole('option',{name:'Отбойник ресори · SEM14631 [38041660]'}))
 expect(values()[0].Data).toEqual({Id:'38041660'})
 expect(api.mock.calls.some(call=>call[1]?.query?.value==='SEM14631'&&call[1]?.query?.dataSource===3)).toBe(true)
 expect(api.mock.calls.every(call=>call[0]===route)).toBe(true)
})
it.each([undefined,{version:99}])('retains the legacy source3 selector when the optional new capability is unavailable %j',async capability=>{
 api.mockResolvedValue([])
 render(<Form advertise={capability!==undefined} capability={capability}/>)
 await userEvent.type(screen.getByPlaceholderText('Пошук значення'),'Legacy')
 await waitFor(()=>expect(api).toHaveBeenCalled())
 expect(api.mock.calls.every(call=>call[0]==='/products/search/advanced')).toBe(true)
})
it('does not use a foreign dataset owner to authorize the requested source3 picker',async()=>{
 api.mockResolvedValue([]);render(<Form source={3} datasetSource={44}/>)
 await userEvent.type(screen.getByPlaceholderText('Пошук значення'),'Legacy')
 await waitFor(()=>expect(api).toHaveBeenCalled());expect(api.mock.calls.every(call=>call[0]==='/products/search/advanced')).toBe(true)
})
it('retains the P8 legacy source2 API when new metadata is absent',async()=>{
 api.mockResolvedValue([]);render(<Form source={2} advertise={false} legacy/>)
 await waitFor(()=>expect(api).toHaveBeenCalledOnce());expect(api.mock.calls[0][0]).toBe('/report/datasets/sales/products/lookup')
})
it('does not try an advanced or legacy route after a valid shared source3 capability returns403',async()=>{
 api.mockRejectedValue(new Error('403'));render(<Form initial={saved}/>)
 expect((await screen.findByRole('alert')).textContent).toBe('Не вдалося завантажити товари. Повторіть спробу.')
 expect(api).toHaveBeenCalledOnce();expect(api.mock.calls[0][0]).toBe(route);expect(values()).toEqual(saved)
})
it('period edits and cloned metadata preserve archived raw values without hydration or another request',async()=>{
 api.mockResolvedValue([]);const view=render(<Form condition={2} initial={saved}/>)
 await waitFor(()=>expect(api).toHaveBeenCalledOnce())
 view.rerender(<Form condition={2} initial={saved} from="2026-09-01"/>)
 expect(api).toHaveBeenCalledOnce();expect(values()).toEqual(saved);expect(saved[0].Data).toBe('{"Id":"9007199254740993","Archived":true}')
})
it('selects the second page above2^53 without rounding or rewriting a saved raw reference',async()=>{
 const first=Array.from({length:30},(_,i)=>({Id:String(9007199254740993n+BigInt(i)),Name:'Позиція',VendorCode:'SKU'+i})),last={Id:'9007199254741023',Name:'Друга сторінка',VendorCode:'NEXT'}
 api.mockImplementation(async(path,options)=>{if(path!==route)throw Error('Unexpected transport');return options?.query?.offset===0?first:[last]})
 render(<Form condition={2} initial={saved}/>);await userEvent.click(screen.getByRole('combobox',{name:'Значення'}))
 await userEvent.click(await screen.findByRole('option',{name:'Ще значення'}));await waitFor(()=>expect(api).toHaveBeenCalledTimes(2))
 await userEvent.click(await screen.findByRole('option',{name:'Друга сторінка · NEXT [9007199254741023]'}))
 expect(values()).toEqual([...saved,{Data:{Id:'9007199254741023'},Name:'Друга сторінка · NEXT',Value:0}])
 expect(api.mock.calls.map(call=>[call[1]?.query?.dataSource,call[1]?.query?.offset])).toEqual([[3,0],[3,30]])
})
it('cancels an explicit saved-ID recheck on owner change and hides its stale message',async()=>{
 let finish!:(value:unknown)=>void
 api.mockImplementation(async(_path,options)=>options?.query?.dataSource===3&&options?.query?.exactId?new Promise(resolve=>{finish=resolve}):[])
 const view=render(<Form source={3} condition={2} initial={saved}/>);await waitFor(()=>expect(api).toHaveBeenCalledOnce())
 await userEvent.click(screen.getByRole('button',{name:'Перевірити ID 9007199254740993'}));await screen.findByText('Перевірка…')
 const signal=api.mock.calls.find(call=>call[1]?.query?.exactId)?.[1]?.signal
 view.rerender(<Form source={44} condition={2} initial={saved}/>);expect(signal?.aborted).toBe(true)
 await waitFor(()=>expect(api.mock.calls.some(call=>call[1]?.query?.dataSource===44)).toBe(true))
 expect(screen.queryByText('Перевірка…')).toBeNull()
 await act(async()=>finish([{Id:'9007199254740993',Name:'Old3',VendorCode:''}]))
 expect(screen.queryByText('Товар доступний у довіднику.')).toBeNull();expect(values()).toEqual(saved)
 await userEvent.click(screen.getByRole('button',{name:'Перевірити ID 9007199254740993'}));await screen.findByText(/Товар недоступний/)
 expect(api.mock.calls.filter(call=>call[1]?.query?.exactId).map(call=>call[1]?.query?.dataSource)).toEqual([3,44])
})
it('aborts pending shared transport when capability becomes invalid and keeps raw saved values',async()=>{
 api.mockImplementation(()=>new Promise(()=>{}));const view=render(<Form initial={saved}/>)
 await waitFor(()=>expect(api).toHaveBeenCalledOnce());const signal=api.mock.calls[0][1]?.signal
 view.rerender(<Form initial={saved} capability={{version:2}}/>);expect(signal?.aborted).toBe(true);expect(values()).toEqual(saved)
})
