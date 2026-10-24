import { ActionIcon, Alert, Button, Group, Stack, Text, Tooltip } from '@mantine/core'
import { Columns3, FileOutput, Info, ListTree, MonitorPlay, X } from 'lucide-react'
import { TableChip } from '../../../shared/ui/TableChip'
import { WorkbookPeriodField, WorkbookSettings } from './workbook-desk/WorkbookSettings'
import { useEffect, useRef, useState } from 'react'
import { DocumentExportModal } from '../../../shared/ui/document-export-modal/DocumentExportModal'
import { ApiError } from '../../../shared/api/apiClient'
import { createStockReport } from '../api/reportsApi'
import { createOneCTurnoverReport, organizationOnlyTurnoverPeriodError } from '../data/oneCTurnoverReport'
import { isOrganizationOnlyTurnoverScope } from '../data/oneCTurnoverScopes'
import type { OneCTurnoverScopeSummary, ReportResult } from '../types'

type Props = { scope: OneCTurnoverScopeSummary; canGenerate: boolean; callerKey: string | null; onClose?: () => void; onBusyChange?: (busy: boolean) => void; onExportOpenChange?: (opened: boolean) => void }
const kyivTimestamp = new Intl.DateTimeFormat('uk-UA', { timeZone: 'Europe/Kyiv', dateStyle: 'medium', timeStyle: 'medium' })
function sourceAsOf(from: string, to: string): string {
  const first = kyivTimestamp.format(new Date(from)), last = kyivTimestamp.format(new Date(to))
  return first === last ? first : `${first} — ${last}`
}

type Applied = { result: ReportResult; from: string; to: string; sourceFrom: string; sourceTo: string }

/** Files remain tied to their applied period while dates are edited. Caller/permission changes remove them. */
export function OneCTurnoverResponsiblesPanel({ scope, canGenerate, callerKey, onClose, onExportOpenChange, onBusyChange }: Props) {
  const identity = `${callerKey ?? ''}:${canGenerate}:${scope.Key}`
  return <ResponsiblesForm key={identity} scope={scope} canGenerate={canGenerate} onClose={onClose} onExportOpenChange={onExportOpenChange} onBusyChange={onBusyChange} />
}

function useResponsiblesReport(scope: OneCTurnoverScopeSummary, canGenerate: boolean, onBusyChange?: (busy: boolean) => void) {
  const [from, setFrom] = useState(() => [scope.FirstDay, `${scope.LastDay.slice(0, 7)}-01`].sort().at(-1)!)
  const [to, setTo] = useState(scope.LastDay)
  const [applied, setApplied] = useState<Applied | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [opened, updateOpened] = useState(false)
  const setOpened = (value: boolean) => { updateOpened(value); onBusyChange?.(value) }
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false; onBusyChange?.(false) } }, [onBusyChange])
  const validScope = isOrganizationOnlyTurnoverScope(scope)
  const periodError = validScope ? organizationOnlyTurnoverPeriodError(from, to, scope) : 'Опубліковане покриття цього звіту не підтверджено.'
  async function generate() {
    if (!canGenerate || !validScope || periodError || loading) return
    setLoading(true); setError(null); onBusyChange?.(true)
    let openedResult = false
    const requested = { from, to, sourceFrom: scope.OldestReadCompletedUtc, sourceTo: scope.NewestReadCompletedUtc }
    try {
      const result = await createStockReport(createOneCTurnoverReport(scope, 'responsibles', from, to))
      if (!alive.current) return
      if (!result.document.DocumentURL && !result.document.PdfDocumentURL) {
        setError('Сервер не повернув файл. Це не підтверджує нульові продажі.')
        return
      }
      setApplied({ ...requested, result }); setOpened(true); openedResult = true
    } catch (failure) {
      if (!alive.current) return
      if (failure instanceof ApiError && [401, 403].includes(failure.status)) {
        setApplied(null); setOpened(false)
      }
      setError(failure instanceof ApiError && /\p{Script=Cyrillic}/u.test(failure.message)
        ? failure.message : 'Не вдалося сформувати звіт. Перевірте покриття періоду й повторіть запит.')
    } finally { if (alive.current) { setLoading(false); if (!openedResult) onBusyChange?.(false) } }
  }
  return { from, setFrom, to, setTo, applied, loading, error, opened, setOpened, validScope, periodError, generate }
}

