import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { ReportSelectedValue } from '../types'
import { SelectionValuePicker } from './ReportsStocksPage'
vi.mock('../../../shared/api/apiClient',()=>({apiRequest:vi.fn()}))
const api=vi.mocked(apiRequest),max='9223372036854775807'
const saved:ReportSelectedValue[]=JSON.parse(String.raw`[{"Data":"{\"Id\":\"9007199254740993\"}","Name":"Старий договір","Value":0},{"Data":{"Id":"9223372036854775807"},"Name":"Архівний договір","Value":0}]`)
function Form({field=9,condition=2,values=saved,from='2026-10-01',disabled=false,checked=true}:{field?:number;condition?:number;values?:ReportSelectedValue[];from?:string;disabled?:boolean;checked?:boolean}){
 const [selected,setSelected]=useState(values)
 return <MantineProvider env="test"><I18nProvider><SelectionValuePicker dataSource={44} from={from} to="2026-10-27" label="Значення" lookupProfitUnavailable={disabled} selection={{IsChecked:checked,SelectedField:{Type:field,Name:'Договір клієнта'},FilterCondition:{Type:condition,Name:'Умова'},Values:selected}} selections={[]} onChange={setSelected}/><output data-testid="selected">{JSON.stringify(selected)}</output></I18nProvider></MantineProvider>
}
const selected=()=>JSON.parse(screen.getByTestId('selected').textContent!)
function search(query:string){const box=screen.getByRole('combobox',{name:'Значення'});act(()=>box.focus());fireEvent.change(box,{target:{value:query}})}
beforeEach(()=>{api.mockReset();Object.defineProperty(HTMLElement.prototype,'scrollIntoView',{configurable:true,value:vi.fn()})})
afterEach(cleanup)
it('chooses actual maxInt64 agreement without Client filter, current-region note or numeric conversion',async()=>{
 api.mockResolvedValue([{Id:max,Name:'Клієнт — Договір №1 ['+max+']'}]);render(<Form values={[]} condition={0}/>);expect(api).not.toHaveBeenCalled()
 expect(screen.getByText(/до договору в документі/)).toBeTruthy();expect(screen.queryByText(/Регіон, код регіону/)).toBeNull()
 search('id:'+max);await userEvent.click(await screen.findByRole('option',{name:'Клієнт — Договір №1 ['+max+']'}))
 expect(selected()).toEqual([{Data:{Id:max},Name:'Клієнт — Договір №1 ['+max+']',Value:0}]);expect(api.mock.calls[0][1]?.query).toEqual({dataSource:44,field:9,value:'id:'+max,offset:0,limit:30})
 expect(screen.queryByRole('button',{name:'Ще значення'})).toBeNull()
})
it('pages ID-keyed same-caption contracts and retains raw saved labels, missing entries and date changes',async()=>{
 api.mockImplementation(async(_path,options)=>options?.query?.offset===30?[{Id:'9007199254741999',Name:'Однакова назва'}]:Array.from({length:30},(_,i)=>({Id:(9007199254740993n+BigInt(i)).toString(),Name:i===0?'Нова назва':'Однакова назва'})))
 const view=render(<Form/>);search('договір');await screen.findByRole('option',{name:'Старий договір'});expect(screen.getAllByRole('option')).toHaveLength(30)
 await userEvent.click(screen.getByRole('button',{name:'Ще значення'}));await waitFor(()=>expect(api).toHaveBeenCalledTimes(2));await userEvent.click(screen.getByRole('combobox',{name:'Значення'}));await waitFor(()=>expect(screen.getAllByRole('option')).toHaveLength(31))
 await userEvent.click(screen.getAllByRole('option',{name:'Однакова назва'}).at(-1)!)
 const expected=[...saved,{Data:{Id:'9007199254741999'},Name:'Однакова назва',Value:0}];expect(selected()).toEqual(expected)
 view.rerender(<Form from="2026-09-01"/>);expect(selected()).toEqual(expected);expect(api.mock.calls.map(call=>call[1]?.query?.offset)).toEqual([0,30])
})
it('explicit equality replacement clears old invalid multi-set only on user selection',async()=>{
 api.mockResolvedValue([{Id:'9007199254740994',Name:'Обраний договір'}]);render(<Form condition={0}/>);expect(selected()).toEqual(saved)
 search('договір');await userEvent.click(await screen.findByRole('option',{name:'Обраний договір'}));expect(selected()).toEqual([{Data:{Id:'9007199254740994'},Name:'Обраний договір',Value:0}])
})
it('ignores late contract page after changing field to manager, never interpreting stringId as UserId',async()=>{
 let finish!:(value:unknown)=>void;api.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve})).mockResolvedValueOnce([{Id:20,LastName:'Менеджер'}])
 const view=render(<Form values={[]}/>);search('договір');await waitFor(()=>expect(api).toHaveBeenCalledOnce());const signal=api.mock.calls[0][1]?.signal
 view.rerender(<Form field={10} values={[]}/>);expect(signal?.aborted).toBe(true);search('менеджер');await screen.findByRole('option',{name:'Менеджер [20]'})
 finish([{Id:max,Name:'Запізнілий договір'}]);await waitFor(()=>expect(screen.queryByRole('option',{name:'Запізнілий договір'})).toBeNull());expect(selected()).toEqual([])
})
it('preserves raw values and disallows mutating a selected-only list disabled after opening',async()=>{
 const view=render(<Form/>);await userEvent.click(screen.getByRole('button',{name:'Вибрано: 2'}));await screen.findByRole('option',{name:'Старий договір'});view.rerender(<Form disabled/>);await userEvent.click(screen.getByRole('option',{name:'Старий договір'}));expect(selected()).toEqual(saved)
})
it('does not send malformed exact query or show active business help on disabled condition',async()=>{
 const view=render(<Form/>);search('id:9223372036854775808');expect(screen.getByText(/Вкажіть точний ID договору/)).toBeTruthy();expect(api).not.toHaveBeenCalled();expect(selected()).toEqual(saved)
 view.rerender(<Form checked={false}/>);expect(screen.queryByText(/до договору в документі/)).toBeNull()
})
