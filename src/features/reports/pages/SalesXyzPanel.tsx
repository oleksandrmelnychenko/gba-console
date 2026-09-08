import { Alert, NumberInput, Select, SimpleGrid, Stack, Text } from '@mantine/core'
import { defaultXyzOptions, XYZ_BOUND_KEYS, XYZ_MAXIMUM, XYZ_POLICIES } from '../data/salesXyz'

type Props = { value: unknown; disabled: boolean; onChange: (value: unknown) => void }
const labels = { XLower: 'X: нижня межа, % (не включно)', XUpper: 'X: верхня межа, % (включно)', YLower: 'Y: нижня межа, % (не включно)', YUpper: 'Y: верхня межа, % (включно)', ZLower: 'Z: нижня межа, % (не включно)', ZUpper: 'Z: верхня межа, % (включно)' }
const inputValue = (value: unknown): number | string => typeof value === 'number' || typeof value === 'string' ? value : ''
export default function SalesXyzPanel({ value, disabled, onChange }: Props) {
  const draft = value && typeof value === 'object' ? value as Record<string, unknown> : defaultXyzOptions()
  const bounds = draft.Bounds && typeof draft.Bounds === 'object' ? draft.Bounds as Record<string, unknown> : {}
  const change = (key: string, next: unknown) => onChange({ ...draft, [key]: next })
  return <Stack gap="sm" aria-label="Параметри XYZ">
    <Text fw={600}>Стабільність продажів за товарами</Text>
    <Select label="Календар XYZ" disabled={disabled} value={typeof draft.CalendarPolicy === 'string' ? draft.CalendarPolicy : null}
      data={[{ value: XYZ_POLICIES[0], label: 'Повні завершені місяці' }, { value: XYZ_POLICIES[1], label: 'Місяці у вибраному вікні' }]}
      allowDeselect={false} onChange={next => change('CalendarPolicy', next)} />
    <NumberInput label="Кількість періодів N" value={inputValue(draft.PeriodCount)} disabled={disabled} min={1} max={60} allowDecimal={false} clampBehavior="none" onChange={next => change('PeriodCount', next)} />
    <Text size="sm">{draft.CalendarPolicy === XYZ_POLICIES[0] ? 'Початок — перший день місяця, завершення — останній. Оберіть рівно N повністю завершених місяців перед поточним місяцем за Києвом.'
      : 'Початок — дата завершення мінус N місяців, потім один день. Якщо потрібного дня в місяці немає, береться його останній день. Кількість охоплених календарних місяців K може відрізнятися від N; середнє й дисперсія діляться на N.'}</Text>
    <SimpleGrid cols={{ base: 1, sm: 2 }}>
      {XYZ_BOUND_KEYS.map(key => <NumberInput key={key} label={labels[key]} value={inputValue(bounds[key])} disabled={disabled}
        min={-XYZ_MAXIMUM} max={XYZ_MAXIMUM} clampBehavior="none" decimalSeparator="," onChange={next => change('Bounds', { ...bounds, [key]: next })} />)}
    </SimpleGrid>
    <Text size="sm">Для кожного класу: коефіцієнт більший за нижню межу й не більший за верхню. Перевіряються X, потім Y, потім Z. Межі незалежні; проміжки, перетини та від’ємні значення не змінюються автоматично. Значення 0 з нижньою межею X=0 залишається без класу.</Text>
    <Alert color="blue">Основа — записані суми продажів у EUR. Коефіцієнт варіації округлюється до двох знаків перед визначенням класу й показується з трьома: 40,820 означає 40,82%. Середнє та коефіцієнт належать окремим товарам; у підсумках залишається лише сума продажів.</Alert>
  </Stack>
}
