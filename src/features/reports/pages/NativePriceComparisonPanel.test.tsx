import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { searchDatasetReportValues } from '../api/reportsApi'
import { NativePriceComparisonPanel } from './NativePriceComparisonPanel'
vi.mock('../api/reportsApi',()=>({searchDatasetReportValues:vi.fn()}))
beforeAll(()=>{Object.defineProperty(HTMLElement.prototype,'scrollIntoView',{configurable:true,value:vi.fn()})})
beforeEach(()=>{vi.mocked(searchDatasetReportValues).mockReset()})
it('selects a native price type even without historical coverage without source-world controls',async()=>{
  const id='9007199254740993'
  vi.mocked(searchDatasetReportValues).mockResolvedValue([{Id:id,Name:'Оптовий'}])
  const onChange=vi.fn()
  render(<MantineProvider env="test"><NativePriceComparisonPanel value={{Version:2,PricingId:''}} onChange={onChange} disabled={false}/></MantineProvider>)
  await waitFor(()=>expect(searchDatasetReportValues).toHaveBeenCalledWith(46,46,{value:'',offset:0,limit:30},expect.any(AbortSignal)))
  fireEvent.click(screen.getByRole('combobox',{name:'Тип ціни для порівняння'}))
  fireEvent.click(await screen.findByRole('option',{name:'Оптовий'}))
  expect(onChange).toHaveBeenLastCalledWith({Version:2,PricingId:id})
  expect(screen.queryByText(/Fenix|AMG/)).toBeNull()
})

it('resolves the saved exact price type outside the first search page',async()=>{
  const id='22222222222222222222222222222222'
  vi.mocked(searchDatasetReportValues).mockImplementation(async(_source,_field,params)=>params.value===`legacy:${id}`?[{Id:id,Name:'Історичний спеціальний'}]:[])
  render(<MantineProvider env="test"><NativePriceComparisonPanel value={{Version:1,PriceTypeId:id}} onChange={vi.fn()} disabled={false}/></MantineProvider>)
  await waitFor(()=>expect((screen.getByRole('combobox',{name:'Тип ціни для порівняння'}) as HTMLInputElement).value).toBe('Історичний спеціальний'))
})

it('restores a native bigint identity without rounding or using a caption search',async()=>{
  const id='9007199254740993'
  vi.mocked(searchDatasetReportValues).mockImplementation(async(_source,_field,params)=>params.value===`id:${id}`?[{Id:id,Name:'Точний прайс'}]:[])
  render(<MantineProvider env="test"><NativePriceComparisonPanel value={{Version:2,PricingId:id}} onChange={vi.fn()} disabled={false}/></MantineProvider>)
  await waitFor(()=>expect((screen.getByRole('combobox',{name:'Тип ціни для порівняння'}) as HTMLInputElement).value).toBe('Точний прайс'))
  expect(searchDatasetReportValues).toHaveBeenCalledWith(46,46,{value:`id:${id}`,offset:0,limit:2},expect.any(AbortSignal))
})

it('does not auto-migrate a saved v1 choice when its caption matches a native choice',async()=>{
  const legacy='a'.repeat(32),native='9007199254740993'
  vi.mocked(searchDatasetReportValues).mockImplementation(async(_source,_field,params)=>
    params.value===`legacy:${legacy.toUpperCase()}`?[{Id:legacy,Name:'Однакова назва'}]:[{Id:native,Name:'Однакова назва'}])
  const onChange=vi.fn()
  render(<MantineProvider env="test"><NativePriceComparisonPanel value={{Version:1,PriceTypeId:legacy}} onChange={onChange} disabled={false}/></MantineProvider>)
  await waitFor(()=>expect((screen.getByRole('combobox',{name:'Тип ціни для порівняння'}) as HTMLInputElement).value).toBe('Однакова назва'))
  expect(onChange).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('combobox',{name:'Тип ціни для порівняння'}))
  const choices=await screen.findAllByRole('option',{name:'Однакова назва'})
  const nativeChoice=choices.find(option=>option.getAttribute('value')===native)
  expect(nativeChoice).toBeDefined()
  fireEvent.click(nativeChoice!)
  expect(onChange).toHaveBeenLastCalledWith({Version:2,PricingId:native})
})

