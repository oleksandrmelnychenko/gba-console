import { BarChart } from '@mantine/charts'
import { Alert, Card, Group, Select, Stack, Text, TextInput } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useEffect, useMemo } from 'react'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import { DataTableDensityToggle } from '../../../shared/ui/data-table/DataTableDensityToggle'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import { useDataTableDensity } from '../../../shared/ui/data-table/useDataTableDensity'
import { getSalesByProductTop } from '../api/salesChartsApi'
import { formatMoney } from '../money'
import type { SalesByProductTopReport, SalesChartsTopNXRow } from '../types'
import { SalesChartsTopType } from '../types'

const TYPE_OPTIONS = [
  { value: String(SalesChartsTopType.TopN), label: 'Top N' },
  { value: String(SalesChartsTopType.TopX), label: 'Top X' },
]

export function ManagerSalesByTopNXView() {
  const { t } = useI18n()
  const today = useMemo(() => formatLocalDate(new Date()), [])
  const [from, setFrom] = useValueState(today)
  const [to, setTo] = useValueState(today)
  const [typeTop, setTypeTop] = useValueState<SalesChartsTopType>(SalesChartsTopType.TopN)
  const [report, setReport] = useValueState<SalesByProductTopReport>({ Managers: [], Products: [] })
  const [isLoading, setIsLoading] = useValueState(false)
  const [error, setError] = useValueState<string | null>(null)
  const { density, toggleDensity } = useDataTableDensity('sales-charts-topnx', 'normal')

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
    <Card className="app-section-card" withBorder radius="md" padding="md">
      <Stack gap="md">
        <Group align="end" gap="sm" wrap="wrap">
          <TextInput
            label={t('З')}
            max={to || undefined}
            type="date"
            value={from}
            w={170}
            onChange={(event) => setFrom(event.currentTarget.value)}
          />
          <TextInput
            label={t('По')}
            min={from || undefined}
            type="date"
            value={to}
            w={170}
            onChange={(event) => setTo(event.currentTarget.value)}
          />
          <Select
            allowDeselect={false}
            data={TYPE_OPTIONS}
            label={t('Тип')}
            value={String(typeTop)}
            w={140}
            onChange={(value) => setTypeTop((Number(value) === SalesChartsTopType.TopX ? SalesChartsTopType.TopX : SalesChartsTopType.TopN))}
          />
          <DataTableDensityToggle density={density} onToggle={toggleDensity} size={36} />
        </Group>

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
          density={density}
          emptyText={t('Дані відсутні')}
          getRowId={(row) => row.rowId}
          isLoading={isLoading}
          layoutVersion="sales-charts-topnx-1"
          loadingText={t('Завантаження даних')}
          maxHeight="calc(100vh - 360px)"
          minWidth={720}
          tableId="sales-charts-topnx"
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
