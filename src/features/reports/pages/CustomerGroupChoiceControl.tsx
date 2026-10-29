import { Button, Group, Select, Stack } from '@mantine/core'
import { customerGroupChoiceValues } from '../data/customerGroupChoiceValues'
import { isMultiValueReportCondition } from '../data/reportOptions'
import type { CustomerGroupChoice } from '../api/customerGroupSelectionsApi'
import type { CustomerGroupDirectoryPickerProps } from './CustomerGroupDirectoryPicker'
import { ReportValueAutocomplete } from './ReportValueAutocomplete'
export function CustomerGroupChoiceControl({ selection, label, disabled, error, onChange, field, options, loading, search, setSearch }: CustomerGroupDirectoryPickerProps & {
 field:1|8|10; options:CustomerGroupChoice[];loading:boolean;search:string;setSearch:(value:string)=>void
}) {
 const query=search.trim()
  const model = customerGroupChoiceValues(selection.Values, options)
  const { data, selected } = model
  const change = (keys: string[]) => onChange(model.change(keys))
  const emptyMessage = field !== 8 && query.length < 2 ? 'Введіть мінімум 2 символи' : 'Нічого не знайдено'
  return <Stack gap="xs">
    {isMultiValueReportCondition(selection.FilterCondition.Type)
      ? <ReportValueAutocomplete label={label} data={loading ? [] : data} selected={selected} search={search} onSearchChange={setSearch}
          onChange={change} loading={loading} disabled={disabled} remote error={error}
          emptyMessage={emptyMessage} />
      : <><Select label={label} searchable searchValue={search} onSearchChange={setSearch} value={null}
          data={loading ? [] : data} disabled={disabled} error={error}
          filter={({ options }) => options} placeholder={field === 1 ? 'Назва або id:123' : 'Пошук значення'}
          nothingFoundMessage={loading ? 'Завантаження…' : emptyMessage}
          onChange={key => { if (key) change([key]); setSearch('') }} />
        <Group gap="xs">{selected.map(item => <Button key={item.value} type="button" variant="subtle" size="compact-sm" disabled={disabled}
          aria-label={`Видалити ${item.label}`} onClick={() => change(selected.filter(other => other.value !== item.value).map(other => other.value))}>{item.label} ×</Button>)}</Group></>}
  </Stack>
}
