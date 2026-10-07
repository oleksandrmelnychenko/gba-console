import { Alert, Button, Group, MultiSelect, Stack, Table, Text, TextInput } from '@mantine/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { readStatement } from '../api/originalCounterpartyStatementApi'
import { statementPeriodError, statementRequest, type StatementCapability, type StatementChoice, type StatementResult } from '../data/originalCounterpartyStatement'
import { statementCsv, statementExportError, statementHeaders, statementLines, statementPdf, statementUnitNote, statementValues, statementXlsx } from '../data/originalCounterpartyStatementExport'
import { useReportRunState } from '../hooks/useReportRunState'
const formats = ['csv', 'xlsx', 'pdf'] as const
const labels = { orgs: 'Організації', parties: 'Контрагенти', agreements: 'Договори' }
type Selection = { orgs: string[]; parties: string[]; agreements: string[] }
type Choices = { orgs: StatementChoice[]; parties: StatementChoice[]; agreements: StatementChoice[] }
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), anchor = document.createElement('a')
  anchor.href = url; anchor.download = name; document.body.append(anchor); anchor.click(); anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
function retain(current: StatementChoice[], previous: StatementChoice[], selected: string[]) {
  const selectedKeys = new Set(selected), currentKeys = new Set(current.map(c => c.Key))
  return [...current, ...previous.filter(p => selectedKeys.has(p.Key) && !currentKeys.has(p.Key))]
}
function StatementTable({ result }: { result: StatementResult }) {
  const { t } = useI18n(), [page, setPage] = useState(0), lines = useMemo(() => statementLines(result), [result])
  const current = Math.min(page, Math.max(0, Math.ceil(lines.length / 50) - 1)), offset = current * 50
  return <Stack gap="xs"><Group justify="space-between">
    <Button variant="light" size="xs" disabled={current === 0} onClick={() => setPage(current - 1)}>{t('Попередні рядки')}</Button>
    <Text size="xs">{lines.length ? offset + 1 : 0}–{Math.min(lines.length, offset + 50)} / {lines.length}</Text>
    <Button variant="light" size="xs" disabled={offset + 50 >= lines.length} onClick={() => setPage(current + 1)}>{t('Наступні рядки')}</Button>
  </Group><Table.ScrollContainer minWidth={1300}><Table striped><Table.Thead><Table.Tr>
    {statementHeaders.map(h => <Table.Th key={h}>{t(h)}</Table.Th>)}
  </Table.Tr></Table.Thead><Table.Tbody>{lines.slice(offset, offset + 50).map(line => <Table.Tr key={line.key} fw={line.subtotal ? 600 : undefined}>
    {line.cells.map((cell, i) => <Table.Td key={statementHeaders[i]} className={i >= 3 ? 'app-money' : undefined}>{cell}</Table.Td>)}
  </Table.Tr>)}</Table.Tbody>{result.Totals ? <Table.Tfoot><Table.Tr><Table.Th colSpan={3}>{t('Разом')}</Table.Th>
    {statementValues(result.Totals).map((cell, i) => <Table.Td key={statementHeaders[i + 3]} className="app-money">{cell}</Table.Td>)}
  </Table.Tr></Table.Tfoot> : null}</Table></Table.ScrollContainer>
    {!lines.length ? <Text>{t('У повністю перевіреному зрізі рядків немає.')}</Text> : null}</Stack>
}
function useStatementRun(capability: StatementCapability, caller: string | null, allowed: boolean, from: string, through: string,
  selected: Selection, key: string, accept: (result: StatementResult) => void) {
  const run = useReportRunState<StatementResult>(key), active = useRef<AbortController | null>(null), latest = useRef(key), [exporting, setExporting] = useState(false)
  useEffect(() => { latest.current = key; return () => { latest.current = ''; active.current?.abort() } }, [key])
  const permitted = allowed && !!caller && capability.Executable, error = statementPeriodError(from, through), report = run.lastRun
  function invalidate() { latest.current = ''; active.current?.abort(); run.clear() }
  async function generate() {
    if (!permitted || error || run.isLoading || exporting) return
    active.current?.abort(); const controller = new AbortController(); active.current = controller; latest.current = key; const update = run.begin()
    try {
      const result = await readStatement(statementRequest(capability, from, through, selected.orgs, selected.parties, selected.agreements), controller.signal)
      if (controller.signal.aborted) return
      update({ lastRun: result }); if (result.NormalInputsComplete) accept(result)
    } catch (failure) { if (!controller.signal.aborted) update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати відомість.' }) }
    finally { update({ isLoading: false }) }
  }
  async function exportFile(format: typeof formats[number]) {
    if (!permitted || !report?.Available || exporting || statementExportError(report)) return
    setExporting(true)
    try {
      const blob = format === 'csv' ? new Blob([statementCsv(report)], { type: 'text/csv;charset=utf-8' }) : format === 'xlsx' ? await statementXlsx(report) : await statementPdf(report)
      if (latest.current === key) download(blob, `counterparty-statement-${report.From}-${report.Through}.${format}`)
    } catch (failure) { if (latest.current === key) run.update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати файл.' }) }
    finally { setExporting(false) }
  }
  return { run, permitted, error, report, exporting, invalidate, generate, exportFile }
}
export function OriginalCounterpartyStatementPanel({ capability, callerKey, canGenerate, initialFrom, initialThrough }: {
  capability: StatementCapability; callerKey: string | null; canGenerate: boolean; initialFrom: string; initialThrough: string
}) {
  const { t } = useI18n(), [from, setFrom] = useState(initialFrom), [through, setThrough] = useState(initialThrough)
  const [selection, setSelection] = useState<{ scope: string; values: Selection }>({ scope: '', values: { orgs: [], parties: [], agreements: [] } })
  const [choices, setChoices] = useState<{ scope: string; values: Choices; fresh: Choices } | null>(null)
  const scope = JSON.stringify([callerKey, canGenerate, capability, from, through]), current = choices?.scope === scope ? choices : null
  const values = selection.scope === scope ? selection.values : { orgs: [], parties: [], agreements: [] }
  const key = JSON.stringify([scope, values])
  const delivery = useStatementRun(capability, callerKey, canGenerate, from, through, values, key, result => {
    const fresh = { orgs: result.OrganizationChoices, parties: result.CounterpartyChoices, agreements: result.AgreementChoices }
    setChoices(previous => ({ scope, fresh, values: {
      orgs: retain(fresh.orgs, previous?.scope === scope ? previous.values.orgs : [], values.orgs),
      parties: retain(fresh.parties, previous?.scope === scope ? previous.values.parties : [], values.parties),
      agreements: retain(fresh.agreements, previous?.scope === scope ? previous.values.agreements : [], values.agreements),
    } }))
  })
  const busy = delivery.run.isLoading || delivery.exporting, result = delivery.report
  function choose(field: keyof Selection, selected: string[]) {
    delivery.invalidate(); setSelection({ scope, values: { ...values, [field]: selected } })
    const selectedKeys = new Set(selected), freshKeys = new Set(current?.fresh[field].map(c => c.Key) ?? [])
    setChoices(previous => previous?.scope === scope ? { ...previous, values: { ...previous.values,
      [field]: previous.values[field].filter(c => selectedKeys.has(c.Key) || freshKeys.has(c.Key)),
    } } : previous)
  }
  return <Stack gap="md"><Text>{t('Організація → контрагент → договір. Початок, прихід, витрата й кінець для обох записаних ресурсів.')}</Text>
    <Group grow><TextInput type="date" label={t('Початок періоду')} value={from} disabled={busy} onChange={e => { delivery.invalidate(); setFrom(e.currentTarget.value) }} />
      <TextInput type="date" label={t('Кінець періоду (включно)')} value={through} disabled={busy} onChange={e => { delivery.invalidate(); setThrough(e.currentTarget.value) }} /></Group>
    <Group grow>{(['orgs', 'parties', 'agreements'] as const).map(field => {
      const selected = values[field], options = current?.values[field] ?? []
      return <MultiSelect key={field} label={t(labels[field])} data={options.map(c => ({ value: c.Key, label: c.Caption }))} value={selected}
        searchable clearable maxValues={256} disabled={busy || (!options.length && !selected.length)} onChange={v => choose(field, v)} />
    })}</Group>
    <Text size="sm" c="dimmed">{t(statementUnitNote)}</Text>
    {delivery.error ? <Alert color="yellow">{t(delivery.error)}</Alert> : null}
    {delivery.run.error ? <Alert color="red">{t(delivery.run.error)}</Alert> : null}
    <Group><Button loading={delivery.run.isLoading} disabled={!delivery.permitted || !!delivery.error || busy} onClick={() => { void delivery.generate() }}>{t('Сформувати')}</Button>
      {formats.map(format => <Button key={format} variant="light" disabled={!delivery.permitted || !result?.Available || busy || !!statementExportError(result)}
        onClick={() => { void delivery.exportFile(format) }}>{format.toUpperCase()}</Button>)}</Group>
    {result && !result.Available ? <Alert color="yellow">{t(result.Code === 'original_counterparty_statement_agreement_metadata_unavailable'
      ? 'Не всі потрібні договори мають однозначну ознаку обліку за документами у звичайних даних Fenix.'
      : 'Повний початковий залишок і всі місячні рухи обох регістрів недоступні; частковий звіт не формується.')}
      {result.Dependency?.MissingMonth ? ` ${result.Dependency.MissingMonth}` : ''}</Alert> : null}
    {result?.Available ? <>{result.MissingCaptionMappings.length ? <Text>{t('Частина назв недоступна; усі ключі й суми включено окремо без об’єднання за назвами.')}</Text> : null}
      <StatementTable key={result.ResultSha256} result={result} /></> : null}
  </Stack>
}
