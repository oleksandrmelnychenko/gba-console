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
import { useEffect, useMemo, useReducer } from 'react'
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

export function VatReportsPage() {
  const { t } = useI18n()
  const [fromDate, setFromDate] = useValueState(() => shiftDate(-7))
  const [toDate, setToDate] = useValueState(() => formatLocalDate(new Date()))
  const [reports, setReports] = useValueState<VatReport[]>([])
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isLoadingMore, setLoadingMore] = useValueState(false)
  const [hasMore, setHasMore] = useValueState(false)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const columns = useVatReportColumns()

  useEffect(() => {
    let isActive = true
    setLoading(true)
    setError(null)
    setHasMore(false)

    async function loadReports() {
      try {
        const nextReports = await getVatReports({
          from: fromDate,
          limit: DEFAULT_LIMIT,
          offset: 0,
          to: toDate,
        })

        if (isActive) {
          setReports(nextReports)
          setHasMore(nextReports.length >= DEFAULT_LIMIT)
        }
      } catch (loadError) {
        if (isActive) {
          setReports([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити VAT'))
        }
      } finally {
        if (isActive) {
          setLoading(false)
        }
      }
    }

    void loadReports()

    return () => {
      isActive = false
    }
  }, [fromDate, reloadKey, setError, setHasMore, setLoading, setReports, t, toDate])

  async function loadMore() {
    setLoadingMore(true)
    setError(null)

    try {
      const nextReports = await getVatReports({
        from: fromDate,
        limit: DEFAULT_LIMIT,
        offset: reports.length,
        to: toDate,
      })

      setReports((current) => [...current, ...nextReports])
      setHasMore(nextReports.length >= DEFAULT_LIMIT)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити наступні записи'))
    } finally {
      setLoadingMore(false)
    }
  }

  function resetFilters() {
    setFromDate(shiftDate(-7))
    setToDate(formatLocalDate(new Date()))
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
                <ActionIcon aria-label={t('Оновити')} loading={isLoading} variant="light" onClick={reload}>
                  <IconRefresh size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>

          <Group align="end" gap="sm">
            <TextInput label={t('Від')} type="date" value={fromDate} onChange={(event) => setFromDate(event.currentTarget.value)} />
            <TextInput label={t('До')} type="date" value={toDate} onChange={(event) => setToDate(event.currentTarget.value)} />
          </Group>

          {error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {error}
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
              <Button color="gray" loading={isLoadingMore} variant="light" onClick={loadMore}>
                {t('Завантажити ще')}
              </Button>
            </Group>
          )}
        </Stack>
      </Card>
    </Stack>
  )
}

function useVatReportColumns(): DataTableColumn<VatReport>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<VatReport>[]>(
    () => [
      {
        id: 'index',
        header: '',
        width: 64,
        minWidth: 56,
        align: 'right',
        accessor: () => 0,
        cell: () => '',
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
    [t],
  )
}

function getReportNumber(report: VatReport): string | undefined {
  return report.Sale?.SaleNumber?.Value || report.Sale?.Number || report.SupplyInvoice?.Number
}

function getReportType(report: VatReport, t: (value: string) => string): string {
  return report.Sale ? t('Фактура') : t('Інвойс')
}

function shiftDate(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)

  return formatLocalDate(date)
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
  return typeof value === 'number' && Number.isFinite(value) ? moneyFormatter.format(value) : '—'
}

function displayValue(value?: string | null): string {
  return value || '—'
}
