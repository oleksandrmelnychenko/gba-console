import { Alert, Badge, Button, Card, Group, Select, Stack, Text, TextInput } from '@mantine/core'
import { useEffect, useState } from 'react'
import { ApiError } from '../../../shared/api/apiClient'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DocumentExportModal } from '../../../shared/ui/document-export-modal/DocumentExportModal'
import { createStockReport, getOneCTurnoverScopes } from '../api/reportsApi'
import { createOneCTurnoverReport, ONE_C_REPORT_LAYOUTS, oneCReportPeriodError, type OneCReportLayoutId } from '../data/oneCTurnoverReport'
import type { OneCTurnoverScopeSummary, ReportResult } from '../types'

type Props = {
  canGenerate: boolean
  from: string
  to: string
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
  onLoadingChange?: (loading: boolean) => void
}

export function OneCTurnoverReportPanel({ canGenerate, from, to, onFromChange, onToChange, onLoadingChange }: Props) {
  const { t } = useI18n()
  const { catalog, refresh } = useOneCTurnoverCatalog(canGenerate)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [layout, setLayout] = useState<OneCReportLayoutId>('responsibles')
  const [run, setRun] = useState<{ loading: boolean; error: string | null; result: ReportResult | null; title: string }>({ loading: false, error: null, result: null, title: '' })
  const [opened, setOpened] = useState(false)
  const scope = catalog.scopes.find(item => item.Key === selectedKey)
  const selectedLayout = ONE_C_REPORT_LAYOUTS.find(item => item.id === layout)
  const periodError = oneCReportPeriodError(from, to)
  const canSubmit = canGenerate && !!scope && !catalog.loading && !periodError && !run.loading

  async function generate() {
    if (!canSubmit || !scope || !selectedLayout) return
    const title = `${selectedLayout.name}: ${from} — ${to}`
    setRun({ loading: true, error: null, result: null, title })
    onLoadingChange?.(true)
    try {
      const result = await createStockReport(createOneCTurnoverReport(scope, layout, from, to))
      const hasFile = !!(result.document.DocumentURL || result.document.PdfDocumentURL)
      setRun({ loading: false, error: hasFile ? null : 'Сервер не повернув файл звіту 1С. Це не підтверджує нульові обороти.', result, title })
      setOpened(hasFile)
    } catch (error) {
      setRun({ loading: false, error: describeError(error), result: null, title })
    } finally {
      onLoadingChange?.(false)
    }
  }

  return (
    <Card withBorder radius="md">
      <Stack gap="sm">
        <Group justify="space-between">
          <Text fw={600}>{t('Консолідований оборот 1С')}</Text>
          <Group gap="xs"><Badge>Fenix · EUR</Badge><Badge color="gray">{t('Продажі + повернення')}</Badge></Group>
        </Group>
        <Text size="sm" c="dimmed">{t('Цей режим читає окремо синхронізовані рухи 1С. Операційні налаштування збережено в іншому режимі й сюди не переносяться. Собівартість та історичні залишки поки не включено.')}</Text>
        {!canGenerate ? <Alert color="yellow">{t('Недостатньо прав для формування звітів 1С. Зверніться до адміністратора щодо доступу до конструктора.')}</Alert> : null}
        <ScopeCatalog catalog={catalog} canGenerate={canGenerate} isGenerating={run.loading}
          selectedKey={selectedKey} onSelect={setSelectedKey} onRefresh={refresh} />
        {scope ? <ScopeDetails scope={scope} /> : null}
        <Group align="end">
          <TextInput type="date" label={t('Від (1С)')} min="2000-01-01" max={to || '7998-12-31'} value={from} disabled={run.loading} onChange={event => onFromChange(event.currentTarget.value)} />
          <TextInput type="date" label={t('До (1С)')} min={from || '2000-01-01'} max="7998-12-31" value={to} disabled={run.loading} onChange={event => onToChange(event.currentTarget.value)} />
          <Select label={t('Структура звіту 1С')} value={layout} disabled={run.loading}
            data={ONE_C_REPORT_LAYOUTS.map(item => ({ value: item.id, label: t(item.name) }))}
            onChange={value => { if (value) setLayout(value as OneCReportLayoutId) }} />
          <Button type="button" disabled={!canSubmit} loading={run.loading} onClick={() => { void generate() }}>{t('Сформувати звіт 1С')}</Button>
        </Group>
        {periodError ? <Alert color="yellow">{t(periodError)}</Alert> : null}
        {run.error ? <Alert color="red">{t(run.error)}</Alert> : null}
        <Text size="xs" c="dimmed">{t('Сервер перевіряє кожен день періоду. Якщо даних бракує, файл не формується. Дати й ревізії читання буде зазначено у звіті; сьогоднішні дані потребують повторного оновлення.')}</Text>
        {run.result?.document.DocumentURL || run.result?.document.PdfDocumentURL ? <Button variant="light" type="button" onClick={() => setOpened(true)}>{t('Відкрити сформований звіт 1С')}</Button> : null}
      </Stack>
      <DocumentExportModal document={run.result?.document} opened={opened} title={run.title} onClose={() => setOpened(false)} />
    </Card>
  )
}

