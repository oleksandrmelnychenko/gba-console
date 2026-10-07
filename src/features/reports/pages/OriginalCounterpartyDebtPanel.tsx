import { Alert, Button, Checkbox, Group, MultiSelect, Select, Stack, Table, Text, TextInput } from '@mantine/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { readDebt } from '../api/originalCounterpartyDebtApi'
import { debtInstantError, debtRequest, type DebtCapability, type DebtChoice, type DebtResult } from '../data/originalCounterpartyDebt'
import { debtCsv, debtExportError, debtHeaders, debtLines, debtPdf, debtUnitNote, debtValues, debtXlsx } from '../data/originalCounterpartyDebtExport'
import { useReportRunState } from '../hooks/useReportRunState'

const formats = ['csv', 'xlsx', 'pdf'] as const
const dependencies: Record<string, string> = {
  original_counterparty_debt_opening_publication_unavailable: 'Немає повного початкового залишку взаєморозрахунків для цього моменту.',
  original_counterparty_debt_month_publication_unavailable: 'Не всі місячні рухи взаєморозрахунків синхронізовані повністю.',
  original_counterparty_debt_normal_storage_unavailable: 'Сховище початкових залишків і рухів ще недоступне.',
  original_counterparty_debt_recent_opening_required: 'Потрібен новіший повний початковий залишок взаєморозрахунків.',
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), a = document.createElement('a')
  a.href = url; a.download = name; document.body.append(a); a.click(); a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
function retainChoices(current: DebtChoice[], previous: DebtChoice[], selected: string[]) {
  const selectedKeys = new Set(selected), currentKeys = new Set(current.map(c => c.Key))
  return [...current, ...previous.filter(p => selectedKeys.has(p.Key) && !currentKeys.has(p.Key))]
}

function DebtTable({ result }: { result: DebtResult }) {
  const { t } = useI18n(), [page, setPage] = useState(0), lines = useMemo(() => debtLines(result), [result]), headers = debtHeaders(result)
  const current = Math.min(page, Math.max(0, Math.ceil(lines.length / 50) - 1)), offset = current * 50
  return <Stack gap="xs"><Group justify="space-between">
    <Button variant="light" size="xs" disabled={current === 0} onClick={() => setPage(current - 1)}>{t('Попередні рядки')}</Button>
    <Text size="xs">{lines.length ? offset + 1 : 0}–{Math.min(lines.length, offset + 50)} / {lines.length}</Text>
    <Button variant="light" size="xs" disabled={offset + 50 >= lines.length} onClick={() => setPage(current + 1)}>{t('Наступні рядки')}</Button>
  </Group><Table.ScrollContainer minWidth={800}><Table striped><Table.Thead><Table.Tr>
    {headers.map(h => <Table.Th key={h}>{t(h)}</Table.Th>)}
  </Table.Tr></Table.Thead><Table.Tbody>{lines.slice(offset, offset + 50).map(line => <Table.Tr key={line.key} fw={line.subtotal ? 600 : undefined}>
    {line.cells.map((cell, i) => <Table.Td key={headers[i]} className={i >= 2 ? 'app-money' : undefined}>{cell}</Table.Td>)}
  </Table.Tr>)}</Table.Tbody>{result.Totals ? <Table.Tfoot><Table.Tr><Table.Th colSpan={2}>{t('Разом')}</Table.Th>
    {debtValues(result.Totals, result.IncludeSettlement).map((cell, i) => <Table.Td key={headers[i + 2]} className="app-money">{cell}</Table.Td>)}
  </Table.Tr></Table.Tfoot> : null}</Table></Table.ScrollContainer>
    {!lines.length ? <Text>{t('У повністю перевіреному зрізі рядків немає.')}</Text> : null}
  </Stack>
}

