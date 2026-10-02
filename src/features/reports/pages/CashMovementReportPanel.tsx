import { Alert, Button, Group, Stack, Table, Text, TextInput } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DocumentExportModal } from '../../../shared/ui/document-export-modal/DocumentExportModal'
import type { CashMovementCapabilities, CashMovementCell, CashMovementReport } from '../data/cashMovement'
import { useCashMovementReport } from '../hooks/useCashMovementReport'

export function CashMovementReportPanel({ capability, initialMonth, canGenerate, callerKey, onLoadingChange }: {
  capability: CashMovementCapabilities; initialMonth: string; canGenerate: boolean; callerKey: string | null
  onLoadingChange?: (loading: boolean) => void
}) {
  const { t } = useI18n()
  const { kind, period, setPeriod, periodError, executable, canSubmit, run, hasFiles, generate } = useCashMovementReport({
    capability, initialMonth, canGenerate, callerKey, onLoadingChange,
  })
  const report = run.lastRun
  return <Stack gap="md">
    <Text size="sm">{t(kind === 'receipts'
      ? 'Надходження коштів за квартал із поточних даних GBA. Порівняння з попереднім календарним кварталом.'
      : 'Виплати коштів за місяць із поточних даних GBA. Порівняння з попереднім календарним місяцем.')}</Text>
    <TextInput type={kind === 'receipts' ? 'text' : 'month'} label={t(kind === 'receipts' ? 'Квартал' : 'Місяць')}
      placeholder={kind === 'receipts' ? '2026-Q3' : undefined} description={kind === 'receipts' ? t('Формат: РРРР-Q1, Q2, Q3 або Q4') : undefined}
      value={period} disabled={!canGenerate || run.isLoading} onChange={event => setPeriod(event.currentTarget.value)} />
    <Text size="sm" c="dimmed">{t('Доступний відбір за періодом. Інші відбори цієї форми ще недоступні.')}</Text>
    {!canGenerate ? <Alert color="yellow">{t('Недостатньо прав для формування звітів.')}</Alert> : null}
    {!executable ? <Alert color="yellow">{t('Сервер ще не підтримує формування цього конструктора.')}</Alert> : null}
    {periodError ? <Alert color="yellow">{t(periodError)}</Alert> : null}
    {run.error ? <Alert color="red">{t(run.error)}</Alert> : null}
    <Group>
      <Button type="button" variant="light" disabled={!canSubmit} loading={run.isLoading} onClick={() => { void generate(false) }}>{t('Переглянути')}</Button>
      <Button type="button" disabled={!canSubmit} onClick={() => { void generate(true) }}>{t('Сформувати')}</Button>
      {hasFiles ? <Button type="button" variant="light" onClick={() => run.update({ downloadModalOpened: true })}>{t('Файли звіту')}</Button> : null}
    </Group>
    {report ? <CashMovementResult report={report} /> : null}
    <DocumentExportModal document={run.result?.document} opened={run.downloadModalOpened}
      title={`${capability.Title}: ${report?.Period ?? period}`} onClose={() => run.update({ downloadModalOpened: false })} />
  </Stack>
}
function CashMovementResult({ report }: { report: CashMovementReport }) {
  const { t } = useI18n()
  const unavailable = report.Totals.some(cell => !cell.Available) || report.Rows.some(row => row.Cells.some(cell => !cell.Available))
  const currencyName = (input: CashMovementReport['Inputs']['Current']) => input.Publication.ManagementCurrency.Available
    && input.Publication.ManagementCurrency.Currency?.Name.trim() ? input.Publication.ManagementCurrency.Currency.Name : t('Назва валюти недоступна')
  function renderCells(cells: CashMovementCell[]) {
    return cells.map(cell => <Table.Td key={cell.Key} title={!cell.Available ? t('Недоступні дані') : cell.Value === null ? t('У періоді немає даних') : undefined}>
      {cell.FormattedValue ?? '—'}
    </Table.Td>)
  }
  return <section aria-label={t('Результат руху коштів')}>
    <Text size="sm">{t('Період')}: {report.Period}</Text>
    <Text size="sm">{t('Валюта поточного періоду')}: {currencyName(report.Inputs.Current)}; {t('Валюта попереднього періоду')}: {currencyName(report.Inputs.Previous)}</Text>
    {report.Complete && !report.HasRows ? <Alert color="blue">{t('У вибраних періодах немає руху коштів.')}</Alert> : null}
    <Table.ScrollContainer minWidth={800}>
      <Table>
        <Table.Thead><Table.Tr><Table.Th>{t('Контрагент')}</Table.Th>{report.Columns.map(column => <Table.Th key={column.Key}>{column.Caption}</Table.Th>)}</Table.Tr></Table.Thead>
        <Table.Tbody>{report.Rows.map(row => <Table.Tr key={row.GroupKey}><Table.Td>{row.NameAvailable ? row.Name : t('Назва контрагента недоступна')}</Table.Td>
          {renderCells(row.Cells)}</Table.Tr>)}
          <Table.Tr><Table.Th scope="row">{t('Разом')}</Table.Th>{renderCells(report.Totals)}</Table.Tr>
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
    {!report.Complete ? <Alert color="yellow">{t('Звіт неповний: синхронізовані рухи коштів за вибрані періоди ще не підтверджені.')}</Alert> : null}
    {report.HasRows && unavailable ? <Alert color="yellow">{t('Не всі показники вдалося розрахувати.')}</Alert> : null}
    {report.Rows.some(row => !row.NameAvailable) ? <Alert color="yellow">{t('Для частини контрагентів назви ще недоступні. Суми збережено.')}</Alert> : null}
  </section>
}
