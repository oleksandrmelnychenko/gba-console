import { Alert, Button, Loader, Select, Stack, Text } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { useMemo, useState } from 'react'
import type { ValuationAgreement } from '../api/reportsApi'
import { useValuationAgreementLookup } from '../hooks/useValuationAgreement'

type Props = {
  value: number | undefined
  agreement: ValuationAgreement | undefined
  validationError: string | null
  validating: boolean
  enabled: boolean
  disabled: boolean
  onChange: (id: number | undefined) => void
  onRetry: () => void
}

function pickerOptions(options: ValuationAgreement[], selected: ValuationAgreement | undefined, value: number | undefined) {
  const items = new Map(options.map(item => [item.Id, { value: String(item.Id), label: item.Name, disabled: false }]))
  if (value !== undefined) items.set(value, { value: String(value), label: selected?.Name ?? `Договір [${value}]`, disabled: !selected })
  return [...items.values()]
}

export function ValuationAgreementPicker({ value, agreement, validationError, validating, enabled, disabled, onChange, onRetry }: Props) {
  const [search, setSearch] = useState('')
  const [query] = useDebouncedValue(search, 300)
  const [retry, setRetry] = useState(0)
  const searchLookup = useValuationAgreementLookup(query, enabled, retry)
  const data = useMemo(() => pickerOptions(searchLookup.result?.items ?? [], agreement, value), [searchLookup.result, agreement, value])
  const error = validationError ?? (searchLookup.result?.failed ? 'Не вдалося завантажити договори для оцінки.' : null)
  const loading = searchLookup.loading || validating

  return <Stack gap={6} p="sm">
    <Select label="Договір для оцінки" placeholder="Виберіть договір клієнта" searchable clearable
      description="Ціновий сценарій: регулярна ціна EUR і режим ПДВ обраного договору для всіх відібраних залишків."
      data={data} value={value?.toString() ?? null} searchValue={search} onSearchChange={setSearch}
      filter={({ options: values }) => values} maxLength={120} disabled={!enabled || disabled}
      rightSection={loading ? <Loader size="xs" /> : undefined}
      nothingFoundMessage={loading ? 'Завантаження…' : 'Договір не знайдено'}
      onChange={next => { setSearch(''); onChange(next === null ? undefined : Number(next)) }} />
    <Text size="xs" c="dimmed">Обраний договір визначає оцінку, а не власника залишків. Для відсутніх чи неоднозначних цін сума залишиться порожньою.</Text>
    {error ? <Alert color="red" title="Договір оцінки">
      <Text size="sm">{error}</Text><Button mt="xs" size="xs" variant="light" disabled={!enabled || disabled}
        onClick={() => { setRetry(current => current + 1); onRetry() }}>Перевірити ще раз</Button>
    </Alert> : null}
  </Stack>
}
