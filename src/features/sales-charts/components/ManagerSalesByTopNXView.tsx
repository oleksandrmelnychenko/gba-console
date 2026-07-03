import { BarChart } from '@mantine/charts'
import { Alert, Card, Select, Stack, Text, TextInput } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { getSalesByProductTop } from '../api/salesChartsApi'
import { formatMoney } from '../money'
import type { SalesByProductTopReport, SalesChartsTopNXRow } from '../types'
import { SalesChartsTopType } from '../types'

const TYPE_OPTIONS = [
  { value: String(SalesChartsTopType.TopN), label: 'Top N' },
  { value: String(SalesChartsTopType.TopX), label: 'Top X' },
]

const TOP_NX_TABLE_DEFAULT_LAYOUT = {
  density: 'normal',
} satisfies DataTableDefaultLayout

export function ManagerSalesByTopNXView() {
  const { t } = useI18n()
  const today = useMemo(() => formatLocalDate(new Date()), [])
  const [from, setFrom] = useValueState(today)
  const [to, setTo] = useValueState(today)
  const [typeTop, setTypeTop] = useValueState<SalesChartsTopType>(SalesChartsTopType.TopN)
  const [report, setReport] = useValueState<SalesByProductTopReport>({ Managers: [], Products: [] })
  const [isLoading, setIsLoading] = useValueState(false)
  const [error, setError] = useValueState<string | null>(null)
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setError(null)

      try {
        const result = await getSalesByProductTop({ from, to, typeTop })

        if (!cancelled) {
          setReport(result)
        }
      } catch {
        if (!cancelled) {
          setError(t('Не вдалося завантажити дані'))
          setReport({ Managers: [], Products: [] })
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [from, to, typeTop, setError, setIsLoading, setReport, t])

  const columns = useMemo<DataTableColumn<SalesChartsTopNXRow>[]>(() => {
    const managerColumns = report.Managers.map<DataTableColumn<SalesChartsTopNXRow>>((manager) => ({
      align: 'right',
      cell: (row) => formatMoney(row.values[manager.NetId]),
      enableSorting: false,
      header: manager.ManagerName,
      id: manager.NetId,
      minWidth: 140,
    }))

    return [
      {
        cell: (row) => (
          <Text fw={row.isManager || row.isTotal ? 700 : 400} pl={row.isManager || row.isTotal ? 0 : 8} size="sm">
            {row.label}
          </Text>
        ),
        enableSorting: false,
        header: t('Код Виробника'),
        id: 'label',
        minWidth: 220,
      },
      ...managerColumns,
      {
        align: 'right',
        cell: (row) => formatMoney(row.total),
        enableSorting: false,
        header: t('Підсумок'),
        id: 'total',
        minWidth: 160,
      },
    ]
  }, [report.Managers, t])

  const rows = useMemo<SalesChartsTopNXRow[]>(() => flattenReport(report, t('Всього')), [report, t])
  const chartData = useMemo(
    () =>
      report.Managers.map((manager) => ({
        manager: manager.ManagerName || `#${manager.NetId}`,
        total: manager.TotalManagerSold || 0,
      })),
    [report.Managers],
  )

  return (
    <Card className="app-data-card sales-chart-card" withBorder radius="md" padding={0}>
      <div className="app-filter-bar">
        <div className="sales-chart-filter-row is-topnx">
          <TextInput
            className="sales-chart-filter-control"
            label={t('З')}
            max={to || undefined}
            type="date"
            value={from}
            onChange={(event) => setFrom(event.currentTarget.value)}
          />
          <TextInput
            className="sales-chart-filter-control"
            label={t('По')}
            min={from || undefined}
            type="date"
            value={to}
            onChange={(event) => setTo(event.currentTarget.value)}
          />
          <Select
            allowDeselect={false}
            className="sales-chart-filter-control"
            data={TYPE_OPTIONS}
            label={t('Тип')}
            value={String(typeTop)}
            onChange={(value) => setTypeTop((Number(value) === SalesChartsTopType.TopX ? SalesChartsTopType.TopX : SalesChartsTopType.TopN))}
          />
          <div ref={setTableToolbarSlot} className="sales-chart-table-toolbar-slot" />
        </div>
      </div>

      <Stack className="sales-chart-content" gap="md" p="md">

        {error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        )}

        {chartData.length > 0 && (
          <BarChart
            data={chartData}
            dataKey="manager"
            h={260}
            series={[{ color: 'orange.6', label: t('Продано'), name: 'total' }]}
            tickLine="y"
            valueFormatter={(value) => formatMoney(value)}
            withLegend={false}
          />
        )}

        <DataTable
          columns={columns}
          data={rows}
          defaultLayout={TOP_NX_TABLE_DEFAULT_LAYOUT}
          distributeAvailableWidth
          emptyText={t('Дані відсутні')}
          getRowId={(row) => row.rowId}
          isLoading={isLoading}
          layoutVersion="sales-charts-topnx-2"
          loadingText={t('Завантаження даних')}
          maxHeight="calc(100vh - 360px)"
          minWidth={720}
          showLayoutControls
          tableId="sales-charts-topnx"
          toolbarPortalTarget={tableToolbarSlot}
        />
      </Stack>
    </Card>
  )
}

function flattenReport(report: SalesByProductTopReport, totalLabel: string): SalesChartsTopNXRow[] {
  const rows: SalesChartsTopNXRow[] = []

  report.Managers.forEach((manager) => {
    rows.push({
      isManager: true,
      isTotal: false,
      label: manager.ManagerName,
      rowId: `manager-${manager.NetId}`,
      total: manager.TotalManagerSold,
      values: { [manager.NetId]: manager.TotalManagerSold },
    })

    for (const product of report.Products) {
      if (typeof product.ManagersSoldProduct[manager.NetId] !== 'undefined') {
        rows.push({
          isManager: false,
          isTotal: false,
          label: product.VendorCode,
          rowId: `manager-${manager.NetId}-product-${product.ProductNetId}`,
          total: product.TotalValueSoldProduct,
          values: { [manager.NetId]: product.TotalValueSoldProduct },
        })
      }
    }
  })

  const totalValues: Record<string, number> = {}
  let grandTotal = 0

  report.Managers.forEach((manager) => {
    totalValues[manager.NetId] = (totalValues[manager.NetId] || 0) + manager.TotalManagerSold
    grandTotal += manager.TotalManagerSold
  })

  rows.push({
    isManager: false,
    isTotal: true,
    label: totalLabel,
    rowId: 'grand-total',
    total: grandTotal,
    values: totalValues,
  })

  return rows
}
