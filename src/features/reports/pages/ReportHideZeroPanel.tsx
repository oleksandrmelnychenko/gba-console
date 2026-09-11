import { Alert, Button, Group, Stack, Text } from '@mantine/core'
import { useId } from 'react'
import type { ReportDataset, ReportRequestBody } from '../types'
import { ABC_CLASS_GROUPING } from '../data/reportAbcClassification'
import { defaultReportHideZero, HIDE_ZERO_GROUPING, HIDE_ZERO_MEASURE, readHideZeroCapabilities, reportHideZeroError, requestHideZero } from '../data/reportHideZero'
import { REPORT_RULE_LOCK_REASON } from './reportRankingReadiness'
import { ReportRuleHelp } from './ReportRuleHelp'

export function ReportHideZeroPanel({ data, dataset, disabled, onChange }: {
  data: ReportRequestBody; dataset?: ReportDataset; disabled: boolean; onChange: (value: unknown) => void
}) {
  const reasonId = useId()
  const raw = requestHideZero(data), cap = readHideZeroCapabilities(dataset)
  const error = reportHideZeroError(data, dataset), initial = defaultReportHideZero(data, dataset)
  if (raw == null && !cap) return null
  const reason = disabled ? REPORT_RULE_LOCK_REASON : raw == null && !initial ? hideZeroSetupReason(data) : null
  return <Stack component="section" aria-label="Приховування підтверджених нулів" className="reports-constructor-rule-panel" gap="xs" p="sm">
    <Group className="reports-constructor-rule-header" justify="space-between" align="start" gap="xs">
      <Text component="h3" className="app-section-title" fw={600}>Приховування підтверджених нулів</Text>
      {raw != null ? <Button type="button" variant="default" size="compact-sm" disabled={disabled}
        aria-describedby={reason ? reasonId : undefined} onClick={() => onChange(undefined)}>Показувати підтверджені нулі</Button>
        : <Button type="button" variant="default" size="compact-sm" disabled={disabled || !initial}
          aria-describedby={reason ? reasonId : undefined} onClick={() => { if (initial) onChange(initial) }}>Приховувати підтверджені нулі</Button>}
    </Group>
    <Text size="xs" c="dimmed">Приховує лише підтверджені нулі. Невідомі суми залишаються видимими, а факти й фінансові підсумки зберігаються.</Text>
    {error ? <Alert color="red">{error}</Alert> : null}
    {reason ? <Text id={reasonId} size="xs" c="dimmed">{reason}</Text> : null}
    <ReportRuleHelp title="Як працює приховування нулів">
      <Text size="xs" c="dimmed">Сервер приховує лише підтверджені нульові записи залишків рахунків. Невідомі суми залишаються видимими та порожніми. Звичайні відбори, TOP і поріг визначають склад фактів; ABC, сортування та фінансові підсумки зберігають ці факти, включно з прихованими нулями.</Text>
      <Text size="xs" c="dimmed">Потрібні поле «Запис залишку рахунку» в рядках, жодне поле стовпців і один показник «Записаний залишок рахунку». Дозволено додати ABC-клас із тим самим ключем і показником. Якщо всі записи підтверджено нульові, файл покаже окремий стан без рядків і показника; це відрізняється від відсутності даних у джерелі.</Text>
      <Text size="xs" c="dimmed">Увімкнення не змінює вашу розкладку автоматично.</Text>
    </ReportRuleHelp>
  </Stack>
}

function hideZeroSetupReason(data: ReportRequestBody) {
  const rows = data.sorted.Row.filter(field => field.type !== ABC_CLASS_GROUPING)
  const measures = data.sorted.Measurements.filter(field => field.IsChecked)
  if (rows.length !== 1 || rows[0].type !== HIDE_ZERO_GROUPING) return 'Залиште в рядках лише поле «Запис залишку рахунку». ABC-клас можна додати окремо.'
  if (data.sorted.Col.length) return 'Для приховування підтверджених нулів приберіть поля зі стовпців.'
  if (measures.length !== 1 || measures[0].Type !== HIDE_ZERO_MEASURE) return 'Увімкніть лише показник «Записаний залишок рахунку».'
  return 'Перевірте сумісність поточного набору та збережених налаштувань ABC із приховуванням нулів.'
}
