import { Alert, Button, Group, Stack, Text } from '@mantine/core'
import { useEffect, useMemo, useRef } from 'react'
import { readSession } from '../../../shared/auth/session'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DocumentExportModal } from '../../../shared/ui/document-export-modal/DocumentExportModal'
import { generateSavedNativeReport, previewSavedNativeReport, savedNativeReportError,
  type SavedNativeReportBinding } from '../api/savedNativeReportApi'
import { savedNativeReportConfigurationError } from '../data/savedNativeReport'
import { useReportRunState } from '../hooks/useReportRunState'
import type { ReportDataset, ReportTemplate } from '../types'
import { ReportInlinePreview } from './ReportInlinePreview'

export function SavedNativeReportPanel({ template, datasets, callerKey, enabled, current, onClose }: {
  template: ReportTemplate
  datasets: readonly ReportDataset[]
  callerKey: string | null
  enabled: boolean
  current: boolean
  onClose: () => void
}) {
  const { t } = useI18n()
  const configurationError = useMemo(() => savedNativeReportConfigurationError(template, datasets), [template, datasets])
  const scope = JSON.stringify([callerKey, enabled, current, template, datasets])
  const run = useReportRunState<SavedNativeReportBinding>(scope)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => { controller.current?.abort() }, [scope])
  const canRun = Boolean(enabled && callerKey && current && !configurationError && !run.isLoading)
  const hasFiles = Boolean(run.result?.document.DocumentURL || run.result?.document.PdfDocumentURL)

  async function generate(preview: boolean) {
    if (!canRun || !template.Id || !template.Revision) return
    const session = readSession()
    if (!session || !callerKey || session.userNetUid !== callerKey) return
    controller.current?.abort()
    const attempt = new AbortController()
    controller.current = attempt
    const target = { id: template.Id, revision: template.Revision, dataSource: template.Data.dataSource ?? 0,
      ...(run.lastRun ? { expectedDefinitionSha256: run.lastRun.definitionSha256 } : {}) }
    const updateAttempt = run.begin()
    try {
      const operation = preview ? previewSavedNativeReport : generateSavedNativeReport
      const response = await operation(target, { session: { userNetUid: callerKey, csrfToken: session.csrfToken }, signal: attempt.signal })
      updateAttempt({ result: response.result, preview: response.preview ?? null, lastRun: response.binding,
        downloadModalOpened: !preview && Boolean(response.result.document.DocumentURL || response.result.document.PdfDocumentURL) })
    } catch (cause) {
      if (!attempt.signal.aborted) updateAttempt({ error: savedNativeReportError(cause) })
    } finally {
      updateAttempt({ isLoading: false })
    }
  }

  return <Stack gap="sm" component="section" aria-label={t('Збережений варіант: {name}', { name: template.Name })}>
    <Group justify="space-between">
      <Text fw={600}>{t('Збережений варіант: {name}', { name: template.Name })}</Text>
      <Button type="button" variant="subtle" onClick={onClose}>{t('Закрити перегляд варіанта')}</Button>
    </Group>
    <Text size="sm">{t('Звіт використовує збережені налаштування. Поточна чернетка залишається у формі без змін.')}</Text>
    {!current ? <Alert color="yellow">{t('Цей варіант змінився або видалений. Оновіть список і виберіть його знову.')}</Alert> : null}
    {configurationError ? <Alert color="yellow">{t(configurationError)}</Alert> : null}
    {run.error ? <Alert color="red" role="alert">{t(run.error)}</Alert> : null}
    <Group>
      <Button type="button" variant="light" disabled={!canRun} loading={run.isLoading}
        onClick={() => { void generate(true) }}>{t('Показати збережений варіант')}</Button>
      <Button type="button" disabled={!canRun} onClick={() => { void generate(false) }}>{t('Сформувати збережений варіант')}</Button>
      {hasFiles ? <Button type="button" variant="light" onClick={() => run.update({ downloadModalOpened: true })}>{t('Файли збереженого звіту')}</Button> : null}
    </Group>
    {run.preview ? <ReportInlinePreview preview={run.preview} /> : null}
    <DocumentExportModal document={run.result?.document} opened={run.downloadModalOpened}
      title={template.Name} onClose={() => run.update({ downloadModalOpened: false })} />
  </Stack>
}
