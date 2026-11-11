import type { ReactNode } from 'react'
import type { NativeProductItemPickerContext } from './NativeSalesProductPicker'
import { AnalysisGroupBrowser } from './AnalysisGroupBrowser'
import { AnalysisTopEntry } from './AnalysisTopEntry'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Group, SegmentedControl, Stack, Text } from '@mantine/core'
import { ReportValuePicker } from './ReportValuePicker'
import { useReportValueSearch } from './reportValueSearch'
import { getAnalysisHierarchyPage, searchAnalysisValues, type AnalysisLookupValue } from '../api/currentVparivanieAnalysisApi'
import { analysisGroupIdentity, analysisHierarchy, analysisHierarchyIdentity, analysisHierarchyUnavailableReason, analysisListCondition, analysisValueIdentity,
  type AnalysisFieldDescriptor, type AnalysisHierarchyStatus, type AnalysisItemKind } from '../data/currentVparivanieAnalysis'
import { isMultiValueReportCondition } from '../data/reportOptions'
import type { ReportEntity, ReportSelectedValue, ReportSelection } from '../types'

const ITEM_LABELS: Record<AnalysisItemKind, [string, string]> = {
  product: ['Товар', 'Товари'], buyer: ['Покупець', 'Покупці'], supplier: ['Постачальник', 'Постачальники'], warehouse: ['Склад', 'Склади'],
}

function analysisValueLabel(field: number, value: ReportSelectedValue, itemKind?: AnalysisItemKind): string {
  const identity = field === 4 ? analysisGroupIdentity(value.Data) : itemKind ? analysisHierarchyIdentity(field, value.Data) : null
  if (!identity) return value.Name
  if (field === 4) return `${identity.kind === 'product' ? 'Товар' : 'Група'}: ${value.Name}`
  const typed = analysisHierarchyIdentity(field, value.Data)
  return typed?.group ? `Група: ${value.Name}` : `${ITEM_LABELS[itemKind!][0]}: ${value.Name}`
}

export type AnalysisItemSearch = (value: string, offset: number, signal: AbortSignal) => Promise<AnalysisLookupValue[]>

function analysisLookupPeriod(sourceKind: string | null, from: string, to: string): [string, string] {
  return sourceKind ? ['', ''] : [from, to]
}

