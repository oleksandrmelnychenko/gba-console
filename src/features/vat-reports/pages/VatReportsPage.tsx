import {
  ActionIcon,
  Alert,
  Card,
  Group,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { CircleAlert, RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useReducer, useRef } from 'react'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import { DataTableDensityToggle } from '../../../shared/ui/data-table/DataTableDensityToggle'
import { useDataTableDensity } from '../../../shared/ui/data-table/useDataTableDensity'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import { getVatReports } from '../api/vatReportsApi'
import type { VatReport } from '../types'
import './vat-reports-page.css'

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
  reports: VatReport[]
}

type VatReportsLoadAction =
  | { type: 'failed'; error: string }
  | { type: 'invalid-filter' }
  | { type: 'loaded'; hasMore: boolean; reports: VatReport[] }
  | { type: 'start-loading' }

const INITIAL_VAT_REPORTS_LOAD_STATE: VatReportsLoadState = {
  error: null,
  hasMore: false,
  isLoading: true,
  reports: [],
}

export function VatReportsPage() {
  const { t } = useI18n()
  const [fromDate, setFromDate] = useValueState(() => shiftDate(-7))
  const [toDate, setToDate] = useValueState(() => formatLocalDate(new Date()))
  const [page, setPage] = useValueState(1)
  const [pageSize, setPageSize] = useValueState(DEFAULT_LIMIT)
  const [loadState, dispatchLoadState] = useReducer(vatReportsLoadReducer, INITIAL_VAT_REPORTS_LOAD_STATE)
  const { error, hasMore, isLoading, reports } = loadState
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const filterError = getDateRangeError(fromDate, toDate)
  const requestRef = useRef(0)
  const indexMap = useMemo(() => buildIndexMap(reports), [reports])
  const columns = useVatReportColumns(indexMap)
  const { density, toggleDensity } = useDataTableDensity('vat-reports', VAT_REPORTS_TABLE_DEFAULT_LAYOUT.density)

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
          limit: pageSize,
          offset: (page - 1) * pageSize,
          to: toDate,
        })

        if (isActive && requestRef.current === requestId) {
          dispatchLoadState({ hasMore: nextReports.length >= pageSize, reports: nextReports, type: 'loaded' })
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
  }, [filterError, fromDate, page, pageSize, reloadKey, t, toDate])

  function prepareReportsLoad() {
    requestRef.current += 1
    dispatchLoadState({ type: 'start-loading' })
  }

  function refreshReports() {
    prepareReportsLoad()
    reload()
  }

  function resetFilters() {
    const nextFromDate = shiftDate(-7)
    const nextToDate = formatLocalDate(new Date())

    if (nextFromDate === fromDate && nextToDate === toDate && page === 1) {
      return
    }

    prepareReportsLoad()
    setPage(1)
    setFromDate(nextFromDate)
    setToDate(nextToDate)
  }

  function updateFromDate(value: string) {
    if (value === fromDate) {
      return
    }

    prepareReportsLoad()
    setPage(1)
    setFromDate(value)
  }

  function updateToDate(value: string) {
    if (value === toDate) {
      return
    }

    prepareReportsLoad()
    setPage(1)
    setToDate(value)
  }

  return (
    <Stack className="vat-reports-page" gap={6}>
      <Card className="app-data-card vat-reports-card" withBorder radius="md" padding={0}>
        <div className="app-filter-bar vat-reports-filter-bar">
          <Group align="end" gap="sm" wrap="nowrap" justify="space-between" className="vat-reports-filter-row">
            <Group align="end" gap="sm" wrap="nowrap">
              <TextInput label={t('Від')} type="date" value={fromDate} onChange={(event) => updateFromDate(event.currentTarget.value)} />
              <TextInput label={t('До')} type="date" value={toDate} onChange={(event) => updateToDate(event.currentTarget.value)} />
            </Group>
            <div className="app-filter-actions">
              <Tooltip label={t('Скинути')}>
                <ActionIcon aria-label={t('Скинути')} color="gray" size={34} variant="light" onClick={resetFilters}>
                  <RotateCcw size={17} />
                </ActionIcon>
              </Tooltip>
              <DataTableDensityToggle density={density} size={34} onToggle={toggleDensity} />
              <Paginator
                hasNext={hasMore}
                isLoading={isLoading}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(nextPageSize) => {
                  setPageSize(nextPageSize)
                  setPage(1)
                }}
                onRefresh={refreshReports}
              />
            </div>
          </Group>
        </div>

        {error && (
          <Alert className="vat-reports-alert" color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        )}

        {filterError && (
          <Alert className="vat-reports-alert" color="yellow" icon={<CircleAlert size={18} />} variant="light">
            {filterError}
          </Alert>
        )}

        <div className="vat-reports-page__table">
          <DataTable
            columns={columns}
            data={reports}
            defaultLayout={VAT_REPORTS_TABLE_DEFAULT_LAYOUT}
            density={density}
            emptyText={t('VAT записів не знайдено')}
            getRowId={(report, index) => `${report.FromDate || 'vat'}-${getReportNumber(report)}-${index}`}
            height="100%"
            isLoading={isLoading}
            layoutVersion="vat-reports-table-1"
            minWidth={900}
            tableId="vat-reports"
          />
        </div>
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
        cell: (report) => (
          <Text
            size="sm"
            style={{ fontFamily: 'var(--font-mono)', letterSpacing: 0 }}
            title={formatDateTime(report.FromDate)}
          >
            {formatDateTime(report.FromDate)}
          </Text>
        ),
      },
      {
        id: 'number',
        header: t('Номер'),
        minWidth: 220,
        accessor: getReportNumber,
        cell: (report) => (
          <Text
            fw={600}
            size="sm"
            style={{ fontFamily: 'var(--font-mono)', letterSpacing: 0, textTransform: 'uppercase' }}
            title={displayValue(getReportNumber(report))}
          >
            {displayValue(getReportNumber(report))}
          </Text>
        ),
      },
      {
        id: 'type',
        header: t('Тип'),
        width: 140,
        minWidth: 120,
        accessor: (report) => getReportType(report, t),
        cell: (report) => {
          const type = getReportType(report, t)

          return (
            <Text size="sm" title={type}>
              {type}
            </Text>
          )
        },
      },
      {
        id: 'rate',
        header: t('Ставка VAT'),
        width: 130,
        minWidth: 110,
        align: 'right',
        accessor: (report) => report.VatPercent,
        cell: (report) => (
          <Text className="app-money" size="sm" ta="right" title={formatPercent(report.VatPercent)}>
            {formatPercent(report.VatPercent)}
          </Text>
        ),
      },
      {
        id: 'amount',
        header: t('Сума в EUR (ПДВ)'),
        width: 150,
        minWidth: 130,
        align: 'right',
        accessor: (report) => report.VatAmountEU,
        cell: (report) => (
          <Text className="app-money" size="sm" ta="right" title={formatMoney(report.VatAmountEU)}>
            {formatMoney(report.VatAmountEU)}
          </Text>
        ),
      },
      {
        id: 'amountPln',
        header: t('Сума в PLN (ПДВ)'),
        width: 150,
        minWidth: 130,
        align: 'right',
        accessor: (report) => report.VatAmountPL,
        cell: (report) => (
          <Text className="app-money" size="sm" ta="right" title={formatMoney(report.VatAmountPL)}>
            {formatMoney(report.VatAmountPL)}
          </Text>
        ),
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
        reports: [],
      }
    case 'invalid-filter':
      return {
        error: null,
        hasMore: false,
        isLoading: false,
        reports: [],
      }
    case 'loaded':
      return {
        error: null,
        hasMore: action.hasMore,
        isLoading: false,
        reports: action.reports,
      }
    case 'start-loading':
      return {
        ...state,
        error: null,
        hasMore: false,
        isLoading: true,
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
