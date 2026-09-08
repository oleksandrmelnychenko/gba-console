import { Alert, Button, Group, NumberInput, Select, Stack, Text } from '@mantine/core'
import type { ReportDataset, ReportRequestBody } from '../types'
import { defaultReportThreshold, readThresholdCapabilities, readThresholdDraft, reportThresholdError, requestThreshold, type ReportThresholdDraft } from '../data/reportThreshold'

type Props = { data: ReportRequestBody; dataset?: ReportDataset; disabled: boolean; onChange: (value: unknown) => void }
export function ReportThresholdPanel({ data, dataset, disabled, onChange }: Props) {
  const raw = requestThreshold(data), draft = readThresholdDraft(raw), cap = readThresholdCapabilities(dataset)
  const error = reportThresholdError(data, dataset), initial = defaultReportThreshold(data, dataset)
  return <Stack component="section" aria-label="Поріг групування" gap="xs" p="sm">
    <Text fw={600}>Поріг групування</Text>
    <Text size="xs" c="dimmed">Сервер залишає окремо групи, частка яких у точній сумі показника не менша за поріг. Менші групи об’єднуються в «Інше (поріг)». Звичайні відбори діють перед TOP, потім застосовуються поріг, ABC та сортування. Усі факти після TOP залишаються в підсумку.</Text>
    <Text size="xs" c="dimmed">Потрібні одне початкове поле рядків, жодного поля стовпців і один увімкнений показник. ABC-клас можна додати окремо з тим самим ключем і показником. «Інше (поріг)» є синтетичною групою; відбору за нею немає. Звичайні відбори за товарами, договорами та іншими полями залишаються доступними.</Text>
    <Text size="xs" c="dimmed">Потрібні відомі невід’ємні суми в одній підтвердженій валюті чи одиниці та додатний загальний показник. Порожній звіт залишається порожнім. Об’єднання лише нульових груп сервер відхилить, щоб не втратити факти; за потреби звузьте відбір або вимкніть поріг.</Text>
    {error ? <Alert color="red">{error}</Alert> : null}
    {!cap ? <Text size="sm" c="dimmed">Сервер не надав можливості порогу. Звіти без нього працюють як раніше.</Text> : null}
    {raw != null ? <Button type="button" variant="subtle" color="gray" size="compact-sm" disabled={disabled} onClick={() => onChange(undefined)}>Вимкнути поріг: показати початкові групи</Button> : cap ? <>
      <Button type="button" variant="light" size="compact-sm" disabled={disabled || !initial} onClick={() => { if (initial) onChange(initial) }}>Увімкнути поріг групування</Button>
      {!initial ? <Text size="xs" c="dimmed">Спочатку залиште одне початкове поле рядків, жодного поля стовпців і один доступний показник. Увімкнення порогу не змінює ваші поля автоматично.</Text> : null}
    </> : null}
    {draft && cap && dataset ? <ThresholdFields data={data} dataset={dataset} disabled={disabled} value={draft} onChange={onChange} /> : null}
  </Stack>
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
  return <Group gap="xs" align="end">
    <Select label="Поле рядків для порогу" data={groups} value={String(value.Grouping)} disabled={disabled} allowDeselect={false}
      onChange={item => { const type = Number(item); if (item !== null && rows.has(type) && cap.GroupingTypes.includes(type)) change({ Grouping: type }) }} />
    <Select label="Показник для порогу" data={measures} value={String(value.Measure)} disabled={disabled} allowDeselect={false}
      onChange={item => { const type = Number(item); if (item !== null && checked.has(type) && cap.RankingMeasures.includes(type)) change({ Measure: type }) }} />
    <NumberInput label="Поріг частки суми, %" value={value.Percent} disabled={disabled} min={1} max={100} allowDecimal={false} clampBehavior="none" onChange={Percent => change({ Percent })} />
  </Group>
}