it('refuses numeric or malformed native lookup IDs instead of rounding or borrowing a legacy identity',async()=>{
  vi.mocked(searchDatasetReportValues).mockResolvedValue([
    {Id:Number.MAX_SAFE_INTEGER+1,Name:'Rounded'}, {Id:'01',Name:'Leading zero'},
    {Id:'a'.repeat(32),Name:'Source identity'}, {Id:'9223372036854775807',Name:'Exact native'},
  ])
  render(<MantineProvider env="test"><NativePriceComparisonPanel value={{Version:2,PricingId:''}} onChange={vi.fn()} disabled={false}/></MantineProvider>)
  fireEvent.click(screen.getByRole('combobox',{name:'Тип ціни для порівняння'}))
  expect(await screen.findByRole('option',{name:'Exact native'})).toBeTruthy()
  expect(screen.queryByRole('option',{name:'Rounded'})).toBeNull()
  expect(screen.queryByRole('option',{name:'Leading zero'})).toBeNull()
  expect(screen.queryByRole('option',{name:'Source identity'})).toBeNull()
})

it('retains an unavailable saved native identity without replacing it with a current choice',async()=>{
  const onChange=vi.fn(),id='9007199254740993'
  vi.mocked(searchDatasetReportValues).mockImplementation(async(_source,_field,params)=>params.value===`id:${id}`?[]:[{Id:'1',Name:'Current type'}])
  render(<MantineProvider env="test"><NativePriceComparisonPanel value={{Version:2,PricingId:id}} onChange={onChange} disabled={false}/></MantineProvider>)
  await waitFor(()=>expect(searchDatasetReportValues).toHaveBeenCalledWith(46,46,{value:`id:${id}`,offset:0,limit:2},expect.any(AbortSignal)))
  expect((screen.getByRole('combobox',{name:'Тип ціни для порівняння'}) as HTMLInputElement).value).toBe('Збережений тип ціни')
  expect(onChange).not.toHaveBeenCalled()
  expect(screen.getByText(/порівняльна сума та різниця порожні/)).toBeTruthy()
})

it('ignores a late legacy resolution after the saved selection changes to a native identity',async()=>{
  const legacy='b'.repeat(32),native='9007199254740993',onChange=vi.fn()
  let resolveLegacy:((value:Array<{Id:string;Name:string}>)=>void)|undefined
  let legacySignal:AbortSignal|undefined
  vi.mocked(searchDatasetReportValues).mockImplementation(async(_source,_field,params,signal)=>{
    if(params.value===`legacy:${legacy.toUpperCase()}`){legacySignal=signal;return new Promise(resolve=>{resolveLegacy=resolve})}
    return params.value===`id:${native}`?[{Id:native,Name:'Нативний тип'}]:[]
  })
  const {rerender}=render(<MantineProvider env="test"><NativePriceComparisonPanel value={{Version:1,PriceTypeId:legacy}} onChange={onChange} disabled={false}/></MantineProvider>)
  await waitFor(()=>expect(resolveLegacy).toBeDefined())
  rerender(<MantineProvider env="test"><NativePriceComparisonPanel value={{Version:2,PricingId:native}} onChange={onChange} disabled={false}/></MantineProvider>)
  await waitFor(()=>expect((screen.getByRole('combobox',{name:'Тип ціни для порівняння'}) as HTMLInputElement).value).toBe('Нативний тип'))
  expect(legacySignal?.aborted).toBe(true)
  await act(async()=>resolveLegacy?.([{Id:legacy,Name:'Старий тип'}]))
  expect((screen.getByRole('combobox',{name:'Тип ціни для порівняння'}) as HTMLInputElement).value).toBe('Нативний тип')
  expect(onChange).not.toHaveBeenCalled()
})
