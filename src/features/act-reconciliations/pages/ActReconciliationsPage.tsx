import {
  ActionIcon,
  Alert,
  Box,
  Group,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { IconAlertCircle, IconEye, IconRefresh, IconRestore } from '@tabler/icons-react'
import { useEffect, useMemo, useReducer } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatLocalDate, SYNC_DATA_RANGE_START } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { translate } from '../../../shared/i18n/translate'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { PageHeaderActions } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { getActReconciliations } from '../api/actReconciliationsApi'
import type { ActReconciliation } from '../types'

type FilterDraft = {
  from: string
  to: string
}

const RECONCILIATIONS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['index', 'fromDate', 'number'],
    right: ['actions'],
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
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const filterError = getFilterError(activeFilters.from, activeFilters.to)
  const rowSummaries = useMemo(() => buildRowSummaries(reconciliations), [reconciliations])

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

  const columns = useReconciliationColumns(openDetail, rowSummaries)

  function applyFilters(nextFilters: FilterDraft) {
    setFilterDraft(nextFilters)
    setActiveFilters(nextFilters)
  }

  function resetFilters() {
    setFilterDraft(initialFilters)
    setActiveFilters(initialFilters)
  }

  return {
    columns,
    error,
    filterDraft,
    filterError,
    isLoading,
    reconciliations,
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
  const {
    columns,
    error,
    filterDraft,
    filterError,
    isLoading,
    openDetail,
    reconciliations,
    reload,
    resetFilters,
    applyFilters,
  } = model

  return (
    <Stack gap={6}>
      <PageHeaderActions>
        <Tooltip label={t('Оновити')}>
          <ActionIcon
            aria-label={t('Оновити')}
            color="gray"
            loading={isLoading}
            size={38}
            variant="light"
            onClick={() => reload()}
          >
            <IconRefresh size={18} />
          </ActionIcon>
        </Tooltip>
      </PageHeaderActions>

      <Stack gap="xs">
        <Group align="flex-end" gap="xs" wrap="nowrap">
          <TextInput
            label={t('Від')}
            max={filterDraft.to || undefined}
            type="date"
            value={filterDraft.from}
            w={150}
            onChange={(event) => applyFilters({ ...filterDraft, from: event.currentTarget.value })}
          />
          <TextInput
            label={t('До')}
            min={filterDraft.from || undefined}
            type="date"
            value={filterDraft.to}
            w={150}
            onChange={(event) => applyFilters({ ...filterDraft, to: event.currentTarget.value })}
          />
          <Tooltip label={t('Скинути')}>
            <ActionIcon aria-label={t('Скинути')} color="gray" size={36} variant="light" onClick={resetFilters}>
              <IconRestore size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>

        {(error || filterError) && (
          <Alert color={filterError ? 'yellow' : 'red'} icon={<IconAlertCircle size={18} />} variant="light">
            {filterError || error}
          </Alert>
        )}

        <DataTable
          columns={columns}
          data={reconciliations}
          defaultLayout={RECONCILIATIONS_TABLE_DEFAULT_LAYOUT}
          emptyText={t('Актів звірок не знайдено')}
          getRowId={(reconciliation, index) => String(reconciliation.NetUid || reconciliation.Id || index)}
          isLoading={isLoading}
          layoutVersion="act-reconciliations-table-1"
          loadingText={t('Завантаження актів звірок')}
          maxHeight="calc(100vh - 320px)"
          minWidth={1200}
          tableId="act-reconciliations"
          onRowClick={openDetail}
        />
      </Stack>
    </Stack>
  )
}

type RowSummary = {
  index: number
  invNumber: string
  negativeSum: number
  organizationName: string
  positiveSum: number
}

function useReconciliationColumns(
  onOpenDetail: (reconciliation: ActReconciliation) => void,
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
          <Text c="dimmed" size="sm">
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
        cell: (reconciliation) => <Text fw={600}>{formatDateTime(reconciliation.FromDate)}</Text>,
      },
      {
        id: 'number',
        header: t('Номер'),
        width: 168,
        minWidth: 140,
        accessor: (reconciliation) => reconciliation.Number || reconciliation.NetUid,
        cell: (reconciliation) => <Text fw={700}>{displayValue(reconciliation.Number)}</Text>,
      },
      {
        id: 'invNumber',
        header: t('Номер вхідного документу'),
        width: 220,
        minWidth: 160,
        accessor: (reconciliation) => rowSummaries.get(reconciliation)?.invNumber,
        cell: (reconciliation) => displayValue(rowSummaries.get(reconciliation)?.invNumber),
      },
      {
        id: 'organization',
        header: t('Організація'),
        width: 260,
        minWidth: 180,
        accessor: (reconciliation) => rowSummaries.get(reconciliation)?.organizationName,
        cell: (reconciliation) => displayValue(rowSummaries.get(reconciliation)?.organizationName),
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
        minWidth: 200,
        accessor: (reconciliation) => reconciliation.Comment,
        cell: (reconciliation) => (
          <Text size="sm" lineClamp={2}>
            {displayValue(reconciliation.Comment)}
          </Text>
        ),
      },
      {
        id: 'actions',
        header: '',
        width: 58,
        minWidth: 58,
        maxWidth: 58,
        align: 'center',
        enableHiding: false,
        enableReorder: false,
        enableResizing: false,
        enableSorting: false,
        cell: (reconciliation) => (
          <Box onClick={(event) => event.stopPropagation()}>
            <Tooltip label={t('Огляд')}>
              <ActionIcon
                aria-label={t('Огляд')}
                color="gray"
                variant="subtle"
                onClick={() => onOpenDetail(reconciliation)}
              >
                <IconEye size={18} />
              </ActionIcon>
            </Tooltip>
          </Box>
        ),
      },
    ],
    [onOpenDetail, rowSummaries, t],
  )
}

function DifferenceCell({ summary }: { summary?: RowSummary }) {
  const negativeSum = summary?.negativeSum || 0
  const positiveSum = summary?.positiveSum || 0

  if (negativeSum === 0 && positiveSum === 0) {
    return <Text size="sm">0</Text>
  }

  return (
    <Group gap={6} wrap="nowrap">
      {negativeSum > 0 && (
        <Text c="red" fw={600} size="sm">
          - {negativeSum}
        </Text>
      )}
      {negativeSum > 0 && positiveSum > 0 && (
        <Text c="dimmed" size="sm">
          /
        </Text>
      )}
      {positiveSum > 0 && (
        <Text c="teal" fw={600} size="sm">
          + {positiveSum}
        </Text>
      )}
    </Group>
  )
}

function buildRowSummaries(reconciliations: ActReconciliation[]): Map<ActReconciliation, RowSummary> {
  return reconciliations.reduce((summaries, reconciliation, index) => {
    const items = reconciliation.ActReconciliationItems || []
    const negativeSum = items
      .filter((item) => item.HasDifference && item.NegativeDifference)
      .reduce((sum, item) => sum + (item.QtyDifference || 0), 0)
    const positiveSum = items
      .filter((item) => item.HasDifference && !item.NegativeDifference)
      .reduce((sum, item) => sum + (item.QtyDifference || 0), 0)

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
      index: index + 1,
      invNumber,
      negativeSum,
      organizationName,
      positiveSum,
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
    return '-'
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return dateTimeFormatter.format(date)
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  return String(value)
}