function useDebtRun(capability: DebtCapability, callerKey: string | null, canGenerate: boolean, asOf: string, kind: number,
  settlement: boolean, orgs: string[], parties: string[], key: string, accepted: (result: DebtResult) => void) {
  const run = useReportRunState<DebtResult>(key), active = useRef<AbortController | null>(null), latest = useRef(key), [exporting, setExporting] = useState(false)
  useEffect(() => { latest.current = key; return () => { latest.current = ''; active.current?.abort() } }, [key])
  const permitted = canGenerate && !!callerKey && capability.Executable, error = debtInstantError(asOf), report = run.lastRun
  function invalidate() { latest.current = ''; active.current?.abort(); run.clear() }
  async function generate() {
    if (!permitted || error || run.isLoading || exporting) return
    active.current?.abort(); const controller = new AbortController(); active.current = controller; latest.current = key; const update = run.begin()
    try {
      const result = await readDebt(debtRequest(capability, asOf, kind, settlement, orgs, parties), controller.signal)
      if (controller.signal.aborted) return
      update({ lastRun: result }); if (result.NormalInputsComplete) accepted(result)
    } catch (failure) { if (!controller.signal.aborted) update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати заборгованість.' }) }
    finally { update({ isLoading: false }) }
  }
  async function exportFile(format: typeof formats[number]) {
    if (!permitted || !report?.Available || exporting || debtExportError(report)) return
    setExporting(true)
    try {
      const blob = format === 'csv' ? new Blob([debtCsv(report)], { type: 'text/csv;charset=utf-8' }) : format === 'xlsx' ? await debtXlsx(report) : await debtPdf(report)
      if (latest.current === key) download(blob, `counterparty-debt-${report.AsOf.replaceAll(':', '-')}.${format}`)
    } catch (failure) { if (latest.current === key) run.update({ error: failure instanceof Error ? failure.message : 'Не вдалося сформувати файл.' }) }
    finally { setExporting(false) }
  }
  return { run, permitted, error, report, exporting, invalidate, generate, exportFile }
}

export function OriginalCounterpartyDebtPanel({ capability, callerKey, canGenerate, initialAsOf }: {
  capability: DebtCapability; callerKey: string | null; canGenerate: boolean; initialAsOf: string
}) {
  const { t } = useI18n(), [asOf, setAsOf] = useState(initialAsOf), [kind, setKind] = useState(0), [settlement, setSettlement] = useState(false)
  const [selection, setSelection] = useState<{ scope: string; orgs: string[]; parties: string[] }>({ scope: '', orgs: [], parties: [] })
  const [choices, setChoices] = useState<{ scope: string; orgs: DebtChoice[]; parties: DebtChoice[]; freshOrgs: string[]; freshParties: string[] } | null>(null)
  const scope = JSON.stringify([callerKey, canGenerate, capability, asOf]), current = choices?.scope === scope ? choices : null
  const orgs = selection.scope === scope ? selection.orgs : [], parties = selection.scope === scope ? selection.parties : []
  const key = JSON.stringify([scope, kind, settlement, orgs, parties])
  const delivery = useDebtRun(capability, callerKey, canGenerate, asOf, kind, settlement, orgs, parties, key,
    result => setChoices(previous => ({ scope, orgs: retainChoices(result.OrganizationChoices, previous?.scope === scope ? previous.orgs : [], orgs),
      parties: retainChoices(result.CounterpartyChoices, previous?.scope === scope ? previous.parties : [], parties),
      freshOrgs: result.OrganizationChoices.map(c => c.Key), freshParties: result.CounterpartyChoices.map(c => c.Key) })))
  const busy = delivery.run.isLoading || delivery.exporting, result = delivery.report
  function choose(field: 'orgs' | 'parties', values: string[]) {
    delivery.invalidate(); setSelection({ scope, orgs: field === 'orgs' ? values : orgs, parties: field === 'parties' ? values : parties })
    const selectedKeys = new Set(values)
    setChoices(previous => {
      if (previous?.scope !== scope) return previous
      const freshOrgs = new Set(previous.freshOrgs), freshParties = new Set(previous.freshParties)
      return { ...previous,
        orgs: previous.orgs.filter(c => field !== 'orgs' || selectedKeys.has(c.Key) || freshOrgs.has(c.Key)),
        parties: previous.parties.filter(c => field !== 'parties' || selectedKeys.has(c.Key) || freshParties.has(c.Key)) }
    })
  }
  return <Stack gap="md"><Text>{t('Організація → контрагент. Типово показано управлінську суму; сума взаєморозрахунків є окремою необов’язковою колонкою.')}</Text>
    <TextInput type="datetime-local" step={1} label={t('Момент залишку (до)')} value={asOf} disabled={busy} onChange={e => { delivery.invalidate(); setAsOf(e.currentTarget.value.length === 16 ? e.currentTarget.value + ':00' : e.currentTarget.value) }} />
    <Select label={t('Вид заборгованості')} data={[{ value: '0', label: t('Усі') }, { value: '1', label: t('Позитивна сума взаєморозрахунків') }, { value: '2', label: t('Від’ємна сума взаєморозрахунків') }]}
      value={String(kind)} disabled={busy} onChange={v => { delivery.invalidate(); setKind(Number(v ?? '0')) }} />
    <Checkbox label={t('Додаткова сума взаєморозрахунків')} checked={settlement} disabled={busy} onChange={e => { delivery.invalidate(); setSettlement(e.currentTarget.checked) }} />
    <Group grow>{(['orgs', 'parties'] as const).map(field => { const values = field === 'orgs' ? orgs : parties, options = current?.[field] ?? []
      return <MultiSelect key={field} label={t(field === 'orgs' ? 'Організації' : 'Контрагенти')} data={options.map(c => ({ value: c.Key, label: c.Caption }))}
        value={values} searchable clearable maxValues={256} disabled={busy || (!options.length && !values.length)} onChange={values => choose(field, values)} />
    })}</Group>
    <Text size="sm" c="dimmed">{t(debtUnitNote)}</Text>
    {delivery.error ? <Alert color="yellow">{t(delivery.error)}</Alert> : null}
    {delivery.run.error ? <Alert color="red">{t(delivery.run.error)}</Alert> : null}
    <Group><Button loading={delivery.run.isLoading} disabled={!delivery.permitted || !!delivery.error || busy} onClick={() => { void delivery.generate() }}>{t('Сформувати')}</Button>
      {formats.map(format => <Button key={format} variant="light" disabled={!delivery.permitted || !result?.Available || busy || !!debtExportError(result)}
        onClick={() => { void delivery.exportFile(format) }}>{format.toUpperCase()}</Button>)}</Group>
    {result && !result.Available ? <Alert color="yellow">{t(dependencies[result.Code] ?? 'Повний узгоджений початковий залишок і рухи недоступні; частковий звіт не формується.')}
      {result.Dependency?.MissingMonth ? ` ${result.Dependency.MissingMonth}` : ''}</Alert> : null}
    {result?.Available ? <>{result.MissingCaptionMappings.length ? <Text>{t('Частина назв недоступна; усі ключі й суми включено окремо без об’єднання за назвами.')}</Text> : null}
      <DebtTable key={result.ResultSha256} result={result} /></> : null}
  </Stack>
}