type ScopeCatalogState = { scopes: OneCTurnoverScopeSummary[]; loading: boolean; error: string | null }

function useOneCTurnoverCatalog(canGenerate: boolean) {
  const [reload, setReload] = useState(0)
  const [catalog, setCatalog] = useState<ScopeCatalogState>({ scopes: [], loading: true, error: null })
  useEffect(() => {
    if (!canGenerate) return
    const controller = new AbortController()
    getOneCTurnoverScopes(controller.signal).then(scopes => {
      if (!controller.signal.aborted) setCatalog({ scopes, loading: false, error: null })
    }).catch(error => {
      if (!controller.signal.aborted) setCatalog({ scopes: [], loading: false, error: describeError(error) })
    })
    return () => controller.abort()
  }, [canGenerate, reload])
  const refresh = () => {
    setCatalog(current => ({ ...current, loading: true, error: null }))
    setReload(current => current + 1)
  }
  return { catalog, refresh }
}

type ScopeCatalogProps = {
  catalog: ScopeCatalogState
  canGenerate: boolean
  isGenerating: boolean
  selectedKey: string | null
  onSelect: (key: string | null) => void
  onRefresh: () => void
}

function ScopeCatalog({ catalog, canGenerate, isGenerating, selectedKey, onSelect, onRefresh }: ScopeCatalogProps) {
  const { t } = useI18n()
  return <Stack gap="xs">
    <Group align="end">
      <Select style={{ flex: 1 }} label={t('Завантажені відбори 1С')} placeholder={t('Виберіть набір відборів')}
        disabled={!canGenerate || catalog.loading || isGenerating} value={selectedKey} onChange={onSelect}
        data={catalog.scopes.map((item, index) => ({ value: item.Key, label: `${index + 1}. ${item.OrganizationNames.join(' / ')} · ${item.Filters.ExcludeServices ? t('без послуг') : t('послуги не виключено')}` }))} />
      <Button type="button" variant="default" disabled={!canGenerate || isGenerating} loading={canGenerate && catalog.loading}
        onClick={onRefresh}>{t('Оновити відбори')}</Button>
    </Group>
    {catalog.error ? <Alert color="red">{t(catalog.error)}</Alert> : null}
    {canGenerate && !catalog.loading && !catalog.error && catalog.scopes.length === 0 ? <Alert color="yellow">{t('Ще немає завантажених відборів 1С. Спочатку виконайте штатний синк із явно вибраними відборами звітних рухів. Звичайний синк документів сам по собі не підтверджує ці дані.')}</Alert> : null}
  </Stack>
}

function ScopeDetails({ scope }: { scope: OneCTurnoverScopeSummary }) {
  const { t } = useI18n()
  return <Stack gap={2}>
    <Text size="sm">{t('Наявні дні')}: {scope.FirstDay} — {scope.LastDay}; {t('завантажено')}: {scope.LoadedDayCount}.</Text>
    <Text size="xs" c="dimmed">{t('Між цими датами можуть бути пропуски. Діапазон не є підтвердженням повноти.')}</Text>
    <Text size="xs" c="dimmed">{t('Завершення читання днів, UTC')}: {scope.OldestReadCompletedUtc} — {scope.NewestReadCompletedUtc}</Text>
    <Text size="xs" c="dimmed">{t('Ідентифікатор виду товару 1С')}: {scope.Filters.ProductKindId}</Text>
  </Stack>
}

function describeError(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Не вдалося виконати запит звіту 1С.'
  if (error.status === 403) return 'Недостатньо прав для формування звітів 1С. Зверніться до адміністратора щодо доступу до конструктора.'
  if (error.status === 401) return 'Сесію завершено. Увійдіть повторно.'
  if ((error.status === 400 || error.status === 409 || error.status === 503) && /\p{Script=Cyrillic}/u.test(error.message)) return error.message
  return 'Сервіс звітів 1С недоступний. Спробуйте ще раз пізніше.'
}
