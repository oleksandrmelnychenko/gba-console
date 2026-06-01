import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { IconAlertCircle, IconRefresh, IconRestore } from '@tabler/icons-react'
import { useEffect, useMemo, useReducer, useRef } from 'react'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { getVatReports } from '../api/vatReportsApi'
import type { VatReport } from '../types'

const DEFAULT_LIMIT = 20

const VAT_REPORTS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['index', 'fromDate'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  dateStyle: 'short',
  timeStyle: 'short',
})

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

type VatReportsLoadState = {
  error: string | null
  hasMore: boolean
  isLoading: boolean
  isLoadingMore: boolean
  reports: VatReport[]
}

type VatReportsLoadAction =
  | { type: 'failed'; error: string }
  | { type: 'invalid-filter' }
  | { type: 'loaded'; reports: VatReport[] }
  | { type: 'load-more-failed'; error: string }
  | { type: 'load-more-loaded'; reports: VatReport[] }
  | { type: 'load-more-start' }
  | { type: 'start-loading' }

const INITIAL_VAT_REPORTS_LOAD_STATE: VatReportsLoadState = {
  error: null,
  hasMore: false,
  isLoading: true,
  isLoadingMore: false,
  reports: [],
}

export function VatReportsPage() {
  const { t } = useI18n()
  const [fromDate, setFromDate] = useValueState(() => shiftDate(-7))
  const [toDate, setToDate] = useValueState(() => formatLocalDate(new Date()))
  const [loadState, dispatchLoadState] = useReducer(vatReportsLoadReducer, INITIAL_VAT_REPORTS_LOAD_STATE)
  const { error, hasMore, isLoading, isLoadingMore, reports } = loadState
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const filterError = getDateRangeError(fromDate, toDate)
  const requestRef = useRef(0)
  const indexMap = useMemo(() => buildIndexMap(reports), [reports])
  const columns = useVatReportColumns(indexMap)

  useEffect(() => {
    let isActive = true

    if (filterError) {
      requestRef.current += 1
      dispatchLoadState({ type: 'invalid-filter' })

      return () => {
        isActive = false
      }
    }

    const requestId = requestRef.current + 1
    requestRef.current = requestId
    dispatchLoadState({ type: 'start-loading' })

    async function loadReports() {
      try {
        const nextReports = await getVatReports({
          from: fromDate,
          limit: DEFAULT_LIMIT,
          offset: 0,
          to: toDate,
        })

        if (isActive && requestRef.current === requestId) {
          dispatchLoadState({ reports: nextReports, type: 'loaded' })
        }
      } catch (loadError) {
        if (isActive && requestRef.current === requestId) {
          dispatchLoadState({
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити VAT'),
            type: 'failed',
          })
        }
      }
    }

    void loadReports()

    return () => {
      isActive = false
    }
  }, [filterError, fromDate, reloadKey, t, toDate])

  function prepareReportsLoad() {
    requestRef.current += 1
    dispatchLoadState({ type: 'start-loading' })
  }

  function refreshReports() {
    prepareReportsLoad()
    reload()
  }

  async function loadMore() {
    if (filterError) {
      dispatchLoadState({ type: 'invalid-filter' })
      return
    }

    dispatchLoadState({ type: 'load-more-start' })
    const requestId = requestRef.current + 1
    requestRef.current = requestId

    try {
      const nextReports = await getVatReports({
        from: fromDate,
        limit: DEFAULT_LIMIT,
        offset: reports.length,
        to: toDate,
      })

      if (requestRef.current === requestId) {
        dispatchLoadState({ reports: nextReports, type: 'load-more-loaded' })
      }
    } catch (loadError) {
      if (requestRef.current === requestId) {
        dispatchLoadState({
          error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити наступні записи'),
          type: 'load-more-failed',
        })
      }
    }
  }

  function resetFilters() {
    const nextFromDate = shiftDate(-7)
    const nextToDate = formatLocalDate(new Date())

    if (nextFromDate === fromDate && nextToDate === toDate) {
      return
    }

    prepareReportsLoad()
    setFromDate(nextFromDate)
    setToDate(nextToDate)
  }

  function updateFromDate(value: string) {
    if (value === fromDate) {
      return
    }

    prepareReportsLoad()
    setFromDate(value)
  }

  function updateToDate(value: string) {
    if (value === toDate) {
      return
    }

    prepareReportsLoad()
    setToDate(value)
  }

  return (
    <Stack gap="md">
      <Card withBorder radius="md" shadow="sm">
        <Stack gap="md">
          <Group justify="space-between" wrap="wrap">
            <div>
              <Text fw={700} size="xl">
                {t('VAT')}
              </Text>
            </div>

            <Group gap="xs">
              <Tooltip label={t('Скинути')}>
                <ActionIcon aria-label={t('Скинути')} color="gray" size={36} variant="light" onClick={resetFilters}>
                  <IconRestore size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={t('Оновити')}>
                <ActionIcon aria-label={t('Оновити')} loading={isLoading} variant="light" onClick={refreshReports}>
                  <IconRefresh size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>

          <Group align="end" gap="sm">
            <TextInput label={t('Від')} type="date" value={fromDate} onChange={(event) => updateFromDate(event.currentTarget.value)} />
            <TextInput label={t('До')} type="date" value={toDate} onChange={(event) => updateToDate(event.currentTarget.value)} />
          </Group>

          {error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {error}
            </Alert>
          )}

          {filterError && (
            <Alert color="yellow" icon={<IconAlertCircle size={18} />} variant="light">
              {filterError}
            </Alert>
          )}

          <Badge color="blue" variant="light" w="fit-content">
            {t('Завантажено')}: {reports.length}
          </Badge>

          <DataTable
            columns={columns}
            data={reports}
            defaultLayout={VAT_REPORTS_TABLE_DEFAULT_LAYOUT}
            emptyText={t('VAT записів не знайдено')}
            getRowId={(report, index) => `${report.FromDate || 'vat'}-${getReportNumber(report)}-${index}`}
            isLoading={isLoading}
            layoutVersion="vat-reports-table-1"
            maxHeight="calc(100vh - 330px)"
            minWidth={900}
            tableId="vat-reports"
          />

          {hasMore && (
            <Group justify="center">
              <Button color="gray" disabled={Boolean(filterError)} loading={isLoadingMore} variant="light" onClick={loadMore}>
                {t('Завантажити ще')}
              </Button>
            </Group>
          )}
        </Stack>
      </Card>
    </Stack>
  )
}

