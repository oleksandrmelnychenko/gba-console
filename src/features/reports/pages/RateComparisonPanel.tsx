import { Alert, Button, Card, Select, SimpleGrid, Stack, Text, TextInput } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { useEffect, useState } from 'react'
import { searchDatasetReportValues } from '../api/reportsApi'
import { CLIENT_COMPARISON_MAX_DATE, CLIENT_COMPARISON_MIN_DATE } from '../data/clientPeriodComparison'
import { defaultRateComparison, rateDefinitionId } from '../data/rateComparison'

type Props = { dataSource: number; value: unknown; disabled: boolean; onChange: (value: unknown) => void }
export default function RateComparisonPanel(props: Props) {
  return props.dataSource === 19 ? <RateSettings {...props} /> : null
}
function RateSettings({ value, disabled, onChange }: Props) {
  const draft = value && typeof value === 'object' ? value as Record<string, unknown> : defaultRateComparison()
  const kind = draft.RateKind === 'government' ? 'government' : 'commercial'
  return <Card className="app-section-card reports-rate-comparison-settings" withBorder radius="md" padding="md" style={{ minWidth: 0 }}>
    <Stack gap="sm" aria-label="Параметри історичних курсів">
      <Text fw={600}>Одна валютна пара, дві незалежні дати</Text>
      <Text size="sm">Оберіть точну серію комерційного або державного курсу. Напрям валютної пари має значення. Дати можуть збігатися або йти у зворотному порядку.</Text>
      <Select label="Тип курсу" data={[{ value: 'commercial', label: 'Комерційний' }, { value: 'government', label: 'Державний' }]}
        value={kind} allowDeselect={false} disabled={disabled} onChange={RateKind => onChange({ ...draft, RateKind, RateDefinitionId: '' })} />
      <RateDefinitionSelector key={`${kind}:${rateDefinitionId(draft.RateDefinitionId) ? 'selected' : 'empty'}`} kind={kind} value={rateDefinitionId(draft.RateDefinitionId) ? draft.RateDefinitionId : ''} disabled={disabled}
        onChange={RateDefinitionId => onChange({ ...draft, RateDefinitionId })} />
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <TextInput type="date" label="Курс: поточна дата" value={typeof draft.CurrentAsOf === 'string' ? draft.CurrentAsOf : ''} disabled={disabled}
          min={CLIENT_COMPARISON_MIN_DATE} max={CLIENT_COMPARISON_MAX_DATE} onChange={event => onChange({ ...draft, CurrentAsOf: event.currentTarget.value })} />
        <TextInput type="date" label="Курс: дата порівняння" value={typeof draft.PreviousAsOf === 'string' ? draft.PreviousAsOf : ''} disabled={disabled}
          min={CLIENT_COMPARISON_MIN_DATE} max={CLIENT_COMPARISON_MAX_DATE} onChange={event => onChange({ ...draft, PreviousAsOf: event.currentTarget.value })} />
      </SimpleGrid>
      <Text size="sm">На кожну дату сервер читає останній запис до завершення вибраного дня за календарем збережених даних. Цей календар не означає єдиний часовий пояс для всієї історії.</Text>
      <Alert color="blue">Відсутня історія залишається порожньою. Поточний курс її не замінює. Курси різних пар і серій не додаються та не усереднюються; ціни договорів і документів не перераховуються.</Alert>
      <Text size="sm">Зміна розраховується з повної точності обох курсів. Відомий попередній нуль дає 100%, включно з 0/0; невідома точка залишає зміну порожньою. Курс і різниця мають чотири десяткові знаки, відсоток — два.</Text>
    </Stack>
  </Card>
}
function RateDefinitionSelector({ kind, value, disabled, onChange }: { kind: 'commercial' | 'government'; value: string; disabled: boolean; onChange: (value: string) => void }) {
  const [selectedLabel, setSelectedLabel] = useState<{ value: string; label: string } | null>(null)
  const [query, setQuery] = useState('')
  const [debouncedQuery] = useDebouncedValue(query, 300)
  const [limit, setLimit] = useState(30)
  const [result, setResult] = useState<{ query: string; items: Array<{ value: string; label: string }> }>({ query: '', items: [] })
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    if (!disabled) void searchDatasetReportValues(19, kind === 'commercial' ? 39 : 40, { value: debouncedQuery, offset: 0, limit }, controller.signal)
      .then(items => { if (!controller.signal.aborted) {
        const options = items.map(item => ({ value: String(item.Id), label: String(item.Name) }))
        const selected = options.find(item => item.value === value)
        if (selected) setSelectedLabel(selected)
        setResult({ query: debouncedQuery, items: options }); setError(null)
      } })
      .catch((reason: unknown) => { if (!controller.signal.aborted) { setResult({ query: debouncedQuery, items: [] }); setError(reason instanceof Error ? reason.message : 'Не вдалося прочитати серії курсів.') } })
    return () => controller.abort()
  }, [debouncedQuery, disabled, kind, limit, value])
  const items = result.query === query ? result.items : []
  const options = value && !items.some(item => item.value === value) ? [selectedLabel?.value === value ? selectedLabel : { value, label: `Серія [${value}]` }, ...items] : items
  return <Stack gap="xs">
    <Select label="Валютна пара і серія" placeholder="Шукайте валюту або точний ідентифікатор" searchable clearable data={options} value={value || null}
      searchValue={query} onSearchChange={next => { setQuery(next); setLimit(30) }} onChange={next => { setSelectedLabel(options.find(item => item.value === next) ?? null); onChange(next ?? '') }} disabled={disabled}
      filter={({ options: available }) => available} nothingFoundMessage="Серій за цими умовами немає" error={error} />
    {items.length === limit && limit < 50 ? <Button variant="subtle" size="xs" disabled={disabled} onClick={() => setLimit(50)}>Показати до 50 серій</Button> : null}
  </Stack>
}
