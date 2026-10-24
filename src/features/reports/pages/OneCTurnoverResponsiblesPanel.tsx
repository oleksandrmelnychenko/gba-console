import { Alert, Button, Group, Stack, Text } from '@mantine/core'
import { useEffect, useRef, useState } from 'react'
import { AppDateInput } from '../../../shared/ui/AppDateInput'
import { DocumentExportModal } from '../../../shared/ui/document-export-modal/DocumentExportModal'
import { ApiError } from '../../../shared/api/apiClient'
import { createStockReport } from '../api/reportsApi'
import { createOneCTurnoverReport, organizationOnlyTurnoverPeriodError } from '../data/oneCTurnoverReport'
import { isOrganizationOnlyTurnoverScope } from '../data/oneCTurnoverScopes'
import type { OneCTurnoverScopeSummary, ReportResult } from '../types'

type Props = { scope: OneCTurnoverScopeSummary; canGenerate: boolean; callerKey: string | null; onClose: () => void }
const kyivTimestamp = new Intl.DateTimeFormat('uk-UA', { timeZone: 'Europe/Kyiv', dateStyle: 'medium', timeStyle: 'medium' })
function sourceAsOf(from: string, to: string): string {
  const first = kyivTimestamp.format(new Date(from)), last = kyivTimestamp.format(new Date(to))
  return first === last ? first : `${first} — ${last}`
}
const kyivDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit' })

type Applied = { result: ReportResult; from: string; to: string; sourceFrom: string; sourceTo: string }

/** Files remain tied to their applied period while dates are edited. Caller/permission changes remove them. */
export function OneCTurnoverResponsiblesPanel({ scope, canGenerate, callerKey, onClose }: Props) {
  const identity = `${callerKey ?? ''}:${canGenerate}:${scope.Key}`
  return <ResponsiblesForm key={identity} scope={scope} canGenerate={canGenerate} onClose={onClose} />
}