function useVatReportColumns(indexMap: Map<VatReport, number>): DataTableColumn<VatReport>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<VatReport>[]>(
    () => [
      {
        id: 'index',
        header: '',
        width: 64,
        minWidth: 56,
        align: 'right',
        accessor: (report) => indexMap.get(report) || 0,
        cell: (report) => indexMap.get(report) || '',
      },
      {
        id: 'fromDate',
        header: t('Дата'),
        width: 160,
        minWidth: 140,
        accessor: (report) => report.FromDate,
        cell: (report) => formatDateTime(report.FromDate),
      },
      {
        id: 'number',
        header: t('Номер'),
        minWidth: 220,
        accessor: getReportNumber,
        cell: (report) => <Text fw={600}>{displayValue(getReportNumber(report))}</Text>,
      },
      {
        id: 'type',
        header: t('Тип'),
        width: 140,
        minWidth: 120,
        accessor: (report) => getReportType(report, t),
        cell: (report) => getReportType(report, t),
      },
      {
        id: 'rate',
        header: t('Ставка VAT'),
        width: 130,
        minWidth: 110,
        align: 'right',
        accessor: (report) => report.VatPercent,
        cell: (report) => formatPercent(report.VatPercent),
      },
      {
        id: 'amount',
        header: t('Сума VAT'),
        width: 150,
        minWidth: 130,
        align: 'right',
        accessor: (report) => report.VatAmountEU,
        cell: (report) => formatMoney(report.VatAmountEU),
      },
      {
        id: 'amountPln',
        header: t('Сума в PLN (ПДВ)'),
        width: 150,
        minWidth: 130,
        align: 'right',
        accessor: (report) => report.VatAmountPL,
        cell: (report) => formatMoney(report.VatAmountPL),
      },
    ],
    [indexMap, t],
  )
}

function buildIndexMap(reports: VatReport[]): Map<VatReport, number> {
  return reports.reduce((indexMap, report, index) => {
    indexMap.set(report, index + 1)

    return indexMap
  }, new Map<VatReport, number>())
}

function vatReportsLoadReducer(state: VatReportsLoadState, action: VatReportsLoadAction): VatReportsLoadState {
  switch (action.type) {
    case 'failed':
      return {
        error: action.error,
        hasMore: false,
        isLoading: false,
        isLoadingMore: false,
        reports: [],
      }
    case 'invalid-filter':
      return {
        error: null,
        hasMore: false,
        isLoading: false,
        isLoadingMore: false,
        reports: [],
      }
    case 'loaded':
      return {
        error: null,
        hasMore: action.reports.length >= DEFAULT_LIMIT,
        isLoading: false,
        isLoadingMore: false,
        reports: action.reports,
      }
    case 'load-more-failed':
      return {
        ...state,
        error: action.error,
        isLoadingMore: false,
      }
    case 'load-more-loaded':
      return {
        ...state,
        error: null,
        hasMore: action.reports.length >= DEFAULT_LIMIT,
        isLoadingMore: false,
        reports: [...state.reports, ...action.reports],
      }
    case 'load-more-start':
      return {
        ...state,
        error: null,
        isLoadingMore: true,
      }
    case 'start-loading':
      return {
        ...state,
        error: null,
        hasMore: false,
        isLoading: true,
        isLoadingMore: false,
      }
    default:
      return state
  }
}

function getReportNumber(report: VatReport): string | undefined {
  return report.Sale?.SaleNumber?.Value || report.Sale?.Number || report.SupplyInvoice?.Number
}

function getReportType(report: VatReport, t: (value: string) => string): string {
  return report.Sale ? t('Інвойс') : t('Фактура')
}

function shiftDate(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)

  return formatLocalDate(date)
}

function getDateRangeError(fromDate: string, toDate: string): string | null {
  if (!fromDate || !toDate) {
    return 'Вкажіть період'
  }

  if (fromDate > toDate) {
    return 'Дата початку не може бути пізніше дати завершення'
  }

  return null
}

function formatDateTime(value?: string): string {
  if (!value) {
    return '—'
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? value : dateTimeFormatter.format(date)
}

function formatPercent(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${value}%` : '—'
}

function formatMoney(value?: number): string {
  return moneyFormatter.format(typeof value === 'number' && Number.isFinite(value) ? value : 0)
}

function displayValue(value?: string | null): string {
  return value || '—'
}
