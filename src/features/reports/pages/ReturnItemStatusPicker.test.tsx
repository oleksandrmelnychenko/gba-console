import { useState } from 'react'
import { MantineProvider } from '@mantine/core'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { ReturnItemStatusPicker } from './ReturnItemStatusPicker'
import { returnStatusDataset } from '../data/returnItemStatuses.test-fixtures'
import type { ReportSelectedValue, ReportSelection } from '../types'
afterEach(cleanup)
const selection=(Values:ReportSelectedValue[],condition=2):ReportSelection=>({IsChecked:true,SelectedField:{Type:64,Name:'Причина повернення'},FilterCondition:{Type:condition,Name:'У списку'},Values})
it('list choices commit only canonical options, including zero; typed search cannot create a value',async()=>{
 const changed=vi.fn();const user=userEvent.setup()
 function Fixture(){const [values,setValues]=useState<ReportSelectedValue[]>([]);return <ReturnItemStatusPicker dataset={returnStatusDataset} selection={selection(values)} onChange={next=>{setValues(next);changed(next)}}/>}
 render(<MantineProvider env="test"><Fixture/></MantineProvider>)
 const input=screen.getByRole('combobox',{name:'Причини повернення'})
 await user.type(input,'Вигадана причина');await user.keyboard('{Enter}');expect(changed).not.toHaveBeenCalled()
 await user.clear(input);await user.click(await screen.findByRole('option',{name:'Причина 0'}))
 await user.click(input);await user.click(await screen.findByRole('option',{name:'Брак'}))
 expect(changed).toHaveBeenLastCalledWith([{Data:{ReturnItemStatus:0},Name:'Причина 0',Value:0},{Data:{ReturnItemStatus:6},Name:'Брак',Value:0}])
})
it('retains legacy multi-equality and switches namespaces only after explicit clear',async()=>{
 const changed=vi.fn();const user=userEvent.setup();const legacy=[{Data:{Id:71},Name:'Старий71',Value:0},{Data:{Id:72},Name:'Старий72',Value:0}]
 function Fixture(){const [values,setValues]=useState<ReportSelectedValue[]>(legacy);return <ReturnItemStatusPicker dataset={returnStatusDataset} selection={selection(values,0)} onChange={next=>{changed(next);setValues(next)}}/>}
 render(<MantineProvider env="test"><Fixture/></MantineProvider>)
 expect(screen.getByText(/Старий71, Старий72/)).toBeTruthy();expect(changed).not.toHaveBeenCalled();expect(screen.queryByRole('combobox')).toBeNull()
 await user.click(screen.getByRole('button',{name:'Очистити причини'}));expect(changed).toHaveBeenLastCalledWith([])
 await user.click(screen.getByRole('combobox',{name:'Причина повернення'}));await user.click(await screen.findByRole('option',{name:'Брак'}))
 expect(changed).toHaveBeenLastCalledWith([{Data:{ReturnItemStatus:6},Name:'Брак',Value:0}]);expect(legacy.map(value=>value.Data.Id)).toEqual([71,72])
})