export function CurrentVparivanieAnalysisValuePicker({ selection, selections, descriptor, from, to, onChange, status, searchItems, renderItemPicker }: {
  selection: ReportSelection; selections: ReportSelection[]; descriptor?: AnalysisFieldDescriptor
  from: string; to: string; onChange: (values: ReportSelectedValue[]) => void; status?: AnalysisHierarchyStatus | null
  searchItems?: AnalysisItemSearch
  renderItemPicker?: (context: NativeProductItemPickerContext) => ReactNode
}) {
  const { search, setSearch, query, pending } = useReportValueSearch()
  const [attempt, setAttempt] = useState(0)
  const [choiceKind, setChoiceKind] = useState<'group' | 'item'>('group')
  const field = selection.SelectedField.Type, condition = selection.FilterCondition.Type
  const hierarchy = analysisHierarchy(descriptor)
  const groupCondition = !!hierarchy?.groupConditions.includes(condition)
  const mixed = !!hierarchy?.mixedConditions.includes(condition)
  const choice: 'group' | 'item' = mixed ? choiceKind : groupCondition || field === 4 ? 'group' : 'item'
  const unavailable = groupCondition ? analysisHierarchyUnavailableReason(descriptor, status) : null
  const sourceKind = choice === 'group' && hierarchy && hierarchy.groupKind !== 'productGroup' ? hierarchy.groupKind : null
  const [lookupFrom, lookupTo] = analysisLookupPeriod(sourceKind, from, to)
  const lookupField = choice === 'group' ? 4 : hierarchy?.itemField ?? field
  const buyer = selections.find(s => s.IsChecked !== false && [5, 6].includes(s.SelectedField.Type) && s.FilterCondition.Type === 0 && s.Values.length === 1)
  const buyerId = buyer?.Values[0].Data.Id
  const buyerParam = typeof buyerId === 'string' || typeof buyerId === 'number' && Number.isSafeInteger(buyerId) ? String(buyerId) : undefined
  const scope = JSON.stringify([field, condition, choice, sourceKind, lookupField, lookupFrom, lookupTo, buyerId ?? null, query, unavailable, attempt])
  const [result, setResult] = useState<{ scope: string; values: AnalysisLookupValue[]; nextOffset: number; hasMore: boolean; loadingMore?: boolean; error?: string } | null>(null)
  const moreRequest = useRef<AbortController | null>(null)
  const injectedItem = choice === 'item' && !!renderItemPicker
  const itemSearch = choice === 'item' ? searchItems : undefined
  const fetchPage = useCallback((offset: number, signal: AbortSignal): Promise<{ values: AnalysisLookupValue[]; hasMore: boolean }> => sourceKind
    ? getAnalysisHierarchyPage(sourceKind, null, offset, 30, query, signal)
      .then(page => ({ values: page.items.map(item => ({ id: item.id, name: item.path, data: item.data })), hasMore: page.hasMore }))
    : itemSearch ? itemSearch(query, offset, signal).then(values => ({ values, hasMore: false }))
    : (offset ? searchAnalysisValues(lookupField, query, lookupFrom, lookupTo, buyerParam, signal, offset) : searchAnalysisValues(lookupField, query, lookupFrom, lookupTo, buyerParam, signal))
      .then(values => ({ values, hasMore: values.length === 30 })),
  [sourceKind, itemSearch, query, lookupField, lookupFrom, lookupTo, buyerParam])
  useEffect(() => {
    if (unavailable || injectedItem) return
    const controller = new AbortController()
    void fetchPage(0, controller.signal)
      .then(page => { if (!controller.signal.aborted) setResult({ scope, values: page.values, nextOffset: page.values.length, hasMore: page.hasMore }) })
      .catch(error => { if (!controller.signal.aborted) setResult({ scope, values: [], nextOffset: 0, hasMore: false, error: error instanceof Error ? error.message : 'Не вдалося прочитати значення.' }) })
    return () => { controller.abort(); moreRequest.current?.abort() }
  }, [fetchPage, scope, unavailable, injectedItem])
  const current = result?.scope === scope ? result : null
  const loadMore = async () => {
    if (!current?.hasMore || current.loadingMore || current.nextOffset >= 4080) return
    const controller = new AbortController()
    moreRequest.current = controller
    setResult(previous => previous?.scope === scope ? { ...previous, loadingMore: true, error: undefined } : previous)
    try {
      const page = await fetchPage(current.nextOffset, controller.signal)
      if (!controller.signal.aborted) setResult(previous => {
        if (previous?.scope !== scope) return previous
        const existing = new Set(previous.values.map(value => value.id))
        return { ...previous, values: [...previous.values, ...page.values.filter(value => !existing.has(value.id))],
          nextOffset: current.nextOffset + page.values.length, hasMore: page.hasMore, loadingMore: false }
      })
    } catch (error) {
      if (!controller.signal.aborted) setResult(previous => previous?.scope === scope ? { ...previous, loadingMore: false,
        error: error instanceof Error ? error.message : 'Не вдалося прочитати наступні значення.' } : previous)
    }
  }
  const multiple = isMultiValueReportCondition(condition) || !!analysisListCondition(condition, descriptor)
  const encode = (data: ReportEntity): ReportEntity | null => {
    if (sourceKind) return data
    if (!hierarchy || !groupCondition && field !== 4) return data
    const id = analysisGroupIdentity(data)?.id
    if (id === undefined) return null
    if (choice === 'group') return field === 4 && !mixed ? data : { kind: 'productGroup', id }
    return { kind: hierarchy.itemKind, id }
  }
  const optionValues = (current?.values ?? []).flatMap(item => {
    const Data = encode(item.data)
    return Data ? [{ Data, Name: item.name, Value: 0 }] : []
  })
  const optionMap = new Map(optionValues.map(value => [analysisValueIdentity(field, value.Data), value]))
  const selectedKeys = selection.Values.map(value => analysisValueIdentity(field, value.Data))
  const changeMultiple = (keys: string[]) => {
    const desired = new Set(keys), previous = new Set(selectedKeys)
    const retained = selection.Values.filter(value => desired.has(analysisValueIdentity(field, value.Data)))
    const added = keys.filter(key => !previous.has(key)).flatMap(key => optionMap.get(key) ? [optionMap.get(key)!] : [])
    onChange([...retained, ...added])
  }
  const change = (keys: string[], chosen?: string) => {
    if (chosen === undefined) { changeMultiple(keys); return }
    const value = optionMap.get(chosen)
    if (value) onChange([value])
  }
  const options = [...optionMap].map(([value, selected]) => ({ value, label: selected.Name }))
  const itemKind = hierarchy && (groupCondition || field === 4) ? hierarchy.itemKind : undefined
  const label = (value: ReportSelectedValue) => analysisValueLabel(field, value, itemKind)
  return <Stack gap={6} className="report-analysis-values">
    {mixed && hierarchy && !unavailable ? <SegmentedControl aria-label="Тип значення" value={choiceKind}
      data={[{ value: 'group', label: 'Групи' }, { value: 'item', label: ITEM_LABELS[hierarchy.itemKind][1] }]}
      onChange={value => { setChoiceKind(value as 'group' | 'item'); setSearch('') }} /> : null}
    {injectedItem ? renderItemPicker?.({ selection, onChange, multiple, createData: encode, selectedLabel: label, identity: data => analysisValueIdentity(field, data) })
      : unavailable ? <Alert color="yellow">{unavailable}</Alert>
      : <ReportValuePicker mode={multiple ? 'multi' : 'single'} label="Значення"
          data={pending ? [] : options} selected={selection.Values.map(value => ({ value: analysisValueIdentity(field, value.Data), label: label(value) }))}
          search={search} onSearchChange={setSearch} onChange={change} loading={!current || pending}
          lookupError={pending ? undefined : current?.error} onRetry={() => { if (current?.values.length) void loadMore(); else setAttempt(value => value + 1) }}
          hasMore={!pending && !!current?.hasMore && current.nextOffset < 4080} loadingMore={current?.loadingMore} onLoadMore={() => void loadMore()} />}
    <Group gap={6} className="report-analysis-values__actions">
    {!injectedItem && !unavailable && current?.hasMore && current.nextOffset >= 4080
      ? <Text size="xs" c="dimmed">Показано 4080 значень. Звузьте пошук, щоб знайти потрібне.</Text> : null}
    {descriptor && hierarchy && !unavailable && (field === 4 ? !!descriptor.hierarchyBrowse : groupCondition)
      ? <AnalysisGroupBrowser descriptor={descriptor} selection={selection} onChange={onChange} /> : null}
    </Group>
    {descriptor?.textEntry && field === 3 ? <AnalysisTopEntry capability={descriptor.textEntry} selection={selection} multiple={multiple} onChange={onChange} /> : null}
  </Stack>
}
