import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Group, Stack, Text } from '@mantine/core'
import { ReportValuePicker } from './ReportValuePicker'
import { reportValueExactId, useReportValueSearch } from './reportValueSearch'
import { useNativeSalesProductOptions, type ProductSearchMode } from './useNativeSalesProductOptions'
import {
  productBusinessName,
  productOptionName,
  searchNativeSalesProducts,
  type NativeSalesProduct,
} from '../api/nativeSalesProductLookup'
import { positiveProductId } from '../data/salesProductLookupCapability'
import { productLookupBinding } from '../data/productLookupCapability'
import { searchNativeReportProducts } from '../api/nativeReportProductLookup'
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
  dataSource?: number
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
type ProductChoice = { key: string; item: NativeSalesProduct; value: ReportSelectedValue }
type SavedRecheck = { lookupKey: string; id: string; message: string } | null
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
function useSavedProductRecheck(dataset: ReportDataset | undefined, field: number, requestedSource: number | undefined) {
  const binding = productLookupBinding(dataset, requestedSource)
  const lookupKey = field === 1 && binding ? `${binding.kind}:${binding.dataSource}` : null
  const [recheck, setRecheck] = useState<SavedRecheck>(null)
  const savedCheck = useRef<AbortController | null>(null)
  useEffect(() => () => savedCheck.current?.abort(), [lookupKey])
  const checkSaved = async (id: string) => {
    if (!lookupKey || !binding) return
    savedCheck.current?.abort()
    const controller = new AbortController()
    savedCheck.current = controller
    setRecheck({ lookupKey, id, message: 'Перевірка…' })
    try {
      const result = await (binding.kind === 'report'
        ? searchNativeReportProducts(binding.dataSource, { exactId: id }, controller.signal)
        : searchNativeSalesProducts({ exactId: id }, controller.signal))
      if (controller.signal.aborted) return
      setRecheck({ lookupKey, id, message: result.length
        ? 'Товар доступний у довіднику.'
        : 'Товар недоступний у довіднику. Збережений відбір залишено.' })
    } catch {
      if (controller.signal.aborted) return
      setRecheck({ lookupKey, id, message: 'Не вдалося перевірити товар. Збережений відбір залишено.' })
    }
  }
  return { recheck: recheck?.lookupKey === lookupKey ? recheck : null, checkSaved }
}

function ProductSearchNotice({ admitted }: { admitted: boolean }) {
  return admitted ? null : <Alert color="yellow">Вибір товарів зараз недоступний. Оновіть сторінку.</Alert>
}
function SavedProductRecheck({
  value,
  disabled,
  admitted,
  recheck,
  checkSaved,
}: {
  value: ReportSelectedValue
  disabled?: boolean
  admitted: boolean
  recheck: SavedRecheck
  checkSaved: (id: string) => Promise<void>
}) {
  const id = savedProductId(value.Data)
  if (!id) return null
  return (
    <Group gap={4}>
      <Button
        type="button"
        variant="subtle"
        size="compact-xs"
        disabled={disabled || !admitted}
        onClick={() => void checkSaved(id)}
      >
        Перевірити ID {id}
      </Button>
      {recheck?.id === id ? <Text size="xs">{recheck.message}</Text> : null}
    </Group>
  )
}
export function NativeSalesProductPicker({
  dataSource,
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
  const { search, setSearch, query, pending } = useReportValueSearch()
  const exactId = reportValueExactId(query)
  const mode: ProductSearchMode = exactId === null ? 'text' : 'id'
  const requestedSource = dataSource ?? dataset?.DataSource
  const binding = productLookupBinding(dataset, requestedSource)
  const { recheck, checkSaved } = useSavedProductRecheck(dataset, selection.SelectedField.Type, requestedSource)
  const admitted = !!binding && selection.SelectedField.Type === 1
  const sharedSource = binding?.kind === 'report' ? binding.dataSource : undefined
  const options = useNativeSalesProductOptions(mode, exactId ?? query, admitted && !disabled && exactId !== '', sharedSource)
  const multiple = explicitMultiple ?? isMultiValueReportCondition(selection.FilterCondition.Type)
  const choices = productChoices(options.items, createData, identity)
  const selected = selection.Values.map((value) => ({ value: identity(value.Data), label: selectedLabel(value) }))
  const change = (keys: string[], chosen?: string) => {
    if (chosen === undefined) {
      onChange(changedSelection(selection.Values, choices, keys, identity))
      return
    }
    const choice = choices.find((item) => item.key === chosen)
    if (choice) onChange([choice.value])
  }
  return (
    <Stack gap={6}>
      <ReportValuePicker
        mode={multiple ? 'multi' : 'single'}
        label={label}
        placeholder="Назва, артикул або id:123"
        data={pending ? [] : choices.map((choice) => ({ value: choice.key, label: productOptionName(choice.item) }))}
        selected={selected}
        search={search}
        onSearchChange={setSearch}
        onChange={change}
        loading={pending || options.loading}
        disabled={disabled || !admitted}
        error={error ?? (!pending && !!exactId && options.invalid ? 'Вкажіть правильний позитивний ID товару.' : undefined)}
        emptyMessage={exactId === '' ? 'Введіть ID товару після id:' : undefined}
        lookupError={pending ? undefined : options.error}
        onRetry={options.retry}
        hasMore={!pending && options.more}
        onLoadMore={options.loadMore}
      />
      <ProductSearchNotice admitted={admitted} />
      {selection.Values.map((value) => (
        <SavedProductRecheck
          key={identity(value.Data)}
          value={value}
          disabled={disabled}
          admitted={admitted}
          recheck={recheck}
          checkSaved={checkSaved}
        />
      ))}
    </Stack>
  )
}
