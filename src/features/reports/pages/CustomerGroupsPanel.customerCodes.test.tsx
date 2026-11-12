import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { searchDatasetReportValues } from '../api/reportsApi'
import { initialCustomerGroups } from '../data/customerGroups'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { CustomerGroupsPanel } from './CustomerGroupsPanel'
import { ReportValuePicker } from './ReportValuePicker'

vi.mock('../api/reportsApi',()=>({searchDatasetReportValues:vi.fn()}))
afterEach(cleanup)
const coded='XM06001 — Хмельницький - ПП Муляр Ю.А. [633729]'
const plain='Вуляр Сергій Олександрович [635176]'

it('finds a client set member by code and stores only the exact id',async()=>{
  vi.mocked(searchDatasetReportValues).mockImplementation(async(_source,_field,params)=>params.value==='XM06001'?[{Id:633729,Name:coded}]:[{Id:635176,Name:plain}])
  const onChange=vi.fn()
  render(<MantineProvider env="test"><CustomerGroupsPanel value={initialCustomerGroups()} onChange={onChange} disabled={false}/></MantineProvider>)
  const input=screen.getByRole('combobox',{name:'Клієнти: Еталон'})
  fireEvent.click(input);fireEvent.change(input,{target:{value:'XM06001'}})
  await waitFor(()=>expect(searchDatasetReportValues).toHaveBeenCalledWith(44,6,{value:'XM06001',offset:0,limit:30},expect.any(AbortSignal)))
  fireEvent.click(await screen.findByRole('option',{name:coded}))
  expect(onChange).toHaveBeenLastCalledWith({Version:1,Groups:[{Name:'Еталон',ClientIds:[633729]},{Name:'Порівнюваний набір',ClientIds:[]}]})
})

it('restores saved client sets with the code and keeps a client without code by name',async()=>{
  vi.mocked(searchDatasetReportValues).mockImplementation(async(_source,_field,params)=>
    params.value==='id:633729'?[{Id:633729,Name:coded}]:params.value==='id:635176'?[{Id:635176,Name:plain}]:[])
  const value=initialCustomerGroups();value.Groups[0].ClientIds=[633729];value.Groups[1].ClientIds=[635176]
  render(<MantineProvider env="test"><CustomerGroupsPanel value={value} onChange={vi.fn()} disabled={false}/></MantineProvider>)
  await waitFor(()=>expect(screen.getAllByText(coded).length).toBeGreaterThan(0))
  await waitFor(()=>expect(screen.getAllByText(plain).length).toBeGreaterThan(0))
  expect(screen.queryByText('Клієнт [633729]')).toBeNull()
})

it('shows the same code label in options, pills and the selected list while values stay ids',()=>{
  const onChange=vi.fn()
  const options=[{value:'633729',label:coded},{value:'635176',label:plain}]
  render(<MantineProvider env="test"><I18nProvider><ReportValuePicker mode="multi" data={options} selected={[options[0]]} search="" onSearchChange={vi.fn()} onChange={onChange}/></I18nProvider></MantineProvider>)
  expect(screen.getByRole('button',{name:`Видалити ${coded}`})).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:'Вибрано: 1'}))
  expect(screen.getByRole('option',{name:coded})).toBeTruthy()
  expect(screen.queryByRole('option',{name:plain})).toBeNull()
  fireEvent.click(screen.getByRole('button',{name:'Вибрано: 1'}))
  fireEvent.click(screen.getByRole('option',{name:plain}))
  expect(onChange).toHaveBeenLastCalledWith(['633729','635176'])
})
