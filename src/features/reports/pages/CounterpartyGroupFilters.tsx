import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Group, MultiSelect, Stack, Text } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { getSettlementCounterpartyGroups } from '../api/counterpartyGroupsApi'
import { changeCounterpartyGroupList, sourceCounterpartyGroups, type CounterpartyGroupChoice } from '../data/sourceCounterpartyGroups'

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
  for (const id of selectedIds) if (!options.has(id.toUpperCase()))
    options.set(id.toUpperCase(), { value: id.toUpperCase(), label: `Збережена група [${id.toUpperCase()}]` })
  const count = selectedIds.length
  return <Stack gap="xs">
    {(['IncludeGroupIds', 'ExcludeGroupIds'] as const).map(list => <MultiSelect key={list}
      label={list === 'IncludeGroupIds' ? 'Включити групи контрагентів (Fenix)' : 'Виключити групи контрагентів (Fenix)'}
      data={[...options.values()]} value={selected?.[list].map(id => id.toUpperCase()) ?? []}
      disabled={disabled} searchable clearable searchValue={search}
      maxValues={64 - count + (selected?.[list].length ?? 0)}
      onSearchChange={next => { const text = next.slice(0, 120); if (text !== search) { setSearch(text); setLoading(true) } }}
      filter={({ options: items }) => items}
      onChange={ids => onChange(changeCounterpartyGroupList(value, list, ids))} />)}
    <Group gap="xs">
      {hasMore && <Button size="xs" variant="subtle" disabled={disabled} loading={loading} onClick={() => void loadMore()}>Завантажити ще групи</Button>}
      {error && <Button size="xs" variant="subtle" disabled={disabled || loading}
        onClick={() => { setLoading(true); setAttempt(current => current + 1) }}>Повторити</Button>}
    </Group>
    {error && <Alert color="orange">{error}</Alert>}
    {value != null && !selected && <Alert color="orange">Збережений відбір груп некоректний. Оберіть групи з поточного списку.</Alert>}
    <Text size="xs" c="dimmed">Включення охоплює будь-яку вибрану групу та її підгрупи; виключення має пріоритет.
      Порожній список включення не звужує вибір. Невідома належність до групи залишає рядок і залежні підсумки з порожніми сумами.</Text>
  </Stack>
}
