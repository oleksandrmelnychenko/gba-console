import { useEffect, useState } from 'react'
import { Button, Group, MultiSelect, Stack, Text, TextInput } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { searchDatasetReportValues } from '../api/reportsApi'
import { initialCustomerGroups, type CustomerGroups } from '../data/customerGroups'

type Props = { value: CustomerGroups | undefined; onChange: (value: CustomerGroups) => void; disabled: boolean }
export function CustomerGroupsPanel({ value, onChange, disabled }: Props) {
  const groups=value ?? initialCustomerGroups()
  return <Stack gap="sm">
    <TextInput label="Підрозділ" value="Ще не підтримується у цьому звіті" disabled />
    <Text size="sm">Кожен стовпець — набір клієнтів. Перший набір є еталоном. Період спільний для всіх наборів; відсоток при нульовому еталоні порожній.</Text>
    {groups.Groups.map((group,index)=><CustomerGroupEditor key={index} group={group} index={index} disabled={disabled}
      onChange={next=>onChange({...groups,Groups:groups.Groups.map((item,at)=>at===index?next:item)})}
      onRemove={groups.Groups.length>2?()=>onChange({...groups,Groups:groups.Groups.filter((_,at)=>at!==index)}):undefined} />)}
    <Button variant="light" disabled={disabled || groups.Groups.length>=8}
      onClick={()=>onChange({...groups,Groups:[...groups.Groups,{Name:`Набір ${groups.Groups.length+1}`,ClientIds:[]}]})}>Додати набір клієнтів</Button>
  </Stack>
}
function CustomerGroupEditor({group,index,disabled,onChange,onRemove}: {
  group: CustomerGroups['Groups'][number]; index:number; disabled:boolean;
  onChange:(group:CustomerGroups['Groups'][number])=>void;onRemove?:()=>void
}) {
  const [query,setQuery]=useState('')
  const [search]=useDebouncedValue(query,250)
  const [options,setOptions]=useState<Array<{value:string;label:string}>>([])
  const [error,setError]=useState<string | null>(null)
  useEffect(()=>{
    const abort=new AbortController()
    void searchDatasetReportValues(44,6,{value:search,offset:0,limit:30},abort.signal).then(rows=>{
      if(!abort.signal.aborted) {setOptions(rows.map(row=>({value:String(row.Id),label:String(row.Name)})));setError(null)}
    }).catch(()=>{if(!abort.signal.aborted)setError('Не вдалося завантажити клієнтів')})
    return ()=>abort.abort()
  },[search])
  const data=[...options,...group.ClientIds.filter(id=>!options.some(option=>option.value===String(id))).map(id=>({value:String(id),label:`Клієнт [${id}]`}))]
  return <Stack gap="xs">
    <Group align="end"><TextInput label={index===0?'Назва еталонного набору':'Назва набору'} value={group.Name} disabled={disabled}
      maxLength={80} onChange={event=>onChange({...group,Name:event.currentTarget.value})} />
      {onRemove?<Button variant="subtle" color="red" disabled={disabled} onClick={onRemove}>Видалити набір</Button>:null}</Group>
    <MultiSelect label={`Клієнти: ${group.Name}`} searchable searchValue={query} onSearchChange={setQuery} data={data}
      value={group.ClientIds.map(String)} disabled={disabled} maxValues={100} error={error}
      onChange={ids=>onChange({...group,ClientIds:ids.map(Number)})} nothingFoundMessage="Клієнтів не знайдено" />
  </Stack>
}
