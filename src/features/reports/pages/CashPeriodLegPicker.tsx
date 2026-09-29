import { useEffect, useState } from 'react'
import { Alert, Button, Card, Group, Select, Stack, Text } from '@mantine/core'
import { getCashPeriodLegs } from '../api/cashPeriodApi'
import { readCashPeriodScope, type CashPeriodLeg, type CashPeriodScope } from '../data/cashPeriod'

const PAGE_SIZE = 30

export function CashPeriodLegPicker({ value, disabled, enabled, onChange }: {
  value: unknown
  disabled: boolean
  enabled: boolean
  onChange: (next: CashPeriodScope | undefined) => void
}) {
  const [legs, setLegs] = useState<CashPeriodLeg[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const selected = readCashPeriodScope(value)

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
          onChange(leg ? { Version: 1, CurrencyRegisterId: leg.CurrencyRegisterId,
            CurrencyRegisterNetUid: leg.CurrencyRegisterNetUid, CurrencyBasis: 'AccountCurrency' } : undefined)
        }} />
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
        Період включає обидві дати й має складатися із завершених днів Києва (до 31 дня).
        Конвертація FX та керівна валюта не застосовуються; сервер відхилить неповне покриття.</Text>
    </Stack>
  </Card>
}
