import { Alert, Button, Group, NumberInput, Select, Stack, Text } from '@mantine/core'
import type { ReportDataset, ReportRequestBody } from '../types'
import { defaultAbcClassification, readAbcCapabilities, readAbcDraft, reportAbcClassificationError, requestAbcClassification, type ReportAbcDraft } from '../data/reportAbcClassification'

type Props = { data: ReportRequestBody; dataset?: ReportDataset; disabled: boolean; notice?: string | null; onChange: (value: unknown) => void }
export function ReportAbcClassificationPanel({ data, dataset, disabled, notice, onChange }: Props) {
  const raw = requestAbcClassification(data), draft = readAbcDraft(raw), cap = readAbcCapabilities(dataset)
  const error = reportAbcClassificationError(data, dataset), initial = defaultAbcClassification(data, dataset)
  return <Stack component="section" aria-label="ABC-класифікація" gap="xs" p="sm">
    <Text fw={600}>ABC-класифікація</Text>
    <Text size="xs" c="dimmed">Сервер класифікує один початковий ключ рядків глобально, разом за всіма батьківськими групами й стовпцями, після TOP. Поле «ABC-клас» утворює справжні групи A, B і C з підсумками; усі залишені факти та загальний підсумок зберігаються.</Text>
    <Text size="xs" c="dimmed">Групи ранжуються від найбільшого показника, за рівності — за меншим ключем. Клас визначається накопиченою сумою до поточної групи: нижче межі A — клас A, нижче A+B — клас B, решта — C. Група може перетнути межу цілком; нульовий хвіст належить C.</Text>
    <Text size="xs" c="dimmed">Потрібні відомі невід’ємні суми груп і додатний загальний показник в одній підтвердженій валюті чи одиниці. За потреби звузьте відбір. ABC підтримує лише рядки; відбору за класом немає. Відсотки вводяться окремо, їхня сума має дорівнювати 100.</Text>
    {error ? <Alert color="red">{error}</Alert> : null}
    {notice ? <Text role="status" size="sm">{notice}</Text> : null}
    {!cap ? <Text size="sm" c="dimmed">Сервер не надав можливості ABC-класифікації. Звіти без неї працюють як раніше.</Text> : null}
    {raw != null ? <>
      <Text size="xs" c="dimmed">Вимкнення ABC прибере його правило, поле «ABC-клас» і сортування лише цього поля. Інші налаштування залишаться.</Text>
      <Button type="button" variant="subtle" color="gray" size="compact-sm" disabled={disabled} onClick={() => onChange(undefined)}>Вимкнути ABC-класифікацію</Button>
    </> : cap ? <>
      <Text size="xs" c="dimmed">Увімкнення додасть поле «ABC-клас» першим у рядках; його порядок можна змінити кнопками групування.</Text>
      <Button type="button" variant="light" size="compact-sm" disabled={disabled || !initial} onClick={() => { if (initial) onChange(initial) }}>Увімкнути ABC-класифікацію</Button>
      {!initial ? <Text size="xs" c="dimmed">Спочатку виберіть початкове поле рядків і доступний увімкнений показник.</Text> : null}
    </> : null}
    {draft && cap && dataset ? <AbcFields data={data} dataset={dataset} disabled={disabled} value={draft} onChange={onChange} /> : null}
  </Stack>
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
  return <Group gap="xs" align="end">
    <Select label="Початковий ключ для ABC" data={groups} value={String(value.Grouping)} disabled={disabled} allowDeselect={false}
      onChange={item => { const type = Number(item); if (item !== null && rows.has(type) && allowedGroups.has(type)) change({ Grouping: type }) }} />
    <Select label="Показник для ABC" data={measures} value={String(value.Measure)} disabled={disabled} allowDeselect={false}
      onChange={item => { const type = Number(item); if (item !== null && checked.has(type) && allowedMeasures.has(type)) change({ Measure: type }) }} />
    {(['PercentA', 'PercentB', 'PercentC'] as const).map(key => <NumberInput key={key} label={`Частка ${key.at(-1)} для ABC, %`} value={value[key]} disabled={disabled}
      min={0} max={100} allowDecimal={false} clampBehavior="none" onChange={next => change({ [key]: next })} />)}
  </Group>
}
