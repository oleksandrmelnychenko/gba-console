import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Card, Group, Select, Stack, Text } from '@mantine/core'
import { getSettlementPeriodAgreements, getSettlementPeriodAvailability } from '../api/settlementPeriodApi'
import { isSettlementFamily, isSettlementWorld, readSettlementPeriodScope, validSettlementPeriodDays,
  type SettlementNativeFamily, type SettlementPeriodAgreement, type SettlementPeriodScope, type SettlementSourceWorld } from '../data/settlementPeriod'

const PAGE_SIZE = 30
const keyOf = (row: { AgreementId: string; AgreementNetUid: string }) => `${row.AgreementId}:${row.AgreementNetUid}`

export function SettlementPeriodAgreementPicker({ value, from, to, disabled, enabled, onChange }: {
  value: unknown
  from: string
  to: string
  disabled: boolean
  enabled: boolean
  onChange: (next: unknown) => void
}) {
  const draft = value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const world = isSettlementWorld(draft.SourceWorld) ? draft.SourceWorld : null
  const family = isSettlementFamily(draft.NativeFamily) ? draft.NativeFamily : null
  function choose(nextWorld: SettlementSourceWorld | null, nextFamily: SettlementNativeFamily | null) {
    // Changing either scope deliberately clears both exact identity fields; never rebind an ID across families/worlds.
    onChange({ Version: 1, CurrencyBasis: 'SettlementCurrency',
      ...(nextWorld ? { SourceWorld: nextWorld } : {}), ...(nextFamily ? { NativeFamily: nextFamily } : {}) })
  }
  return <Card className="app-section-card" withBorder radius="md" padding="md" style={{ minWidth: 0 }}>
    <Stack gap="xs">
      <Group grow align="start">
        <Select label="База обліку договору" placeholder="Оберіть базу" value={world}
          data={[{ value: 'Fenix', label: 'Fenix' }, { value: 'Amg', label: 'AMG' }]}
          disabled={disabled || !enabled} clearable onChange={next => choose(isSettlementWorld(next) ? next : null, family)} />
        <Select label="Тип договору" placeholder="Оберіть тип" value={family}
          data={[{ value: 'ClientAgreement', label: 'Договір контрагента' },
            { value: 'SupplyOrganizationAgreement', label: 'Договір організації постачальника' }]}
          disabled={disabled || !enabled} clearable onChange={next => choose(world, isSettlementFamily(next) ? next : null)} />
      </Group>
      {world && family ? <AgreementPage key={`${world}:${family}`} world={world} family={family}
        value={value} from={from} to={to} disabled={disabled} enabled={enabled} onChange={onChange} />
        : <Text size="sm" c="dimmed">Оберіть базу та тип договору для завантаження списку.</Text>}
      <Text size="xs" c="dimmed">Початок, надходження, витрати й кінець — у валюті взаєморозрахунків вибраного договору.
        Період включає обидві дати: до 31 завершеного дня Києва. Довідник не підтверджує покриття періоду.
        Управлінська валюта й FX недоступні; за неповних даних сервер не сформує звіт.</Text>
    </Stack>
  </Card>
}

