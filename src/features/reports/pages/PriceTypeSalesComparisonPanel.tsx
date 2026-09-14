import { Alert, Card, Loader, Select, Stack, Text } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { useEffect, useState } from 'react'
import { getOneCTurnoverScopes, searchDatasetReportValues } from '../api/reportsApi'
import {
  defaultPriceTypeSalesComparison,
  PRICE_TYPE_SALES_COMPARISON_LOOKUP_FIELD,
  PRICE_TYPE_SALES_COMPARISON_SOURCE,
  priceTypeSalesSourceId,
} from '../data/priceTypeSalesComparison'
import { EXACT_ONE_C_BUYER_ROOT_ID } from '../data/oneCTurnoverReport'
import type { OneCTurnoverFilters, OneCTurnoverScopeSummary } from '../types'

type Props = {
  dataSource: number
  disabled: boolean
  scope: unknown
  value: unknown
  onChange: (value: unknown) => void
  onScopeChange: (value: OneCTurnoverFilters | undefined) => void
}

type SelectOption = { value: string; label: string }
type LookupResult<T> = { items: T[]; error: string | null }

const LOOKUP_LIMIT = 30

export default function PriceTypeSalesComparisonPanel(props: Props) {
  return props.dataSource === PRICE_TYPE_SALES_COMPARISON_SOURCE ? <PriceTypeSalesSettings {...props} /> : null
}

function PriceTypeSalesSettings({ disabled, scope, value, onChange, onScopeChange }: Props) {
  const draft = settingsDraft(value)
  const priceTypeId = priceTypeSalesSourceId(draft.PriceTypeId) ?? ''
  const [query, setQuery] = useState('')
  const [selectedPriceType, setSelectedPriceType] = useState<SelectOption | null>(null)
  const priceTypes = usePriceTypeLookup(disabled, query, priceTypeId, setSelectedPriceType)
  const scopes = useFenixScopeLookup(disabled)
  const scopeValue = selectedScopeKey(scopes.items, scope)
  const scopeOptions = scopes.items.map(item => ({ value: item.Key, label: scopeLabel(item) }))
  const priceTypeOptions = mergeSelectedPriceType(priceTypes.items, selectedPriceType, priceTypeId)

  return <Card className="app-section-card reports-price-type-sales-settings" withBorder radius="md" padding="md" style={{ minWidth: 0 }}>
    <Stack gap="sm" aria-label="Параметри порівняння продажів за типом цін">
      <Text fw={600}>Продажі Fenix за глобальним типом ціни</Text>
      <Select label="Локальне покриття Fenix" placeholder="Оберіть завантажений exact scope" searchable clearable
        data={scopeOptions} value={scopeValue} disabled={disabled} filter={({ options }) => options}
        rightSection={scopes.loading ? <Loader size="xs" /> : undefined}
        nothingFoundMessage={scopes.loading ? 'Завантаження…' : 'Сумісного покриття не знайдено'} error={scopes.error}
        onChange={key => onScopeChange(key ? structuredClone(scopes.items.find(item => item.Key === key)?.Filters) : undefined)} />
      <Select label="Глобальний тип ціни Fenix" placeholder="Шукайте назву або точний 32-hex ID" searchable clearable
        data={priceTypeOptions} value={priceTypeId || null} searchValue={query} disabled={disabled}
        filter={({ options }) => options} maxLength={120}
        rightSection={priceTypes.loading ? <Loader size="xs" /> : undefined}
        nothingFoundMessage={priceTypes.loading ? 'Завантаження…' : 'Тип ціни не знайдено'} error={priceTypes.error}
        onSearchChange={setQuery}
        onChange={next => {
          const exact = priceTypeSalesSourceId(next)
          setSelectedPriceType(priceTypeOptions.find(item => item.value === next) ?? null)
          setQuery('')
          onChange({ ...draft, Version: 1, SourceWorld: 1, PriceTypeId: exact ?? '' })
        }} />
      <Text size="sm">Джерело налаштувань — Fenix (Version 1). Внутрішній добір для кожного дня бере останню точну ціну типу на товар і характеристику; зовнішнє приєднання до джерельних продажів свідомо не включає день, як у захопленому запиті 1С.</Text>
      <Alert color="yellow" title="Лише порівняльний звіт">
        Глобальний тип ціни не є ціною договору клієнта. Цей звіт не формує договірних рекомендацій і ніколи не підставляє ціну договору, якщо глобальної ціни немає.
      </Alert>
      <Text size="xs" c="dimmed">Покриття native_partial залежить від свіжості локальної синхронізації. Збіги ціни за різні дні можуть повторити джерельний продаж; рядки без підтвердженої ціни не додаються до суми за типом ціни та різниці, а якщо ціни немає в усій групі, ці підсумки залишаються порожніми.</Text>
    </Stack>
  </Card>
}

