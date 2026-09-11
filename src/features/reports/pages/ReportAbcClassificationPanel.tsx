import { Alert, Button, Group, NumberInput, Select, SimpleGrid, Stack, Text } from '@mantine/core'
import { useId } from 'react'
import type { ReportDataset, ReportRequestBody } from '../types'
import { defaultAbcClassification, readAbcCapabilities, readAbcDraft, reportAbcClassificationError, requestAbcClassification, type ReportAbcDraft } from '../data/reportAbcClassification'
import { ReportRankingPrerequisites } from './ReportRankingPrerequisites'
import { getRankingPrerequisites } from './reportRankingReadiness'
import { ReportRuleHelp } from './ReportRuleHelp'

type Props = {
  data: ReportRequestBody
  dataset?: ReportDataset
  disabled: boolean
  notice?: string | null
  onChange: (value: unknown) => void
  onConfigureGrouping?: () => void
  onConfigureMeasures?: () => void
}
export function ReportAbcClassificationPanel({ data, dataset, disabled, notice, onChange, onConfigureGrouping, onConfigureMeasures }: Props) {
  const reasonId = useId()
  const raw = requestAbcClassification(data), draft = readAbcDraft(raw), cap = readAbcCapabilities(dataset)
  const error = reportAbcClassificationError(data, dataset), initial = defaultAbcClassification(data, dataset)
  const prerequisites = getRankingPrerequisites('ABC', data, cap, disabled)
  return <Stack component="section" aria-label="ABC-класифікація" className="reports-constructor-rule-panel" gap="xs" p="sm">
    <Group className="reports-constructor-rule-header" justify="space-between" align="start" gap="xs">
      <Text component="h3" className="app-section-title" fw={600}>ABC-класифікація</Text>
      <AbcToggleButton active={raw != null} supported={!!cap} initial={initial} disabled={disabled}
        descriptionId={prerequisites.reasons ? reasonId : undefined} onChange={onChange} />
    </Group>
    <Text size="xs" c="dimmed">Ділить групи на A, B і C після TOP. Усі залишені факти й загальний підсумок зберігаються.</Text>
    {error ? <Alert color="red">{error}</Alert> : null}
    {notice ? <Text role="status" size="sm">{notice}</Text> : null}
    <ReportRankingPrerequisites kind="ABC" reasonId={reasonId} {...prerequisites} disabled={disabled}
      onConfigureGrouping={onConfigureGrouping} onConfigureMeasures={onConfigureMeasures} />
    {raw != null ? <Text size="xs" c="dimmed">Вимкнення ABC прибере його правило, поле «ABC-клас» і сортування лише цього поля. Інші налаштування залишаться.</Text>
      : cap ? <Text size="xs" c="dimmed">Увімкнення додасть поле «ABC-клас» першим у рядках; його порядок можна змінити кнопками групування.</Text> : null}
    {draft && cap && dataset ? <AbcFields data={data} dataset={dataset} disabled={disabled} value={draft} onChange={onChange} /> : null}
    <ReportRuleHelp title="Як працює ABC">
        <Text size="xs" c="dimmed">Сервер класифікує один початковий ключ рядків глобально, разом за всіма батьківськими групами й стовпцями, після TOP. Поле «ABC-клас» утворює групи A, B і C; усі залишені факти та загальний підсумок зберігаються. Окремі рядки підсумків A/B/C у файлі з’являються, лише коли «ABC-клас» стоїть першим у групуванні рядків.</Text>
        <Text size="xs" c="dimmed">Групи ранжуються від найбільшого показника, за рівності — за меншим ключем. Клас визначається накопиченою сумою до поточної групи: нижче межі A — клас A, нижче A+B — клас B, решта — C. Група може перетнути межу цілком; нульовий хвіст належить C.</Text>
        <Text size="xs" c="dimmed">Потрібні відомі невід’ємні суми груп і додатний загальний показник в одній підтвердженій валюті чи одиниці. За потреби звузьте відбір. ABC підтримує лише рядки; відбору за класом немає. Відсотки вводяться окремо, їхня сума має дорівнювати 100.</Text>
    </ReportRuleHelp>
  </Stack>
}

function AbcToggleButton({ active, supported, initial, disabled, descriptionId, onChange }: Pick<Props, 'disabled' | 'onChange'> & {
  active: boolean; supported: boolean; initial: ReturnType<typeof defaultAbcClassification>; descriptionId?: string
}) {
  if (!active && !supported) return null
  const toggle = () => {
    if (active) onChange(undefined)
    else if (initial) onChange(initial)
  }
  return <Button type="button" variant="default" size="compact-sm" disabled={disabled || (!active && !initial)}
    aria-describedby={active && !disabled ? undefined : descriptionId} onClick={toggle}>
    {active ? 'Вимкнути ABC-класифікацію' : 'Увімкнути ABC-класифікацію'}
  </Button>
}

function AbcFields({ data, dataset, value, disabled, onChange }: Props & { dataset: ReportDataset; value: ReportAbcDraft }) {
  const cap = readAbcCapabilities(dataset)!
  const allowedGroups = new Set(cap.GroupingTypes), allowedMeasures = new Set(cap.RankingMeasures)
  const rows = new Set(data.sorted.Row.map(field => field.type)), checked = new Set(data.sorted.Measurements.flatMap(field => field.IsChecked ? [field.Type] : []))
  const groups = dataset.Groupings.flatMap(field => allowedGroups.has(field.Type) && rows.has(field.Type) ? [{ value: String(field.Type), label: field.Name }] : [])
  const measures = dataset.Measurements.flatMap(field => allowedMeasures.has(field.Type) && checked.has(field.Type) ? [{ value: String(field.Type), label: field.Name }] : [])
  if (!groups.some(field => field.value === String(value.Grouping))) groups.push({ value: String(value.Grouping), label: `Поза рядками або недоступне: ${dataset.Groupings.find(field => field.Type === value.Grouping)?.Name ?? `[${value.Grouping}]`}` })
  if (!measures.some(field => field.value === String(value.Measure))) measures.push({ value: String(value.Measure), label: `Вимкнений або недоступний показник: ${dataset.Measurements.find(field => field.Type === value.Measure)?.Name ?? `[${value.Measure}]`}` })
  const change = (patch: Partial<ReportAbcDraft>) => onChange({ ...value, ...patch })
  return <SimpleGrid className="reports-constructor-rule-fields" cols={{ base: 1, sm: 2, lg: 3 }} spacing="xs" style={{ alignItems: 'end' }}>
    <Select label="Початковий ключ для ABC" data={groups} value={String(value.Grouping)} disabled={disabled} allowDeselect={false}
      onChange={item => { const type = Number(item); if (item !== null && rows.has(type) && allowedGroups.has(type)) change({ Grouping: type }) }} />
    <Select label="Показник для ABC" data={measures} value={String(value.Measure)} disabled={disabled} allowDeselect={false}
      onChange={item => { const type = Number(item); if (item !== null && checked.has(type) && allowedMeasures.has(type)) change({ Measure: type }) }} />
    {(['PercentA', 'PercentB', 'PercentC'] as const).map(key => <NumberInput key={key} label={`Частка ${key.at(-1)} для ABC, %`} value={value[key]} disabled={disabled}
      min={0} max={100} allowDecimal={false} clampBehavior="none" onChange={next => change({ [key]: next })} />)}
  </SimpleGrid>
}
