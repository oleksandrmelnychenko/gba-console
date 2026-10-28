import { useEffect, useState } from 'react'
import { useDebouncedValue } from '@mantine/hooks'
import { Select, Stack, Text, TextInput } from '@mantine/core'
import { searchDatasetReportValues } from '../api/reportsApi'
import type { NativePriceComparison } from '../data/nativePriceComparison'
export function NativePriceComparisonPanel({value,onChange,disabled}:{value:NativePriceComparison|undefined;onChange:(value:NativePriceComparison)=>void;disabled:boolean}) {
  const [search,setSearch]=useState('')
  const [query]=useDebouncedValue(search.trim(),250)
  const [options,setOptions]=useState<Array<{value:string;label:string}>>([])
  const [selected,setSelected]=useState<{value:string;label:string}|null>(null)
  const [error,setError]=useState<string|null>(null)
  useEffect(()=>{
    if(disabled)return
    const controller=new AbortController()
    // This existing lookup reads saved global price-type definitions; it never starts a source sync.
    void searchDatasetReportValues(27,46,{value:query,offset:0,limit:30},controller.signal).then(items=>{
      if(controller.signal.aborted)return
      setOptions(items.map(item=>({value:String(item.Id).toUpperCase(),label:item.Name??'Тип ціни'})));setError(null)
    }).catch(()=>{if(!controller.signal.aborted)setError('Не вдалося завантажити історичні типи цін.')})
    return()=>controller.abort()
  },[query,disabled])
  const id=value?.PriceTypeId.toUpperCase()||null
  useEffect(()=>{
    if(disabled || !id || selected?.value===id)return
    const controller=new AbortController()
    void searchDatasetReportValues(27,46,{value:id,offset:0,limit:2},controller.signal).then(items=>{
      if(controller.signal.aborted)return
      const item=items.find(item=>String(item.Id).toUpperCase()===id)
      if(item)setSelected({value:id,label:item.Name??'Тип ціни'})
    }).catch(()=>{/* Keep the exact saved selection; the main lookup displays its own error. */})
    return()=>controller.abort()
  },[id,disabled,selected])
  const data=options.some(option=>option.value===id)||!id?options:[...options,selected?.value===id?selected:{value:id,label:'Збережений тип ціни'}]
  return <Stack gap="sm">
    <Select label="Тип ціни для порівняння" placeholder="Знайдіть тип ціни" searchable clearable disabled={disabled} data={data}
      searchValue={search} onSearchChange={setSearch} value={id} filter={({options})=>options} error={error}
      onChange={next=>{setSelected(data.find(option=>option.value===next)??null);onChange({Version:1,PriceTypeId:next??''})}} />
    <Text size="sm" c="dimmed">Продажі та повернення беруться з GBA. Ціна на дату документа додається лише за підтвердженою історією; без неї порівняльна сума та різниця порожні.</Text>
    <TextInput label="Проект / підрозділ" value="Ще не підтримуються у цьому звіті" disabled />
  </Stack>
}
