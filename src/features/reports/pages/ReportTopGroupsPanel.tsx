import { Alert, Button, Group, NumberInput, Select, SimpleGrid, Stack, Text } from '@mantine/core'
import { useId } from 'react'
import type { ReportDataset, ReportRequestBody, ReportTopGroupsCapabilities } from '../types'
import { defaultReportTopGroups, readTopGroupsCapabilities, readTopGroupsDraft, reportTopGroupsError, requestTopGroups, type ReportTopGroupsDraft } from '../data/reportTopGroups'
import { ReportRankingPrerequisites } from './ReportRankingPrerequisites'
import { getRankingPrerequisites } from './reportRankingReadiness'
import { ReportRuleHelp } from './ReportRuleHelp'

type Props = {
  data: ReportRequestBody
  dataset?: ReportDataset
  disabled: boolean
  onChange: (value: unknown) => void
  onConfigureGrouping?: () => void
  onConfigureMeasures?: () => void
}
const modes = [{ value: '1', label: 'Кількість груп' }, { value: '2', label: 'Відсоток кількості груп' }]
const directions = [{ value: '2', label: 'Найбільші значення' }, { value: '1', label: 'Найменші значення' }]

export function ReportTopGroupsPanel({ data, dataset, disabled, onChange, onConfigureGrouping, onConfigureMeasures }: Props) {
  const reasonId = useId()
  const raw = requestTopGroups(data), draft = readTopGroupsDraft(raw), cap = readTopGroupsCapabilities(dataset)
  const error = reportTopGroupsError(data, dataset), initial = defaultReportTopGroups(data, dataset)
  const prerequisites = getRankingPrerequisites('TOP', data, cap, disabled)
  return <Stack component="section" aria-label="TOP цілих груп" className="reports-constructor-rule-panel" gap="xs" p="sm">
    <Group className="reports-constructor-rule-header" justify="space-between" align="start" gap="xs">
      <Text component="h3" className="app-section-title" fw={600}>TOP цілих груп</Text>
      {raw != null ? <Button type="button" variant="default" size="compact-sm" disabled={disabled}
        aria-describedby={disabled ? reasonId : undefined} onClick={() => onChange(undefined)}>Вимкнути TOP: залишити всі групи</Button> : cap ?
        <Button type="button" variant="default" size="compact-sm" disabled={disabled || !initial}
          aria-describedby={prerequisites.reasons ? reasonId : undefined} onClick={() => { if (initial) onChange(initial) }}>Увімкнути TOP цілих груп</Button> : null}
    </Group>
    <Text size="xs" c="dimmed">Залишає цілі групи рядків за одним показником. Підсумки рахуються лише за відібраними групами.</Text>
    {error ? <Alert color="red">{error}</Alert> : null}
    <ReportRankingPrerequisites kind="TOP" reasonId={reasonId} {...prerequisites} disabled={disabled}
      onConfigureGrouping={onConfigureGrouping} onConfigureMeasures={onConfigureMeasures} />
    {draft && cap ? <TopGroupsFields data={data} dataset={dataset!} value={draft} cap={cap} disabled={disabled} onChange={onChange} /> : null}
    <ReportRuleHelp title="Як працює TOP">
        <Text size="xs" c="dimmed">Сервер обирає значення одного поля рядків за одним показником у всьому звіті: разом за всіма батьківськими групами й стовпцями. Усі рядки обраного значення залишаються; підсумки рахуються лише за ними. Порядок показу задає окреме сортування.</Text>
        <Text size="xs" c="dimmed">Відсоток стосується кількості груп із округленням угору: 50% від 3 груп — це 2 групи, незалежно від їхніх сум. За рівних показників першим є менший ключ поля; порожній ключ — перший.</Text>
        <Text size="xs" c="dimmed">Для порівняння потрібні відомі значення всіх груп. Якщо змішані одиниці або валюти, звузьте відбір до однієї одиниці чи валюти. Сервер відхилить невизначений рейтинг. Примітки про джерело описують відбір до TOP; кількість відібраних груп і рядків буде в звіті.</Text>
    </ReportRuleHelp>
  </Stack>
}

function TopGroupsFields({ data, dataset, value, cap, disabled, onChange }: Props & { dataset: ReportDataset; value: ReportTopGroupsDraft; cap: ReportTopGroupsCapabilities }) {
  const allowedGroups = new Set(cap.GroupingTypes), allowedMeasures = new Set(cap.RankingMeasures)
  const rowTypes = new Set(data.sorted.Row.map(field => field.type))
  const checkedTypes = new Set(data.sorted.Measurements.flatMap(field => field.IsChecked ? [field.Type] : []))
  const groups = dataset.Groupings.flatMap(field => allowedGroups.has(field.Type) && rowTypes.has(field.Type) ? [{ value: String(field.Type), label: field.Name }] : [])
  const measures = dataset.Measurements.flatMap(field => allowedMeasures.has(field.Type) && checkedTypes.has(field.Type) ? [{ value: String(field.Type), label: field.Name }] : [])
  if (!groups.some(item => item.value === String(value.Grouping))) groups.push({ value: String(value.Grouping), label: `Поза рядками або недоступне: ${dataset.Groupings.find(field => field.Type === value.Grouping)?.Name ?? `[${value.Grouping}]`}` })
  if (!measures.some(item => item.value === String(value.Measure))) measures.push({ value: String(value.Measure), label: `Вимкнений або недоступний показник: ${dataset.Measurements.find(field => field.Type === value.Measure)?.Name ?? `[${value.Measure}]`}` })
  const change = (patch: Partial<ReportTopGroupsDraft>) => onChange({ ...value, ...patch })
  const allowedModes = new Set(cap.Modes), allowedDirections = new Set(cap.Directions)
  return <SimpleGrid className="reports-constructor-rule-fields" cols={{ base: 1, sm: 2, lg: 3 }} spacing="xs" style={{ alignItems: 'end' }}>
    <Select label="Поле рядків для TOP" data={groups} value={String(value.Grouping)} disabled={disabled} allowDeselect={false}
      onChange={item => { const type = Number(item); if (item !== null && rowTypes.has(type) && allowedGroups.has(type)) change({ Grouping: type }) }} />
    <Select label="Показник для TOP" data={measures} value={String(value.Measure)} disabled={disabled} allowDeselect={false}
      onChange={item => { const type = Number(item); if (item !== null && checkedTypes.has(type) && allowedMeasures.has(type)) change({ Measure: type }) }} />
    <Select label="Напрямок відбору TOP" data={directions.filter(item => allowedDirections.has(Number(item.value) as 1 | 2))} value={String(value.Direction)} disabled={disabled} allowDeselect={false}
      onChange={item => { if (item === '1' || item === '2') change({ Direction: Number(item) as 1 | 2 }) }} />
    <Select label="Режим TOP" data={modes.filter(item => allowedModes.has(Number(item.value) as 1 | 2))} value={String(value.Mode)} disabled={disabled} allowDeselect={false}
      onChange={item => { if (item === '1' || item === '2') change({ Mode: Number(item) as 1 | 2 }) }} />
    <NumberInput label={value.Mode === 1 ? 'Кількість груп TOP' : 'Відсоток кількості груп TOP'} value={value.Value} disabled={disabled}
      min={value.Mode === 1 ? 1 : cap.PercentMinimum} max={value.Mode === 1 ? cap.MaximumCount : cap.PercentMaximum}
      allowDecimal={false} clampBehavior="none" onChange={Value => change({ Value })} />
  </SimpleGrid>
}
