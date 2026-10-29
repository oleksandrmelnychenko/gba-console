import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { ReportSelectedValue } from '../types'
import { SelectionValuePicker } from './ReportsStocksPage'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
const rawSaved:ReportSelectedValue[]=JSON.parse(String.raw`[{"Data":"{\"Id\":10}","Name":"Стара назва","Value":10},{"Data":{"Id":999},"Name":"Архівний запис","Value":0}]`)
function Form({field=1,condition=2,values=rawSaved,from='2026-10-01',disabled=false,checked=true}:{field?:number;condition?:number;values?:ReportSelectedValue[];from?:string;disabled?:boolean;checked?:boolean}) {
 const [selected,setSelected]=useState(values)
 return <MantineProvider env="test"><I18nProvider><SelectionValuePicker dataSource={44} from={from} to="2026-10-27" label="Значення" lookupProfitUnavailable={disabled}
 selection={{IsChecked:checked,SelectedField:{Type:field,Name:String(field)},FilterCondition:{Type:condition,Name:'Умова'},Values:selected}} selections={[]} onChange={setSelected}/><output data-testid="selected">{JSON.stringify(selected)}</output></I18nProvider></MantineProvider>
}
const selected=()=>JSON.parse(screen.getByTestId('selected').textContent!)
const search=(value:string)=>{const box=screen.getByRole('combobox',{name:'Значення'});act(()=>box.focus());fireEvent.change(box,{target:{value}})}
beforeEach(()=>{api.mockReset();Object.defineProperty(HTMLElement.prototype,'scrollIntoView',{configurable:true,value:vi.fn()})})
afterEach(cleanup)
it('does not bulk-load products; exact token yields real choice and keeps ID above Int32 in Data only',async()=>{
 api.mockResolvedValue([{Id:1099511627776,Name:'Знайдений товар'}]);render(<Form values={[]}/>)
 expect(api).not.toHaveBeenCalled();search('id:1099511627776');fireEvent.click(await screen.findByRole('option',{name:'Знайдений товар'}))
 expect(selected()).toEqual([{Data:{Id:1099511627776},Name:'Знайдений товар',Value:0}])
 expect(screen.queryByRole('button',{name:'Ще значення'})).toBeNull()
})
it('pages beyond30 names on demand, keeps same-caption IDs and preserves raw saved payload/date',async()=>{
 const first=Array.from({length:30},(_,i)=>({Id:i+10,Name:i===0?'Нова назва':'Одна назва'}))
 api.mockImplementation(async(_path,options)=>options?.query?.offset===30?[{Id:40,Name:'Одна назва'}]:first)
 const view=render(<Form/>);search('назва')
 await screen.findByRole('option',{name:'Стара назва'})
 expect(screen.getAllByRole('option')).toHaveLength(30)
 expect(api).toHaveBeenCalledTimes(1)
 fireEvent.click(screen.getByRole('button',{name:'Ще значення'}))
 await waitFor(()=>expect(screen.getAllByRole('option')).toHaveLength(31))
 fireEvent.click(screen.getAllByRole('option',{name:'Одна назва'}).at(-1)!)
 expect(selected()).toEqual([...rawSaved,{Data:{Id:40},Name:'Одна назва',Value:0}])
 view.rerender(<Form from="2026-09-01"/>);expect(selected()).toEqual([...rawSaved,{Data:{Id:40},Name:'Одна назва',Value:0}])
 expect(api.mock.calls.map(call=>call[1]?.query?.offset)).toEqual([0,30])
})
it('ignores aborted next-page response after a new search and leaves selected IDs intact',async()=>{
 let oldResolve!:(value:unknown)=>void
 api.mockImplementation(async(_path,options)=>options?.query?.value==='new'? [{Id:80,Name:'Нова відповідь'}]
 :options?.query?.offset===30?new Promise(resolve=>{oldResolve=resolve}):Array.from({length:30},(_,i)=>({Id:i+10,Name:'Стара '+i})))
 render(<Form/>);search('old');await screen.findByRole('option',{name:'Стара 1'});fireEvent.click(screen.getByRole('button',{name:'Ще значення'}))
 await waitFor(()=>expect(api).toHaveBeenCalledTimes(2));const oldSignal=api.mock.calls[1][1]?.signal
 search('new');await screen.findByRole('option',{name:'Нова відповідь'});expect(oldSignal?.aborted).toBe(true)
 oldResolve([{Id:90,Name:'Запізніла відповідь'}]);await waitFor(()=>expect(screen.queryByRole('option',{name:'Запізніла відповідь'})).toBeNull())
 expect(selected()).toEqual(rawSaved);expect(api.mock.calls.at(-1)?.[1]?.query?.offset).toBe(0)
})
it('retries failed next page at same offset without losing previous options or saved selections',async()=>{
 api.mockResolvedValueOnce(Array.from({length:30},(_,i)=>({Id:i+10,Name:'Товар '+i}))).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([{Id:40,Name:'Наступний'}])
 render(<Form/>);search('товар');await screen.findByRole('option',{name:'Товар 1'});fireEvent.click(screen.getByRole('button',{name:'Ще значення'}))
 fireEvent.click(await screen.findByRole('button',{name:'Спробувати ще раз'}));await screen.findByRole('option',{name:'Наступний'})
 expect(api.mock.calls.map(call=>call[1]?.query?.offset)).toEqual([0,30,30]);expect(selected()).toEqual(rawSaved)
})
it('renders bounded code choices but searches every child, preserving independent parent-region selection',async()=>{
 api.mockResolvedValue([{Id:12,Name:'Parent',RegionCodes:Array.from({length:3484},(_,i)=>({Id:i+100,RegionId:12,Value:'CODE'+i}))}])
 render(<Form field={8} values={[]}/>);fireEvent.focus(screen.getByRole('combobox',{name:'Значення'}))
 await screen.findByRole('option',{name:'CODE0 — Parent [100]'});expect(screen.getAllByRole('option')).toHaveLength(30)
 search('CODE3483');fireEvent.click(await screen.findByRole('option',{name:'CODE3483 — Parent [3583]'}))
 expect(selected()).toEqual([{Data:{Id:3583},Name:'CODE3483 — Parent [3583]',Value:0}]);expect(api).toHaveBeenCalledTimes(1)
})
it('searches/paginates current manager User IDs without an empty load or role restriction',async()=>{
 api.mockResolvedValue([{Id:20,FirstName:'Іван',LastName:'Петренко',UserDetailsId:800,NetUid:'other',IsActive:false}])
 render(<Form field={10} values={[]}/>);expect(api).not.toHaveBeenCalled()
 expect(screen.getByText('Основний менеджер із поточної картки клієнта, а не автор продажу.')).toBeTruthy()
 search('Пет');fireEvent.click(await screen.findByRole('option',{name:'Петренко Іван [20]'}))
 expect(selected()).toEqual([{Data:{Id:20},Name:'Петренко Іван [20]',Value:0}])
 expect(api.mock.calls[0][0]).toBe('/usermanagement/profiles/search/lookup')
})
it('preserves valid Product multi-Equals until explicit user action and does not rewrite on mount',()=>{
 render(<Form condition={0}/>);expect(selected()).toEqual(rawSaved)
 expect(screen.getByRole('button',{name:'Видалити Стара назва'})).toBeTruthy();expect(screen.getByRole('button',{name:'Видалити Архівний запис'})).toBeTruthy()
})
it('shows current-card meaning only for enabled code/manager conditions',()=>{
 const view=render(<Form field={10}/>);expect(screen.getByText(/Регіон, код регіону та основний менеджер у відборах/)).toBeTruthy()
 view.rerender(<Form field={10} checked={false}/>);expect(screen.queryByText(/Регіон, код регіону та основний менеджер у відборах/)).toBeNull()
})

