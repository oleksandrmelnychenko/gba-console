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
const api=vi.mocked(apiRequest),max='9223372036854775807'
const saved:ReportSelectedValue[]=[{Data:JSON.stringify({Id:'9007199254740993'}),Name:'Стара група',Value:0},{Data:{Id:max},Name:'Відсутня група',Value:0}]
function Form({field=4,condition=2,values=saved,from='2026-10-01',disabled=false,checked=true}:{field?:number;condition?:number;values?:ReportSelectedValue[];from?:string;disabled?:boolean;checked?:boolean}){
 const [selected,setSelected]=useState(values)
 return <MantineProvider env="test"><I18nProvider><SelectionValuePicker dataSource={44} from={from} to="2026-10-27" label="Значення" lookupProfitUnavailable={disabled} selection={{IsChecked:checked,SelectedField:{Type:field,Name:'Поточні прямі групи товару'},FilterCondition:{Type:condition,Name:'Умова'},Values:selected}} selections={[]} onChange={setSelected}/><output data-testid="selected">{JSON.stringify(selected)}</output></I18nProvider></MantineProvider>
}
const selected=()=>JSON.parse(screen.getByTestId('selected').textContent!)
function search(query:string){const box=screen.getByRole('combobox',{name:'Значення'});act(()=>box.focus());fireEvent.change(box,{target:{value:query}})}
beforeEach(()=>{api.mockReset();Object.defineProperty(HTMLElement.prototype,'scrollIntoView',{configurable:true,value:vi.fn()})})
afterEach(cleanup)
it('loads bounded empty group catalogue and selects exact maxInt64 without hierarchy/customer/primary inference',async()=>{
 api.mockResolvedValue([{Id:max,Name:'Група ['+max+']'}]);render(<Form values={[]} condition={0}/>);await waitFor(()=>expect(api).toHaveBeenCalledOnce());await userEvent.click(screen.getByRole('combobox',{name:'Значення'}));await userEvent.click(await screen.findByRole('option',{name:'Група ['+max+']'}))
 expect(selected()).toEqual([{Data:{Id:max},Name:'Група ['+max+']',Value:0}]);expect(api.mock.calls[0][1]?.query).toEqual({dataSource:44,field:4,value:'',offset:0,limit:30});expect(screen.getByText(/поточні прямі зв’язки картки товару/)).toBeTruthy();expect(screen.queryByText(/до договору в документі/)).toBeNull();expect(screen.queryByText(/Регіон, код регіону/)).toBeNull()
})
it('pages same-caption IDs by normal pointer without losing raw missing choices or date state',async()=>{
 api.mockImplementation(async(_path,options)=>Number(options?.query?.offset)>0?[{Id:'9007199254741999',Name:'Одна назва'}]:Array.from({length:30},(_,i)=>({Id:(9007199254740993n+BigInt(i)).toString(),Name:i===0?'Нова назва':'Одна назва'})))
 const view=render(<Form/>);await userEvent.click(screen.getByRole('combobox',{name:'Значення'}));await screen.findByRole('option',{name:'Стара група'});await userEvent.click(screen.getByRole('button',{name:'Ще значення'}));await waitFor(()=>expect(api).toHaveBeenCalledTimes(2));await userEvent.click(screen.getByRole('combobox',{name:'Значення'}));await waitFor(()=>expect(screen.getAllByRole('option')).toHaveLength(31));await userEvent.click(screen.getAllByRole('option',{name:'Одна назва'}).at(-1)!)
 const expected=[...saved,{Data:{Id:'9007199254741999'},Name:'Одна назва',Value:0}];expect(selected()).toEqual(expected);view.rerender(<Form from="2026-09-01"/>);expect(selected()).toEqual(expected);expect(api.mock.calls.map(x=>x[1]?.query?.offset)).toEqual([0,30])
})
it('rejects stale group response after changing field without widening numeric manager identity',async()=>{
 let finish!:(value:unknown)=>void;api.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve})).mockResolvedValue([{Id:20,LastName:'Менеджер'}]);const view=render(<Form values={[]}/>);await waitFor(()=>expect(api).toHaveBeenCalledOnce());const signal=api.mock.calls[0][1]?.signal
 view.rerender(<Form field={10} values={[]}/>);expect(signal?.aborted).toBe(true);search('менеджер');await screen.findByRole('option',{name:'Менеджер [20]'});finish([{Id:max,Name:'Запізніла група'}]);await waitFor(()=>expect(screen.queryByRole('option',{name:'Запізніла група'})).toBeNull());expect(selected()).toEqual([])
})
it('retries failed next page at the same offset and preserves values while disabled',async()=>{
 let retried=false;api.mockImplementation(async(_path,options)=>{if(options?.query?.offset===30&&!retried){retried=true;throw Error('temporary')}return options?.query?.offset===30?[{Id:'200',Name:'Остання'}]:Array.from({length:30},(_,i)=>({Id:String(i+1),Name:'Група '+i}))});const view=render(<Form/>);await userEvent.click(screen.getByRole('combobox',{name:'Значення'}));await screen.findByRole('option',{name:'Група 0'});await userEvent.click(screen.getByRole('button',{name:'Ще значення'}));await userEvent.click(await screen.findByRole('button',{name:'Спробувати ще раз'}));await waitFor(()=>expect(api.mock.calls.map(x=>x[1]?.query?.offset)).toEqual([0,30,30]));view.rerender(<Form disabled/>);expect(selected()).toEqual(saved);expect(screen.getByRole('combobox',{name:'Значення'})).toHaveProperty('disabled',true)
})
it('invalid exact query never requests rounded identity and disabled condition hides membership help',async()=>{
 api.mockResolvedValue([]);const view=render(<Form/>);await waitFor(()=>expect(api).toHaveBeenCalledOnce());search('id:9223372036854775808');expect(screen.getByText(/Вкажіть точний ID групи/)).toBeTruthy();expect(api).toHaveBeenCalledOnce();expect(selected()).toEqual(saved);view.rerender(<Form checked={false}/>);expect(screen.queryByText(/поточні прямі зв’язки картки товару/)).toBeNull()
})
