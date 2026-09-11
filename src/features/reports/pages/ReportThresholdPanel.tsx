import { Alert, Button, Group, NumberInput, Select, SimpleGrid, Stack, Text } from '@mantine/core'
import { useId } from 'react'
import type { ReportDataset, ReportRequestBody, ReportThresholdCapabilities } from '../types'
import { ABC_CLASS_GROUPING } from '../data/reportAbcClassification'
import { defaultReportThreshold, readThresholdCapabilities, readThresholdDraft, reportThresholdError, requestThreshold, type ReportThresholdDraft } from '../data/reportThreshold'
import { REPORT_RULE_LOCK_REASON } from './reportRankingReadiness'
import { ReportRuleHelp } from './ReportRuleHelp'

type Props = { data: ReportRequestBody; dataset?: ReportDataset; disabled: boolean; onChange: (value: unknown) => void }
export function ReportThresholdPanel({ data, dataset, disabled, onChange }: Props) {
  const reasonId = useId()
  const raw = requestThreshold(data), draft = readThresholdDraft(raw), cap = readThresholdCapabilities(dataset)
  const error = reportThresholdError(data, dataset), initial = defaultReportThreshold(data, dataset)
  const setupReason = !initial ? thresholdSetupReason(data, cap) : null
  const reason = disabled ? REPORT_RULE_LOCK_REASON : raw == null ? setupReason : null
  return <Stack component="section" aria-label="Поріг групування" className="reports-constructor-rule-panel" gap="xs" p="sm">
    <Group className="reports-constructor-rule-header" justify="space-between" align="start" gap="xs">
      <Text component="h3" className="app-section-title" fw={600}>Поріг групування</Text>
      <ThresholdToggleButton active={raw != null} supported={!!cap} initial={initial} disabled={disabled}
        descriptionId={reason ? reasonId : undefined} onChange={onChange} />
    </Group>
    <Text size="xs" c="dimmed">Об’єднує групи з малою часткою суми в «Інше (поріг)». Усі факти після TOP залишаються в підсумку.</Text>
    {error ? <Alert color="red">{error}</Alert> : null}
    {reason ? <Text id={reasonId} size="xs" c="dimmed">{reason}</Text> : null}
    {draft && cap && dataset ? <ThresholdFields data={data} dataset={dataset} disabled={disabled} value={draft} onChange={onChange} /> : null}
    <ReportRuleHelp title="Як працює поріг групування">
      <Text size="xs" c="dimmed">Сервер залишає окремо групи, частка яких у точній сумі показника не менша за поріг. Менші групи об’єднуються в «Інше (поріг)». Звичайні відбори діють перед TOP, потім застосовуються поріг, ABC та сортування. Усі факти після TOP залишаються в підсумку.</Text>
      <Text size="xs" c="dimmed">Потрібні одне початкове поле рядків, жодного поля стовпців і один увімкнений показник. ABC-клас можна додати окремо з тим самим ключем і показником. «Інше (поріг)» є синтетичною групою; відбору за нею немає. Звичайні відбори за товарами, договорами та іншими полями залишаються доступними.</Text>
      <Text size="xs" c="dimmed">Потрібні відомі невід’ємні суми в одній підтвердженій валюті чи одиниці та додатний загальний показник. Порожній звіт залишається порожнім. Об’єднання лише нульових груп сервер відхилить, щоб не втратити факти; за потреби звузьте відбір або вимкніть поріг.</Text>
      <Text size="xs" c="dimmed">Увімкнення порогу не змінює ваші поля автоматично.</Text>
    </ReportRuleHelp>
  </Stack>
}

function ThresholdToggleButton({ active, supported, initial, disabled, descriptionId, onChange }: Pick<Props, 'disabled' | 'onChange'> & {
  active: boolean; supported: boolean; initial: ReturnType<typeof defaultReportThreshold>; descriptionId?: string
}) {
  if (!active && !supported) return null
  const toggle = () => {
    if (active) onChange(undefined)
    else if (initial) onChange(initial)
  }
  return <Button type="button" variant="default" size="compact-sm" disabled={disabled || (!active && !initial)}
    aria-describedby={descriptionId} onClick={toggle}>
    {active ? 'Вимкнути поріг: показати початкові групи' : 'Увімкнути поріг групування'}
  </Button>
}

function thresholdSetupReason(data: ReportRequestBody, cap: ReportThresholdCapabilities | null) {
  if (!cap) return 'Для цього набору даних сервер не підтвердив підтримку порогу групування.'
  const rows = data.sorted.Row.filter(field => field.type !== ABC_CLASS_GROUPING)
  const measures = data.sorted.Measurements.filter(field => field.IsChecked)
  if (rows.length !== 1 || !new Set(cap.GroupingTypes).has(rows[0].type)) return 'Залиште в рядках одне початкове поле, для якого доступний поріг. ABC-клас можна додати окремо.'
  if (data.sorted.Col.length) return 'Для порогу приберіть поля зі стовпців.'
  if (measures.length !== 1 || !new Set(cap.RankingMeasures).has(measures[0].Type)) return 'Для порогу залиште один увімкнений показник, який сервер дозволяє підсумовувати.'
  return null
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
  return <SimpleGrid className="reports-constructor-rule-fields" cols={{ base: 1, sm: 2, lg: 3 }} spacing="xs" style={{ alignItems: 'end' }}>
    <Select label="Поле рядків для порогу" data={groups} value={String(value.Grouping)} disabled={disabled} allowDeselect={false}
      onChange={item => { const type = Number(item); if (item !== null && rows.has(type) && cap.GroupingTypes.includes(type)) change({ Grouping: type }) }} />
    <Select label="Показник для порогу" data={measures} value={String(value.Measure)} disabled={disabled} allowDeselect={false}
      onChange={item => { const type = Number(item); if (item !== null && checked.has(type) && cap.RankingMeasures.includes(type)) change({ Measure: type }) }} />
    <NumberInput label="Поріг частки суми, %" value={value.Percent} disabled={disabled} min={1} max={100} allowDecimal={false} clampBehavior="none" onChange={Percent => change({ Percent })} />
  </SimpleGrid>
}