it('keeps literal id: manager-name paging distinct from Product exact-ID mode',async()=>{
 api.mockImplementation(async(_path,options)=>options?.query?.offset===30?[{Id:100,LastName:'id:literal next'}]:Array.from({length:30},(_,i)=>({Id:i+10,LastName:'id:literal '+i})))
 render(<Form field={10} values={[]}/>);search('id:literal')
 await screen.findByRole('option',{name:'id:literal 0 [10]'})
 fireEvent.click(screen.getByRole('button',{name:'Ще значення'}));await screen.findByRole('option',{name:'id:literal next [100]'})
 expect(api.mock.calls.map(call=>call[1]?.query?.offset)).toEqual([0,30])
})

it.each([[2,1],[44,2]])('keeps legacy source%d/field%d routing and literal query unchanged',async(source,field)=>{
 api.mockResolvedValue([{Id:10,Name:'Старий каталог'}])
 render(<MantineProvider env="test"><I18nProvider><SelectionValuePicker dataSource={source} from="2026-10-01" to="2026-10-27" label="Значення"
 selection={{IsChecked:true,SelectedField:{Type:field,Name:'Product'},FilterCondition:{Type:2,Name:'У списку'},Values:[]}} selections={[]} onChange={vi.fn()}/></I18nProvider></MantineProvider>)
 search('id:10');await screen.findByRole('option',{name:'Старий каталог'})
 expect(api.mock.calls.at(-1)?.[1]?.query).toMatchObject({dataSource:source,field,value:'id:10',offset:0,limit:30})
 expect(screen.queryByText('Шукайте за назвою або точним ID товару: id:123.')).toBeNull()
})

