import { Select, SimpleGrid, Stack, Text } from '@mantine/core'
import type { ReportDataset } from '../types'
import { numberPrecisionKinds, numberPresentationSupported, readNumberPresentation, readValueSemantics, type ReportNumberPresentation } from '../data/reportNumberPresentation'
const labels = { money: 'Грошові суми', quantity: 'Кількість', percent: 'Відсотки', unitPrice: 'Ціна за одиницю', rate: 'Курси' }
export function ReportNumberPresentationPanel({ value, dataset, disabled, onChange }: {
  value: unknown; dataset?: ReportDataset; disabled: boolean; onChange: (value: ReportNumberPresentation | undefined) => void
}) {
  const presentation = readNumberPresentation(value)
  const supported = numberPresentationSupported(dataset)
  const kinds = new Set(dataset?.Measurements.map(field => readValueSemantics(field.valueSemantics)?.kind))
  return <Stack gap="sm">
    <Select label="Формат чисел" value={value == null ? 'legacy' : 'custom'} disabled={disabled || !supported}
      data={[{ value: 'legacy', label: 'Як у звіті' }, { value: 'custom', label: 'Налаштувати' }]}
      onChange={next => onChange(next === 'custom' ? { version: 1, moneyScale: 1 } : undefined)} allowDeselect={false} />
    {!supported ? <Text size="xs" c="dimmed">Налаштування чисел недоступні на цьому сервері.</Text> : null}
    {presentation ? <>
      <Select label="Масштаб грошових сум" value={String(presentation.moneyScale)} disabled={disabled}
        data={[{ value: '1', label: 'Одиниці' }, { value: '1000', label: 'Тисячі (тис.)' }, { value: '1000000', label: 'Мільйони (млн.)' }]}
        onChange={next => { if (next) onChange({ ...presentation, moneyScale: Number(next) as 1 | 1000 | 1000000 }) }} allowDeselect={false} />
      <SimpleGrid cols={{ base: 1, sm: 2 }}>{numberPrecisionKinds.filter(kind => kinds.has(kind)).map(kind =>
        <Select key={kind} label={`${labels[kind]}: знаки після коми`} value={String(presentation.decimalPlacesByKind?.[kind] ?? 'default')}
          disabled={disabled} allowDeselect={false} data={[{ value: 'default', label: 'Як у звіті' }, ...Array.from({ length: 7 }, (_, index) => ({ value: String(index), label: String(index) }))]}
          onChange={next => {
            const places = { ...presentation.decimalPlacesByKind }
            if (next === 'default') delete places[kind]
            else if (next !== null) places[kind] = Number(next)
            onChange({ ...presentation, decimalPlacesByKind: places })
          }} />)}</SimpleGrid>
      <Text size="xs" c="dimmed">Масштаб змінює лише грошові суми. Ціни, кількість, курси й відсотки зберігають свої одиниці; цілі лічильники не мають дробової частини.</Text>
    </> : null}
  </Stack>
}
