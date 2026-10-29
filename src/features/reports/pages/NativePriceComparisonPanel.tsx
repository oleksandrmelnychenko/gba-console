import { useEffect, useState } from 'react'
import { useDebouncedValue } from '@mantine/hooks'
import { Select, Stack, Text, TextInput } from '@mantine/core'
import { searchDatasetReportValues } from '../api/reportsApi'
import { isNativePricingId, type NativePriceComparison } from '../data/nativePriceComparison'
export function NativePriceComparisonPanel({value,onChange,disabled}:{value:NativePriceComparison|undefined;onChange:(value:NativePriceComparison)=>void;disabled:boolean}) {
  const [search,setSearch]=useState('')
  const [query]=useDebouncedValue(search.trim(),250)
  const [options,setOptions]=useState<Array<{value:string;label:string}>>([])
  const [selected,setSelected]=useState<{value:string;label:string}|null>(null)
  const [error,setError]=useState<string|null>(null)
  useEffect(()=>{
    if(disabled)return
    const controller=new AbortController()
    // Native catalogue choices remain available when historical price coverage is absent.
    void searchDatasetReportValues(46,46,{value:query,offset:0,limit:30},controller.signal).then(items=>{
      if(controller.signal.aborted)return
      setOptions(items.flatMap(item=>isNativePricingId(item.Id)?[{value:item.Id,label:item.Name??'Тип ціни'}]:[]));setError(null)
    }).catch(()=>{if(!controller.signal.aborted)setError('Не вдалося завантажити типи цін GBA.')})
    return()=>controller.abort()
  },[query,disabled])
  const legacy=value?.Version===1
  const id=(legacy ? (value.PriceTypeId ? `legacy:${value.PriceTypeId.toUpperCase()}` : null) : value?.PricingId)||null
  useEffect(()=>{
    if(disabled || !id || selected?.value===id)return
    const controller=new AbortController()
    void searchDatasetReportValues(46,46,{value:legacy?id:`id:${id}`,offset:0,limit:2},controller.signal).then(items=>{
      if(controller.signal.aborted)return
      const item=items.find(item=>(legacy?`legacy:${String(item.Id).toUpperCase()}`:isNativePricingId(item.Id)?item.Id:null)===id)
      if(item)setSelected({value:id,label:item.Name??'Тип ціни'})
    }).catch(()=>{/* Keep the exact saved selection; the main lookup displays its own error. */})
    return()=>controller.abort()
  },[id,legacy,disabled,selected])
  const data=options.some(option=>option.value===id)||!id?options:[...options,selected?.value===id?selected:{value:id,label:'Збережений тип ціни'}]
  return <Stack gap="sm">
    <Select label="Тип ціни для порівняння" placeholder="Знайдіть тип ціни" searchable clearable disabled={disabled} data={data}
      searchValue={search} onSearchChange={setSearch} value={id} filter={({options})=>options} error={error}
      onChange={next=>{setSelected(data.find(option=>option.value===next)??null);if(next?.startsWith('legacy:'))onChange({Version:1,PriceTypeId:next.slice(7)});else onChange({Version:2,PricingId:next??''})}} />
    {legacy && <Text size="sm" c="dimmed">Збережено попередній історичний тип ціни. Щоб вибрати тип із довідника GBA, змініть вибір.</Text>}
    <Text size="sm" c="dimmed">Продажі та повернення беруться з GBA. Ціна для порівняння потребує підтвердженої історії на точний час продажу, а для повернення — первинного продажу. Без неї порівняльна сума та різниця порожні.</Text>
    <TextInput label="Проект / підрозділ" value="Ще не підтримуються у цьому звіті" disabled />
  </Stack>
}
