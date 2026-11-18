import { Alert, Button, Group, NumberInput, Select, SimpleGrid, Stack, Text } from '@mantine/core'
import type { ReportDataset, ReportRequestBody } from '../types'
import { defaultReportThreshold, readThresholdCapabilities, readThresholdDraft, reportThresholdError, requestThreshold, type ReportThresholdDraft } from '../data/reportThreshold'

type Props = { data: ReportRequestBody; dataset?: ReportDataset; disabled: boolean; onChange: (value: unknown) => void }
export function ReportThresholdPanel({ data, dataset, disabled, onChange }: Props) {
  const raw = requestThreshold(data), draft = readThresholdDraft(raw), cap = readThresholdCapabilities(dataset)
  const error = reportThresholdError(data, dataset), initial = defaultReportThreshold(data, dataset)
  return <Stack component="section" aria-label="Поріг групування" className="reports-constructor-rule-panel" gap="xs" p="sm">
    <Group className="reports-constructor-rule-header" justify="space-between" align="start" gap="xs">
      <Text component="h3" className="app-section-title" fw={600}>Поріг групування</Text>
      <ThresholdToggleButton active={raw != null} supported={!!cap} initial={initial} disabled={disabled}
        onChange={onChange} />
    </Group>
    {error ? <Alert color="red">{error}</Alert> : null}
    {draft && cap && dataset ? <ThresholdFields data={data} dataset={dataset} disabled={disabled} value={draft} onChange={onChange} /> : null}
  </Stack>
}

function ThresholdToggleButton({ active, supported, initial, disabled, onChange }: Pick<Props, 'disabled' | 'onChange'> & {
  active: boolean; supported: boolean; initial: ReturnType<typeof defaultReportThreshold>
}) {
  if (!active && !supported) return null
  const toggle = () => {
    if (active) onChange(undefined)
    else if (initial) onChange(initial)
  }
  return <Button type="button" variant="default" size="compact-sm" disabled={disabled || (!active && !initial)}
    onClick={toggle}>
    {active ? 'Вимкнути поріг: показати початкові групи' : 'Увімкнути поріг групування'}
  </Button>
}

function ThresholdFields({ data, dataset, value, disabled, onChange }: Props & { dataset: ReportDataset; value: ReportThresholdDraft }) {
  const cap = readThresholdCapabilities(dataset)!
  const rows = new Set(data.sorted.Row.map(field => field.type)), checked = new Set(data.sorted.Measurements.flatMap(field => field.IsChecked ? [field.Type] : []))
  const allowedGroups = new Set(cap.GroupingTypes), allowedMeasures = new Set(cap.RankingMeasures)
  const groups = dataset.Groupings.flatMap(field => allowedGroups.has(field.Type) && rows.has(field.Type) ? [{ value: String(field.Type), label: field.Name }] : [])
  const measures = dataset.Measurements.flatMap(field => allowedMeasures.has(field.Type) && checked.has(field.Type) ? [{ value: String(field.Type), label: field.Name }] : [])
  if (!groups.some(field => field.value === String(value.Grouping))) groups.push({ value: String(value.Grouping), label: `Поза рядками або недоступне: ${dataset.Groupings.find(field => field.Type === value.Grouping)?.Name ?? `[${value.Grouping}]`}` })
  if (!measures.some(field => field.value === String(value.Measure))) measures.push({ value: String(value.Measure), label: `Вимкнений або недоступний показник: ${dataset.Measurements.find(field => field.Type === value.Measure)?.Name ?? `[${value.Measure}]`}` })
  const change = (patch: Partial<ReportThresholdDraft>) => onChange({ ...value, ...patch })
  return <SimpleGrid className="reports-constructor-rule-fields" type="container" cols={{ base: 1, '36em': 2, '54em': 3 }} spacing="xs" style={{ alignItems: 'end' }}>
    <Select label="Поле рядків для порогу" data={groups} value={String(value.Grouping)} disabled={disabled} allowDeselect={false}
      onChange={item => { const type = Number(item); if (item !== null && rows.has(type) && cap.GroupingTypes.includes(type)) change({ Grouping: type }) }} />
    <Select label="Показник для порогу" data={measures} value={String(value.Measure)} disabled={disabled} allowDeselect={false}
      onChange={item => { const type = Number(item); if (item !== null && checked.has(type) && cap.RankingMeasures.includes(type)) change({ Measure: type }) }} />
    <NumberInput label="Поріг частки суми, %" value={value.Percent} disabled={disabled} min={1} max={100} allowDecimal={false} clampBehavior="none" onChange={Percent => change({ Percent })} />
  </SimpleGrid>
}
