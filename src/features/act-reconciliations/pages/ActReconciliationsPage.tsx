import {
  ActionIcon,
  Alert,
  Badge,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { CircleAlert, RefreshCw, RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useReducer, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatLocalDate, SYNC_DATA_RANGE_START } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { translate } from '../../../shared/i18n/translate'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { getActReconciliations } from '../api/actReconciliationsApi'
import { getActWorkflowState, getItemWorkflowState } from '../actReconciliationWorkflow'
import type { ActReconciliation } from '../types'
import '../../../shared/ui/console-table-page.css'
import './act-reconciliations-page.css'

type FilterDraft = {
  from: string
  to: string
}

type StatusFilter = 'all' | 'pending' | 'partial' | 'dismissed' | 'resolved'

/* Numbers / codes / dates in the tables read in mono (docs/ui-patterns.md §5.1). */
const ACT_MONO_STYLE = { fontFamily: 'var(--font-mono)', letterSpacing: 0 } as const

const RECONCILIATIONS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['index', 'fromDate', 'number'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  dateStyle: 'short',
  timeStyle: 'short',
})

function useActReconciliationsPageModel() {
  const navigate = useNavigate()
  const initialFilters = useMemo<FilterDraft>(
    () => ({
      from: SYNC_DATA_RANGE_START,
      to: formatLocalDate(new Date()),
    }),
    [],
  )
  const [filterDraft, setFilterDraft] = useValueState<FilterDraft>(initialFilters)
  const [activeFilters, setActiveFilters] = useValueState<FilterDraft>(initialFilters)
  const [reconciliations, setReconciliations] = useValueState<ActReconciliation[]>([])
  const [statusFilter, setStatusFilter] = useValueState<StatusFilter>('all')
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const filterError = getFilterError(activeFilters.from, activeFilters.to)
  const rowSummaries = useMemo(() => buildRowSummaries(reconciliations), [reconciliations])
  const visibleReconciliations = useMemo(
    () => reconciliations.filter((item) => statusFilter === 'all' || getActWorkflowState(item) === statusFilter),
    [reconciliations, statusFilter],
  )

  useReconciliationsLoader({
    activeFilters,
    filterError,
    reloadKey,
    setError,
    setLoading,
    setReconciliations,
  })

  const openDetail = useMemo(
    () => (reconciliation: ActReconciliation) => {
      if (reconciliation.NetUid) {
        navigate(`/ukraine/act/reconcoliation/${reconciliation.NetUid}`)
      }
    },
    [navigate],
  )

  const columns = useReconciliationColumns(rowSummaries)

  function applyFilters(nextFilters: FilterDraft) {
    setFilterDraft(nextFilters)
    setActiveFilters(nextFilters)
  }

  function resetFilters() {
    setFilterDraft(initialFilters)
    setActiveFilters(initialFilters)
    setStatusFilter('all')
  }

  return {
    columns,
    error,
    filterDraft,
    filterError,
    isLoading,
    visibleReconciliations,
    statusFilter,
    setStatusFilter,
    applyFilters,
    openDetail,
    reload,
    resetFilters,
  }
}