function ResponsiblesForm({ scope, canGenerate, onClose, onExportOpenChange, onBusyChange }: Omit<Props, 'callerKey'>) {
  const { from, setFrom, to, setTo, applied, loading, error, opened, setOpened, validScope, periodError, generate } = useResponsiblesReport(scope, canGenerate, onBusyChange)
  useEffect(() => {
    onExportOpenChange?.(opened)
    return () => onExportOpenChange?.(false)
  }, [opened, onExportOpenChange])
  const pending = !!applied && (from !== applied.from || to !== applied.to)
  if (!canGenerate) return <Alert color="yellow">Немає права формування звітів.</Alert>
  const monthStart = `${scope.LastDay.slice(0, 7)}-01`
  const periodStart = (days: number) => {
    const start = new Date(Date.parse(scope.LastDay) - (days - 1) * 86400000).toISOString().slice(0, 10)
    return start < scope.FirstDay ? scope.FirstDay : start
  }
  const presets = [
    { label: 'Місяць', from: monthStart < scope.FirstDay ? scope.FirstDay : monthStart, to: scope.LastDay },
    { label: '7 днів', from: periodStart(7), to: scope.LastDay },
    { label: '30 днів', from: periodStart(30), to: scope.LastDay },
  ]
  const hasGaps = scope.LoadedDayCount < (Date.parse(scope.LastDay) - Date.parse(scope.FirstDay)) / 86_400_000 + 1
  const sourceNote = `Доступний період: ${scope.FirstDay} — ${scope.LastDay}. Завантажено днів: ${scope.LoadedDayCount}.${validScope ? ` Дані з 1С станом на ${sourceAsOf(scope.OldestReadCompletedUtc, scope.NewestReadCompletedUtc)} (за Києвом). Час читання вибраних днів зазначено у файлі.` : ''}`
  return <Stack gap={8} className="published-responsibles">
    <WorkbookSettings unified disabled={loading} advanced={null}
      period={<WorkbookPeriodField required from={from} to={to} minDate={scope.FirstDay} maxDate={scope.LastDay}
        presets={presets} error={null} disabled={loading} onFromChange={setFrom} onToChange={setTo} />}
      sections={[
        { id: 'organizations', title: 'Організації', summary: scope.OrganizationNames.join(' · '), compactSummary: String(scope.OrganizationNames.length), content:
          <Group gap={8}>{scope.OrganizationNames.map(name => <TableChip key={name} tone="product" value={name} />)}</Group> },
        { id: 'measures', title: 'Показники', summary: 'Продажі й повернення', content:
          <Stack gap={8}>
            <Group gap={8}><Text size="sm" fw={600}>Продажі й повернення</Text><TableChip tone="source" value="EUR" /></Group>
            <div className="published-responsibles__measures"><span>Сума без ПДВ</span><span>Сума з ПДВ</span></div>
            <Text className="published-responsibles__scope">Усі товари та послуги</Text>
            <dl className="published-responsibles__layout">
              <div><dt><ListTree size={14} aria-hidden="true" />Рядки</dt><dd>Організація → відповідальний реалізації</dd></div>
              <div><dt><Columns3 size={14} aria-hidden="true" />Колонки</dt><dd>Відповідальний замовлення</dd></div>
            </dl>
          </Stack> },
      ]} />
    {hasGaps ? <Alert color="yellow">У доступному періоді є пропуски. Оберіть період із завантаженими днями; відсутні дані не є нульовими продажами.</Alert> : null}
    {periodError ? <Alert color="yellow">{periodError}</Alert> : null}
    {error ? <Alert color="red">{error}</Alert> : null}
    {pending ? <Text size="xs" c="orange.8">Є незастосовані зміни періоду. Відкриття файла показує попередній сформований звіт.</Text> : null}
    <div className="workbook-actions" role="region" aria-label="Дії зі звітом">
      <div className="app-filter-bar workbook-toolbar"><div className="app-filter-actions workbook-actions__buttons">
        <Tooltip label={sourceNote} multiline w={320}><ActionIcon variant="default" size={36} aria-label="Про дані продажів за відповідальними"><Info size={16} /></ActionIcon></Tooltip>
        <div className="workbook-actions__delivery">
          {onClose ? <Button variant="default" leftSection={<X size={16} />} disabled={loading} onClick={onClose}>Закрити</Button> : null}
          {applied ? <Button variant="default" leftSection={<FileOutput size={16} />} disabled={loading} onClick={() => setOpened(true)}>Відкрити сформований звіт</Button> : null}
          <Button leftSection={<MonitorPlay size={16} />} disabled={!validScope || !!periodError || loading} loading={loading} onClick={() => { void generate() }}>Застосувати й сформувати</Button>
        </div>
      </div></div>
    </div>
    {applied ? <section className="workbook-result" aria-label="Результат">
      <h2 className="app-section-title">Результат</h2>
      <Group justify="space-between" gap={8}>
        <Text size="sm" fw={600} aria-label="Період сформованого звіту">{applied.from.split('-').reverse().join('.')} — {applied.to.split('-').reverse().join('.')}</Text>
        <Text size="xs" c="dimmed">Дані з 1С при формуванні: {sourceAsOf(applied.sourceFrom, applied.sourceTo)} (за Києвом).</Text>
      </Group>
    </section> : null}
    <DocumentExportModal document={applied?.result.document} opened={opened && !!applied}
      title={applied ? `Продажі за відповідальними: ${applied.from} — ${applied.to}` : ''} onClose={() => setOpened(false)} />
  </Stack>
}
