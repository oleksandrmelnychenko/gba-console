import { ListPlus } from 'lucide-react'
import { AnalysisGroupBrowser } from './AnalysisGroupBrowser'
import { AnalysisTopEntry } from './AnalysisTopEntry'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Button, Group, Loader, SegmentedControl, Select, Stack, Text } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { ReportValueAutocomplete } from './ReportValueAutocomplete'
import { TableRowAction } from '../../../shared/ui/table-row-action/TableRowAction'
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

export function CurrentVparivanieAnalysisValuePicker({ selection, selections, descriptor, from, to, onChange, status }: {
  selection: ReportSelection; selections: ReportSelection[]; descriptor?: AnalysisFieldDescriptor
  from: string; to: string; onChange: (values: ReportSelectedValue[]) => void; status?: AnalysisHierarchyStatus | null
}) {
  const [search, setSearch] = useState('')
  const [query] = useDebouncedValue(search, 400)
  const [choiceKind, setChoiceKind] = useState<'group' | 'item'>('group')
  const field = selection.SelectedField.Type, condition = selection.FilterCondition.Type
  const hierarchy = analysisHierarchy(descriptor)
  const groupCondition = !!hierarchy?.groupConditions.includes(condition)
  const mixed = !!hierarchy?.mixedConditions.includes(condition)
  const choice: 'group' | 'item' = mixed ? choiceKind : groupCondition || field === 4 ? 'group' : 'item'
  const unavailable = groupCondition ? analysisHierarchyUnavailableReason(descriptor, status) : null
  const sourceKind = choice === 'group' && hierarchy && hierarchy.groupKind !== 'productGroup' ? hierarchy.groupKind : null
  const lookupField = choice === 'group' ? 4 : hierarchy?.itemField ?? field
  const buyer = selections.find(s => s.IsChecked !== false && [5, 6].includes(s.SelectedField.Type) && s.FilterCondition.Type === 0 && s.Values.length === 1)
  const buyerId = buyer?.Values[0].Data.Id
  const buyerParam = typeof buyerId === 'string' || typeof buyerId === 'number' && Number.isSafeInteger(buyerId) ? String(buyerId) : undefined
  const scope = JSON.stringify([field, condition, choice, sourceKind, lookupField, from, to, buyerId ?? null, query, unavailable])
  const [result, setResult] = useState<{ scope: string; values: AnalysisLookupValue[]; nextOffset: number; hasMore: boolean; loadingMore?: boolean; error?: string } | null>(null)
  const moreRequest = useRef<AbortController | null>(null)
  const fetchPage = useCallback((offset: number, signal: AbortSignal): Promise<{ values: AnalysisLookupValue[]; hasMore: boolean }> => sourceKind
    ? getAnalysisHierarchyPage(sourceKind, null, offset, 30, query, signal)
      .then(page => ({ values: page.items.map(item => ({ id: item.id, name: item.path, data: item.data })), hasMore: page.hasMore }))
    : (offset ? searchAnalysisValues(lookupField, query, from, to, buyerParam, signal, offset) : searchAnalysisValues(lookupField, query, from, to, buyerParam, signal))
      .then(values => ({ values, hasMore: values.length === 30 })),
  [sourceKind, query, lookupField, from, to, buyerParam])
  useEffect(() => {
    if (unavailable) return
    const controller = new AbortController()
    void fetchPage(0, controller.signal)
      .then(page => { if (!controller.signal.aborted) setResult({ scope, values: page.values, nextOffset: page.values.length, hasMore: page.hasMore }) })
      .catch(error => { if (!controller.signal.aborted) setResult({ scope, values: [], nextOffset: 0, hasMore: false, error: error instanceof Error ? error.message : 'Не вдалося прочитати значення.' }) })
    return () => { controller.abort(); moreRequest.current?.abort() }
  }, [fetchPage, scope, unavailable])
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
  const add = (id: string | null) => {
    const selected = id === null ? undefined : optionMap.get(id)
    if (!selected) return
    onChange([selected])
    setSearch('')
  }
  const changeMultiple = (keys: string[]) => {
    const desired = new Set(keys), previous = new Set(selectedKeys)
    const retained = selection.Values.filter(value => desired.has(analysisValueIdentity(field, value.Data)))
    const added = keys.filter(key => !previous.has(key)).flatMap(key => optionMap.get(key) ? [optionMap.get(key)!] : [])
    onChange([...retained, ...added])
  }
  const options = [...optionMap].map(([value, selected]) => ({ value, label: selected.Name }))
  const itemKind = hierarchy && (groupCondition || field === 4) ? hierarchy.itemKind : undefined
  const label = (value: ReportSelectedValue) => analysisValueLabel(field, value, itemKind)
  const groupsOnly = choice === 'group'
  return <Stack gap={6} className="report-analysis-values">
    {mixed && hierarchy && !unavailable ? <SegmentedControl aria-label="Тип значення" value={choiceKind}
      data={[{ value: 'group', label: 'Групи' }, { value: 'item', label: ITEM_LABELS[hierarchy.itemKind][1] }]}
      onChange={value => { setChoiceKind(value as 'group' | 'item'); setSearch('') }} /> : null}
    {unavailable ? <Alert color="yellow">{unavailable}</Alert> : multiple ? <ReportValueAutocomplete label="Значення" data={search !== query ? [] : options}
      selected={selection.Values.map(value => ({ value: analysisValueIdentity(field, value.Data), label: label(value) }))}
      onChange={changeMultiple} search={search} onSearchChange={setSearch} loading={!current || search !== query} />
      : <Select comboboxProps={{ withinPortal: false }} label="Значення" placeholder={groupsOnly ? 'Знайти групу' : 'Знайти значення'}
        searchable filter={({ options }) => options} searchValue={search} onSearchChange={setSearch}
        data={options} value={null} onChange={add}
        rightSection={!current ? <Loader size="xs" /> : undefined} nothingFoundMessage="Нічого не знайдено" />}
    <Group gap={6} className="report-analysis-values__actions">
    {!unavailable && current?.hasMore ? current.nextOffset < 4080
      ? <Button type="button" variant="default" size="compact-sm" leftSection={<ListPlus size={15} aria-hidden="true" />} loading={current.loadingMore} onClick={() => void loadMore()}>Ще значення</Button>
      : <Text size="xs" c="dimmed">Показано 4080 значень. Звузьте пошук, щоб знайти потрібне.</Text> : null}
    {descriptor && hierarchy && !unavailable && (field === 4 ? !!descriptor.hierarchyBrowse : groupCondition)
      ? <AnalysisGroupBrowser descriptor={descriptor} selection={selection} onChange={onChange} /> : null}
    </Group>
    {descriptor?.textEntry && field === 3 ? <AnalysisTopEntry capability={descriptor.textEntry} selection={selection} multiple={multiple} onChange={onChange} /> : null}
    {current?.error ? <Alert color="red">{current.error}</Alert> : null}
    {!multiple ? <div className="report-analysis-values__selected">{selection.Values.map((v, index) => {
      const text = label(v)
      return <Group key={analysisValueIdentity(field, v.Data)} className="report-analysis-values__chip" gap={4} wrap="nowrap">
        <Text size="sm">{text}</Text><TableRowAction action="delete" label={`Видалити значення ${text}`}
          onClick={() => onChange(selection.Values.filter((_, i) => i !== index))} />
      </Group>
    })}</div> : null}
  </Stack>
}
