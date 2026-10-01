import { Alert, Button, Group, Stack, Table, Text, TextInput } from '@mantine/core'
import { useState } from 'react'
import { ApiError } from '../../../shared/api/apiClient'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DocumentExportModal } from '../../../shared/ui/document-export-modal/DocumentExportModal'
import { previewOriginalBuyerSalesShare } from '../api/originalBuyerSalesShareApi'
import {
  originalBuyerSalesShareCellText,
  originalBuyerSalesShareMonthError,
  isOriginalBuyerSalesShareCapabilities,
  type OriginalBuyerSalesShareCapabilities,
  type OriginalBuyerSalesShareReport,
} from '../data/originalBuyerSalesShare'
import { useReportRunState } from '../hooks/useReportRunState'
import { normalizeReportResult } from '../utils'

export function OriginalBuyerSalesShareReportPanel({ capability, initialMonth, canGenerate, callerKey, onLoadingChange }: {
  capability: OriginalBuyerSalesShareCapabilities
  initialMonth: string
  canGenerate: boolean
  callerKey: string | null
  onLoadingChange?: (loading: boolean) => void
}) {
  const { t } = useI18n()
  const [month, setMonth] = useState(initialMonth)
  const run = useReportRunState<OriginalBuyerSalesShareReport>(JSON.stringify([callerKey, canGenerate, capability, month]))
  const monthError = originalBuyerSalesShareMonthError(month)
  const executable = isOriginalBuyerSalesShareCapabilities(capability) && capability.Executable
  const canSubmit = canGenerate && executable && !monthError && !run.isLoading
  const report = run.lastRun
  const hasFiles = Boolean(run.result?.document.DocumentURL || run.result?.document.PdfDocumentURL)

  async function generate(openFiles: boolean) {
    if (!canSubmit) return
    const updateAttempt = run.begin()
    onLoadingChange?.(true)
    try {
      const response = await previewOriginalBuyerSalesShare(capability, month)
      const result = normalizeReportResult(response)
      updateAttempt({ result, lastRun: response, downloadModalOpened: openFiles && Boolean(result.document.DocumentURL || result.document.PdfDocumentURL) })
    } catch (error) {
      updateAttempt({ error: error instanceof ApiError || error instanceof Error ? error.message : 'Не вдалося сформувати звіт.' })
    } finally {
      updateAttempt({ isLoading: false })
      onLoadingChange?.(false)
    }
  }

  return <Stack gap="md">
    <Text size="sm">{t('Виберіть місячний період. Попередній період — попередній календарний місяць.')}</Text>
    <Text size="sm" c="dimmed">{t('Частка розраховується за сумами продажів і повернень без ПДВ. Попередні продажі й повернення визначають, чи клієнт є новим або повторним.')}</Text>
    <Text size="sm" c="dimmed">{t('Значення частки подається як відношення сум; відсотком є зміна між місяцями.')}</Text>
    <TextInput type="month" label={t('Період')} value={month} disabled={!canGenerate || run.isLoading}
      onChange={event => setMonth(event.currentTarget.value)} />
    {!canGenerate ? <Alert color="yellow">{t('Недостатньо прав для формування звітів.')}</Alert> : null}
    {!executable ? <Alert color="yellow">{t('Сервер ще не підтримує формування цього конструктора.')}</Alert> : null}
    {monthError ? <Alert color="yellow">{t(monthError)}</Alert> : null}
    {run.error ? <Alert color="red">{t(run.error)}</Alert> : null}
    <Group>
      <Button type="button" variant="light" disabled={!canSubmit} loading={run.isLoading} onClick={() => { void generate(false) }}>{t('Переглянути')}</Button>
      <Button type="button" disabled={!canSubmit} onClick={() => { void generate(true) }}>{t('Сформувати')}</Button>
      {hasFiles ? <Button type="button" variant="light" onClick={() => run.update({ downloadModalOpened: true })}>{t('Файли звіту')}</Button> : null}
    </Group>
    {report ? <section aria-label={t('Результат частки продажів')}>
      <Text size="sm">{t('Період')}: {report.Month}</Text>
      <Table.ScrollContainer minWidth={640}>
        <Table>
          <Table.Thead><Table.Tr>{report.Columns.map(column => <Table.Th key={column.Key}>{column.Caption}</Table.Th>)}</Table.Tr></Table.Thead>
          <Table.Tbody><Table.Tr>{report.Cells.map((cell, index) => <Table.Td key={cell.Key}
            title={cell.Available ? undefined : t('Недоступні дані')}>
            {originalBuyerSalesShareCellText(cell.Value, report.Columns[index].DecimalPlaces)}
          </Table.Td>)}</Table.Tr></Table.Tbody>
          <Table.Tfoot><Table.Tr aria-label={t('Загальний підсумок')}>{report.TotalCells.map((cell, index) => <Table.Td key={cell.Key}
            title={cell.Available ? undefined : t('Недоступні дані')}>
            {originalBuyerSalesShareCellText(cell.Value, report.Columns[index].DecimalPlaces)}
          </Table.Td>)}</Table.Tr></Table.Tfoot>
        </Table>
      </Table.ScrollContainer>
      {report.Cells.some(cell => !cell.Available) ? <Alert color="yellow">{t('Порожні клітинки позначають недоступні значення розрахунку.')}</Alert> : null}
      <UnavailableInputs report={report} />
    </section> : null}
    <DocumentExportModal document={run.result?.document} opened={run.downloadModalOpened}
      title={`${capability.Title}: ${report?.Month ?? month}`} onClose={() => run.update({ downloadModalOpened: false })} />
  </Stack>
}

function UnavailableInputs({ report }: { report: OriginalBuyerSalesShareReport }) {
  const { t } = useI18n()
  const labels = { Current: 'Поточний місяць', Previous: 'Попередній місяць' }
  const kinds = { UnknownMoneyLines: 'Суми продажів', UnknownClientLines: 'Клієнти документів', UnknownHistoryLines: 'Попередня активність клієнтів' }
  const missing = (Object.keys(labels) as Array<keyof typeof labels>).flatMap(period =>
    (Object.keys(kinds) as Array<keyof typeof kinds>).filter(key => report.Inputs[period][key] > 0)
      .map(key => `${t(labels[period])}: ${t(kinds[key])}`))
  return missing.length ? <Text size="sm">{t('Дані недоступні')}: {missing.join('; ')}.</Text> : null
}
