import { Alert, MultiSelect, Select, Stack, Text } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { useEffect, useMemo, useState } from 'react'
import { searchDatasetReportValues } from '../api/reportsApi'
import { agreementPriceComparisonOptions, defaultAgreementPriceComparison, type AgreementPriceComparisonOptions } from '../data/agreementPriceComparison'
import type { ReportEntity } from '../types'

type Props = { value: unknown; disabled: boolean; onChange: (value: AgreementPriceComparisonOptions) => void }
type Option = { value: string; label: string }
const SOURCE = 31
const LIMIT = 25
const EMPTY_ITEMS: ReportEntity[] = []

function useLookup(field: number, enabled: boolean, search: string) {
  const [query] = useDebouncedValue(search.trim(), 300)
  const [result, setResult] = useState<{ key: string; items: ReportEntity[]; error: string | null } | null>(null)
  const key = `${field}:${query}`
  const active = enabled && (field !== 1 || query.length >= 2 || /^\d+$/.test(query))
  useEffect(() => {
    if (!active) return
    const controller = new AbortController()
    searchDatasetReportValues(SOURCE, field, { value: query, offset: 0, limit: LIMIT }, controller.signal)
      .then(items => { if (!controller.signal.aborted) setResult({ key, items, error: null }) })
      .catch(cause => { if (!controller.signal.aborted) setResult({ key, items: EMPTY_ITEMS,
        error: cause instanceof Error ? cause.message : 'Не вдалося завантажити довідник.' }) })
    return () => controller.abort()
  }, [active, field, key, query])
  return { items: active && result?.key === key ? result.items : EMPTY_ITEMS,
    error: active && result?.key === key ? result.error : null }
}

function mergeOptions(found: ReportEntity[], saved: Option[], selected: number[]): Option[] {
  const result = new Map(saved.map(item => [item.value, item]))
  for (const item of found) result.set(String(item.Id), { value: String(item.Id), label: String(item.Name) })
  for (const id of selected) if (!result.has(String(id))) result.set(String(id), { value: String(id), label: `ID ${id}` })
  return [...result.values()]
}

export default function AgreementPriceComparisonPanel({ value, disabled, onChange }: Props) {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value as Partial<AgreementPriceComparisonOptions> : {}
  const current = agreementPriceComparisonOptions(value) ?? {
    ...defaultAgreementPriceComparison(),
    baseClientAgreementId: Number.isSafeInteger(raw.baseClientAgreementId) ? raw.baseClientAgreementId! : 0,
    comparedClientAgreementId: Number.isSafeInteger(raw.comparedClientAgreementId) ? raw.comparedClientAgreementId! : 0,
    productIds: Array.isArray(raw.productIds) ? raw.productIds.filter(id => Number.isSafeInteger(id) && id > 0) : [],
  }
  const [baseSearch, setBaseSearch] = useState('')
  const [comparedSearch, setComparedSearch] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const base = useLookup(9, !disabled, baseSearch)
  const compared = useLookup(9, !disabled, comparedSearch)
  const products = useLookup(1, !disabled, productSearch)
  const [savedAgreements, setSavedAgreements] = useState<Option[]>([])
  const [savedProducts, setSavedProducts] = useState<Option[]>([])
  const baseOptions = useMemo(() => mergeOptions(base.items, savedAgreements, [current.baseClientAgreementId].filter(Boolean)),
    [base.items, current.baseClientAgreementId, savedAgreements])
  const comparedOptions = useMemo(() => mergeOptions(compared.items, savedAgreements, [current.comparedClientAgreementId].filter(Boolean)),
    [compared.items, current.comparedClientAgreementId, savedAgreements])
  const productOptions = useMemo(() => mergeOptions(products.items, savedProducts, current.productIds),
    [current.productIds, products.items, savedProducts])
  const chooseAgreement = (kind: 'baseClientAgreementId' | 'comparedClientAgreementId', id: string | null, options: Option[]) => {
    if (id) setSavedAgreements(currentOptions => mergeOptions([], [...currentOptions, ...options.filter(item => item.value === id)], [Number(id)]))
    onChange({ ...current, [kind]: id ? Number(id) : 0 })
    if (kind === 'baseClientAgreementId') setBaseSearch('')
    else setComparedSearch('')
  }
  const chooseProducts = (ids: string[]) => {
    if (ids.length > 2000) return
    setSavedProducts(currentOptions => mergeOptions([], [...currentOptions, ...productOptions.filter(item => ids.includes(item.value))], ids.map(Number)))
    onChange({ ...current, productIds: ids.map(Number) })
  }
  return <Stack gap="xs" p="sm">
    <Text fw={600}>Поточні ціни двох договорів</Text>
    <Text size="xs" c="dimmed">Порівняння з нашої SQL бази за двома точними договорами. Ціни товарів не підсумовуються.</Text>
    <Select label="Базовий договір клієнта" searchable clearable data={baseOptions} value={current.baseClientAgreementId > 0 ? String(current.baseClientAgreementId) : null}
      searchValue={baseSearch} onSearchChange={setBaseSearch} filter={({ options }) => options} maxLength={120}
      disabled={disabled} nothingFoundMessage="Договір не знайдено" onChange={id => chooseAgreement('baseClientAgreementId', id, baseOptions)} />
    <Select label="Договір для порівняння" searchable clearable data={comparedOptions} value={current.comparedClientAgreementId > 0 ? String(current.comparedClientAgreementId) : null}
      searchValue={comparedSearch} onSearchChange={setComparedSearch} filter={({ options }) => options} maxLength={120}
      disabled={disabled} nothingFoundMessage="Договір не знайдено" onChange={id => chooseAgreement('comparedClientAgreementId', id, comparedOptions)} />
    <MultiSelect label="Товари" description={`Вибрано ${current.productIds.length}. Пошук обмежено ${LIMIT} позиціями за запит; до 2 000 ID у запиті, максимум 1 000 активних у результаті.`}
      searchable clearable data={productOptions} value={current.productIds.map(String)} searchValue={productSearch}
      onSearchChange={setProductSearch} filter={({ options }) => options} maxLength={120} maxValues={2000}
      disabled={disabled} nothingFoundMessage={productSearch.length < 2 && !/^\d+$/.test(productSearch) ? 'Введіть щонайменше два символи' : 'Товар не знайдено'}
      onChange={chooseProducts} />
    {current.baseClientAgreementId > 0 && current.baseClientAgreementId === current.comparedClientAgreementId
      ? <Text size="xs" c="red">Оберіть два різні договори.</Text> : null}
    {[base.error, compared.error, products.error].filter((item): item is string => Boolean(item)).map((error, index) =>
      <Alert key={`${index}-${error}`} color="red">{error}</Alert>)}
  </Stack>
}
