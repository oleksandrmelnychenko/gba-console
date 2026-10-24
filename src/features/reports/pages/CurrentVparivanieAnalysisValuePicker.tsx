import { ListPlus } from 'lucide-react'
import { AnalysisGroupBrowser } from './AnalysisGroupBrowser'
import { AnalysisTopEntry } from './AnalysisTopEntry'
import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Group, Loader, SegmentedControl, Select, Stack, Text } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { CheckboxMultiSelect } from '../../../shared/ui/CheckboxMultiSelect'
import { TableRowAction } from '../../../shared/ui/table-row-action/TableRowAction'
import { searchAnalysisValues, type AnalysisLookupValue } from '../api/currentVparivanieAnalysisApi'
import { analysisGroupIdentity, analysisValueIdentity, mixedAnalysisSelection, type AnalysisFieldDescriptor } from '../data/currentVparivanieAnalysis'
import { isMultiValueReportCondition } from '../data/reportOptions'
import type { ReportSelectedValue, ReportSelection } from '../types'

export function CurrentVparivanieAnalysisValuePicker({ selection, selections, descriptor, from, to, onChange }: {
  selection: ReportSelection; selections: ReportSelection[]; descriptor?: AnalysisFieldDescriptor
  from: string; to: string; onChange: (values: ReportSelectedValue[]) => void
}) {
  const [search, setSearch] = useState('')
  const [query] = useDebouncedValue(search, 200)
  const [choiceKind, setChoiceKind] = useState<'product' | 'productGroup'>('productGroup')
  const mixed = mixedAnalysisSelection(descriptor, selection.FilterCondition.Type)
  const lookupField = mixed && choiceKind === 'product' ? descriptor!.groupSelection!.itemField : selection.SelectedField.Type
  const buyer = selections.find(s => s.IsChecked !== false && [5, 6].includes(s.SelectedField.Type) && s.FilterCondition.Type === 0 && s.Values.length === 1)
  const buyerId = buyer?.Values[0].Data.Id
  const scope = JSON.stringify([selection.SelectedField.Type, selection.FilterCondition.Type, lookupField, from, to, buyerId ?? null, query])
  const [result, setResult] = useState<{ scope: string; values: AnalysisLookupValue[]; nextOffset: number; hasMore: boolean; loadingMore?: boolean; error?: string } | null>(null)
  const moreRequest = useRef<AbortController | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    void searchAnalysisValues(lookupField, query, from, to, typeof buyerId === 'string' || typeof buyerId === 'number' && Number.isSafeInteger(buyerId) ? String(buyerId) : undefined, controller.signal)
      .then(values => { if (!controller.signal.aborted) setResult({ scope, values, nextOffset: values.length, hasMore: values.length === 30 }) })
      .catch(error => { if (!controller.signal.aborted) setResult({ scope, values: [], nextOffset: 0, hasMore: false, error: error instanceof Error ? error.message : 'Не вдалося прочитати значення.' }) })
    return () => { controller.abort(); moreRequest.current?.abort() }
  }, [lookupField, selection.FilterCondition.Type, query, from, to, buyerId, scope])
  const current = result?.scope === scope ? result : null
  const loadMore = async () => {
    if (!current?.hasMore || current.loadingMore || current.nextOffset >= 4080) return
    const controller = new AbortController()
    moreRequest.current = controller
    setResult(previous => previous?.scope === scope ? { ...previous, loadingMore: true, error: undefined } : previous)
    try {
      const values = await searchAnalysisValues(lookupField, query, from, to,
        typeof buyerId === 'string' || typeof buyerId === 'number' && Number.isSafeInteger(buyerId) ? String(buyerId) : undefined,
        controller.signal, current.nextOffset)
      if (!controller.signal.aborted) setResult(previous => {
        if (previous?.scope !== scope) return previous
        const existing = new Set(previous.values.map(value => value.id))
        return { ...previous, values: [...previous.values, ...values.filter(value => !existing.has(value.id))],
          nextOffset: current.nextOffset + values.length, hasMore: values.length === 30, loadingMore: false }
      })
    } catch (error) {
      if (!controller.signal.aborted) setResult(previous => previous?.scope === scope ? { ...previous, loadingMore: false,
        error: error instanceof Error ? error.message : 'Не вдалося прочитати наступні значення.' } : previous)
    }
  }
  const multiple = isMultiValueReportCondition(selection.FilterCondition.Type)
  const optionValues = (current?.values ?? []).flatMap(item => {
    const lookupIdentity = mixed ? analysisGroupIdentity(item.data) : null
    if (mixed && !lookupIdentity) return []
    const Data = mixed ? { kind: choiceKind, id: lookupIdentity!.id } : item.data
    return [{ Data, Name: item.name, Value: 0 }]
  })
  const optionMap = new Map(optionValues.map(value => [analysisValueIdentity(selection.SelectedField.Type, value.Data), value]))
  const selectedKeys = selection.Values.map(value => analysisValueIdentity(selection.SelectedField.Type, value.Data))
  const add = (id: string | null) => {
    const selected = id === null ? undefined : optionMap.get(id)
    if (!selected) return
    onChange([selected])
    setSearch('')
  }
  const changeMultiple = (keys: string[]) => {
    const desired = new Set(keys), previous = new Set(selectedKeys)
    const retained = selection.Values.filter(value => desired.has(analysisValueIdentity(selection.SelectedField.Type, value.Data)))
    const added = keys.filter(key => !previous.has(key)).flatMap(key => optionMap.get(key) ? [optionMap.get(key)!] : [])
    onChange([...retained, ...added])
  }
  const options = [...optionMap].map(([value, selected]) => ({ value, label: selected.Name }))
  const isGroup = selection.SelectedField.Type === 4
  return <Stack gap={6} className="report-analysis-values">
    {mixed ? <SegmentedControl aria-label="Тип значення" value={choiceKind}
      data={[{ value: 'productGroup', label: 'Групи' }, { value: 'product', label: 'Товари' }]}
      onChange={value => { setChoiceKind(value as 'product' | 'productGroup'); setSearch('') }} /> : null}
    {multiple ? <CheckboxMultiSelect label="Значення" placeholder="Оберіть значення" data={options} value={selectedKeys}
      onChange={changeMultiple} withinPortal={false} remoteSearch={{ value: search, onChange: setSearch, loading: !current }} />
      : <Select comboboxProps={{ withinPortal: false }} label="Значення" placeholder={isGroup ? 'Знайти групу' : 'Знайти значення'}
        searchable filter={({ options }) => options} searchValue={search} onSearchChange={setSearch}
        data={options} value={null} onChange={add}
        rightSection={!current ? <Loader size="xs" /> : undefined} nothingFoundMessage="Нічого не знайдено" />}
    {mixed ? <Text size="xs" c="dimmed">Оберіть товари та групи. Товари з перетинів груп враховуються один раз.</Text> : null}
    <Group gap={6} className="report-analysis-values__actions">
    {current?.hasMore ? current.nextOffset < 4080
      ? <Button type="button" variant="default" size="compact-sm" leftSection={<ListPlus size={15} aria-hidden="true" />} loading={current.loadingMore} onClick={() => void loadMore()}>Ще значення</Button>
      : <Text size="xs" c="dimmed">Показано 4080 значень. Звузьте пошук, щоб знайти потрібне.</Text> : null}
    {descriptor?.hierarchyBrowse && selection.SelectedField.Type === 4 ? <AnalysisGroupBrowser descriptor={descriptor} selection={selection} onChange={onChange} /> : null}
    </Group>
    {descriptor?.textEntry && selection.SelectedField.Type === 3 ? <AnalysisTopEntry capability={descriptor.textEntry} selection={selection} onChange={onChange} /> : null}
    {current?.error ? <Alert color="red">{current.error}</Alert> : null}
    {multiple && selection.Values.length > 0 ? <Text size="xs">Вибрано: {selection.Values.length}</Text> : null}
    <div className="report-analysis-values__selected">{selection.Values.map((v, index) => {
      const group = isGroup ? analysisGroupIdentity(v.Data) : null
      const label = group ? `${group.kind === 'product' ? 'Товар' : 'Група'}: ${v.Name}` : v.Name
      return <Group key={analysisValueIdentity(selection.SelectedField.Type, v.Data)} className="report-analysis-values__chip" gap={4} wrap="nowrap">
        <Text size="sm">{label}</Text><TableRowAction action="delete" label={`Видалити значення ${label}`}
          onClick={() => onChange(selection.Values.filter((_, i) => i !== index))} />
      </Group>
    })}</div>
  </Stack>
}
