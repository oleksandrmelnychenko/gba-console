import { Alert, Button, Stack, Text } from '@mantine/core'
import type { ReportDataset, ReportRequestBody } from '../types'
import { defaultReportHideZero, readHideZeroCapabilities, reportHideZeroError, requestHideZero } from '../data/reportHideZero'

export function ReportHideZeroPanel({ data, dataset, disabled, onChange }: {
  data: ReportRequestBody; dataset?: ReportDataset; disabled: boolean; onChange: (value: unknown) => void
}) {
  const raw = requestHideZero(data), cap = readHideZeroCapabilities(dataset)
  const error = reportHideZeroError(data, dataset), initial = defaultReportHideZero(data, dataset)
  if (raw == null && !cap) return null
  return <Stack component="section" aria-label="Приховування підтверджених нулів" gap="xs" p="sm">
    <Text fw={600}>Приховування підтверджених нулів</Text>
    <Text size="xs" c="dimmed">Сервер приховує лише підтверджені нульові записи залишків рахунків. Невідомі суми залишаються видимими та порожніми. Звичайні відбори, TOP і поріг визначають склад фактів; ABC, сортування та фінансові підсумки зберігають ці факти, включно з прихованими нулями.</Text>
    <Text size="xs" c="dimmed">Потрібні поле «Запис залишку рахунку» в рядках, жодне поле стовпців і один показник «Записаний залишок рахунку». Дозволено додати ABC-клас із тим самим ключем і показником. Якщо всі записи підтверджено нульові, файл покаже окремий стан без рядків і показника; це відрізняється від відсутності даних у джерелі.</Text>
    {error ? <Alert color="red">{error}</Alert> : null}
    {raw != null
      ? <Button type="button" variant="subtle" color="gray" size="compact-sm" disabled={disabled} onClick={() => onChange(undefined)}>Показувати підтверджені нулі</Button>
      : <>
        <Button type="button" variant="light" size="compact-sm" disabled={disabled || !initial} onClick={() => { if (initial) onChange(initial) }}>Приховувати підтверджені нулі</Button>
        {!initial ? <Text size="xs" c="dimmed">Спочатку оберіть сумісні поля. Увімкнення не змінює вашу розкладку автоматично.</Text> : null}
      </>}
  </Stack>
}
