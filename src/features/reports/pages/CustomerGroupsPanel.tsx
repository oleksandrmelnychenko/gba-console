import { useCallback, useEffect, useState } from 'react'
import { Button, Group, MultiSelect, Stack, Text, TextInput } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { searchDatasetReportValues } from '../api/reportsApi'
import { initialCustomerGroups, type CustomerGroups } from '../data/customerGroups'

type ClientOption = { value:string; label:string }
type Props = { value: CustomerGroups | undefined; onChange: (value: CustomerGroups) => void; disabled: boolean }
export function CustomerGroupsPanel({ value, onChange, disabled }: Props) {
  const [initial]=useState(initialCustomerGroups)
  const groups=value ?? initial
  const [editors,setEditors]=useState(()=>({groups:groups.Groups,keys:groups.Groups.map(()=>crypto.randomUUID())}))
  if(editors.groups!==groups.Groups) {
    const previousPositions=new Map(editors.groups.map((group,index)=>[group,index]))
    const localEdit=groups.Groups.some(group=>previousPositions.has(group)) && groups.Groups.length===editors.groups.length
    setEditors({groups:groups.Groups,keys:groups.Groups.map((group,index)=>{
      const previous=previousPositions.get(group)
      return previous!==undefined?editors.keys[previous]:localEdit?editors.keys[index]:crypto.randomUUID()
    })})
  }
  const [known,setKnown]=useState<Record<string,ClientOption>>({})
  const [restoreError,setRestoreError]=useState<string|null>(null)
  const remember=useCallback((options:ClientOption[])=>setKnown(previous=>{
    const changed=options.filter(option=>previous[option.value]?.label!==option.label)
    return changed.length?{...previous,...Object.fromEntries(changed.map(option=>[option.value,option]))}:previous
  }),[])
  const selectedIds=[...new Set(groups.Groups.flatMap(group=>group.ClientIds))].sort((a,b)=>a-b).join(',')
  useEffect(()=>{
    if(disabled || !selectedIds)return
    const missing=selectedIds.split(',').filter(id=>!known[id])
    if(!missing.length)return
    const controller=new AbortController()
    void resolveClientLabels(missing,controller.signal).then(({resolved,failed})=>{
      if(controller.signal.aborted)return
      remember(resolved);setRestoreError(failed?'Не вдалося відновити частину назв клієнтів. Вибрані клієнти збережені.':null)
    })
    return()=>controller.abort()
  },[disabled,known,remember,selectedIds])
  return <Stack gap="sm">
    <TextInput label="Підрозділ" value="Ще не підтримується у цьому звіті" disabled />
    <Text size="sm">Кожен стовпець — набір клієнтів. Перший набір є еталоном. Період спільний для всіх наборів; відсоток при нульовому еталоні порожній.</Text>
    {restoreError?<Text size="sm" c="red">{restoreError}</Text>:null}
    {groups.Groups.map((group,index)=><CustomerGroupEditor key={editors.keys[index]} group={group} index={index} disabled={disabled} known={known} onFound={remember}
      onChange={next=>onChange({...groups,Groups:groups.Groups.map((item,at)=>at===index?next:item)})}
      onRemove={groups.Groups.length>2?()=>onChange({...groups,Groups:groups.Groups.filter((_,at)=>at!==index)}):undefined} />)}
    <Button variant="light" disabled={disabled || groups.Groups.length>=8}
      onClick={()=>onChange({...groups,Groups:[...groups.Groups,{Name:`Набір ${groups.Groups.length+1}`,ClientIds:[]}]})}>Додати набір клієнтів</Button>
  </Stack>
}
function CustomerGroupEditor({group,index,disabled,onChange,onRemove,known,onFound}: {
  group: CustomerGroups['Groups'][number]; index:number; disabled:boolean;
  known:Record<string,ClientOption>;onFound:(options:ClientOption[])=>void;
  onChange:(group:CustomerGroups['Groups'][number])=>void;onRemove?:()=>void
}) {
  const [query,setQuery]=useState('')
  const [search]=useDebouncedValue(query,250)
  const [options,setOptions]=useState<Array<{value:string;label:string}>>([])
  const [error,setError]=useState<string | null>(null)
  useEffect(()=>{
    if(disabled)return
    const abort=new AbortController()
    void searchDatasetReportValues(44,6,{value:search,offset:0,limit:30},abort.signal).then(rows=>{
      if(!abort.signal.aborted) {const found=rows.map(row=>({value:String(row.Id),label:String(row.Name)}));setOptions(found);onFound(found);setError(null)}
    }).catch(()=>{if(!abort.signal.aborted)setError('Не вдалося завантажити клієнтів')})
    return ()=>abort.abort()
  },[search,disabled,onFound])
  const data=[...options,...group.ClientIds.filter(id=>!options.some(option=>option.value===String(id))).map(id=>known[String(id)]??{value:String(id),label:`Клієнт [${id}]`})]
  return <Stack gap="xs">
    <Group align="end"><TextInput label={index===0?'Назва еталонного набору':'Назва набору'} value={group.Name} disabled={disabled}
      maxLength={80} onChange={event=>onChange({...group,Name:event.currentTarget.value})} />
      {onRemove?<Button variant="subtle" color="red" disabled={disabled} onClick={onRemove}>Видалити набір</Button>:null}</Group>
    <MultiSelect label={`Клієнти: ${group.Name}`} searchable searchValue={query} onSearchChange={setQuery} data={data}
      filter={({options})=>options} value={group.ClientIds.map(String)} disabled={disabled} maxValues={100} error={error}
      onChange={ids=>onChange({...group,ClientIds:ids.map(Number)})} nothingFoundMessage="Клієнтів не знайдено" />
  </Stack>
}

async function resolveClientLabels(ids:string[],signal:AbortSignal) {
  const resolved:ClientOption[]=[];let failed=false
  // Share names across sets and bound concurrency when reopening a large saved selection.
  for(let start=0;start<ids.length && !signal.aborted;start+=4) {
    await Promise.all(ids.slice(start,start+4).map(async id=>{
      try {
        const rows=await searchDatasetReportValues(44,6,{value:`id:${id}`,offset:0,limit:1},signal)
        const client=rows.find(row=>String(row.Id)===id)
        resolved.push({value:id,label:client?.Name?String(client.Name):`Клієнт [${id}] — не знайдено`})
      } catch {failed=true}
    }))
  }
  return {resolved,failed}
}
