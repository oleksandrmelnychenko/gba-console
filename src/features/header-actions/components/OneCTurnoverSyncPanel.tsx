import { Alert, Button, Checkbox, Group, MultiSelect, Select, Stack, Text } from '@mantine/core'
import { useEffect, useState } from 'react'
import { getOneCTurnoverSyncCatalog } from '../api/syncApi'
import { validateOneCTurnoverSync } from '../oneCTurnoverSyncForm'
import type { SyncDateRange, SyncMode, SyncSource } from '../syncSessionForm'
import type { OneCTurnoverSyncCatalog, OneCTurnoverSyncFilters } from '../types'

type Props = {
  range: SyncDateRange
  types: string[]
  today: string
  blocked: boolean
  loading: boolean
  onRun: (filters: OneCTurnoverSyncFilters) => Promise<void>
  visible?: boolean
  mode?: SyncMode
  source?: SyncSource
}

export function OneCTurnoverSyncPanel(props: Props) {
  const [enabled, setEnabled] = useState(false)
  if (props.visible === false || props.mode === 'full' || props.source === 'amg') return null
  return <Stack gap="xs">
    <Checkbox label="Звітні рухи 1С — окремий запуск Fenix" checked={enabled}
      disabled={props.loading} onChange={(event) => setEnabled(event.currentTarget.checked)} />
    {enabled ? <TurnoverConfiguration {...props} /> : null}
  </Stack>
}

function TurnoverConfiguration({ range, types, today, blocked, loading, onRun }: Props) {
  const [catalog, setCatalog] = useState<OneCTurnoverSyncCatalog | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [confirming, setConfirming] = useState(false)
  const [filters, setFilters] = useState<OneCTurnoverSyncFilters>({
    oneCOrganizationIds: [], oneCProductKindId: '', oneCExcludeServices: true,
  })
  useEffect(() => {
    const controller = new AbortController()
    void getOneCTurnoverSyncCatalog(controller.signal).then((result) => {
      if (!controller.signal.aborted) setCatalog(result)
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Не вдалося завантажити довідники Fenix')
    })
    return () => controller.abort()
  }, [attempt])

  const validation = validateOneCTurnoverSync(range, types, filters, catalog, today)
  function updateFilters(next: OneCTurnoverSyncFilters) {
    setConfirming(false)
    setFilters(next)
  }
  async function confirm() {
    if (blocked || validation) return
    setConfirming(false)
    await onRun(filters)
  }
  return <Stack gap="xs">
    <Text size="xs" c="dimmed">Окремо: вибрані документи → звітні рухи й повернення Fenix. Режим DocumentsOnly, без перебудови поточних залишків і балансів. Звичайна сесія вище не змінюється.</Text>
    {error ? <Alert color="red" title="Довідники недоступні">
      {error}<Button variant="subtle" size="xs" onClick={() => { setError(''); setAttempt((value) => value + 1) }}>Повторити</Button>
    </Alert> : null}
    {!catalog && !error ? <Text role="status" size="xs">Завантаження довідників Fenix…</Text> : null}
    <MultiSelect label="Організації Fenix для звіту" searchable clearable maxValues={100}
      data={(catalog?.Organizations ?? []).map((item) => ({ value: item.Id, label: `${item.Name || 'Без назви'} · ${item.Id}` }))}
      value={filters.oneCOrganizationIds} disabled={!catalog || loading}
      onChange={(ids) => updateFilters({ ...filters, oneCOrganizationIds: ids })} />
    <Select label="Вид номенклатури Fenix" searchable clearable
      data={(catalog?.ProductKinds ?? []).map((item) => ({ value: item.Id, label: `${item.Name || 'Без назви'} · ${item.Id}` }))}
      value={filters.oneCProductKindId || null} disabled={!catalog || loading}
      onChange={(id) => updateFilters({ ...filters, oneCProductKindId: id ?? '' })} />
    <Checkbox label="Виключити позиції з ознакою послуги" checked={filters.oneCExcludeServices} disabled={loading}
      onChange={(event) => updateFilters({ ...filters, oneCExcludeServices: event.currentTarget.checked })} />
    <Text size="xs">Максимум 31 день. Відбори мають збігатися з відборами звіту; організації не вибираються автоматично.</Text>
    {validation ? <Text size="xs" c="dimmed">{validation}</Text> : null}
    {confirming ? <Alert title="Підтвердити окремий запуск">
      <Text size="sm">Fenix · {range.from} — {range.to} · організацій: {filters.oneCOrganizationIds.length} · типів документів: {types.length}. Документи + звітні рухи, без поточного стану.</Text>
      <Group mt="xs">
        <Button variant="subtle" disabled={loading} onClick={() => setConfirming(false)}>Скасувати</Button>
        <Button disabled={blocked || Boolean(validation)} loading={loading} onClick={() => void confirm()}>Підтвердити завантаження звітних рухів</Button>
      </Group>
    </Alert> : <Button variant="light" disabled={blocked || Boolean(validation)} loading={loading} onClick={() => setConfirming(true)}>Завантажити звітні рухи 1С</Button>}
  </Stack>
}
