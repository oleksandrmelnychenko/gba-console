import { Alert, Button, Group, SegmentedControl, Select, Stack, Text } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { useState } from 'react'
import type { ReportDataset, ReportSelectedValue, ReportSelection } from '../types'
import type { NativePriceFilterOption } from '../api/nativePriceFilterLookup'
import { isNativePriceFilterField, nativePriceFilterDescriptor, nativePriceSavedKey, PRICE_FILTER_HELP, PRICE_FILTER_UNAVAILABLE, type NativePriceFilterField } from '../data/nativePriceFilterLookup'
import { isMultiValueReportCondition } from '../data/reportOptions'
import { ReportValueAutocomplete } from './ReportValueAutocomplete'
import { useNativePriceFilterOptions, type PriceFilterSearchMode } from './useNativePriceFilterOptions'

type Props = { dataSource: number; dataset?: ReportDataset | null; selection: ReportSelection; from: string; to: string; label?: string; error?: string; disabled?: boolean; onChange: (values: ReportSelectedValue[]) => void }
type Choice = { value: string; label: string }
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
function PriceSearchControl({ multiple, label, search, setSearch, data, selected, onChange, disabled, error, loading }: {
  multiple: boolean; label: string; search: string; setSearch: (value: string) => void; data: Choice[]; selected: Choice[]; onChange: (keys: string[]) => void; disabled: boolean; error?: string; loading: boolean
}) {
  return multiple ? <ReportValueAutocomplete withinPortal clearSearchOnClose={false} label={label} data={data} selected={selected} search={search} onSearchChange={setSearch} onChange={onChange} disabled={disabled} error={error} loading={loading} />
    : <Select searchable label={label} value={null} data={data} searchValue={search} onSearchChange={setSearch} onBlur={() => setSearch(search)} filter={({ options }) => options}
      onChange={value => { if (value !== null) { onChange([value]); setSearch('') } }} disabled={disabled} error={error} nothingFoundMessage="Нічого не знайдено" />
}
function PricePageActions({ page, disabled }: { page: ReturnType<typeof useNativePriceFilterOptions>; disabled: boolean }) {
  return <>{page.more ? <Button type="button" variant="default" loading={page.loading} disabled={disabled} onClick={page.loadMore}>Ще значення</Button> : null}
    {page.error ? <Alert color="yellow">{page.error}<Button type="button" variant="subtle" disabled={disabled} onClick={page.retry}>Спробувати ще раз</Button></Alert> : null}</>
}
function PriceLookupNotice({ admitted, flat }: { admitted: boolean; flat: boolean }) {
  return <>{!admitted ? <Alert color="yellow">{PRICE_FILTER_UNAVAILABLE}</Alert> : null}
    {!flat ? <Alert color="yellow">Для цього відбору доступні лише чотири точні умови.</Alert> : null}</>
}
function SelectedPriceValues({ multiple, selected, disabled, remove }: { multiple: boolean; selected: Choice[]; disabled?: boolean; remove: (key: string) => void }) {
  if (multiple) return null
  return <Group gap="xs">{selected.map(item => <Group gap={4} key={item.value}><Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{item.label}</Text>
    <Button type="button" variant="subtle" size="compact-xs" disabled={disabled} aria-label={`Видалити ${item.label}`} onClick={() => remove(item.value)}>Видалити</Button></Group>)}</Group>
}
function NativePriceFieldPicker({ field, ...props }: Props & { field: NativePriceFilterField }) {
  const [mode, setMode] = useState<PriceFilterSearchMode>('text'), [search, setSearch] = useState('')
  const [debounced] = useDebouncedValue(search, 250)
  const descriptor = nativePriceFilterDescriptor(props.dataset, props.dataSource, field)
  const flat = [0, 1, 2, 4].includes(props.selection.FilterCondition.Type), disabled = !!props.disabled || !descriptor || !flat
  const page = useNativePriceFilterOptions(props.dataSource, field, mode, search, !disabled && search === debounced, props.from, props.to, props.selection.FilterCondition.Type)
  const model = priceChoices(field, props.selection.Values, page.items), multiple = isMultiValueReportCondition(props.selection.FilterCondition.Type)
  const label = mode === 'exact' ? field === 3 ? 'Збережена позначка TOP' : 'Точний ID значення' : props.label ?? 'Значення'
  return <Stack gap="xs">
    <PriceLookupNotice admitted={!!descriptor} flat={flat} />
    <SegmentedControl aria-label="Спосіб пошуку значення" value={mode} onChange={value => { setMode(value as PriceFilterSearchMode); setSearch('') }}
      disabled={disabled} data={[{ value: 'text', label: 'Пошук' }, { value: 'exact', label: field === 3 ? 'Збережена позначка' : 'Точний ID' }]} />
    <PriceSearchControl multiple={multiple} label={label} search={search} setSearch={setSearch} data={page.items.length ? model.data : []} selected={model.selected}
      onChange={keys => props.onChange(model.change(keys))} disabled={disabled} error={props.error || page.queryError || undefined} loading={page.loading || !disabled && search !== debounced} />
    <SelectedPriceValues multiple={multiple} selected={model.selected} disabled={props.disabled}
      remove={key => props.onChange(model.change(model.selected.filter(value => value.value !== key).map(value => value.value)))} />
    <PricePageActions page={page} disabled={disabled} />
    <Text size="sm" c="dimmed">{PRICE_FILTER_HELP[field]}</Text>
  </Stack>
}
export function NativePriceFilterValuePicker(props: Props) {
  const field = props.selection.SelectedField.Type
  return isNativePriceFilterField(props.dataSource, field) ? <NativePriceFieldPicker key={`${props.dataSource}:${field}`} {...props} field={field} /> : null
}
