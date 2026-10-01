import { Alert, Button, Group, Loader, Select, Stack } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getCurrencyRateDynamicsDefinitions } from '../api/currencyRateDynamicsApi'
import { currencyRateDynamicsDefinitionLabel, type CurrencyRateDynamicsDefinition } from '../data/currencyRateDynamics'

const PAGE_SIZE = 25
type Page = { rows: CurrencyRateDynamicsDefinition[]; offset: number; hasMore: boolean; error: string | null; loadingMore: boolean }
export function CurrencyRateDynamicsRatePicker({ value, enabled, callerKey, onChange }: {
  value: CurrencyRateDynamicsDefinition | null; enabled: boolean; callerKey: string | null
  onChange: (definition: CurrencyRateDynamicsDefinition | null) => void
}) {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const selectedLabel = value ? currencyRateDynamicsDefinitionLabel(value) : ''
  // Mantine writes the selected label into its search input without a user search.
  const lookupSearch = search === selectedLabel ? '' : search
  const [query] = useDebouncedValue(lookupSearch, 300)
  const [attempt, setAttempt] = useState(0)
  const scope = useMemo(() => ({ enabled, callerKey, query, attempt }), [enabled, callerKey, query, attempt])
  const [load, setLoad] = useState<{ scope: typeof scope; page: Page } | null>(null)
  const active = useRef<AbortController | null>(null)
  useEffect(() => {
    const controller = new AbortController(); active.current = controller
    if (scope.enabled) void getCurrencyRateDynamicsDefinitions(scope.query, 0, PAGE_SIZE, controller.signal).then(rows => {
      if (!controller.signal.aborted) setLoad({ scope, page: { rows, offset: rows.length, hasMore: rows.length === PAGE_SIZE, error: null, loadingMore: false } })
    }).catch(() => {
      if (!controller.signal.aborted) setLoad({ scope, page: { rows: [], offset: 0, hasMore: false,
        error: 'Не вдалося завантажити валютні пари.', loadingMore: false } })
    })
    return () => controller.abort()
  }, [scope])
  const page = load?.scope === scope && lookupSearch === query ? load.page : null
  const options = new Map((page?.rows ?? []).map(row => [row.RateDefinitionId, row]))
  if (value) options.set(value.RateDefinitionId, value)

  async function loadMore() {
    const controller = active.current
    if (!page || !enabled || !page.hasMore || page.loadingMore || !controller || controller.signal.aborted) return
    setLoad({ scope, page: { ...page, loadingMore: true } })
    try {
      const rows = await getCurrencyRateDynamicsDefinitions(query, page.offset, PAGE_SIZE, controller.signal)
      if (!controller.signal.aborted) {
        const merged = new Map([...page.rows, ...rows].map(row => [row.RateDefinitionId, row]))
        const offset = page.offset + rows.length
        setLoad({ scope, page: { rows: [...merged.values()], offset,
          hasMore: rows.length === PAGE_SIZE && offset <= 10000, error: null, loadingMore: false } })
      }
    } catch {
      if (!controller.signal.aborted) setLoad({ scope, page: { ...page,
        error: 'Наступну сторінку валютних пар не отримано. Поточний вибір збережено.', loadingMore: false } })
    }
  }
  return <Stack gap="xs">
    <Select label={t('Валюта')} description={t('Комерційний курс; напрям валютної пари має значення.')}
      placeholder={t('Шукайте валюту або точну серію')} searchable clearable disabled={!enabled}
      value={value?.RateDefinitionId ?? null} data={[...options.values()].map(row => ({ value: row.RateDefinitionId,
        label: currencyRateDynamicsDefinitionLabel(row) }))} searchValue={search}
      onSearchChange={next => setSearch(next === selectedLabel ? next : next.slice(0, 120))} maxLength={120} filter={({ options: rows }) => rows}
      onChange={next => onChange(next ? options.get(next) ?? null : null)}
      nothingFoundMessage={t('Валютних пар за цими умовами немає')} />
    <Group gap="xs">
      {enabled && !page ? <Loader size="xs" aria-label={t('Завантаження валютних пар')} /> : null}
      {page?.hasMore ? <Button type="button" variant="subtle" size="xs" disabled={!enabled} loading={page.loadingMore}
        onClick={() => { void loadMore() }}>{t('Завантажити ще валютні пари')}</Button> : null}
      {page?.error ? <Button type="button" variant="subtle" size="xs" disabled={!enabled || page.loadingMore}
        onClick={() => setAttempt(current => current + 1)}>{t('Повторити')}</Button> : null}
    </Group>
    {page?.error ? <Alert color="yellow">{t(page.error)}</Alert> : null}
  </Stack>
}
