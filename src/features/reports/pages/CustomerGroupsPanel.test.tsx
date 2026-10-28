import { useState } from 'react'
import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { searchDatasetReportValues } from '../api/reportsApi'
import { initialCustomerGroups, type CustomerGroups } from '../data/customerGroups'
import { CustomerGroupsPanel } from './CustomerGroupsPanel'

vi.mock('../api/reportsApi',()=>({searchDatasetReportValues:vi.fn()}))
it('uses GBA client autocomplete and persists exact ids independently for each group',async()=>{
  vi.mocked(searchDatasetReportValues).mockResolvedValue([{Id:71,Name:'Покупець один'}])
  const onChange=vi.fn()
  render(<MantineProvider env="test"><CustomerGroupsPanel value={initialCustomerGroups()} onChange={onChange} disabled={false}/></MantineProvider>)
  await waitFor(()=>expect(searchDatasetReportValues).toHaveBeenCalledWith(44,6,{value:'',offset:0,limit:30},expect.any(AbortSignal)))
  fireEvent.click(screen.getByRole('combobox',{name:'Клієнти: Еталон'}))
  fireEvent.click(await screen.findByRole('option',{name:'Покупець один'}))
  expect(onChange).toHaveBeenLastCalledWith({Version:1,Groups:[{Name:'Еталон',ClientIds:[71]},{Name:'Порівнюваний набір',ClientIds:[]}]})
})

it('keeps selected labels after another server search without client-side refiltering',async()=>{
  vi.mocked(searchDatasetReportValues).mockImplementation(async(_source,_field,params)=>params.value==='new'?[{Id:72,Name:'Інша компанія'}]:[{Id:71,Name:'Покупець один'}])
  function Form(){const [value,setValue]=useState(initialCustomerGroups());return <CustomerGroupsPanel value={value} onChange={setValue} disabled={false}/>}
  render(<MantineProvider env="test"><Form/></MantineProvider>)
  const input=screen.getByRole('combobox',{name:'Клієнти: Еталон'})
  fireEvent.click(input);fireEvent.click(await screen.findByRole('option',{name:'Покупець один'}))
  fireEvent.change(input,{target:{value:'new'}})
  await waitFor(()=>expect(searchDatasetReportValues).toHaveBeenCalledWith(44,6,{value:'new',offset:0,limit:30},expect.any(AbortSignal)))
  expect(await screen.findByRole('option',{name:'Інша компанія'})).toBeTruthy()
  expect(screen.getAllByText('Покупець один').length).toBeGreaterThan(0)
  expect(screen.queryByText('Клієнт [71]')).toBeNull()
})
it('restores exact client labels once for overlapping saved sets',async()=>{
  vi.mocked(searchDatasetReportValues).mockClear()
  vi.mocked(searchDatasetReportValues).mockImplementation(async(_source,_field,params)=>params.value==='id:71'?[{Id:71,Name:'Збережений покупець'}]:[])
  const value=initialCustomerGroups();value.Groups[0].ClientIds=[71];value.Groups[1].ClientIds=[71]
  render(<MantineProvider env="test"><CustomerGroupsPanel value={value} onChange={vi.fn()} disabled={false}/></MantineProvider>)
  await waitFor(()=>expect(screen.getAllByText('Збережений покупець').length).toBeGreaterThanOrEqual(2))
  expect(vi.mocked(searchDatasetReportValues).mock.calls.filter(call=>call[2].value==='id:71')).toHaveLength(1)
  expect(screen.queryByText('Клієнт [71]')).toBeNull()
})

it('keeps the last editor attached to its set when the middle set is removed',()=>{
  vi.mocked(searchDatasetReportValues).mockResolvedValue([])
  function Form(){
    const [value,setValue]=useState<CustomerGroups>(()=>({...initialCustomerGroups(),Groups:[
      {Name:'Еталон',ClientIds:[]},{Name:'Набір B',ClientIds:[]},{Name:'Набір C',ClientIds:[]},
    ]}))
    return <CustomerGroupsPanel value={value} onChange={setValue} disabled={false}/>
  }
  render(<MantineProvider env="test"><Form/></MantineProvider>)
  fireEvent.change(screen.getByRole('combobox',{name:'Клієнти: Набір B'}),{target:{value:'середній пошук'}})
  const lastEditor=screen.getByRole('combobox',{name:'Клієнти: Набір C'})
  fireEvent.change(lastEditor,{target:{value:'останній пошук'}})
  fireEvent.click(screen.getAllByRole('button',{name:'Видалити набір'})[1])
  expect(screen.getByRole('combobox',{name:'Клієнти: Набір C'})).toBe(lastEditor)
  expect(screen.queryByRole('combobox',{name:'Клієнти: Набір B'})).toBeNull()
})
