import { useEffect, useState } from 'react'
import { Alert, Stack } from '@mantine/core'
import { ReportValuePicker } from './ReportValuePicker'
import { reportValueExactId, useReportValueSearch } from './reportValueSearch'
import { useNativeSalesProductOptions, type ProductSearchMode } from './useNativeSalesProductOptions'
import {
  productBusinessName,
  productOptionNames,
  searchNativeSalesProducts,
  type NativeSalesProduct,
} from '../api/nativeSalesProductLookup'
import { positiveProductId } from '../data/salesProductLookupCapability'
import { distinctCaptions, plainCaption } from '../data/distinctCaptions'
import { productLookupBinding, type ReportProductLookupSource } from '../data/productLookupCapability'
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
type ResolvedNames = { lookupKey: string; names: Record<string, string | null> }
const RESOLVE_LIMIT = 20
function defaultIdentity(data: ReportEntity): string {
  return savedProductId(data) ? `product:${savedProductId(data)}` : `saved:${JSON.stringify(data)}`
}
function savedName(value: ReportSelectedValue): string {
  return plainCaption(value.Name ?? '')
}
function defaultSelectedLabel(value: ReportSelectedValue): string {
  return savedName(value) || 'Товар'
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
function useResolvedProductNames(
  dataset: ReportDataset | undefined,
  field: number,
  requestedSource: number | undefined,
  values: ReportSelectedValue[],
  disabled: boolean,
) {
  const binding = productLookupBinding(dataset, requestedSource)
  const lookupKey = field === 1 && binding ? `${binding.kind}:${binding.dataSource}` : null
  const [resolved, setResolved] = useState<ResolvedNames>({ lookupKey: '', names: {} })
  const known = resolved.lookupKey === lookupKey ? resolved.names : {}
  const missing = [
    ...new Set(
      values.flatMap((value) => {
        const id = savedName(value) ? null : savedProductId(value.Data)
        return id && !(id in known) ? [id] : []
      }),
    ),
  ].slice(0, RESOLVE_LIMIT)
  const pendingKey = missing.join(',')
  useEffect(() => {
    if (disabled || !lookupKey || !pendingKey) return
    const [kind, source] = lookupKey.split(':')
    const controller = new AbortController()
    void Promise.all(
      pendingKey.split(',').map(async (id) => {
        try {
          const result = await (kind === 'report'
            ? searchNativeReportProducts(Number(source) as ReportProductLookupSource, { exactId: id }, controller.signal)
            : searchNativeSalesProducts({ exactId: id }, controller.signal))
          return [[id, result.length ? productBusinessName(result[0]) : null] as const]
        } catch {
          return []
        }
      }),
    ).then((found) => {
      const entries = found.flat()
      if (controller.signal.aborted || !entries.length) return
      setResolved((previous) => ({
        lookupKey,
        names: { ...(previous.lookupKey === lookupKey ? previous.names : {}), ...Object.fromEntries(entries) },
      }))
    })
    return () => controller.abort()
  }, [disabled, lookupKey, pendingKey])
  return known
}

function ProductSearchNotice({ admitted }: { admitted: boolean }) {
  return admitted ? null : <Alert color="yellow">Вибір товарів зараз недоступний. Оновіть сторінку.</Alert>
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
  const resolvedNames = useResolvedProductNames(
    dataset,
    selection.SelectedField.Type,
    requestedSource,
    selection.Values,
    !!disabled,
  )
  const admitted = !!binding && selection.SelectedField.Type === 1
  const sharedSource = binding?.kind === 'report' ? binding.dataSource : undefined
  const options = useNativeSalesProductOptions(mode, exactId ?? query, admitted && !disabled && exactId !== '', sharedSource)
  const multiple = explicitMultiple ?? isMultiValueReportCondition(selection.FilterCondition.Type)
  const choices = productChoices(options.items, createData, identity)
  const selectedCaptions = distinctCaptions(
    selection.Values.map((value) => {
      const id = savedProductId(value.Data)
      const resolvedName = !savedName(value) && id ? resolvedNames[id] : null
      return { id, caption: resolvedName ? selectedLabel({ ...value, Name: resolvedName }) : selectedLabel(value) }
    }),
  )
  const selected = selection.Values.map((value, index) => ({ value: identity(value.Data), label: selectedCaptions[index] }))
  const optionNames = productOptionNames(choices.map((choice) => choice.item))
  const change = (keys: string[], chosen?: string) => {
    if (chosen === undefined) {
      onChange(changedSelection(selection.Values, choices, keys, identity))
      return
    }
    const choice = choices.find((item) => item.key === chosen)
    if (choice) onChange([choice.value])
  }
  return (
    <Stack gap={8}>
      <ReportValuePicker
        mode={multiple ? 'multi' : 'single'}
        label={label}
        placeholder="Назва, артикул або id:123"
        data={pending ? [] : choices.map((choice, index) => ({ value: choice.key, label: optionNames[index] }))}
        selected={selected}
        ownSelectedLabels
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
    </Stack>
  )
}
