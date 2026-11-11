import { Button, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import type { ReportDataset, ReportSelectedValue, ReportSelection } from '../types'
import { returnItemStatus, returnItemStatusesCapability } from '../data/returnItemStatuses'
import { isMultiValueReportCondition } from '../data/reportOptions'
import { ReportValuePicker } from './ReportValuePicker'

export function ReturnItemStatusPicker({ dataset, selection, onChange }: {
  dataset?: ReportDataset; selection: ReportSelection; onChange: (values: ReportSelectedValue[]) => void
}) {
  const [search, setSearch] = useState('')
  const statuses = returnItemStatusesCapability(dataset)
  const multiple = isMultiValueReportCondition(selection.FilterCondition.Type)
  const legacy = selection.Values.some(value => returnItemStatus(value.Data) === null)
  const options = (statuses ?? []).map(status => ({ value: String(status.value), label: status.name }))
  const selected = selection.Values.flatMap(value => { const status = returnItemStatus(value.Data); return status === null ? [] : [String(status)] })
  function change(keys: string[]) {
    if (!statuses || legacy) return
    onChange(keys.flatMap(key => {
      const status = statuses.find(item => String(item.value) === key)
      if (!status) return []
      const existing = selection.Values.find(item => returnItemStatus(item.Data) === status.value)
      return [existing ?? { Data: { ReturnItemStatus: status.value }, Name: status.name, Value: 0 }]
    }))
  }
  return <Stack gap="xs">
    {!legacy && selection.Values.length > 0 && (!statuses || !isMultiValueReportCondition(selection.FilterCondition.Type) && selection.Values.length > 1)
      ? <Text size="sm">Збережені причини: {selection.Values.map(value => statuses?.find(status => status.value === returnItemStatus(value.Data))?.name ?? value.Name).join(', ')}</Text> : null}
    {legacy ? <Text size="sm">Збережені значення: {selection.Values.map(value => value.Name).join(', ')}. Щоб вибрати нові причини, спочатку очистіть ці значення.</Text>
      : <ReportValuePicker mode={multiple ? 'multi' : 'single'} label={multiple ? 'Причини повернення' : 'Причина повернення'} remote={false}
          data={options} selected={(multiple ? selected : selected.slice(0, 1)).flatMap(key => options.filter(option => option.value === key))}
          search={search} onSearchChange={setSearch} onChange={change} disabled={!statuses} emptyMessage="Причину не знайдено" />}
    {!statuses ? <Text size="sm">Сервер не надав перелік причин повернення. Збережені значення залишено без змін.</Text> : null}
    {selection.Values.length > 0 ? <Button type="button" variant="subtle" size="compact-sm" onClick={() => onChange([])}>Очистити причини</Button> : null}
  </Stack>
}
