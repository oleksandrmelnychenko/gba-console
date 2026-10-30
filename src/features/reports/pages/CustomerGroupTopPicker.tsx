import { Alert, Box, Button, Group, Stack, Text } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { useState } from 'react'
import { customerGroupTopValues, CUSTOMER_GROUP_TOP_NOTE } from '../data/customerGroupTop'
import { isMultiValueReportCondition } from '../data/reportOptions'
import type { CustomerGroupDirectoryPickerProps } from './CustomerGroupDirectoryPicker'
import { CustomerGroupChoiceCombobox } from './CustomerGroupChoiceCombobox'
import { useCustomerGroupTopPage } from './useCustomerGroupTopPage'
function TopPageActions({page,loading,disabled,label}:{page:ReturnType<typeof useCustomerGroupTopPage>;loading:boolean;disabled?:boolean;label?:string}){
  return page.more||page.failed?<Stack gap={4} mt={label?24:0} style={{flexShrink:0}}>
      {page.more&&page.next<=10000?<Button type="button" variant="subtle" size="compact-sm" disabled={disabled||loading} onMouseDown={event=>event.preventDefault()} onClick={()=>void page.loadMore()}>Ще значення</Button>:null}
      {page.failed?<Button type="button" variant="subtle" size="compact-sm" disabled={disabled} onMouseDown={event=>event.preventDefault()} onClick={()=>void(page.rows.length?page.loadMore():page.retry())}>Спробувати ще раз</Button>:null}
    </Stack>:null
}
export function CustomerGroupTopPicker({selection,label,disabled,error,onChange}:CustomerGroupDirectoryPickerProps){
  const [search,setSearch]=useState(''),[debounced]=useDebouncedValue(search,250)
  const queryError=search.length>120?'Введіть не більше 120 символів.':undefined
  const page=useCustomerGroupTopPage(search,!disabled&&!queryError&&debounced===search)
  const model=customerGroupTopValues(selection.Values,page.rows),multiple=isMultiValueReportCondition(selection.FilterCondition.Type)
  const change=(keys:string[])=>onChange(model.change(keys)),loading=page.loading||!disabled&&debounced!==search
  return <Stack gap="xs"><Group wrap="nowrap" align="flex-start" gap="xs">
    <Box flex={1} miw={0}><CustomerGroupChoiceCombobox label={label} search={search} onSearchChange={setSearch} data={loading?[]:model.data} selected={model.selected}
      multiple={multiple} onChange={change} loading={loading} disabled={disabled} error={error||queryError} placeholder="Код TOP" emptyMessage="Нічого не знайдено"/>
      {!multiple?<Group gap="xs">{model.selected.map(item=><Button key={item.value} type="button" variant="subtle" size="compact-sm" disabled={disabled} aria-label={`Видалити ${item.label}`}
        onClick={()=>change(model.selected.filter(other=>other.value!==item.value).map(other=>other.value))}>{item.label} ×</Button>)}</Group>:null}</Box>
    <TopPageActions page={page} loading={loading} disabled={disabled} label={label}/>
  </Group>
  {page.more&&page.next>10000?<Text size="sm">Уточніть пошук, щоб побачити решту значень.</Text>:null}
  {page.failed?<Alert color="yellow">Не вдалося завантажити TOP. Збережений відбір залишено без змін.</Alert>:null}
  {selection.IsChecked!==false?<Text size="sm" c="dimmed">{CUSTOMER_GROUP_TOP_NOTE}</Text>:null}
  </Stack>
}
