import { Alert, Button, Group, Select, SimpleGrid, Stack, Text } from '@mantine/core'
import { useId } from 'react'
import type { ReportDataset, ReportOrderRule, ReportRequestBody } from '../types'
import { readOrderingCapabilities, readReportOrdering, reportOrderingError, requestOrdering, setReportOrderRule } from '../data/reportOrdering'
import { REPORT_RULE_LOCK_REASON } from './reportRankingReadiness'
import { ReportRuleHelp } from './ReportRuleHelp'

const byOptions = [{ value: '1', label: 'За значенням поля' }, { value: '2', label: 'За точним підписом' }, { value: '3', label: 'За підсумком показника' }]
const directions = [{ value: '1', label: 'За зростанням' }, { value: '2', label: 'За спаданням' }]
const nullPositions = [{ value: '1', label: 'Порожні на початку' }, { value: '2', label: 'Порожні в кінці' }]
type Props = { data: ReportRequestBody; dataset?: ReportDataset; disabled: boolean; notice: string | null; onChange: (value: unknown) => void }

export function ReportOrderingPanel({ data, dataset, disabled, notice, onChange }: Props) {
  const reasonId = useId()
  const raw = requestOrdering(data), ordering = readReportOrdering(raw), capability = readOrderingCapabilities(dataset)
  const error = reportOrderingError(data, dataset), invalidShape = raw != null && !ordering
  const activeMeasures = data.sorted.Measurements.filter(item => item.IsChecked)
  const reason = orderingSetupReason(disabled, !!capability, data.sorted.Row.length + data.sorted.Col.length)
  return <Stack component="section" aria-label="Сортування значень груп" className="reports-constructor-rule-panel" gap="xs" p="sm">
    <Group className="reports-constructor-rule-header" justify="space-between" align="start" gap="xs">
      <Text component="h3" className="app-section-title" fw={600}>Сортування значень груп</Text>
      {raw != null ? <Button type="button" variant="default" size="compact-sm" disabled={disabled}
        aria-describedby={reason ? reasonId : undefined} onClick={() => onChange(undefined)}>Очистити збережене сортування</Button> : null}
    </Group>
    <Text size="xs" c="dimmed">Упорядковує цілі групи всередині їхнього рівня. Різні валюти або одиниці не порівнюються.</Text>
    {error ? <Alert color="red">{error}</Alert> : null}
    {notice ? <Text role="status" size="sm">{notice}</Text> : null}
    {reason ? <Text id={reasonId} size="xs" c="dimmed">{reason}</Text> : null}
    {capability && !invalidShape ? ([['Rows', 'Row', 'Рядки'], ['Columns', 'Col', 'Стовпці']] as const).map(([ruleAxis, layoutAxis, title]) =>
      <Stack key={ruleAxis} gap="xs" aria-label={`Сортування: ${title}`}>
        {data.sorted[layoutAxis].map(group => {
          const allowed = capability.Groupings.find(field => field.Type === group.type)?.By ?? []
          const allowedSet = new Set(allowed)
          const rule = ordering?.[ruleAxis].find(item => item.Grouping === group.type), scope = `${title}: ${group.label}`
          const occupied = (ordering?.Rows.length ?? 0) + (ordering?.Columns.length ?? 0)
          const unavailable = disabled || !allowed.length || (!rule && occupied >= capability.MaximumRules)
          const unavailableReason = orderingFieldReason(disabled, allowed.length, !!rule, occupied, capability.MaximumRules)
          const set = (next: ReportOrderRule | null) => onChange(setReportOrderRule(raw, ruleAxis, group.type, next))
          const selectedMeasure = rule?.Measure == null ? null : dataset?.Measurements.find(field => field.Type === rule.Measure)
          const choices = activeMeasures.map(field => ({ value: String(field.Type), label: dataset?.Measurements.find(item => item.Type === field.Type)?.Name ?? field.Label ?? field.Name }))
          if (rule?.Measure != null && !choices.some(item => item.value === String(rule.Measure))) choices.push({ value: String(rule.Measure), label: `Вимкнений показник: ${selectedMeasure?.Name ?? `[${rule.Measure}]`}` })
          return <SimpleGrid key={group.type} className="reports-constructor-rule-fields" cols={{ base: 1, sm: 2, lg: 4 }} spacing="xs" style={{ alignItems: 'end' }}>
            <Select label={`Сортування — ${scope}`} value={rule ? String(rule.By) : 'default'} allowDeselect={false} disabled={unavailable}
              description={unavailableReason}
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
                description={activeMeasures.length ? undefined : 'Спочатку увімкніть показник у налаштуваннях звіту.'}
                onChange={value => { const measure = activeMeasures.find(item => String(item.Type) === value); if (measure) set({ ...rule, Measure: measure.Type }) }} /> : null}
            </> : null}
          </SimpleGrid>
        })}
      </Stack>) : null}
    <ReportRuleHelp title="Як працює сортування">
      <Text size="xs" c="dimmed">Сервер впорядковує цілі групи всередині їхнього рівня. Підсумок показника охоплює всю групу й усі значення протилежної осі. Різні валюти або одиниці не порівнюються.</Text>
      <Text size="xs" c="dimmed">Точний підпис включає надрукований [ID]. Значення поля впорядковує дати, числа та числові ID за їхнім значенням.</Text>
      <Text size="xs" c="dimmed">Звіти без правил використовують звичайний порядок.</Text>
    </ReportRuleHelp>
  </Stack>
}

function orderingSetupReason(disabled: boolean, supported: boolean, groupCount: number) {
  if (disabled) return REPORT_RULE_LOCK_REASON
  if (!supported) return 'Для цього набору даних сервер не підтвердив підтримку сортування.'
  if (!groupCount) return 'Додайте поля до рядків або стовпців, щоб налаштувати порядок їхніх значень.'
  return null
}

function orderingFieldReason(disabled: boolean, allowedCount: number, hasRule: boolean, occupied: number, maximum: number) {
  if (disabled) return REPORT_RULE_LOCK_REASON
  if (!allowedCount) return 'Для цього поля сортування недоступне.'
  if (!hasRule && occupied >= maximum) return `Досягнуто межі ${maximum} правил. Приберіть одне правило, щоб додати інше.`
  return undefined
}
