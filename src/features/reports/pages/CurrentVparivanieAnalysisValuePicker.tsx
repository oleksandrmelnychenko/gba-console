import { useEffect, useState } from 'react'
import { Alert, Button, Group, Loader, Select, Stack, Text } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { searchAnalysisValues, type AnalysisLookupValue } from '../api/currentVparivanieAnalysisApi'
import type { ReportSelectedValue, ReportSelection } from '../types'

const identity = (value: object) => JSON.stringify(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
export function CurrentVparivanieAnalysisValuePicker({ selection, selections, from, to, onChange }: {
  selection: ReportSelection; selections: ReportSelection[]; from: string; to: string; onChange: (values: ReportSelectedValue[]) => void
}) {
  const [search, setSearch] = useState('')
  const [query] = useDebouncedValue(search, 200)
  const buyer = selections.find(s => s.IsChecked !== false && [5, 6].includes(s.SelectedField.Type) && s.FilterCondition.Type === 0 && s.Values.length === 1)
  const buyerId = buyer?.Values[0].Data.Id
  const scope = JSON.stringify([selection.SelectedField.Type, from, to, buyerId ?? null, query])
  const [result, setResult] = useState<{ scope: string; values: AnalysisLookupValue[]; error?: string } | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    void searchAnalysisValues(selection.SelectedField.Type, query, from, to, typeof buyerId === 'string' || typeof buyerId === 'number' && Number.isSafeInteger(buyerId) ? String(buyerId) : undefined, controller.signal)
      .then(values => { if (!controller.signal.aborted) setResult({ scope, values }) })
      .catch(error => { if (!controller.signal.aborted) setResult({ scope, values: [], error: error instanceof Error ? error.message : 'Не вдалося прочитати значення.' }) })
    return () => controller.abort()
  }, [selection.SelectedField.Type, query, from, to, buyerId, scope])
  const current = result?.scope === scope ? result : null
  const add = (id: string | null) => {
    const item = current?.values.find(v => v.id === id)
    if (!item) return
    const selected = { Data: item.data, Name: item.name, Value: 0 }
    const multiple = [2, 3, 4, 5].includes(selection.FilterCondition.Type)
    onChange(multiple ? [...selection.Values.filter(v => identity(v.Data) !== identity(item.data)), selected] : [selected])
    setSearch('')
  }
  return <Stack gap="xs">
    <Select comboboxProps={{ withinPortal: false }} label="Значення" placeholder="Знайти значення" searchable searchValue={search} onSearchChange={setSearch}
      data={current?.values.map(v => ({ value: v.id, label: v.name })) ?? []} value={null} onChange={add}
      rightSection={!current ? <Loader size="xs" /> : undefined} nothingFoundMessage="Нічого не знайдено" />
    {current?.error ? <Alert color="red">{current.error}</Alert> : null}
    {selection.Values.map((v, index) => <Group key={identity(v.Data)} justify="space-between" wrap="nowrap">
      <Text size="sm">{v.Name}</Text><Button size="compact-xs" variant="subtle" aria-label={`Видалити значення ${v.Name}`}
        onClick={() => onChange(selection.Values.filter((_, i) => i !== index))}>Видалити</Button>
    </Group>)}
  </Stack>
}
