import { Fragment, useEffect, useRef, useState } from 'react'
import { Alert, Button, Card, Group, Stack, Table, Text } from '@mantine/core'
import { getGroupedDebtorCapability, getGroupedDebtorStatement } from '../api/groupedDebtorApi'
import { formatGroupedDebtorMoney, GROUPED_DEBTOR_ROOT,
  type GroupedDebtorCapability, type GroupedDebtorStatement } from '../data/groupedDebtor'
import { downloadGroupedDebtorPdf, downloadGroupedDebtorXlsx } from '../data/downloadGroupedDebtor'
import { GROUPED_DEBTOR_DRAFT_LABEL } from '../data/groupedDebtorExport'
import { validSettlementPeriodDays } from '../data/settlementPeriod'

export function GroupedDebtorWorkbookPanel({ from, to, enabled, disabled }: {
  from: string
  to: string
  enabled: boolean
  disabled: boolean
}) {
  return <GroupedDebtorWorkbookBody key={`${from}:${to}:${enabled}`} from={from} to={to}
    enabled={enabled} disabled={disabled} />
}

function GroupedDebtorWorkbookBody({ from, to, enabled, disabled }: {
  from: string
  to: string
  enabled: boolean
  disabled: boolean
}) {
  const [capability, setCapability] = useState<GroupedDebtorCapability | null>(null)
  const [statement, setStatement] = useState<GroupedDebtorStatement | null>(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState<'xlsx' | 'pdf' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const active = useRef<AbortController | null>(null)
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    void getGroupedDebtorCapability(controller.signal).then(value => {
      if (!controller.signal.aborted) setCapability(value)
    }).catch(() => {
      if (!controller.signal.aborted) setError('Стан повного звіту дебіторки недоступний.')
    })
    return () => controller.abort()
  }, [enabled])
  useEffect(() => () => active.current?.abort(), [])

  const ready = capability?.Available === true
    && capability.SourcePopulationCertified && capability.WorkbookParityVerified
  async function run() {
    if (!ready || !enabled || disabled || loading || !validSettlementPeriodDays(from, to)) return
    active.current?.abort()
    const controller = new AbortController()
    active.current = controller
    setLoading(true); setError(null); setStatement(null)
    try {
      // The server rechecks the complete manifest and every publication in one OWN snapshot.
      const value = await getGroupedDebtorStatement(from, to, controller.signal)
      if (!controller.signal.aborted) setStatement(value)
    } catch {
      if (!controller.signal.aborted)
        setError('Повний зріз дебіторки не сформовано. Перевірте покриття після синхронізації.')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  async function download(format: 'xlsx' | 'pdf') {
    if (!statement || !ready || !enabled || disabled || loading || exporting) return
    setExporting(format); setError(null)
    try {
      if (format === 'xlsx') await downloadGroupedDebtorXlsx(statement)
      else await downloadGroupedDebtorPdf(statement)
    } catch {
      setError(`Не вдалося завантажити ${format.toUpperCase()}. Спробуйте ще раз.`)
    } finally {
      setExporting(null)
    }
  }

  return <Card className="app-section-card" withBorder radius="md" padding="md" style={{ minWidth: 0 }}>
    <Stack gap="xs">
      <Text fw={600}>Дебіторка · усі покупці</Text>
      <Text size="xs" c="dimmed">Форма 1С: організація → контрагент, група «Покупці» ({GROUPED_DEBTOR_ROOT}),
        початок, надходження, витрати й кінець у валюті взаєморозрахунків. Різні валюти не підсумовуються.</Text>
      {!ready ? <Alert color="orange">{capability?.Reason
        || 'Перевіряємо повноту популяції договорів і звірку форми. Частковий звіт недоступний.'}</Alert> : null}
      {error ? <Alert color="orange">{error}</Alert> : null}
      <Group><Button size="xs" variant="light" loading={loading}
        disabled={!ready || !enabled || disabled || !validSettlementPeriodDays(from, to)}
        onClick={() => void run()}>Сформувати повну дебіторку</Button></Group>
      {statement ? <>
        <Text size="xs" c="dimmed">{GROUPED_DEBTOR_DRAFT_LABEL}. Файли містять поточний зріз;
          точна форма книги 1С ще не підтверджена.</Text>
        <Group gap="xs">
          <Button size="xs" variant="light" loading={exporting === 'xlsx'}
            disabled={!ready || !enabled || disabled || loading || !!exporting}
            onClick={() => void download('xlsx')}>Завантажити XLSX · чернетка</Button>
          <Button size="xs" variant="light" loading={exporting === 'pdf'}
            disabled={!ready || !enabled || disabled || loading || !!exporting}
            onClick={() => void download('pdf')}>Завантажити PDF · чернетка</Button>
        </Group>
      </> : null}
      {statement ? <div style={{ overflowX: 'auto' }}><Table striped highlightOnHover>
        <Table.Thead><Table.Tr><Table.Th>Організація / контрагент</Table.Th><Table.Th>Валюта</Table.Th>
          <Table.Th>Початок</Table.Th><Table.Th>Надходження</Table.Th>
          <Table.Th>Витрати</Table.Th><Table.Th>Кінець</Table.Th></Table.Tr></Table.Thead>
        <Table.Tbody>{statement.Rows.map((row, index) => {
          const previous = statement.Rows[index - 1]
          const firstOrganization = !previous || previous.OrganizationId !== row.OrganizationId
            || previous.OrganizationNetUid !== row.OrganizationNetUid
          return <Fragment key={`${row.OrganizationId}:${row.CounterpartyId}:${row.CurrencyId}`}>
            {firstOrganization ? <Table.Tr><Table.Td colSpan={6}><Text fw={600}>{row.OrganizationName}</Text></Table.Td></Table.Tr> : null}
            <Table.Tr><Table.Td>{row.CounterpartyName}</Table.Td><Table.Td>{row.CurrencyCode}</Table.Td>
              <Table.Td>{formatGroupedDebtorMoney(row.Opening)}</Table.Td>
              <Table.Td>{formatGroupedDebtorMoney(row.Incoming)}</Table.Td>
              <Table.Td>{formatGroupedDebtorMoney(row.Outgoing)}</Table.Td>
              <Table.Td>{formatGroupedDebtorMoney(row.Closing)}</Table.Td></Table.Tr>
          </Fragment>
        })}</Table.Tbody>
      </Table>{statement.Rows.length === 0 ? <Text size="sm">За повністю покритим періодом рядків немає.</Text> : null}</div> : null}
    </Stack>
  </Card>
}
