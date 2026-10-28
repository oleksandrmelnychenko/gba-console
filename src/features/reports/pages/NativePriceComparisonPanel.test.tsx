import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { searchDatasetReportValues } from '../api/reportsApi'
import { NativePriceComparisonPanel } from './NativePriceComparisonPanel'
vi.mock('../api/reportsApi',()=>({searchDatasetReportValues:vi.fn()}))
it('selects a stored historical price type without source-world controls',async()=>{
  const id='11111111111111111111111111111111'
  vi.mocked(searchDatasetReportValues).mockResolvedValue([{Id:id,Name:'Оптовий'}])
  const onChange=vi.fn()
  render(<MantineProvider env="test"><NativePriceComparisonPanel value={{Version:1,PriceTypeId:''}} onChange={onChange} disabled={false}/></MantineProvider>)
  await waitFor(()=>expect(searchDatasetReportValues).toHaveBeenCalledWith(27,46,{value:'',offset:0,limit:30},expect.any(AbortSignal)))
  fireEvent.click(screen.getByRole('combobox',{name:'Тип ціни для порівняння'}))
  fireEvent.click(await screen.findByRole('option',{name:'Оптовий'}))
  expect(onChange).toHaveBeenLastCalledWith({Version:1,PriceTypeId:id})
  expect(screen.queryByText(/Fenix|AMG/)).toBeNull()
})

it('resolves the saved exact price type outside the first search page',async()=>{
  const id='22222222222222222222222222222222'
  vi.mocked(searchDatasetReportValues).mockImplementation(async(_source,_field,params)=>params.value===id?[{Id:id,Name:'Історичний спеціальний'}]:[])
  render(<MantineProvider env="test"><NativePriceComparisonPanel value={{Version:1,PriceTypeId:id}} onChange={vi.fn()} disabled={false}/></MantineProvider>)
  await waitFor(()=>expect((screen.getByRole('combobox',{name:'Тип ціни для порівняння'}) as HTMLInputElement).value).toBe('Історичний спеціальний'))
})