function useReconciliationsLoader({
  activeFilters,
  filterError,
  reloadKey,
  setError,
  setLoading,
  setReconciliations,
}: {
  activeFilters: FilterDraft
  filterError: string | null
  reloadKey: number
  setError: (value: string | null) => void
  setLoading: (value: boolean) => void
  setReconciliations: (value: ActReconciliation[]) => void
}) {
  const { t } = useI18n()

  useEffect(() => {
    if (filterError) {
      setReconciliations([])
      setLoading(false)
      return
    }

    let cancelled = false

    async function loadReconciliations() {
      setLoading(true)
      setError(null)

      try {
        const nextReconciliations = await getActReconciliations({
          from: activeFilters.from,
          to: activeFilters.to,
        })

        if (!cancelled) {
          setReconciliations(nextReconciliations)
        }
      } catch (loadError) {
        if (!cancelled) {
          setReconciliations([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити акти звірок'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadReconciliations()

    return () => {
      cancelled = true
    }
  }, [activeFilters, filterError, reloadKey, setError, setLoading, setReconciliations, t])
}

export function ActReconciliationsPage() {
  const model = useActReconciliationsPageModel()

  return <ActReconciliationsPageView model={model} />
}

function ActReconciliationsPageView({ model }: { model: ReturnType<typeof useActReconciliationsPageModel> }) {
  const { t } = useI18n()
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)
  const {
    columns,
    error,
    filterDraft,
    filterError,
    isLoading,
    openDetail,
    visibleReconciliations,
    statusFilter,
    setStatusFilter,
    reload,
    resetFilters,
    applyFilters,
  } = model

  return (
    <Stack className="act-reconciliations-page console-table-page" gap={6}>
      <div className="console-table-shell act-reconciliations-shell">
        <div className="app-filter-bar act-reconciliations-filter-bar">
          <div className="act-reconciliations-filter-row">
            <div className="app-filter-date-range">
              <TextInput
                className="act-reconciliations-date-input"
                label={t('Від')}
                max={filterDraft.to || undefined}
                type="date"
                value={filterDraft.from}
                onChange={(event) => applyFilters({ ...filterDraft, from: event.currentTarget.value })}
              />
              <TextInput
                className="act-reconciliations-date-input"
                label={t('До')}
                min={filterDraft.from || undefined}
                type="date"
                value={filterDraft.to}
                onChange={(event) => applyFilters({ ...filterDraft, to: event.currentTarget.value })}
              />
            </div>
            <Select
              className="act-reconciliations-status-filter"
              data={[
                { value: 'all', label: t('Усі стани') },
                { value: 'pending', label: t('Очікує дії') },
                { value: 'partial', label: t('Частково опрацьовано') },
                { value: 'dismissed', label: t('Закрито без руху') },
                { value: 'resolved', label: t('Опрацьовано') },
              ]}
              label={t('Стан')}
              value={statusFilter}
              onChange={(value) => setStatusFilter((value as StatusFilter) || 'all')}
            />
            <div className="app-filter-actions">
              <Tooltip label={t('Скинути')}>
                <ActionIcon aria-label={t('Скинути')} color="gray" size={34} variant="light" onClick={resetFilters}>
                  <RotateCcw size={17} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={t('Оновити')}>
                <ActionIcon
                  aria-label={t('Оновити')}
                  color="gray"
                  loading={isLoading}
                  size={34}
                  variant="light"
                  onClick={() => reload()}
                >
                  <RefreshCw size={18} />
                </ActionIcon>
              </Tooltip>
            </div>
          </div>
          <div ref={setTableToolbarSlot} className="app-filter-table-toolbar-slot act-reconciliations-table-toolbar-slot" />
        </div>

        {(error || filterError) && (
          <Alert className="console-table-alert" color={filterError ? 'yellow' : 'red'} icon={<CircleAlert size={18} />} variant="light">
            {filterError || error}
          </Alert>
        )}

        <div className="act-reconciliations-page__table console-table-body">
          <DataTable
            columns={columns}
            data={visibleReconciliations}
            defaultLayout={RECONCILIATIONS_TABLE_DEFAULT_LAYOUT}
            emptyText={t('Актів звірок не знайдено')}
            getRowId={(reconciliation, index) => String(reconciliation.NetUid || reconciliation.Id || index)}
            height="100%"
            isLoading={isLoading}
            layoutVersion="act-reconciliations-table-3"
            minWidth={1280}
            showLayoutControls
            tableId="act-reconciliations"
            toolbarPortalTarget={tableToolbarSlot}
            onRowClick={openDetail}
          />
        </div>
      </div>
    </Stack>
  )
}

type RowSummary = {
  dismissedCount: number
  index: number
  invNumber: string
  negativeSum: number
  organizationName: string
  pendingCount: number
  positiveSum: number
  resolvedCount: number
  state: ReturnType<typeof getActWorkflowState>
}

function useReconciliationColumns(
  rowSummaries: Map<ActReconciliation, RowSummary>,
) {
  const { t } = useI18n()

  return useMemo<DataTableColumn<ActReconciliation>[]>(
    () => [
      {
        id: 'index',
        header: '#',
        width: 56,
        minWidth: 48,
        align: 'right',
        enableSorting: false,
        enableHiding: false,
        accessor: (reconciliation) => rowSummaries.get(reconciliation)?.index || 0,
        cell: (reconciliation) => (
          <Text c="dimmed" size="sm" style={ACT_MONO_STYLE}>
            {rowSummaries.get(reconciliation)?.index || ''}
          </Text>
        ),
      },
      {
        id: 'fromDate',
        header: t('Від якої дати'),
        width: 168,
        minWidth: 148,
        accessor: (reconciliation) => getDateTime(reconciliation.FromDate),
        cell: (reconciliation) => {
          const value = formatDateTime(reconciliation.FromDate)

          return <Text fw={600} style={ACT_MONO_STYLE} title={nativeTitle(value)}>{value}</Text>
        },
      },
      {
        id: 'number',
        header: t('Номер'),
        width: 168,
        minWidth: 140,
        accessor: (reconciliation) => reconciliation.Number || reconciliation.NetUid,
        cell: (reconciliation) => {
          const value = displayValue(reconciliation.Number)

          return <Text fw={600} style={ACT_MONO_STYLE} title={nativeTitle(value)}>{value}</Text>
        },
      },
      {
        id: 'invNumber',
        header: t('Номер вхідного документу'),
        width: 220,
        minWidth: 160,
        accessor: (reconciliation) => rowSummaries.get(reconciliation)?.invNumber,
        cell: (reconciliation) => {
          const value = displayValue(rowSummaries.get(reconciliation)?.invNumber)

          return <span style={ACT_MONO_STYLE} title={nativeTitle(value)}>{value}</span>
        },
      },
      {
        id: 'organization',
        header: t('Організація'),
        width: 260,
        minWidth: 180,
        accessor: (reconciliation) => rowSummaries.get(reconciliation)?.organizationName,
        cell: (reconciliation) => {
          const value = displayValue(rowSummaries.get(reconciliation)?.organizationName)

          return <span title={nativeTitle(value)}>{value}</span>
        },
      },
      {
        id: 'status',
        header: t('Стан'),
        width: 190,
        minWidth: 160,
        accessor: (reconciliation) => rowSummaries.get(reconciliation)?.state,
        cell: (reconciliation) => <ActStatusBadge summary={rowSummaries.get(reconciliation)} />,
      },
      {
        id: 'difference',
        header: t('Різниця'),
        width: 200,
        minWidth: 160,
        enableSorting: false,
        accessor: (reconciliation) => {
          const summary = rowSummaries.get(reconciliation)
          return (summary?.positiveSum || 0) - (summary?.negativeSum || 0)
        },
        cell: (reconciliation) => <DifferenceCell summary={rowSummaries.get(reconciliation)} />,
      },
      {
        id: 'comment',
        header: t('Коментар'),
        width: 260,
        minWidth: 200,
        accessor: (reconciliation) => reconciliation.Comment,
        cell: (reconciliation) => {
          const value = displayValue(reconciliation.Comment)

          return (
            <Text lineClamp={2} title={nativeTitle(value)}>
              {value}
            </Text>
          )
        },
      },
    ],
    [rowSummaries, t],
  )
}

function DifferenceCell({ summary }: { summary?: RowSummary }) {
  const negativeSum = summary?.negativeSum || 0
  const positiveSum = summary?.positiveSum || 0

  if (negativeSum === 0 && positiveSum === 0) {
    return <Text size="sm" style={ACT_MONO_STYLE}>0</Text>
  }

  return (
    <Group gap={6} wrap="nowrap">
      {negativeSum > 0 && (
        <Text c="red" fw={600} size="sm" style={ACT_MONO_STYLE}>
          - {negativeSum}
        </Text>
      )}
      {negativeSum > 0 && positiveSum > 0 && (
        <Text c="dimmed" size="sm">
          /
        </Text>
      )}
      {positiveSum > 0 && (
        <Text c="teal" fw={600} size="sm" style={ACT_MONO_STYLE}>
          + {positiveSum}
        </Text>
      )}
    </Group>
  )
}

function ActStatusBadge({ summary }: { summary?: RowSummary }) {
  const { t } = useI18n()
  const state = summary?.state || 'resolved'
  const meta = {
    pending: { color: 'red', label: 'Очікує дії' },
    partial: { color: 'orange', label: 'Частково опрацьовано' },
    dismissed: { color: 'orange', label: 'Закрито без руху' },
    resolved: { color: 'green', label: 'Опрацьовано' },
  }[state]

  return (
    <Group gap={6} wrap="nowrap">
      <Badge color={meta.color} variant="light">{t(meta.label)}</Badge>
      {summary && state === 'partial' && (
        <Text c="dimmed" size="xs">{summary.pendingCount} / {summary.dismissedCount + summary.resolvedCount}</Text>
      )}
    </Group>
  )
}

function buildRowSummaries(reconciliations: ActReconciliation[]): Map<ActReconciliation, RowSummary> {
  return reconciliations.reduce((summaries, reconciliation, index) => {
    const items = reconciliation.ActReconciliationItems || []
    const negativeSum = items
      .filter((item) => getItemWorkflowState(item) === 'pending-shortage')
      .reduce((sum, item) => sum + (item.QtyDifference || 0), 0)
    const positiveSum = items
      .filter((item) => getItemWorkflowState(item) === 'pending-surplus')
      .reduce((sum, item) => sum + (item.QtyDifference || 0), 0)
    const states = items.map(getItemWorkflowState)

    let invNumber = ''
    let organizationName = ''

    if (reconciliation.SupplyOrderUkraine) {
      invNumber = reconciliation.SupplyOrderUkraine.InvNumber || ''
      organizationName = reconciliation.SupplyOrderUkraine.Organization?.Name || ''
    } else if (reconciliation.SupplyInvoice) {
      invNumber = reconciliation.SupplyInvoice.Number || ''
      organizationName = reconciliation.SupplyInvoice.SupplyOrder?.Organization?.Name || ''
    }

    summaries.set(reconciliation, {
      dismissedCount: states.filter((state) => state === 'dismissed').length,
      index: index + 1,
      invNumber,
      negativeSum,
      organizationName,
      pendingCount: states.filter((state) => state.startsWith('pending-')).length,
      positiveSum,
      resolvedCount: states.filter((state) => state === 'resolved').length,
      state: getActWorkflowState(reconciliation),
    })

    return summaries
  }, new Map<ActReconciliation, RowSummary>())
}

function getFilterError(from: string, to: string): string | null {
  if (!from || !to) {
    return translate('Вкажіть дату початку та дату завершення')
  }

  if (from > to) {
    return translate('Дата початку не може бути пізнішою за дату завершення')
  }

  return null
}

function getDateTime(value: unknown): number {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? 0 : value.getTime()
  }

  if (typeof value !== 'string' || !value) {
    return 0
  }

  const parsed = new Date(value)

  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime()
}

function formatDateTime(value?: Date | string): string {
  if (!value) {
    return ''
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return dateTimeFormatter.format(date)
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return ''
  }

  return String(value)
}

function nativeTitle(value: string): string | undefined {
  return value ? value : undefined
}
