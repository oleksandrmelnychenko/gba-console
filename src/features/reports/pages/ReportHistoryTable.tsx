import { Button, Group, Loader, Text, UnstyledButton } from '@mantine/core'
import { ChevronRight } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import { TableRowAction } from '../../../shared/ui/table-row-action/TableRowAction'
import { TableChip } from '../../../shared/ui/TableChip'
import type { ReportHistoryItem } from '../api/reportHistoryApi'
import type { WorkbookLaunch } from '../data/bug1274WorkbookLaunch'
import { historyReportKeyName, historySummary, historyTime, movementHistorySummary, type ReportHistoryAction } from '../data/reportHistory'
import { BUG_1274_ACTIVE_DATA_SOURCES } from '../data/reportMigration'
import type { ReportDataset } from '../types'

export type HistoryGrouping = 'day' | 'report'
export type HistoryGroup = { key: string; title: string; count: number; from: string; to: string; reports: string[] }
export type HistoryGroupState = { items: ReportHistoryItem[]; loading: boolean; error: string | null; done: boolean }

type EntryRow = {
  id: string
  kind: 'entry'
  item: ReportHistoryItem
  name: string
  period?: string
  filters?: string
  unavailable?: string
}

type HistoryRow =
  | EntryRow
  | { id: string; kind: 'group'; group: HistoryGroup; expanded: boolean }
  | { id: string; kind: 'status'; group: HistoryGroup; state?: HistoryGroupState }

type EntryColumn = Omit<DataTableColumn<HistoryRow>, 'cell'> & { cell: (row: EntryRow) => ReactNode }

type Props = {
  groups: HistoryGroup[]
  grouping: HistoryGrouping
  opened: string[]
  groupStates: Record<string, HistoryGroupState>
  datasets: readonly ReportDataset[]
  launches: readonly WorkbookLaunch[]
  userLabels?: ReadonlyMap<string, string>
  loading: boolean
  onToggleGroup: (key: string) => void
  onLoadGroup: (group: HistoryGroup, offset: number) => void
  onRun: (item: ReportHistoryItem, action: ReportHistoryAction) => void
}

const KYIV_DAY = new Intl.DateTimeFormat('uk-UA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit' })
const getRowId = (row: HistoryRow) => row.id

