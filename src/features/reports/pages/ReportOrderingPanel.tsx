import { Alert, Button, Group, Select, Stack, Text } from '@mantine/core'
import type { ReportDataset, ReportOrderRule, ReportRequestBody } from '../types'
import { readOrderingCapabilities, readReportOrdering, reportOrderingError, requestOrdering, setReportOrderRule } from '../data/reportOrdering'

const byOptions = [{ value: '1', label: 'За значенням поля' }, { value: '2', label: 'За точним підписом' }, { value: '3', label: 'За підсумком показника' }]
const directions = [{ value: '1', label: 'За зростанням' }, { value: '2', label: 'За спаданням' }]
const nullPositions = [{ value: '1', label: 'Порожні на початку' }, { value: '2', label: 'Порожні в кінці' }]
type Props = { data: ReportRequestBody; dataset?: ReportDataset; disabled: boolean; notice: string | null; onChange: (value: unknown) => void }

export function ReportOrderingPanel({ data, dataset, disabled, notice, onChange }: Props) {
  const raw = requestOrdering(data), ordering = readReportOrdering(raw), capability = readOrderingCapabilities(dataset)
  const error = reportOrderingError(data, dataset), invalidShape = raw != null && !ordering
  const activeMeasures = data.sorted.Measurements.filter(item => item.IsChecked)
  return <Stack component="section" aria-label="Сортування значень груп" gap="xs" p="sm">
    <Text fw={600}>Сортування значень груп</Text>
    <Text size="xs" c="dimmed">Сервер впорядковує цілі групи всередині їхнього рівня. Підсумок показника охоплює всю групу й усі значення протилежної осі. Різні валюти або одиниці не порівнюються.</Text>
    <Text size="xs" c="dimmed">Точний підпис включає надрукований [ID]. Значення поля впорядковує дати, числа та числові ID за їхнім значенням.</Text>
    {error ? <Alert color="red">{error}</Alert> : null}
    {notice ? <Alert color="blue">{notice}</Alert> : null}
    {!capability ? <Text size="sm" c="dimmed">Сервер не надав підтримувані можливості сортування. Звіти без правил використовують звичайний порядок.</Text> : null}
    {raw != null ? <Button type="button" variant="subtle" color="gray" size="compact-sm" disabled={disabled}
      onClick={() => onChange(undefined)}>Очистити збережене сортування</Button> : null}
    {capability && !invalidShape ? ([['Rows', 'Row', 'Рядки'], ['Columns', 'Col', 'Стовпці']] as const).map(([ruleAxis, layoutAxis, title]) =>
      <Stack key={ruleAxis} gap="xs" aria-label={`Сортування: ${title}`}>
        {data.sorted[layoutAxis].map(group => {
          const allowed = capability.Groupings.find(field => field.Type === group.type)?.By ?? []
          const allowedSet = new Set(allowed)
          const rule = ordering?.[ruleAxis].find(item => item.Grouping === group.type), scope = `${title}: ${group.label}`
          const occupied = (ordering?.Rows.length ?? 0) + (ordering?.Columns.length ?? 0)
          const unavailable = disabled || !allowed.length || (!rule && occupied >= capability.MaximumRules)
          const set = (next: ReportOrderRule | null) => onChange(setReportOrderRule(raw, ruleAxis, group.type, next))
          const selectedMeasure = rule?.Measure == null ? null : dataset?.Measurements.find(field => field.Type === rule.Measure)
          const choices = activeMeasures.map(field => ({ value: String(field.Type), label: dataset?.Measurements.find(item => item.Type === field.Type)?.Name ?? field.Label ?? field.Name }))
          if (rule?.Measure != null && !choices.some(item => item.value === String(rule.Measure))) choices.push({ value: String(rule.Measure), label: `Вимкнений показник: ${selectedMeasure?.Name ?? `[${rule.Measure}]`}` })
          return <Group key={group.type} align="end" gap="xs">
            <Select label={`Сортування — ${scope}`} value={rule ? String(rule.By) : 'default'} allowDeselect={false} disabled={unavailable}
              data={[{ value: 'default', label: 'Звичайний порядок' }, ...byOptions.filter(option => allowedSet.has(Number(option.value) as 1 | 2 | 3))]}
              onChange={value => {
                if (value === 'default') { set(null); return }
                const By = Number(value) as 1 | 2 | 3
                if (!allowed.includes(By)) return
                const next: ReportOrderRule = { Grouping: group.type, By, Direction: rule?.Direction ?? 1, Nulls: rule?.Nulls ?? 2 }
                if (By === 3) next.Measure = rule?.By === 3 ? rule.Measure : activeMeasures[0]?.Type ?? null
                set(next)
              }} />
            {rule ? <>
              <Select label={`Напрямок — ${scope}`} data={directions} value={String(rule.Direction)} allowDeselect={false} disabled={disabled}
                onChange={value => { if (value === '1' || value === '2') set({ ...rule, Direction: Number(value) as 1 | 2 }) }} />
              <Select label={`Порожні значення — ${scope}`} data={nullPositions} value={String(rule.Nulls)} allowDeselect={false} disabled={disabled}
                onChange={value => { if (value === '1' || value === '2') set({ ...rule, Nulls: Number(value) as 1 | 2 }) }} />
              {rule.By === 3 ? <Select label={`Показник сортування — ${scope}`} data={choices} value={rule.Measure == null ? null : String(rule.Measure)}
                placeholder="Виберіть увімкнений показник" allowDeselect={false} disabled={disabled}
                onChange={value => { const measure = activeMeasures.find(item => String(item.Type) === value); if (measure) set({ ...rule, Measure: measure.Type }) }} /> : null}
            </> : null}
          </Group>
        })}
      </Stack>) : null}
  </Stack>
}
