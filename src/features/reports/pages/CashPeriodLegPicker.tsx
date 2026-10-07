import { useEffect, useState } from 'react'
import { Alert, Button, Card, Group, Select, Stack, Text } from '@mantine/core'
import { getCashPeriodLegs } from '../api/cashPeriodApi'
import { readCashPeriodScope, type CashPeriodLeg, type CashPeriodScope } from '../data/cashPeriod'

const PAGE_SIZE = 30

export function CashPeriodLegPicker({ value, disabled, enabled, managementSupported = false, onChange }: {
  value: unknown
  disabled: boolean
  enabled: boolean
  managementSupported?: boolean
  onChange: (next: CashPeriodScope | undefined) => void
}) {
  const [legs, setLegs] = useState<CashPeriodLeg[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const selected = readCashPeriodScope(value)
  const managementSelected = selected ? selected.Version === 2 : managementSupported

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    void getCashPeriodLegs('0', PAGE_SIZE, controller.signal).then(page => {
      if (controller.signal.aborted) return
      setLegs(page)
      setHasMore(page.length === PAGE_SIZE)
      setError(null)
    }).catch(() => {
      if (!controller.signal.aborted) setError('Не вдалося завантажити точні валютні записи рахунків. Спробуйте ще раз.')
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [enabled, retry])

  const matching = legs.find(leg => leg.CurrencyRegisterId === selected?.CurrencyRegisterId)
  const changed = matching && selected && matching.CurrencyRegisterNetUid !== selected.CurrencyRegisterNetUid
  const options = legs.map(leg => ({ value: leg.CurrencyRegisterId,
    label: `${leg.OrganizationName || 'Організація без назви'} · ${leg.AccountName || 'Рахунок без назви'} · ${leg.CurrencyCode} (${leg.CurrencyName || 'Без назви'}) · ID ${leg.CurrencyRegisterId}` }))
  if (selected && !legs.some(leg => leg.CurrencyRegisterId === selected.CurrencyRegisterId))
    options.unshift({ value: selected.CurrencyRegisterId,
      label: `Збережений рахунок ID ${selected.CurrencyRegisterId} · очікує перевірки сервером` })

  async function loadMore() {
    const last = legs.at(-1)
    if (!hasMore || !last || loading || disabled) return
    setLoading(true)
    try {
      const page = await getCashPeriodLegs(last.CurrencyRegisterId, PAGE_SIZE)
      setLegs(current => [...current, ...page])
      setHasMore(page.length === PAGE_SIZE)
      setError(null)
    } catch {
      setError('Наступну сторінку рахунків не отримано. Поточний вибір збережено.')
    } finally {
      setLoading(false)
    }
  }

  return <Card className="app-section-card" withBorder radius="md" padding="md" style={{ minWidth: 0 }}>
    <Stack gap="xs">
      <Select label="Рахунок і власна валюта" placeholder="Оберіть точний валютний запис рахунку"
        searchable data={options} value={selected?.CurrencyRegisterId ?? null}
        disabled={disabled || !enabled} onChange={id => {
          const leg = legs.find(item => item.CurrencyRegisterId === id)
          if (!leg) { onChange(undefined); return }
          const identity = { CurrencyRegisterId: leg.CurrencyRegisterId, CurrencyRegisterNetUid: leg.CurrencyRegisterNetUid }
          onChange(managementSelected
            ? { ...identity, Version: 2, CurrencyBasis: 'AccountAndManagementCurrency' }
            : { ...identity, Version: 1, CurrencyBasis: 'AccountCurrency' })
        }} />
      {managementSupported ? <Select label="Валюти показників" allowDeselect={false}
        data={[{ value: 'both', label: 'Валюта рахунку та управлінська — 8 показників' },
          { value: 'account', label: 'Валюта рахунку — 4 показники' }]}
        value={managementSelected ? 'both' : 'account'} disabled={disabled || !enabled || !selected}
        onChange={mode => {
          if (!selected || (mode !== 'both' && mode !== 'account')) return
          const identity = { CurrencyRegisterId: selected.CurrencyRegisterId, CurrencyRegisterNetUid: selected.CurrencyRegisterNetUid }
          onChange(mode === 'both'
            ? { ...identity, Version: 2, CurrencyBasis: 'AccountAndManagementCurrency' }
            : { ...identity, Version: 1, CurrencyBasis: 'AccountCurrency' })
        }} /> : null}
      <Group gap="xs">
        {hasMore ? <Button size="xs" variant="subtle" loading={loading} disabled={disabled} onClick={() => void loadMore()}>
          Завантажити ще рахунки
        </Button> : null}
        {error ? <Button size="xs" variant="subtle" disabled={disabled || loading}
          onClick={() => { setLoading(true); setRetry(value => value + 1) }}>Повторити</Button> : null}
      </Group>
      {error ? <Alert color="orange">{error}</Alert> : null}
      {changed ? <Alert color="orange">Ідентичність цього рахунку змінилася. Оберіть його зі списку знову.</Alert> : null}
      <Text size="xs" c="dimmed">Початок, надходження, витрати та кінець показані у власній валюті рахунку.
        {managementSupported ? ' У режимі восьми показників поруч показані окремі записані управлінські суми; їхню валюту вказано в результаті.' : ''}
        Період включає обидві дати й має складатися із завершених днів Києва (до 31 дня).
        Сервер перевіряє повне покриття періоду та валюту обраних сум.</Text>
    </Stack>
  </Card>
}
