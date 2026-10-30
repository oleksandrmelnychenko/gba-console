import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { act,cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach,beforeEach,expect,it,vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { ReportSelectedValue } from '../types'
import { SelectionValuePicker } from './ReportsStocksPage'
vi.mock('../../../shared/api/apiClient',()=>({apiRequest:vi.fn()}))
const api=vi.mocked(apiRequest)
const raw:ReportSelectedValue[]=JSON.parse(String.raw`[{"Data":"{\"Name\":\"E  \",\"Id\":999}","Name":"Стара назва E","Value":0},{"Data":{"Name":"UNKNOWN"},"Name":"Архів","Value":0}]`)
function Form({source=44,condition=2,values=raw,from='2026-10-01',disabled=false,checked=true}:{source?:number;condition?:number;values?:ReportSelectedValue[];from?:string;disabled?:boolean;checked?:boolean}){
 const [selected,setSelected]=useState(values)
 return <MantineProvider env="test"><I18nProvider><SelectionValuePicker dataSource={source} from={from} to="2026-10-27" label="Значення" lookupProfitUnavailable={disabled}
 selection={{IsChecked:checked,SelectedField:{Type:3,Name:'Поточний TOP товару'},FilterCondition:{Type:condition,Name:'Умова'},Values:selected}} selections={[]} onChange={setSelected}/><output data-testid="selected">{JSON.stringify(selected)}</output></I18nProvider></MantineProvider>
}
const selected=()=>JSON.parse(screen.getByTestId('selected').textContent!)
function search(value:string){const box=screen.getByRole('combobox',{name:'Значення'});act(()=>box.focus());fireEvent.change(box,{target:{value}})}
beforeEach(()=>{api.mockReset();Object.defineProperty(HTMLElement.prototype,'scrollIntoView',{configurable:true,value:vi.fn()})});afterEach(cleanup)
it('uses scoped bounded TOP endpoint and chooses exact raw E-two-spaces Name with Value0 and no Id',async()=>{
 api.mockResolvedValue([{Name:'E  ',Id:9},{Name:'X9',Id:1}]);render(<Form values={[]} condition={0}/>);await waitFor(()=>expect(api).toHaveBeenCalledOnce());await userEvent.click(screen.getByRole('combobox',{name:'Значення'}));await userEvent.click(await screen.findByRole('option',{name:'E'}))
 expect(selected()).toEqual([{Data:{Name:'E  '},Name:'E  ',Value:0}]);expect(api.mock.calls[0][0]).toBe('/report/datasets/lookup');expect(api.mock.calls[0][1]?.query).toEqual({dataSource:44,field:3,value:'',offset:0,limit:30})
 expect(screen.getByText(/TOP у відборі — поточні дані/)).toBeTruthy()
})
it('pages by raw code without rownumber identity, preserves old JSON/captions/unknown values/date',async()=>{
 api.mockImplementation(async(_path,options)=>options?.query?.offset===30?[{Name:'NEXT'}]:[{Name:'E  ',Id:1},...Array.from({length:29},(_,i)=>({Name:'TOP'+i,Id:1}))]);const view=render(<Form/>);await userEvent.click(screen.getByRole('combobox',{name:'Значення'}));await screen.findByRole('option',{name:'Стара назва E'});expect(selected()).toEqual(raw)
 await userEvent.click(screen.getByRole('button',{name:'Ще значення'}));await waitFor(()=>expect(api).toHaveBeenCalledTimes(2));await userEvent.click(screen.getByRole('combobox',{name:'Значення'}));await userEvent.click(await screen.findByRole('option',{name:'NEXT'}));const expected=[...raw,{Data:{Name:'NEXT'},Name:'NEXT',Value:0}];expect(selected()).toEqual(expected)
 view.rerender(<Form from="2026-09-01"/>);expect(selected()).toEqual(expected);expect(api.mock.calls.map(x=>x[1]?.query?.offset)).toEqual([0,30])
})
it('explicit equality replaces legacy multi set only on choice; list retains and appends',async()=>{
 api.mockResolvedValue([{Name:'X9'}]);render(<Form condition={0}/>);expect(selected()).toEqual(raw);await userEvent.click(screen.getByRole('combobox',{name:'Значення'}));await userEvent.click(await screen.findByRole('option',{name:'X9'}));expect(selected()).toEqual([{Data:{Name:'X9'},Name:'X9',Value:0}])
})
it('rejects late initial responses after search changes and keeps literal spaces in remote query',async()=>{
 let finish!:(v:unknown)=>void;api.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve})).mockResolvedValue([{Name:'E  '}]);render(<Form values={[]}/>);await waitFor(()=>expect(api).toHaveBeenCalledOnce());const signal=api.mock.calls[0][1]?.signal;search('E  ');await screen.findByRole('option',{name:'E'});expect(signal?.aborted).toBe(true);finish([{Name:'STALE'}]);await waitFor(()=>expect(screen.queryByRole('option',{name:'STALE'})).toBeNull());expect(api.mock.calls[1][1]?.query?.value).toBe('E  ');expect(selected()).toEqual([])
})
it('retries failed next page at the same offset and leaves saved choices unchanged',async()=>{
 api.mockResolvedValueOnce(Array.from({length:30},(_,i)=>({Name:'T'+i}))).mockRejectedValueOnce(Error('temporary')).mockResolvedValueOnce([{Name:'NEXT'}]);render(<Form/>);await screen.findByRole('button',{name:'Ще значення'});await userEvent.click(screen.getByRole('button',{name:'Ще значення'}));await userEvent.click(await screen.findByRole('button',{name:'Спробувати ще раз'}));await userEvent.click(screen.getByRole('combobox',{name:'Значення'}));await screen.findByRole('option',{name:'NEXT'});expect(api.mock.calls.map(x=>x[1]?.query?.offset)).toEqual([0,30,30]);expect(selected()).toEqual(raw)
})
it('preserves disabled values and ignores an aborted load; active-only current meaning',async()=>{
 let finish!:(v:unknown)=>void;api.mockImplementation(()=>new Promise(resolve=>{finish=resolve}));const view=render(<Form/>);await waitFor(()=>expect(api).toHaveBeenCalledOnce());const signal=api.mock.calls[0][1]?.signal;await userEvent.click(screen.getByRole('button',{name:'Вибрано: 2'}));view.rerender(<Form disabled checked={false}/>);expect(signal?.aborted).toBe(true);finish([{Name:'X9'}]);await userEvent.click(screen.getByRole('option',{name:'Стара назва E'}));expect(selected()).toEqual(raw);expect(screen.queryByText(/TOP у відборі — поточні дані/)).toBeNull()
})
it('leaves the existing purchase TOP lookup route unchanged',async()=>{
 api.mockResolvedValue([{Id:1,Name:'X9'}]);render(<Form source={3} values={[]}/>);await waitFor(()=>expect(api).toHaveBeenCalledWith('/products/groups/get/top'));expect(api.mock.calls.some(([path,options])=>path==='/report/datasets/lookup'&&options?.query?.dataSource===44)).toBe(false)
})
