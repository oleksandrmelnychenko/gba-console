import { Button, Group, Stack } from '@mantine/core'
import { customerGroupChoiceValues } from '../data/customerGroupChoiceValues'
import { isMultiValueReportCondition } from '../data/reportOptions'
import type { CustomerGroupChoice } from '../api/customerGroupSelectionsApi'
import type { CustomerGroupDirectoryPickerProps } from './CustomerGroupDirectoryPicker'
import { CustomerGroupChoiceCombobox } from './CustomerGroupChoiceCombobox'
export function CustomerGroupChoiceControl({ selection, label, disabled, error, onChange, field, options, loading, search, setSearch }: CustomerGroupDirectoryPickerProps & {
 field:1|8|10;options:CustomerGroupChoice[];loading:boolean;search:string;setSearch:(value:string)=>void
}) {
 const model=customerGroupChoiceValues(selection.Values,options)
 const change=(keys:string[])=>onChange(model.change(keys))
 const multiple=isMultiValueReportCondition(selection.FilterCondition.Type)
 const emptyMessage=field!==8 && search.trim().length<2?'Введіть мінімум 2 символи':'Нічого не знайдено'
 return <Stack gap="xs"><CustomerGroupChoiceCombobox label={label} search={search} onSearchChange={setSearch} data={loading?[]:model.data} selected={model.selected}
   multiple={multiple} onChange={change} loading={loading} disabled={disabled} error={error} placeholder={field===1?'Назва або id:123':'Пошук значення'} emptyMessage={emptyMessage}/>
   {!multiple?<Group gap="xs">{model.selected.map(item=><Button key={item.value} type="button" variant="subtle" size="compact-sm" disabled={disabled}
     aria-label={`Видалити ${item.label}`} onClick={()=>change(model.selected.filter(other=>other.value!==item.value).map(other=>other.value))}>{item.label} ×</Button>)}</Group>:null}
 </Stack>
}
