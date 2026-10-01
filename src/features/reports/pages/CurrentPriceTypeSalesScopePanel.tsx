import { Alert, Checkbox, Loader, MultiSelect, Select, Stack, Text } from '@mantine/core'
import { useEffect, useState } from 'react'
import { getCurrentPriceTypeSalesScopeChoices, type CurrentPriceTypeSalesScopeChoices } from '../api/reportsApi'
import { EXACT_ONE_C_BUYER_ROOT_ID } from '../data/oneCTurnoverReport'
import { priceTypeSalesSourceId } from '../data/priceTypeSalesComparison'
import type { OneCTurnoverFilters, ReportEntity } from '../types'

type Props = {
  available: boolean
  disabled: boolean
  value: unknown
  onChange: (value: OneCTurnoverFilters) => void
}
type Option = { value: string; label: string }
type Result = { choices?: CurrentPriceTypeSalesScopeChoices; error?: string }

export default function CurrentPriceTypeSalesScopePanel({ available, disabled, value, onChange }: Props) {
  const result = useCurrentChoices(available && !disabled)
  const scope = scopeDraft(value)
  const organizations = optionsWithSaved(result?.choices?.Organizations ?? [], scope.OrganizationIds)
  const kinds = optionsWithSaved(result?.choices?.ProductKinds ?? [], [scope.ProductKindId])
  return <Stack gap="sm">
    <MultiSelect label="Організації поточних продажів" placeholder="Оберіть організації" searchable clearable
      disabled={disabled || !available} data={organizations} value={scope.OrganizationIds}
      rightSection={available && !disabled && !result ? <Loader size="xs" /> : undefined}
      onChange={OrganizationIds => onChange({ ...scope, OrganizationIds })} />
    <Select label="Вид товару поточних продажів" placeholder="Оберіть вид товару" searchable clearable
      disabled={disabled || !available} data={kinds} value={scope.ProductKindId || null}
      onChange={ProductKindId => onChange({ ...scope, ProductKindId: ProductKindId ?? '' })} />
    <Checkbox label="Виключити послуги" checked={scope.ExcludeServices} disabled={disabled}
      onChange={event => onChange({ ...scope, ExcludeServices: event.currentTarget.checked })} />
    <Text size="xs" c="dimmed">Покупці — поточна група «Покупці» та її підгрупи.</Text>
    {result?.error ? <Alert color="yellow">{result.error} Збережені відбори залишаються доступними.</Alert> : null}
    {!available ? <Alert color="yellow">Сервер ще не надає поточні довідники цього звіту. Збережені точні відбори можна використовувати.</Alert> : null}
    {result?.choices && kinds.length === 0 ? <Text size="sm" c="orange">Для вибору виду товару потрібна його прив’язка у нашій базі.</Text> : null}
  </Stack>
}

function useCurrentChoices(enabled: boolean) {
  const [result, setResult] = useState<Result | null>(null)
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    void getCurrentPriceTypeSalesScopeChoices(controller.signal)
      .then(choices => { if (!controller.signal.aborted) setResult({ choices }) })
      .catch(() => { if (!controller.signal.aborted) setResult({ error: 'Не вдалося завантажити поточні відбори продажів.' }) })
    return () => controller.abort()
  }, [enabled])
  return result
}

function scopeDraft(raw: unknown): OneCTurnoverFilters {
  const item = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  return {
    OrganizationIds: Array.isArray(item.OrganizationIds) ? item.OrganizationIds.flatMap(id => {
      const exact = priceTypeSalesSourceId(id)
      return exact ? [exact] : []
    }) : [],
    ProductKindId: priceTypeSalesSourceId(item.ProductKindId) ?? '',
    ExcludeServices: typeof item.ExcludeServices === 'boolean' ? item.ExcludeServices : true,
    BuyerRootId: typeof item.BuyerRootId === 'string' ? item.BuyerRootId : EXACT_ONE_C_BUYER_ROOT_ID,
  }
}

function optionsWithSaved(items: ReportEntity[], saved: string[]): Option[] {
  const options = items.flatMap(item => {
    const exact = priceTypeSalesSourceId(item.Id)
    return exact ? [{ value: exact, label: item.Name ?? `[${exact}]` }] : []
  })
  for (const value of saved) if (value && !options.some(option => option.value === value))
    options.push({ value, label: `[${value}]` })
  return options
}