function AgreementPage({ world, family, value, from, to, disabled, enabled, onChange }: {
  world: SettlementSourceWorld
  family: SettlementNativeFamily
  value: unknown
  from: string
  to: string
  disabled: boolean
  enabled: boolean
  onChange: (next: unknown) => void
}) {
  const [rows, setRows] = useState<SettlementPeriodAgreement[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const active = useRef<AbortController | null>(null)
  const selected = readSettlementPeriodScope(value)
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    active.current = controller
    void getSettlementPeriodAgreements(world, family, '0', PAGE_SIZE, controller.signal).then(page => {
      if (controller.signal.aborted) return
      setRows(page); setHasMore(page.length === PAGE_SIZE); setError(null)
    }).catch(() => {
      if (!controller.signal.aborted) setError('Не вдалося завантажити точні договори. Спробуйте ще раз.')
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [world, family, enabled, attempt])
  async function loadMore() {
    const last = rows.at(-1), controller = active.current
    if (!hasMore || !last || loading || disabled || !enabled || !controller || controller.signal.aborted) return
    setLoading(true)
    try {
      const page = await getSettlementPeriodAgreements(world, family, last.AgreementId, PAGE_SIZE, controller.signal)
      if (controller.signal.aborted) return
      setRows(current => [...current, ...page]); setHasMore(page.length === PAGE_SIZE); setError(null)
    } catch {
      if (!controller.signal.aborted) setError('Наступну сторінку договорів не отримано. Поточний вибір збережено.')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }
  const changed = selected && rows.some(row => row.AgreementId === selected.AgreementId && row.AgreementNetUid !== selected.AgreementNetUid)
  const options = rows.map(row => ({ value: keyOf(row), disabled: false,
    label: `${row.OrganizationName || 'Організація без назви'} · ${row.CounterpartyName || 'Контрагент без назви'} · ${row.AgreementName || 'Договір без назви'} · ${row.CurrencyCode} (${row.CurrencyName || 'Без назви'}) · ID ${row.AgreementId}` }))
  if (selected && !rows.some(row => keyOf(row) === keyOf(selected))) options.unshift({ value: keyOf(selected), disabled: true,
    label: `Збережений договір ID ${selected.AgreementId} · очікує перевірки сервером` })
  return <Stack gap="xs">
    <Select label="Договір і валюта взаєморозрахунків" placeholder={loading ? 'Завантаження договорів…' : 'Оберіть точний договір'}
      searchable clearable data={options} value={selected ? keyOf(selected) : null} disabled={disabled || !enabled}
      onChange={key => {
        const row = rows.find(item => keyOf(item) === key)
        onChange({ Version: 1, SourceWorld: world, NativeFamily: family, CurrencyBasis: 'SettlementCurrency',
          ...(row ? { AgreementId: row.AgreementId, AgreementNetUid: row.AgreementNetUid } : {}) })
      }} />
    <Group gap="xs">
      {hasMore ? <Button size="xs" variant="subtle" loading={loading} disabled={disabled || !enabled} onClick={() => void loadMore()}>Завантажити ще договори</Button> : null}
      {error ? <Button size="xs" variant="subtle" disabled={disabled || !enabled || loading}
        onClick={() => { setLoading(true); setAttempt(current => current + 1) }}>Повторити</Button> : null}
    </Group>
    {error ? <Alert color="orange">{error}</Alert> : null}
    {changed ? <Alert color="orange">Ідентичність збереженого договору змінилася. Оберіть його зі списку знову; старий вибір не замінюється автоматично.</Alert> : null}
    {selected && !changed ? <AvailabilityCheck key={`${keyOf(selected)}:${from}:${to}`} scope={selected}
      from={from} to={to} disabled={disabled || !enabled} /> : null}
  </Stack>
}

function AvailabilityCheck({ scope, from, to, disabled }: {
  scope: SettlementPeriodScope; from: string; to: string; disabled: boolean
}) {
  const [checking, setChecking] = useState(false)
  const [available, setAvailable] = useState<boolean | null>(null)
  const [error, setError] = useState(false)
  const active = useRef<AbortController | null>(null)
  useEffect(() => () => active.current?.abort(), [])
  if (!validSettlementPeriodDays(from, to))
    return <Text size="xs" c="dimmed">Для перевірки покриття оберіть завершений період до 31 дня.</Text>
  async function check() {
    if (checking || disabled) return
    active.current?.abort()
    const controller = new AbortController()
    active.current = controller
    setChecking(true); setAvailable(null); setError(false)
    try {
      const value = await getSettlementPeriodAvailability(scope, from, to, controller.signal)
      if (!controller.signal.aborted) setAvailable(value)
    } catch {
      if (!controller.signal.aborted) setError(true)
    } finally {
      if (!controller.signal.aborted) setChecking(false)
    }
  }
  return <Stack gap="xs">
    <Button size="xs" variant="light" loading={checking} disabled={disabled} onClick={() => void check()}>
      Перевірити покриття періоду
    </Button>
    {available === true ? <Alert color="green">Повна публікація доступна на момент перевірки. Під час формування звіт перевірить її знову.</Alert> : null}
    {available === false ? <Alert color="orange">Для цього договору й періоду немає повної чинної публікації. Потрібне штатне оновлення даних.</Alert> : null}
    {error ? <Alert color="orange">Стан покриття тимчасово недоступний. Спробуйте перевірити ще раз.</Alert> : null}
  </Stack>
}
