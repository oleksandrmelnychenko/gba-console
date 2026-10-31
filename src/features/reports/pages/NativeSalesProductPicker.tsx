import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Group, SegmentedControl, Select, Stack, Text } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { ReportValueAutocomplete } from './ReportValueAutocomplete'
import { useNativeSalesProductOptions, type ProductSearchMode } from './useNativeSalesProductOptions'
import {
  productBusinessName,
  productOptionName,
  searchNativeSalesProducts,
  type NativeSalesProduct,
} from '../api/nativeSalesProductLookup'
import { positiveProductId, salesProductLookupCapability } from '../data/salesProductLookupCapability'
import { isMultiValueReportCondition } from '../data/reportOptions'
import type { ReportDataset, ReportEntity, ReportSelectedValue, ReportSelection } from '../types'

function savedProductId(data: unknown): string | null {
  let item = data
  if (typeof item === 'string') {
    try {
      item = JSON.parse(item)
    } catch {
      return null
    }
  }
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null
  const raw = item as Record<string, unknown>
  if (raw.kind !== undefined && raw.kind !== 'product') return null
  const value = raw.Id ?? raw.id
  return positiveProductId(value)
    ? value
    : typeof value === 'number' && Number.isSafeInteger(value) && value > 0
      ? String(value)
      : null
}
export type NativeProductItemPickerContext = {
  selection: ReportSelection
  onChange: (values: ReportSelectedValue[]) => void
  multiple: boolean
  createData: (entity: ReportEntity) => ReportEntity | null
  selectedLabel: (value: ReportSelectedValue) => string
  identity: (data: ReportEntity) => string
}
type Props = {
  dataset?: ReportDataset
  selection: ReportSelection
  onChange: (values: ReportSelectedValue[]) => void
  label?: string
  disabled?: boolean
  error?: string
  multiple?: boolean
  createData?: NativeProductItemPickerContext['createData']
  selectedLabel?: NativeProductItemPickerContext['selectedLabel']
  identity?: NativeProductItemPickerContext['identity']
}
type Option = { value: string; label: string }
type ProductChoice = { key: string; item: NativeSalesProduct; value: ReportSelectedValue }
type SavedRecheck = { id: string; message: string } | null
function defaultIdentity(data: ReportEntity): string {
  return savedProductId(data) ? `product:${savedProductId(data)}` : `saved:${JSON.stringify(data)}`
}
function defaultSelectedLabel(value: ReportSelectedValue): string {
  return value.Name || `Товар [${savedProductId(value.Data) ?? '?'}]`
}
function productChoices(
  items: NativeSalesProduct[],
  createData: Props['createData'],
  identity: NonNullable<Props['identity']>,
): ProductChoice[] {
  return items.flatMap((item) => {
    const Data = createData ? createData({ Id: item.Id }) : { Id: item.Id }
    return Data ? [{ key: identity(Data), item, value: { Data, Name: productBusinessName(item), Value: 0 } }] : []
  })
}
function changedSelection(
  values: ReportSelectedValue[],
  choices: ProductChoice[],
  keys: string[],
  identity: NonNullable<Props['identity']>,
) {
  const wanted = new Set(keys),
    previous = new Set(values.map((value) => identity(value.Data)))
  const retained = values.filter((value) => wanted.has(identity(value.Data)))
  const added = choices
    .filter((choice) => wanted.has(choice.key) && !previous.has(choice.key))
    .map((choice) => choice.value)
  return [...retained, ...added]
}
function useSavedProductRecheck(dataset: ReportDataset | undefined, field: number) {
  const [recheck, setRecheck] = useState<SavedRecheck>(null)
  const savedCheck = useRef<AbortController | null>(null)
  useEffect(
    () => () => {
      savedCheck.current?.abort()
    },
    [dataset?.DataSource, dataset?.salesProductLookup, field],
  )
  const checkSaved = async (id: string) => {
    savedCheck.current?.abort()
    const controller = new AbortController()
    savedCheck.current = controller
    setRecheck({ id, message: 'Перевірка…' })
    try {
      const result = await searchNativeSalesProducts({ exactId: id }, controller.signal)
      if (controller.signal.aborted) return
      setRecheck({
        id,
        message: result.length
          ? 'Товар доступний у довіднику.'
          : 'Товар недоступний у довіднику. Збережений відбір залишено.',
      })
    } catch {
      if (controller.signal.aborted) return
      setRecheck({ id, message: 'Не вдалося перевірити товар. Збережений відбір залишено.' })
    }
  }
  return { recheck, checkSaved }
}
function ProductSearchInput({
  multiple,
  mode,
  label,
  data,
  selected,
  search,
  setSearch,
  select,
  addSingle,
  loading,
  disabled,
  error,
}: {
  multiple: boolean
  mode: ProductSearchMode
  label: string
  data: Option[]
  selected: Option[]
  search: string
  setSearch: (value: string) => void
  select: (keys: string[]) => void
  addSingle: (key: string | null) => void
  loading: boolean
  disabled?: boolean
  error?: string
}) {
  const inputLabel = mode === 'id' ? 'Точний ID товару' : label
  if (multiple)
    return (
      <ReportValueAutocomplete
        withinPortal
        clearSearchOnClose={false}
        label={inputLabel}
        data={data}
        selected={selected}
        search={search}
        onSearchChange={setSearch}
        onChange={select}
        loading={loading}
        disabled={disabled}
        error={error}
      />
    )
  return (
    <Select
      label={inputLabel}
      searchable
      placeholder={mode === 'id' ? 'Введіть ID товару' : 'Назва або артикул'}
      data={data}
      filter={({ options: items }) => items}
      searchValue={search}
      onSearchChange={setSearch}
      // Mantine clears a null-valued Select on blur; keep this remote query for paging.
      onBlur={() => setSearch(search)}
      value={null}
      disabled={disabled}
      error={error}
      onChange={addSingle}
      nothingFoundMessage="Нічого не знайдено"
    />
  )
}
function ProductSearchFeedback({
  admitted,
  invalidId,
  error,
  retry,
  more,
  loading,
  loadMore,
}: {
  admitted: boolean
  invalidId: boolean
  error?: string
  retry: () => void
  more: boolean
  loading: boolean
  loadMore: () => void
}) {
  return (
    <>
      {!admitted ? <Alert color="yellow">Вибір товарів зараз недоступний. Оновіть сторінку.</Alert> : null}
      {invalidId ? (
        <Text size="xs" c="red">
          Вкажіть правильний позитивний ID товару.
        </Text>
      ) : null}
      {error ? (
        <Alert color="red">
          {error}
          <Button type="button" variant="subtle" onClick={retry}>
            Повторити пошук
          </Button>
        </Alert>
      ) : null}
      {more ? (
        <Button type="button" variant="default" loading={loading} onClick={loadMore}>
          Ще товари
        </Button>
      ) : null}
    </>
  )
}
function SelectedProductValue({
  value,
  label,
  disabled,
  admitted,
  recheck,
  checkSaved,
  remove,
}: {
  value: ReportSelectedValue
  label: string
  disabled?: boolean
  admitted: boolean
  recheck: SavedRecheck
  checkSaved: (id: string) => Promise<void>
  remove: () => void
}) {
  const id = savedProductId(value.Data)
  return (
    <Group gap={4}>
      <Text size="sm">{label}</Text>
      <Button
        type="button"
        variant="subtle"
        size="compact-xs"
        disabled={disabled}
        aria-label={`Видалити ${label}`}
        onClick={remove}
      >
        Видалити
      </Button>
      {id ? (
        <Button
          type="button"
          variant="subtle"
          size="compact-xs"
          disabled={disabled || !admitted}
          onClick={() => void checkSaved(id)}
        >
          Перевірити ID {id}
        </Button>
      ) : null}
      {recheck?.id === id ? <Text size="xs">{recheck.message}</Text> : null}
    </Group>
  )
}
export function NativeSalesProductPicker({
  dataset,
  selection,
  onChange,
  label = 'Значення',
  disabled,
  error,
  multiple: explicitMultiple,
  createData,
  selectedLabel = defaultSelectedLabel,
  identity = defaultIdentity,
}: Props) {
  const [mode, setMode] = useState<ProductSearchMode>('text'),
    [search, setSearch] = useState('')
  const [query] = useDebouncedValue(search, 350)
  const { recheck, checkSaved } = useSavedProductRecheck(dataset, selection.SelectedField.Type)
  const admitted = !!salesProductLookupCapability(dataset) && selection.SelectedField.Type === 1
  const options = useNativeSalesProductOptions(mode, query, admitted && !disabled)
  const multiple = explicitMultiple ?? isMultiValueReportCondition(selection.FilterCondition.Type)
  const choices = productChoices(options.items, createData, identity)
  const selected = selection.Values.map((value) => ({ value: identity(value.Data), label: selectedLabel(value) }))
  const data =
    search !== query ? [] : choices.map((choice) => ({ value: choice.key, label: productOptionName(choice.item) }))
  const addSingle = (key: string | null) => {
    const choice = choices.find((item) => item.key === key)
    if (!choice) return
    onChange([choice.value])
    setSearch('')
  }
  return (
    <Stack gap={6}>
      <SegmentedControl
        aria-label="Спосіб пошуку товару"
        value={mode}
        disabled={disabled || !admitted}
        data={[
          { value: 'text', label: 'Назва або артикул' },
          { value: 'id', label: 'Точний ID' },
        ]}
        onChange={(value) => {
          setMode(value === 'id' ? 'id' : 'text')
          setSearch('')
        }}
      />
      <ProductSearchInput
        multiple={multiple}
        mode={mode}
        label={label}
        data={data}
        selected={selected}
        search={search}
        setSearch={setSearch}
        select={(keys) => onChange(changedSelection(selection.Values, choices, keys, identity))}
        addSingle={addSingle}
        loading={options.loading}
        disabled={disabled || !admitted}
        error={error}
      />
      <ProductSearchFeedback
        admitted={admitted}
        invalidId={mode === 'id' && !!search && options.invalid}
        error={options.error}
        retry={options.retry}
        more={search === query && options.more}
        loading={options.loading}
        loadMore={options.loadMore}
      />
      {selection.Values.map((value, index) => (
        <SelectedProductValue
          key={identity(value.Data)}
          value={value}
          label={selected[index].label}
          disabled={disabled}
          admitted={admitted}
          recheck={recheck}
          checkSaved={checkSaved}
          remove={() => onChange(selection.Values.filter((_, position) => index !== position))}
        />
      ))}
    </Stack>
  )
}
