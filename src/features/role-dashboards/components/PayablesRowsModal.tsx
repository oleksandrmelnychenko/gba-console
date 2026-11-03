import { Alert, Anchor, Button, Group, Loader, Pagination, Stack, Text } from '@mantine/core'
import { Info, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AppModal } from '../../../shared/ui/AppModal'
import { TableChip } from '../../../shared/ui/TableChip'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import { useCallback, useReducer, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useWorkdayResource } from '../../sales-cockpit/hooks/useWorkdayResource'
import { getPayablesRows } from '../api/dashboardPayablesApi'
import type { PayablesRows, PayablesSelection, PayablesWorkspace } from '../payablesTypes'
import { formatPayablesAmount, formatPayablesDate, matchesPayablesSelection, payablesGridFromDate, payablesSettlementRoute, payablesScopeTitle } from './payablesPresentation'

export function PayablesRowsModal({ workspace, selected, onClose }: { workspace: PayablesWorkspace; selected: PayablesSelection; onClose: () => void }) {
  const { t } = useI18n()
  const [page, setPage] = useState(1)
  const [revision, refresh] = useReducer((value: number) => value + 1, 0)
  const load = useCallback((signal: AbortSignal) => getPayablesRows({ workspace, asOfDate: selected.asOfDate, currencyCode: selected.bucket.currencyCode, ...(selected.partyKind === undefined ? {} : { partyKind: selected.partyKind }), offset: (page - 1) * 50, limit: 50 }, signal), [workspace, selected, page])
  const state = useWorkdayResource(load, `${page}:${revision}`)
  const title = `${t(payablesScopeTitle(selected.partyKind))} · ${selected.bucket.currencyCode}`
  return <AppModal opened onClose={onClose} title={title} size="min(1180px, calc(100vw - 32px))" closeButtonProps={{ 'aria-label': t('Закрити розшифровку') }}>
    <Stack gap={8}>
      <Group justify="space-between"><Text className="role-dashboard-source-date" size="sm">{t('Станом на кінець дня')}: {formatPayablesDate(selected.asOfDate)}</Text><Button leftSection={<RefreshCw size={14} />} size="xs" variant="default" onClick={refresh}>{t('Повторити читання')}</Button></Group>
      <details className="role-dashboard-data-details"><summary><Info size={14} />{t('Про дані')}</summary>
      <Text size="xs">{t('Від’ємне сальдо означає борг за договором, додатне — аванс або переплату.')}</Text>
      <Text size="xs">{t('Сальдо договору збігається з «Залишком на початок» у взаєморозрахунках з датою «з»')} {payablesGridFromDate(selected.asOfDate)}.</Text>
      </details>
      {state.loading && <Loader aria-label={t('Завантаження розшифровки')} />}
      {state.error && <Alert color="red">{state.error}</Alert>}
      {state.data && <PayablesRowsContents data={state.data} selected={selected} page={page} onPage={setPage} />}
    </Stack>
  </AppModal>
}

function PayablesRowsContents({ data, selected, page, onPage }: { data: PayablesRows; selected: PayablesSelection; page: number; onPage: (value: number) => void }) {
  const { t } = useI18n()
  if (!matchesPayablesSelection(data, selected)) return <Alert color="red">{t('Розшифровка не відповідає підсумкам панелі. Закрийте її та оновіть відображення.')}</Alert>
  return <>
    <Text className="role-dashboard-source-date" size="sm">{t('Договорів')}: {data.total} · {t('Борг')}: {formatPayablesAmount(data.aggregate.payable)} · {t('Аванси')}: {formatPayablesAmount(data.aggregate.advance)} · {selected.bucket.currencyCode}</Text>
    {data.rows.length === 0 ? <Text>{t('Немає договорів для обраної валюти.')}</Text> : <DataTable
      tableId="dashboard-payables-rows"
      data={data.rows}
      getRowId={row => row.id}
      minWidth={720}
      columns={[
        { id: 'supplier', header: t(selected.partyKind === 2 ? 'Постачальник' : 'Контрагент'), accessor: row => row.supplierName || '', minWidth: 190, fill: true,
          cell: row => <><Anchor component={Link} to={payablesSettlementRoute(row)} size="sm" fw={600} lineClamp={2} title={t('Відкрити взаєморозрахунки')}>{row.supplierName || t('Без назви')}</Anchor><TableChip tone="document" value={t(row.partyKind === 2 ? 'Товари' : 'Послуги та інші розрахунки')} /></> },
        { id: 'agreement', header: t('Договір'), accessor: row => row.agreementName || '', width: 160, cell: row => <TableChip value={row.agreementName} /> },
        { id: 'organization', header: t('Організація'), accessor: row => row.organizationName || '', width: 150, cell: row => <TableChip tone="product" value={row.organizationName} /> },
        { id: 'balance', header: t('Сальдо'), accessor: row => row.signedBalance, align: 'right', width: 150, cell: row => row.known ? <span className="app-money">{formatPayablesAmount(row.signedBalance)}</span> : <TableChip tone="warning" value={t('Сума приходу не підтверджена')} /> },
        { id: 'payable', header: t('Борг'), accessor: row => row.payable, align: 'right', width: 125, cell: row => <span className="app-money">{formatPayablesAmount(row.payable)}</span> },
        { id: 'advance', header: t('Аванс'), accessor: row => row.advance, align: 'right', width: 125, cell: row => <span className="app-money">{formatPayablesAmount(row.advance)}</span> },
      ]}
    />}
    {(data.total > 50 || page > 1) && <Pagination value={page} total={Math.max(page, Math.ceil(data.total / 50))} onChange={onPage} />}
  </>
}
