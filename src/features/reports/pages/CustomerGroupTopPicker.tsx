import { Stack, Text } from '@mantine/core'
import { customerGroupTopValues, CUSTOMER_GROUP_TOP_NOTE } from '../data/customerGroupTop'
import { isMultiValueReportCondition } from '../data/reportOptions'
import type { CustomerGroupDirectoryPickerProps } from './CustomerGroupDirectoryPicker'
import { ReportValuePicker } from './ReportValuePicker'
import { useReportValueSearch } from './reportValueSearch'
import { useCustomerGroupTopPage } from './useCustomerGroupTopPage'
const CUSTOMER_GROUP_TOP_FAILURE = 'Не вдалося завантажити TOP. Збережений відбір залишено без змін.'
export function CustomerGroupTopPicker({selection,label,disabled,error,onChange}:CustomerGroupDirectoryPickerProps){
  const {search,setSearch,pending}=useReportValueSearch()
  const queryError=search.length>120?'Введіть не більше 120 символів.':undefined
  const page=useCustomerGroupTopPage(search,!disabled&&!queryError&&!pending)
  const model=customerGroupTopValues(selection.Values,page.rows),loading=page.loading||!disabled&&pending
  return <Stack gap="xs">
    <ReportValuePicker mode={isMultiValueReportCondition(selection.FilterCondition.Type)?'multi':'single'} label={label} placeholder="Код TOP"
      search={search} onSearchChange={setSearch} data={loading?[]:model.data} selected={model.selected} onChange={keys=>onChange(model.change(keys))}
      loading={loading} disabled={disabled} error={error||queryError} lookupError={page.failed?CUSTOMER_GROUP_TOP_FAILURE:undefined}
      onRetry={()=>void(page.rows.length?page.loadMore():page.retry())} hasMore={page.more&&page.next<=10000} onLoadMore={()=>void page.loadMore()}/>
  {page.more&&page.next>10000?<Text size="sm">Уточніть пошук, щоб побачити решту значень.</Text>:null}
  {selection.IsChecked!==false?<Text size="sm" c="dimmed">{CUSTOMER_GROUP_TOP_NOTE}</Text>:null}
  </Stack>
}