function useResponsiblesReport(scope: OneCTurnoverScopeSummary, canGenerate: boolean) {
  const [from, setFrom] = useState(() => [scope.FirstDay, `${scope.LastDay.slice(0, 7)}-01`].sort().at(-1)!)
  const [to, setTo] = useState(scope.LastDay)
  const [applied, setApplied] = useState<Applied | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [opened, setOpened] = useState(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const validScope = isOrganizationOnlyTurnoverScope(scope)
  const periodError = validScope ? organizationOnlyTurnoverPeriodError(from, to, scope) : 'Опубліковане покриття цього звіту не підтверджено.'
  async function generate() {
    if (!canGenerate || !validScope || periodError || loading) return
    setLoading(true); setError(null)
    const requested = { from, to, sourceFrom: scope.OldestReadCompletedUtc, sourceTo: scope.NewestReadCompletedUtc }
    try {
      const result = await createStockReport(createOneCTurnoverReport(scope, 'responsibles', from, to))
      if (!alive.current) return
      if (!result.document.DocumentURL && !result.document.PdfDocumentURL) {
        setError('Сервер не повернув файл. Це не підтверджує нульові продажі.')
        return
      }
      setApplied({ ...requested, result }); setOpened(true)
    } catch (failure) {
      if (!alive.current) return
      if (failure instanceof ApiError && [401, 403].includes(failure.status)) {
        setApplied(null); setOpened(false)
      }
      setError(failure instanceof ApiError && /\p{Script=Cyrillic}/u.test(failure.message)
        ? failure.message : 'Не вдалося сформувати звіт. Перевірте покриття періоду й повторіть запит.')
    } finally { if (alive.current) setLoading(false) }
  }
  return { from, setFrom, to, setTo, applied, loading, error, opened, setOpened, validScope, periodError, generate }
}

function ResponsiblesForm({ scope, canGenerate, onClose }: Omit<Props, 'callerKey'>) {
  const { from, setFrom, to, setTo, applied, loading, error, opened, setOpened, validScope, periodError, generate } = useResponsiblesReport(scope, canGenerate)
  const pending = !!applied && (from !== applied.from || to !== applied.to)
  const today = kyivDay.format(new Date())
  const currentMonth = from.slice(0, 7) <= today.slice(0, 7) && to.slice(0, 7) >= today.slice(0, 7)
  if (!canGenerate) return <Alert color="yellow">Немає права формування звітів.</Alert>
  return <Stack gap="sm">
    <ResponsiblesScopeSummary scope={scope} validScope={validScope} />
    <Group align="start">
      <AppDateInput type="date" label="Від" value={from} disabled={loading} onChange={event => setFrom(event.currentTarget.value)} />
      <AppDateInput type="date" label="До" value={to} disabled={loading} onChange={event => setTo(event.currentTarget.value)} />
    </Group>
    {currentMonth ? <Alert color="yellow">Поточний місяць ще не завершено. Результат охоплює лише вибрані опубліковані дні, а не повний місяць.</Alert> : null}
    {periodError ? <Alert color="yellow">{periodError}</Alert> : null}
    {error ? <Alert color="red">{error}</Alert> : null}
    {applied ? <Stack gap={4}>
      <Text aria-label="Період сформованого звіту">Сформований звіт: {applied.from} — {applied.to}.</Text>
      <Text size="xs">Дані з 1С при формуванні: {sourceAsOf(applied.sourceFrom, applied.sourceTo)} (за Києвом).</Text>
      {pending ? <Text c="orange">Є незастосовані зміни періоду. Відкриття файла показує попередній сформований звіт.</Text> : null}
    </Stack> : null}
    <details>
      <summary>Відомості про дані</summary>
      <Text size="xs">Завантажено днів: {scope.LoadedDayCount}. Час читання опублікованого набору, UTC: {scope.OldestReadCompletedUtc} — {scope.NewestReadCompletedUtc}. Час читання вибраних днів зазначено у файлі.</Text>
    </details>
    <Group justify="flex-end">
      {applied ? <Button variant="light" onClick={() => setOpened(true)}>Відкрити сформований звіт</Button> : null}
      <Button variant="default" disabled={loading} onClick={onClose}>Закрити</Button>
      <Button disabled={!validScope || !!periodError || loading} loading={loading} onClick={() => { void generate() }}>Застосувати й сформувати</Button>
    </Group>
    <DocumentExportModal document={applied?.result.document} opened={opened && !!applied}
      title={applied ? `Продажі за відповідальними: ${applied.from} — ${applied.to}` : ''} onClose={() => setOpened(false)} />
  </Stack>
}

function ResponsiblesScopeSummary({ scope, validScope }: { scope: OneCTurnoverScopeSummary; validScope: boolean }) {
  const hasGaps = scope.LoadedDayCount < (Date.parse(scope.LastDay) - Date.parse(scope.FirstDay)) / 86_400_000 + 1
  return <>
    <Text className="app-section-title" fw={600}>Організації та показники</Text>
    <Text size="sm">{scope.OrganizationNames.join(' · ')}</Text>
    <Text size="sm">Усі товари та послуги. Продажі й повернення: суми без ПДВ та з ПДВ у EUR.</Text>
    <Text size="sm">Рядки: організація → відповідальний реалізації. Колонки: відповідальний замовлення.</Text>
    <Text size="sm">Доступний період: {scope.FirstDay} — {scope.LastDay}.</Text>
    {validScope ? <Text size="sm">Дані з 1С станом на {sourceAsOf(scope.OldestReadCompletedUtc, scope.NewestReadCompletedUtc)} (за Києвом).</Text> : null}
    {hasGaps ? <Alert color="yellow">У доступному періоді є пропуски. Оберіть період із завантаженими днями; відсутні дані не є нульовими продажами.</Alert> : null}
  </>
}
