import { Alert, Stack, Text } from '@mantine/core'
import type { ReportDataset, ReportSelectedValue, ReportSelection } from '../types'
import type { NativePriceFilterOption } from '../api/nativePriceFilterLookup'
import { isNativePriceFilterField, nativePriceFilterDescriptor, nativePriceSavedKey, PRICE_FILTER_HELP, PRICE_FILTER_UNAVAILABLE, type NativePriceFilterField } from '../data/nativePriceFilterLookup'
import { isMultiValueReportCondition } from '../data/reportOptions'
import { ReportValuePicker } from './ReportValuePicker'
import { REPORT_VALUE_EXACT_ID_PLACEHOLDER, reportValueExactId, useReportValueSearch } from './reportValueSearch'
import { useNativePriceFilterOptions, type PriceFilterSearchMode } from './useNativePriceFilterOptions'

type Props = { dataSource: number; dataset?: ReportDataset | null; selection: ReportSelection; from: string; to: string; label?: string; error?: string; disabled?: boolean; onChange: (values: ReportSelectedValue[]) => void }
const keyFor = (field: number, id: string) => `price:46:${field}:${JSON.stringify(id)}`
function priceChoices(field: NativePriceFilterField, values: ReportSelectedValue[], rows: NativePriceFilterOption[]) {
  const entries = values.map((value, index) => {
    const id = nativePriceSavedKey(field, value)
    return { value: id === null ? `saved:${index}` : keyFor(field, id), label: value.Name || id || 'Збережене значення без підтвердженого ключа' }
  })
  const selected = [...new Map(entries.map(entry => [entry.value, entry])).values()]
  const data = rows.map(row => ({ value: keyFor(field, row.Id), label: row.Name }))
  const change = (keys: string[]) => {
    const wanted = new Set(keys), previous = new Set(entries.map(entry => entry.value))
    const retained = values.filter((_, index) => wanted.has(entries[index].value))
    const added = rows.filter(row => wanted.has(keyFor(field, row.Id)) && !previous.has(keyFor(field, row.Id))).map(row => ({ Data: field === 3 ? { Name: row.Id } : { Id: row.Id }, Name: row.Name, Value: 0 }))
    return [...retained, ...added]
  }
  return { selected, data, change }
}
function PriceLookupNotice({ admitted, flat }: { admitted: boolean; flat: boolean }) {
  return <>{!admitted ? <Alert color="yellow">{PRICE_FILTER_UNAVAILABLE}</Alert> : null}
    {!flat ? <Alert color="yellow">Для цього відбору доступні лише чотири точні умови.</Alert> : null}</>
}
function NativePriceFieldPicker({ field, ...props }: Props & { field: NativePriceFilterField }) {
  const { search, setSearch, query, pending } = useReportValueSearch()
  const exact = reportValueExactId(query)
  const mode: PriceFilterSearchMode = exact === null ? 'text' : 'exact'
  const descriptor = nativePriceFilterDescriptor(props.dataset, props.dataSource, field)
  const flat = [0, 1, 2, 4].includes(props.selection.FilterCondition.Type), disabled = !!props.disabled || !descriptor || !flat
  const page = useNativePriceFilterOptions(props.dataSource, field, mode, exact ?? query, !disabled && exact !== '', props.from, props.to, props.selection.FilterCondition.Type)
  const model = priceChoices(field, props.selection.Values, page.items), multiple = isMultiValueReportCondition(props.selection.FilterCondition.Type)
  return <Stack gap="xs">
    <PriceLookupNotice admitted={!!descriptor} flat={flat} />
    <ReportValuePicker mode={multiple ? 'multi' : 'single'} label={props.label ?? 'Значення'}
      placeholder={field === 3 ? 'Код TOP або id:точна позначка' : REPORT_VALUE_EXACT_ID_PLACEHOLDER}
      search={search} onSearchChange={setSearch} data={pending || !page.items.length ? [] : model.data} selected={model.selected}
      onChange={keys => props.onChange(model.change(keys))} disabled={disabled} loading={pending || page.loading}
      error={props.error || (exact === '' ? undefined : page.queryError ?? undefined)}
      emptyMessage={exact === '' ? field === 3 ? 'Введіть позначку TOP після id:' : 'Введіть ID після id:' : undefined}
      lookupError={pending ? undefined : page.error} onRetry={page.retry} hasMore={!pending && page.more} onLoadMore={page.loadMore} />
    <Text size="sm" c="dimmed">{PRICE_FILTER_HELP[field]}</Text>
  </Stack>
}
export function NativePriceFilterValuePicker(props: Props) {
  const field = props.selection.SelectedField.Type
  return isNativePriceFilterField(props.dataSource, field) ? <NativePriceFieldPicker key={`${props.dataSource}:${field}`} {...props} field={field} /> : null
}