export function ReportHistoryTable({ groups, grouping, opened, groupStates, datasets, launches, userLabels, loading,
  onToggleGroup, onLoadGroup, onRun }: Props) {
  const { t } = useI18n()
  const byDay = grouping === 'day'
  const data = useMemo(() => {
    const bySource = new Map(datasets.map(dataset => [dataset.DataSource, dataset]))
    const rows: HistoryRow[] = []
    for (const group of groups) {
      const expanded = opened.includes(group.key)
      rows.push({ id: `group-${group.key}`, kind: 'group', group, expanded })
      if (!expanded) continue

      const state = groupStates[group.key]
      for (const item of state?.items ?? []) {
        const summary = item.movement
          ? movementHistorySummary(item.movement, item.names)
          : item.data && historySummary(item.data, bySource.get(item.kind === 'regional' ? 39 : item.dataSource))
        const source = item.data?.dataSource ?? -1
        const usable = item.kind === 'movement' ? Boolean(item.movement)
          : bySource.has(source) && BUG_1274_ACTIVE_DATA_SOURCES.has(source)
        rows.push({
          id: item.id,
          kind: 'entry',
          item,
          name: t(historyReportKeyName(item.report, datasets, launches)),
          period: summary?.period,
          filters: summary?.filters,
          unavailable: usable ? undefined : t('Цей звіт більше не можна відкрити.'),
        })
      }
      if (!state?.done || state.error) rows.push({ id: `status-${group.key}`, kind: 'status', group, state })
    }
    return rows
  }, [datasets, groupStates, groups, launches, opened, t])

  const columns = useMemo(() => {
    const entryColumns: EntryColumn[] = [
      {
        id: 'formedAt',
        header: byDay ? t('Час') : t('Сформовано'),
        width: byDay ? 72 : 200,
        minWidth: byDay ? 64 : 160,
        numeric: true,
        cell: row => <div className="report-history__record">
          <time dateTime={row.item.formedAtUtc}>
            {byDay ? '' : `${KYIV_DAY.format(new Date(row.item.formedAtUtc))} · `}{historyTime(row.item.formedAtUtc)}
          </time>
          {byDay ? null : <EntryDetails row={row} />}
        </div>,
      },
      {
        id: 'period',
        header: t('Період звіту'),
        width: 180,
        minWidth: 176,
        cell: row => <TableChip tone="document" value={row.period} />,
      },
      { id: 'format', header: t('Формат'), width: 100, minWidth: 92, cell: row => row.item.output === 'excel' ? 'Excel' : t('На екрані') },
      { id: 'rowCount', header: t('Рядків'), width: 88, minWidth: 72, align: 'right', cell: row => row.item.rowCount.toLocaleString('uk-UA') },
    ]
    if (byDay) entryColumns.splice(1, 0, {
      id: 'report',
      header: t('Звіт'),
      width: 248,
      minWidth: 144,
      cell: row => <div className="report-history__record">
        <span title={row.name}>{row.name}</span>
        <EntryDetails row={row} />
      </div>,
    })
    if (userLabels) entryColumns.push({
      id: 'user',
      header: t('Користувач'),
      width: 172,
      minWidth: 120,
      cell: row => userLabels.get(row.item.userNetId) ?? (row.item.userName || t('Без імені')),
    })
    entryColumns.push({
      id: 'actions',
      header: '',
      width: 60,
      rowActions: true,
      cell: row => <div className="data-table-row-actions">
        <TableRowAction action="open" label={t('Відкрити')} aria-description={row.name} disabled={Boolean(row.unavailable)}
          hint={row.unavailable} onClick={() => onRun(row.item, 'open')} />
        <TableRowAction action="download" label={t('Завантажити Excel')} aria-description={row.name} disabled={Boolean(row.unavailable)}
          hint={row.unavailable} onClick={() => onRun(row.item, 'excel')} />
      </div>,
    })
    return entryColumns.map<DataTableColumn<HistoryRow>>(column => ({
      ...column,
      header: <span className="report-history__black">{column.header}</span>,
      className: 'report-history__black',
      enableSorting: false,
      cell: row => row.kind === 'entry' ? column.cell(row) : null,
    }))
  }, [byDay, onRun, t, userLabels])

  function renderFullWidthRow(row: HistoryRow) {
    switch (row.kind) {
      case 'entry':
        return null
      case 'group':
        return <UnstyledButton className="report-history__group-control report-history__black" aria-expanded={row.expanded}
          onClick={() => onToggleGroup(row.group.key)}>
          <ChevronRight size={16} aria-hidden="true" />
          <span>{row.group.title}</span>
          <span title={t('Записів')}>{row.group.count.toLocaleString('uk-UA')}</span>
        </UnstyledButton>
      case 'status': {
        const { group, state } = row
        if (!state || state.loading) {
          return <Group className="report-history__black" role="status" gap={8}>
            <Loader size="xs" /><Text>{t('Завантаження…')}</Text>
          </Group>
        }
        return <Group className="report-history__black" gap={8}>
          {state.error ? <Text role="alert">{state.error}</Text> : null}
          <Button size="xs" variant="default" onClick={() => onLoadGroup(group, state.items.length)}>
            {state.error ? t('Спробувати ще раз') : t('Показати ще')}
          </Button>
        </Group>
      }
    }
  }

  return <DataTable tableId="report-history" columns={columns} data={data} getRowId={getRowId}
    scrollRegionLabel={t('Історія звітів')} renderFullWidthRow={renderFullWidthRow}
    showToolbar={false} showLayoutControls={false} distributeAvailableWidth minWidth={0} height="100%" isLoading={loading}
    emptyText={t('За вибраний період звітів не формували.')} />
}

function EntryDetails({ row }: { row: EntryRow }) {
  return <>
    {row.filters ? <small title={row.filters}>{row.filters}</small> : null}
    {row.unavailable ? <small title={row.unavailable}>{row.unavailable}</small> : null}
  </>
}
