import { customerGroupChoiceValues } from '../data/customerGroupChoiceValues'
import { isMultiValueReportCondition } from '../data/reportOptions'
import type { CustomerGroupDirectoryPickerProps } from './CustomerGroupDirectoryPicker'
import { ReportValuePicker } from './ReportValuePicker'
import { REPORT_VALUE_EXACT_ID_PLACEHOLDER } from './reportValueSearch'
import type { CustomerGroupExactChoiceField } from '../data/customerGroupSelections'
import type { useCustomerGroupChoiceOptions } from './useCustomerGroupChoiceOptions'
const EXACT_ID_FIELDS = new Set<number>([1, 4, 9, 15, 16, 21])
export const CUSTOMER_GROUP_CHOICE_FAILURE = 'Не вдалося завантажити значення. Збережений відбір залишено без змін.'
export function CustomerGroupChoiceControl({ selection, label, disabled, error, onChange, field, choices }: CustomerGroupDirectoryPickerProps & {
 field:CustomerGroupExactChoiceField;choices:ReturnType<typeof useCustomerGroupChoiceOptions>
}) {
 const model=customerGroupChoiceValues(selection.Values,choices.options,field)
 const emptyMessage=field!==8 && field!==4 && field!==21 && !choices.search.trim()?'Почніть вводити назву':'Нічого не знайдено'
 return <ReportValuePicker mode={isMultiValueReportCondition(selection.FilterCondition.Type)?'multi':'single'} label={label}
   search={choices.search} onSearchChange={choices.setSearch} data={choices.loading?[]:model.data} selected={model.selected}
   onChange={keys=>onChange(model.change(keys))} loading={choices.loading} disabled={disabled} error={error || choices.queryError || undefined}
   placeholder={EXACT_ID_FIELDS.has(field)?REPORT_VALUE_EXACT_ID_PLACEHOLDER:undefined} emptyMessage={emptyMessage}
   lookupError={choices.failure?CUSTOMER_GROUP_CHOICE_FAILURE:undefined} onRetry={()=>void choices.retry()}
   hasMore={choices.more} onLoadMore={()=>void choices.loadMore()}/>
}
