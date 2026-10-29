import { Button, Checkbox, Combobox, Group, InputBase, Loader, ScrollArea, Stack, useCombobox } from '@mantine/core'
import { useState } from 'react'
type Option = { value: string; label: string }
/** Scoped remote choices keep the query when focus moves to paging/retry controls. */
export function CustomerGroupChoiceCombobox({ label, search, onSearchChange, data, selected, multiple, onChange, loading, disabled, error, placeholder, emptyMessage }: {
 label?:string;search:string;onSearchChange:(value:string)=>void;data:Option[];selected:Option[];multiple:boolean;
 onChange:(keys:string[])=>void;loading:boolean;disabled?:boolean;error?:string;placeholder:string;emptyMessage:string
}) {
 const [selectedOnly,setSelectedOnly]=useState(false)
 const combobox=useCombobox({onDropdownClose:()=>{setSelectedOnly(false);combobox.resetSelectedOption()}})
 const keys=new Set(selected.map(item=>item.value))
 const unfiltered=multiple && !search.trim() ? [...new Map([...selected,...data].map(item=>[item.value,item])).values()] : data
 const visible=selectedOnly ? selected : unfiltered
 function choose(key:string) {
   if (disabled) return
   if (multiple) { onChange(keys.has(key)?selected.filter(item=>item.value!==key).map(item=>item.value):[...keys,key]);combobox.updateSelectedOptionIndex();return }
   onChange([key]);onSearchChange('');combobox.closeDropdown()
 }
 return <Stack gap={4}><Combobox store={combobox} withinPortal={false} onOptionSubmit={choose}>
   <Combobox.Target withExpandedAttribute><InputBase role="combobox" label={label} value={search} disabled={disabled} error={error}
     placeholder={placeholder} rightSection={loading && !selectedOnly ? <Loader size="xs"/> : <Combobox.Chevron/>} rightSectionPointerEvents="none"
     onFocus={()=>combobox.openDropdown()} onClick={()=>combobox.openDropdown()} onBlur={()=>combobox.closeDropdown()}
     onChange={event=>{onSearchChange(event.currentTarget.value);setSelectedOnly(false);combobox.openDropdown();combobox.updateSelectedOptionIndex()}}/></Combobox.Target>
   <Combobox.Dropdown><Combobox.Options><ScrollArea.Autosize mah={260} type="auto" viewportProps={{ tabIndex: -1 }}>
     {visible.map(item=><Combobox.Option key={item.value} value={item.value} active={keys.has(item.value)} disabled={disabled}>
       <Group gap="xs" wrap="nowrap">{multiple?<Checkbox checked={keys.has(item.value)} readOnly size="xs" tabIndex={-1} aria-hidden/>:null}<span>{item.label}</span></Group>
     </Combobox.Option>)}
     {!visible.length?<Combobox.Empty>{loading?'Завантаження…':emptyMessage}</Combobox.Empty>:null}
   </ScrollArea.Autosize></Combobox.Options></Combobox.Dropdown>
 </Combobox>
 {multiple && selected.length>0?<Button type="button" variant="subtle" size="compact-sm" disabled={disabled} aria-pressed={selectedOnly}
   onClick={()=>{setSelectedOnly(value=>!value);onSearchChange('');combobox.openDropdown()}}>Вибрано: {selected.length}</Button>:null}
 </Stack>
}
