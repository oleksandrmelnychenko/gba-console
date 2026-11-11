import { Card, MantineProvider } from '@mantine/core'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { apiRequest } from '../../../shared/api/apiClient'
import type { ReportDataset, ReportSelectedValue } from '../types'
import { NativePriceFilterValuePicker } from './NativePriceFilterValuePicker'
import { NATIVE_PRICE_FILTER_FIELDS, PRICE_TOP_REFERENCE_NOTE, type NativePriceFilterField } from '../data/nativePriceFilterLookup'
import { priceDatasetFixture, priceSelectionFixture } from '../data/nativePriceFilterLookup.test-fixtures'
vi.mock('../../../shared/api/apiClient',()=>({apiRequest:vi.fn()}))
const api=vi.mocked(apiRequest),route='/report/datasets/price-comparison/filters/lookup'
const saved=[{Data:'{"Id":"9007199254740993","Archived":true}',Name:'Архівний користувач',Value:0}]as unknown as ReportSelectedValue[]
function Form({field=4,condition=0,initial=[],dataset=priceDatasetFixture(),from='2026-10-01',portal=false}:{field?:NativePriceFilterField;condition?:number;initial?:ReportSelectedValue[];dataset?:ReportDataset;from?:string;portal?:boolean}){
 const [values,setValues]=useState(initial)
 return <MantineProvider env={portal?undefined:'test'}><I18nProvider><Card data-testid="filter-card" style={{overflow:'hidden'}}><NativePriceFilterValuePicker dataSource={46} dataset={dataset} selection={{...priceSelectionFixture(field,condition),Values:values}} from={from} to="2026-10-31" label="Значення" onChange={setValues}/></Card><output data-testid="values">{JSON.stringify(values)}</output></I18nProvider></MantineProvider>
}
const values=()=>JSON.parse(screen.getByTestId('values').textContent!)
beforeEach(()=>{api.mockReset();Object.defineProperty(HTMLElement.prototype,'scrollIntoView',{configurable:true,value:vi.fn()})})
afterEach(()=>{cleanup();vi.restoreAllMocks()})
const cases=NATIVE_PRICE_FILTER_FIELDS.flatMap(field=>[0,1,2,4].map(condition=>({field,condition})))
it.each(cases)('selects source46 field$field condition$condition through exact owner and writes only its correct key namespace',async({field,condition})=>{
 const row=field===3?{Id:'01',Name:'01'}:{Id:'9007199254740993',Name:'Значення [9007199254740993]'}
 api.mockResolvedValue([row]);render(<Form field={field} condition={condition}/>)
 await waitFor(()=>expect(api).toHaveBeenCalledOnce());await userEvent.click(screen.getByRole('combobox',{name:'Значення'}));await userEvent.click(await screen.findByRole('option',{name:row.Name}))
 expect(values()).toEqual([{Data:field===3?{Name:row.Id}:{Id:row.Id},Name:row.Name,Value:0}])
 expect(api.mock.calls.every(call=>call[0]===route&&call[1]?.query?.dataSource===46&&call[1]?.query?.field===field)).toBe(true)
 if(field===12||field===14)expect(api.mock.calls[0][1]?.query).toMatchObject({from:'2026-10-01',to:'2026-10-31'})
 else expect(api.mock.calls[0][1]?.query).not.toHaveProperty('from')
})
it('preserves padded TOP saved identity exactly and explains that restoration does not imply a binary financial partition',async()=>{
 const raw='{"Name":" A ","Archived":true}',initial=[{Data:raw,Name:'Збережено',Value:0}]as unknown as ReportSelectedValue[]
 api.mockResolvedValue([{Id:'01',Name:'01'}]);render(<Form field={3} condition={2} initial={initial}/>)
 await screen.findByText(new RegExp('Пошук точного коду TOP'))
 expect(screen.getByText(text=>text.includes(PRICE_TOP_REFERENCE_NOTE))).toBeTruthy();expect(values()).toEqual(initial)
 await userEvent.type(screen.getByRole('combobox',{name:'Значення'}),'id:01')
 await waitFor(()=>expect(api.mock.calls.at(-1)?.[1]?.query).toMatchObject({exactValue:'01',field:3,offset:0}))
 await userEvent.click(await screen.findByRole('option',{name:'01'}));expect(values()).toEqual([...initial,{Data:{Name:'01'},Name:'01',Value:0}]);expect(values()[0].Data).toBe(raw)
})
it('selects an explicit Int64 maximum by keyboard and trusts the complete supplied caption once',async()=>{
 const row={Id:'9223372036854775807',Name:'Підтверджувач [9223372036854775807]'};api.mockImplementation(async(_path,options)=>options?.query?.exactId?[row]:[])
 render(<Form field={16}/>);await waitFor(()=>expect(api).toHaveBeenCalledOnce());
 await userEvent.type(screen.getByRole('combobox',{name:'Значення'}),'id:'+row.Id);await screen.findByRole('option',{name:row.Name});await userEvent.keyboard('{ArrowDown}{Enter}')
 expect(values()).toEqual([{Data:{Id:row.Id},Name:row.Name,Value:0}]);expect(api.mock.calls.at(-1)?.[1]?.query).toEqual({dataSource:46,field:16,exactId:row.Id,offset:0,limit:30})
})
it('preserves archived JSON and date-independent directory scope without hydration',async()=>{
 api.mockResolvedValue([]);const view=render(<Form field={10} condition={2} initial={saved}/>);await waitFor(()=>expect(api).toHaveBeenCalledOnce())
 view.rerender(<Form field={10} condition={2} initial={saved} from="2026-09-01" dataset={structuredClone(priceDatasetFixture())}/>);expect(api).toHaveBeenCalledOnce();expect(values()).toEqual(saved)
})
it('retains archived values after a403 and retries only the same source46 route',async()=>{
 api.mockRejectedValueOnce(new Error('403')).mockResolvedValueOnce([]);render(<Form field={15} condition={2} initial={saved}/>)
 expect((await screen.findByRole('alert')).textContent).toBe('Не вдалося завантажити довідник. Повторіть спробу.');await userEvent.click(screen.getByRole('combobox',{name:'Значення'}));await userEvent.click(await screen.findByRole('option',{name:'Спробувати ще раз'}));await waitFor(()=>expect(api).toHaveBeenCalledTimes(2));expect(values()).toEqual(saved);expect(api.mock.calls.every(call=>call[0]===route&&call[1]?.query?.field===15)).toBe(true)
})
it('shows missing capability as unavailable without any legacy request or saved-value mutation',()=>{
 render(<Form field={4} condition={2} initial={saved} dataset={{...priceDatasetFixture(),priceFilterLookup:undefined}}/>);expect(screen.getByText(/Сервер не підтвердив довідник/)).toBeTruthy();expect(values()).toEqual(saved);expect(api).not.toHaveBeenCalled()
})
function portalGeometry(){vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockReturnValue(640);vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(320)}
it.each([0,2])('portals condition%i options outside a clipping Card and keeps large IDs on normal selection',async condition=>{
 portalGeometry();const row={Id:'9223372036854775807',Name:'Пряма група [9223372036854775807]'};api.mockResolvedValue([row]);render(<Form condition={condition} initial={condition===2?saved:[]} portal/>);await waitFor(()=>expect(api).toHaveBeenCalledOnce());await userEvent.click(screen.getByRole('combobox',{name:'Значення'}));const option=await screen.findByRole('option',{name:row.Name});expect(screen.getByTestId('filter-card').contains(option)).toBe(false)
 if(condition===0)await userEvent.keyboard('{ArrowDown}{Enter}');else await userEvent.click(option)
 expect(values()).toEqual([...(condition===2?saved:[]),{Data:{Id:row.Id},Name:row.Name,Value:0}])
})
function typedPages(){api.mockImplementation(async(_path,options)=>options?.query?.value==='Ім’я'?(options.query.offset===0?Array.from({length:30},(_,index)=>({Id:String(index+1),Name:'Користувач '+index+' ['+(index+1)+']'})):[{Id:'31',Name:'Наступний [31]'}]):[])}
it('keeps a nonempty scalar query when clicking More and preserves raw saved selection',async()=>{
 typedPages();render(<Form field={15} condition={0} initial={saved}/>);await waitFor(()=>expect(api).toHaveBeenCalledOnce());const input=screen.getByRole('combobox',{name:'Значення'});await userEvent.type(input,'Ім’я');await userEvent.click(await screen.findByRole('option',{name:'Ще значення'}))
 await waitFor(()=>expect(api.mock.calls.map(call=>call[1]?.query)).toContainEqual({dataSource:46,field:15,value:'Ім’я',offset:30,limit:30}));expect((input as HTMLInputElement).value).toBe('Ім’я');expect(values()).toEqual(saved)
})
it('keeps a nonempty multi query when More is chosen with ArrowUp and Enter',async()=>{
 typedPages();render(<Form field={15} condition={2} initial={saved}/>);await waitFor(()=>expect(api).toHaveBeenCalledOnce());const input=screen.getByRole('combobox',{name:'Значення'});await userEvent.type(input,'Ім’я');await screen.findByRole('option',{name:'Ще значення'});await userEvent.keyboard('{ArrowUp}{Enter}')
 await waitFor(()=>expect(api.mock.calls.map(call=>call[1]?.query)).toContainEqual({dataSource:46,field:15,value:'Ім’я',offset:30,limit:30}));expect((input as HTMLInputElement).value).toBe('Ім’я');expect(values()).toEqual(saved)
})
