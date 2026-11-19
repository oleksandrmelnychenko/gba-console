import { Button, Group, Stack, Text } from '@mantine/core'
import { useEffect, useState } from 'react'
import { searchManufacturerSuppliers, searchReportManufacturers } from '../api/reportsApi'
import { REPORT_FILTER_CONDITIONS } from '../data/reportOptions'
import type { ReportFilterField, ReportSelection } from '../types'
import { ReportModal } from './ReportModal'
import { ReportValuePicker } from './ReportValuePicker'
import { useReportValueSearch } from './reportValueSearch'

type Choice = { Id: number; Name: string }
export const UNPLACED_BUYER_GROUP_ID = 'fenix:FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF1'

type Props = {
  groupId: string
  groupName: string
  showGroupName: boolean
  field: ReportFilterField
  onAdd: (selection: ReportSelection) => void
}

export function GroupManufacturerPicker({ groupId, groupName, showGroupName, field, onAdd }: Props) {
  const [opened, setOpened] = useState(false)
  return <>
    <Button type="button" size="compact-xs" variant="default" onClick={() => setOpened(true)}>
      {showGroupName ? `Вибрати виробника · ${groupName}` : 'Вибрати виробника'}
    </Button>
    <ReportModal opened={opened} onClose={() => setOpened(false)} title="Виробники постачальника" size="md">
      {opened && <ManufacturerDraft groupId={groupId} groupName={groupName} onApply={choices => {
        onAdd({ IsChecked: true, SelectedField: field, FilterCondition: REPORT_FILTER_CONDITIONS.find(item => item.Type === 2)!,
          Values: choices.map(item => ({ Data: item, Name: item.Name, Value: item.Id })) })
        setOpened(false)
      }} />}
    </ReportModal>
  </>
}

function ManufacturerDraft({ groupId, groupName, onApply }: Pick<Props, 'groupId' | 'groupName'> & { onApply: (brands: Choice[]) => void }) {
  const [supplier, setSupplier] = useState<Choice>()
  const [brands, setBrands] = useState<Choice[]>([])
  return <Stack gap="sm">
    <Text size="sm">{groupName}</Text>
    {supplier ? <>
      <Group gap="xs"><Text size="sm">{supplier.Name}</Text>
        <Button type="button" variant="subtle" size="compact-xs"
          onClick={() => { setSupplier(undefined); setBrands([]) }}>Змінити постачальника</Button>
      </Group>
      <DirectoryPicker key={supplier.Id} groupId={groupId} supplierId={supplier.Id} selected={brands} onChange={setBrands} />
      <Button type="button" disabled={!brands.length} onMouseDown={event => event.preventDefault()}
        onClick={() => onApply(brands)}>Додати відбір за виробником</Button>
    </> : <DirectoryPicker key={groupId} groupId={groupId} selected={[]} onChange={choices => setSupplier(choices[0])} />}
  </Stack>
}

const PAGE_SIZE = 30

function DirectoryPicker({ groupId, supplierId, selected, onChange }: {
  groupId: string; supplierId?: number; selected: Choice[]; onChange: (values: Choice[]) => void
}) {
  const { search, setSearch, query, pending } = useReportValueSearch()
  const [offset, setOffset] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [page, setPage] = useState<{ scope: string; items: Choice[]; error?: string }>()
  const scope = JSON.stringify([groupId, supplierId, query, offset, attempt])
  useEffect(() => {
    const controller = new AbortController()
    const params = { value: query, offset, limit: PAGE_SIZE }
    const request = supplierId === undefined ? searchManufacturerSuppliers(groupId, params, controller.signal)
      : searchReportManufacturers(2, params, [supplierId], controller.signal)
    request.then(items => {
      if (!controller.signal.aborted) setPage({ scope, items })
    }).catch(error => {
      if (!controller.signal.aborted) setPage({ scope, items: [], error: error instanceof Error ? error.message : 'Не вдалося прочитати довідник.' })
    })
    return () => controller.abort()
  }, [groupId, supplierId, query, offset, scope])
  const current = !pending && page?.scope === scope ? page : undefined
  const options = current?.items ?? []
  const option = (item: Choice) => ({ value: String(item.Id), label: item.Name })
  return <>
    <ReportValuePicker mode={supplierId === undefined ? 'single' : 'multi'} label={supplierId === undefined ? 'Постачальник' : 'Виробник'}
      data={options.map(option)} selected={selected.map(option)} search={search} inlineOptions={supplierId !== undefined}
      onSearchChange={text => { setSearch(text); setOffset(0) }} loading={!current} lookupError={current?.error}
      onRetry={() => setAttempt(value => value + 1)} onChange={keys => {
        const byId = new Map([...selected, ...options].map(item => [String(item.Id), item]))
        onChange(keys.flatMap(id => {
          const item = byId.get(id)
          return item ? [item] : []
        }))
      }} />
    {supplierId === undefined && (offset > 0 || options.length === PAGE_SIZE) && <Group gap="xs">
      <Button type="button" size="compact-xs" variant="default" disabled={!offset} onClick={() => setOffset(offset - PAGE_SIZE)}>Попередні</Button>
      <Button type="button" size="compact-xs" variant="default" disabled={options.length < PAGE_SIZE || offset + PAGE_SIZE > 10000}
        onClick={() => setOffset(offset + PAGE_SIZE)}>Наступні</Button>
    </Group>}
  </>
}
