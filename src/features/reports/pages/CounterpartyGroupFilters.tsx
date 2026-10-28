import { WorkbookSectionActions } from './workbook-desk/WorkbookSectionActions'
import { ListPlus, UserRoundMinus, UserRoundPlus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Group, MultiSelect, Stack } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { getSettlementCounterpartyGroups } from '../api/counterpartyGroupsApi'
import { changeCounterpartyGroupList, SETTLEMENT_WORKBOOK_EXCLUDED_GROUPS, sourceCounterpartyGroups, type CounterpartyGroupChoice } from '../data/sourceCounterpartyGroups'

const PAGE_SIZE = 30

export function CounterpartyGroupFilters({ value, disabled, onChange }: {
  value: unknown; disabled: boolean; onChange: (next: unknown) => void
}) {
  const selected = sourceCounterpartyGroups(value)
  const [search, setSearch] = useState('')
  const [query] = useDebouncedValue(search, 300)
  const [attempt, setAttempt] = useState(0)
  const [rows, setRows] = useState<CounterpartyGroupChoice[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const active = useRef<AbortController | null>(null)
  useEffect(() => {
    const controller = new AbortController(); active.current = controller
    if (!disabled) {
      void getSettlementCounterpartyGroups(query, 0, PAGE_SIZE, controller.signal).then(page => {
        if (controller.signal.aborted) return
        setRows(page); setHasMore(page.length === PAGE_SIZE); setError(null)
      }).catch(() => {
        if (!controller.signal.aborted) setError('Не вдалося завантажити поточні групи контрагентів. Збережений відбір не змінено.')
      }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }
    return () => controller.abort()
  }, [query, disabled, attempt])
  async function loadMore() {
    const controller = active.current
    if (!controller || controller.signal.aborted || disabled || loading || !hasMore) return
    setLoading(true)
    try {
      const page = await getSettlementCounterpartyGroups(query, rows.length, PAGE_SIZE, controller.signal)
      if (!controller.signal.aborted) {
        setRows(current => [...current, ...page.filter(row => !current.some(item => item.Id === row.Id))])
        setHasMore(page.length === PAGE_SIZE); setError(null)
      }
    } catch { if (!controller.signal.aborted) setError('Наступну сторінку груп не отримано. Поточний вибір збережено.') }
    finally { if (!controller.signal.aborted) setLoading(false) }
  }
  const selectedIds = [...(selected?.IncludeGroupIds ?? []), ...(selected?.ExcludeGroupIds ?? [])]
  const options = new Map(rows.map(row => [row.Id.toUpperCase(), { value: row.Id.toUpperCase(), label: row.Name }]))
  for (const id of selectedIds) if (!options.has(id.toUpperCase())) {
    const known = SETTLEMENT_WORKBOOK_EXCLUDED_GROUPS.find(group => group.Id === id.toUpperCase())
    options.set(id.toUpperCase(), { value: id.toUpperCase(), label: known?.Name ?? `Збережена група [${id.toUpperCase()}]` })
  }
  const count = selectedIds.length
  return <Stack gap="xs">
    {(['IncludeGroupIds', 'ExcludeGroupIds'] as const).map(list => <MultiSelect key={list}
      label={<Group component="span" gap={6} wrap="nowrap">
        {list === 'IncludeGroupIds' ? <UserRoundPlus size={16} aria-hidden="true" /> : <UserRoundMinus size={16} aria-hidden="true" />}
        {list === 'IncludeGroupIds' ? 'Включити групи контрагентів' : 'Виключити групи контрагентів'}
      </Group>}
      placeholder="Пошук групи або контрагента"
      data={[...options.values()]} value={selected?.[list].map(id => id.toUpperCase()) ?? []}
      disabled={disabled} searchable clearable searchValue={search}
      maxValues={64 - count + (selected?.[list].length ?? 0)}
      onSearchChange={next => { const text = next.slice(0, 120); if (text !== search) { setSearch(text); setLoading(true) } }}
      filter={({ options: items }) => items}
      onChange={ids => onChange(changeCounterpartyGroupList(value, list, ids))} />)}
    <WorkbookSectionActions><Group gap="xs">
      {hasMore && <Button size="compact-xs" variant="default" leftSection={<ListPlus size={14} aria-hidden="true" />} disabled={disabled} loading={loading} onClick={() => void loadMore()}>Завантажити ще групи</Button>}
      {error && <Button size="xs" variant="subtle" disabled={disabled || loading}
        onClick={() => { setLoading(true); setAttempt(current => current + 1) }}>Повторити</Button>}
    </Group></WorkbookSectionActions>
    {error && <Alert color="orange">{error}</Alert>}
    {value != null && !selected && <Alert color="orange">Збережений відбір груп некоректний. Оберіть групи з поточного списку.</Alert>}
  </Stack>
}