function usePriceTypeLookup(disabled: boolean, query: string, priceTypeId: string,
  setSelectedPriceType: (value: SelectOption | null) => void): LookupResult<SelectOption> & { loading: boolean } {
  const [debouncedQuery] = useDebouncedValue(query, 300)
  const [result, setResult] = useState<(LookupResult<SelectOption> & { key: string }) | null>(null)
  useEffect(() => {
    if (disabled) return
    const controller = new AbortController()
    void searchDatasetReportValues(PRICE_TYPE_SALES_COMPARISON_SOURCE, PRICE_TYPE_SALES_COMPARISON_LOOKUP_FIELD,
      { value: debouncedQuery, offset: 0, limit: LOOKUP_LIMIT }, controller.signal)
      .then(items => {
        if (controller.signal.aborted) return
        const options = items.flatMap(item => {
          const exact = priceTypeSalesSourceId(item.Id)
          return exact ? [{ value: exact, label: String(item.Name) }] : []
        })
        const selected = options.find(item => item.value === priceTypeId)
        if (selected) setSelectedPriceType(selected)
        setResult({ key: debouncedQuery, items: options, error: null })
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setResult({ key: debouncedQuery, items: [], error: reason instanceof Error ? reason.message : 'Не вдалося завантажити глобальні типи цін Fenix.' })
      })
    return () => controller.abort()
  }, [debouncedQuery, disabled, priceTypeId, setSelectedPriceType])
  const current = result?.key === debouncedQuery ? result : null
  return { items: current?.items ?? [], error: current?.error ?? null, loading: !disabled && current === null }
}

function useFenixScopeLookup(disabled: boolean): LookupResult<OneCTurnoverScopeSummary> & { loading: boolean } {
  const [result, setResult] = useState<LookupResult<OneCTurnoverScopeSummary> | null>(null)
  useEffect(() => {
    if (disabled) return
    const controller = new AbortController()
    void getOneCTurnoverScopes(controller.signal)
      .then(items => {
        if (controller.signal.aborted) return
        setResult({ items: items.filter(item => item.Filters.BuyerRootId?.toUpperCase() === EXACT_ONE_C_BUYER_ROOT_ID), error: null })
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setResult({ items: [], error: 'Не вдалося завантажити локальне покриття Fenix для звіту.' })
      })
    return () => controller.abort()
  }, [disabled])
  return { items: result?.items ?? [], error: result?.error ?? null, loading: !disabled && result === null }
}

function settingsDraft(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : defaultPriceTypeSalesComparison()
}

function selectedScopeKey(scopes: OneCTurnoverScopeSummary[], scope: unknown): string | null {
  if (!scope || typeof scope !== 'object') return null
  return scopes.find(item => scopeMatches(item.Filters, scope))?.Key ?? null
}

function mergeSelectedPriceType(items: SelectOption[], selected: SelectOption | null, priceTypeId: string): SelectOption[] {
  if (!priceTypeId || items.some(item => item.value === priceTypeId)) return items
  return [selected?.value === priceTypeId ? selected : { value: priceTypeId, label: `Глобальний тип ціни [${priceTypeId}]` }, ...items]
}

function scopeLabel(scope: OneCTurnoverScopeSummary): string {
  const organizations = scope.OrganizationNames.length ? scope.OrganizationNames.join(', ') : `${scope.Filters.OrganizationIds.length} організацій`
  return `${organizations} · ${scope.FirstDay} — ${scope.LastDay}`
}

function scopeMatches(candidate: OneCTurnoverFilters, value: object): boolean {
  const selected = value as Partial<OneCTurnoverFilters>
  const ids = (items: unknown) => Array.isArray(items)
    ? items.filter((item): item is string => typeof item === 'string').map(item => item.toUpperCase()).toSorted()
    : []
  return JSON.stringify(ids(candidate.OrganizationIds)) === JSON.stringify(ids(selected.OrganizationIds))
    && candidate.ProductKindId.toUpperCase() === selected.ProductKindId?.toUpperCase()
    && candidate.ExcludeServices === selected.ExcludeServices
    && candidate.BuyerRootId?.toUpperCase() === selected.BuyerRootId?.toUpperCase()
}