it.each([0,1])('explicit new Product choice replaces an old multi-value condition%d set',async condition=>{
 api.mockResolvedValue([{Id:20,Name:'Новий товар'}]);render(<Form condition={condition}/>);search('новий')
 fireEvent.click(await screen.findByRole('option',{name:'Новий товар'}))
 expect(selected()).toEqual([{Data:{Id:20},Name:'Новий товар',Value:0}])
})

it('aborts a product lookup when field changes and never exposes its late response as manager identity',async()=>{
 let oldResolve!:(value:unknown)=>void
 api.mockImplementationOnce(()=>new Promise(resolve=>{oldResolve=resolve})).mockResolvedValueOnce([{Id:80,LastName:'Новий менеджер'}])
 const view=render(<Form values={[]}/>);search('product');await waitFor(()=>expect(api).toHaveBeenCalledOnce())
 const signal=api.mock.calls[0][1]?.signal;view.rerender(<Form field={10} values={[]}/>);expect(signal?.aborted).toBe(true)
 search('manager');await screen.findByRole('option',{name:'Новий менеджер [80]'})
 oldResolve([{Id:90,Name:'Запізнілий товар'}]);await waitFor(()=>expect(screen.queryByRole('option',{name:'Запізнілий товар'})).toBeNull())
 expect(selected()).toEqual([])
})

it.each([0,2])('loads the next Product name page with real pointer focus/blur events for condition%d',async condition=>{
 api.mockImplementation(async(_path,options)=>options?.query?.offset===30?[{Id:40,Name:'Наступний товар'}]:Array.from({length:30},(_,i)=>({Id:i+10,Name:'Товар '+i})))
 render(<Form condition={condition} values={[]}/>);search('товар');await screen.findByRole('option',{name:'Товар 0'})
 await userEvent.click(screen.getByRole('button',{name:'Ще значення'}))
 await waitFor(()=>expect(api.mock.calls.map(call=>call[1]?.query?.offset)).toEqual([0,30]))
 expect(screen.getByRole('combobox',{name:'Значення'})).toHaveProperty('value','товар')
})

it.each([0,2])('keeps query while keyboard Tab/Enter loads next page for condition%d',async condition=>{
 api.mockImplementation(async(_path,options)=>options?.query?.offset===30?[{Id:40,Name:'Наступний товар'}]:Array.from({length:30},(_,i)=>({Id:i+10,Name:'Товар '+i})))
 render(<Form condition={condition} values={[]}/>);search('товар');await screen.findByRole('option',{name:'Товар 0'})
 await userEvent.tab();expect(screen.getByRole('button',{name:'Ще значення'})).toBe(document.activeElement)
 expect(screen.getByRole('combobox',{name:'Значення'})).toHaveProperty('value','товар')
 await userEvent.keyboard('{Enter}');await waitFor(()=>expect(api.mock.calls.map(call=>call[1]?.query?.offset)).toEqual([0,30]))
 await userEvent.click(screen.getByRole('combobox',{name:'Значення'}));await screen.findByRole('option',{name:'Наступний товар'})
 expect(selected()).toEqual([])
})
it('selects a verified exact ID with keyboard arrows/Enter and Escape retains search without creating a choice',async()=>{
 api.mockResolvedValue([{Id:20,Name:'Точний товар'}]);render(<Form condition={0} values={[]}/>);search('id:20')
 await screen.findByRole('option',{name:'Точний товар'});await userEvent.keyboard('{ArrowDown}{Enter}')
 expect(selected()).toEqual([{Data:{Id:20},Name:'Точний товар',Value:0}])
 search('інше');await screen.findByRole('option',{name:'Точний товар'});await userEvent.keyboard('{Escape}')
 expect(screen.getByRole('combobox',{name:'Значення'})).toHaveProperty('ariaExpanded','false')
 expect(screen.getByRole('combobox',{name:'Значення'})).toHaveProperty('value','інше')
 expect(selected()).toEqual([{Data:{Id:20},Name:'Точний товар',Value:0}])
})
it('keeps remote choices disabled and exposes a labelled query error without inventing an ID',async()=>{
 const view=render(<Form condition={0} values={[]} disabled/>);expect(screen.getByRole('combobox',{name:'Значення'})).toHaveProperty('disabled',true)
 view.rerender(<Form condition={0} values={[]}/>);search('id:0')
 expect(screen.getByText(/Вкажіть точний ID товару/)).toBeTruthy();expect(api).not.toHaveBeenCalled();expect(selected()).toEqual([])
})
