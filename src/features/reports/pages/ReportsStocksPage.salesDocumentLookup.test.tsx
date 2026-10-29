import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { apiRequest } from '../../../shared/api/apiClient'
import type { ReportSelectedValue, ReportSelection } from '../types'
import { SelectionValuePicker } from './ReportsStocksPage'
vi.mock('../../../shared/api/apiClient',()=>({apiRequest:vi.fn()}))
const api=vi.mocked(apiRequest), changed=vi.fn()
function Picker({field}:{field:number}) {
 const [values,setValues]=useState<ReportSelectedValue[]>([]),[from,setFrom]=useState('2026-10-18')
 const selection:ReportSelection={IsChecked:true,SelectedField:{Type:field,Name:field===14?'Повернення від клієнта':'Документ продажу'},FilterCondition:{Type:2,Name:'У списку'},Values:values}
 return <MantineProvider env="test"><I18nProvider><button onClick={()=>setFrom('2026-10-19')}>Змінити дату</button><SelectionValuePicker dataSource={2} selection={selection} selections={[selection]} from={from} to="2026-10-27" label="Значення" onChange={next=>{setValues(next);changed(next)}}/></I18nProvider></MantineProvider>
}
beforeEach(()=>{vi.clearAllMocks();Object.defineProperty(HTMLElement.prototype,'scrollIntoView',{configurable:true,value:vi.fn()})})
it.each([[12,'sale','Продаж'],[14,'return','Повернення']] as const)('uses actual adapter for field%s and retains selected exact ID after date change',async(field,Kind,caption)=>{
 const Name=`${caption} №17 · 19.10.2026 13:14:53`
 api.mockResolvedValue([{Id:'9007199254740993',Kind,Name}])
 render(<Picker field={field}/>)
 fireEvent.click(screen.getByRole('combobox',{name:'Значення'}))
 fireEvent.click(await screen.findByRole('option',{name:Name}))
 expect(changed.mock.calls.at(-1)?.[0]).toEqual([{Data:{Id:'9007199254740993'},Name,Value:0}])
 fireEvent.click(screen.getByRole('button',{name:'Змінити дату'}))
 await waitFor(()=>expect(api).toHaveBeenLastCalledWith('/report/datasets/sales/documents/lookup',expect.objectContaining({query:expect.objectContaining({field,from:'2026-10-19'})})))
 expect(screen.getByRole('button',{name:'Вибрано: 1'})).toBeTruthy();expect(changed).toHaveBeenCalledOnce()
 expect(api.mock.calls.every(([path])=>path==='/report/datasets/sales/documents/lookup')).toBe(true)
})
