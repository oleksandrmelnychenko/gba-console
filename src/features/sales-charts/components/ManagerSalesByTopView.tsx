import { BarChart } from '@mantine/charts'
import { Alert, Card, Select, Stack, Text, TextInput } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { getSalesByManagersAndTop, getSalesManagers, getSalesOrganizations } from '../api/salesChartsApi'
import { formatMoney } from '../money'
import type {
  SalesByManagersAndTopReport,
  SalesChartsManagerOption,
  SalesChartsManagerTopRow,
  SalesChartsOrganizationOption,
} from '../types'

const EMPTY_REPORT: SalesByManagersAndTopReport = { SalesByManagerAndProductTop: [], TotalByColumn: {} }

const MANAGER_TOP_TABLE_DEFAULT_LAYOUT = {
  density: 'normal',
} satisfies DataTableDefaultLayout

export function ManagerSalesByTopView() {
  const { t } = useI18n()
  const today = useMemo(() => formatLocalDate(new Date()), [])
  const [from, setFrom] = useValueState(today)
  const [to, setTo] = useValueState(today)
  const [netIdManager, setNetIdManager] = useValueState<string | null>(null)
  const [netIdOrganization, setNetIdOrganization] = useValueState<string | null>(null)
  const [managers, setManagers] = useValueState<SalesChartsManagerOption[]>([])
  const [organizations, setOrganizations] = useValueState<SalesChartsOrganizationOption[]>([])
  const [report, setReport] = useValueState<SalesByManagersAndTopReport>(EMPTY_REPORT)
  const [isLoading, setIsLoading] = useValueState(false)
  const [error, setError] = useValueState<string | null>(null)
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [managerList, organizationList] = await Promise.all([getSalesManagers(), getSalesOrganizations()])

        if (!cancelled) {
          setManagers(managerList)
          setOrganizations(organizationList)
        }
      } catch {
        if (!cancelled) {
          setManagers([])
          setOrganizations([])
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [setManagers, setOrganizations])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setError(null)

      try {
        const result = await getSalesByManagersAndTop({
          from,
          netIdManager: netIdManager || undefined,
          netIdOrganization: netIdOrganization || undefined,
          to,
        })

        if (!cancelled) {
          setReport(result)
        }
      } catch {
        if (!cancelled) {
          setError(t('Не вдалося завантажити дані'))
          setReport(EMPTY_REPORT)
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
  }, [from, to, netIdManager, netIdOrganization, setError, setIsLoading, setReport, t])

  const managerOptions = useMemo(
    () =>
      managers.reduce<{ label: string; value: string }[]>((acc, manager) => {
        const option = { label: managerLabel(manager), value: manager.NetUid || '' }
        if (option.value) acc.push(option)
        return acc
      }, []),
    [managers],
  )

  const organizationOptions = useMemo(
    () =>
      organizations.reduce<{ label: string; value: string }[]>((acc, organization) => {
        const option = { label: organization.Name || '', value: organization.NetUid || '' }
        if (option.value) acc.push(option)
        return acc
      }, []),
    [organizations],
  )

  const columnKeys = useMemo(() => Object.keys(report.TotalByColumn), [report.TotalByColumn])

  const columns = useMemo<DataTableColumn<SalesChartsManagerTopRow>[]>(() => {
    const dynamicColumns = columnKeys.map<DataTableColumn<SalesChartsManagerTopRow>>((key) => ({
      align: 'right',
      cell: (row) => <span className="sales-chart-money">{formatMoney(row.values[key])}</span>,
      enableSorting: false,
      header: key,
      id: `col-${key}`,
      minWidth: 140,
    }))

    return [
      {
        cell: (row) => row.label,
        enableSorting: false,
        header: `${t('Менеджер')} / ${t('Організація')}`,
        id: 'label',
        minWidth: 250,
      },
      ...dynamicColumns,
      {
        align: 'right',
        cell: (row) => <span className="sales-chart-money">{formatMoney(row.total)}</span>,
        enableSorting: false,
        header: t('Всього'),
        id: 'total',
        minWidth: 160,
      },
    ]
  }, [columnKeys, t])

  const rows = useMemo<SalesChartsManagerTopRow[]>(() => buildRows(report, t('Всього')), [report, t])
  const chartData = useMemo(
    () =>
      report.SalesByManagerAndProductTop.map((item) => ({
        manager: item.ManagerName || `#${item.ManagerNetId}`,
        total: item.TotalValueSales || 0,
      })),
    [report.SalesByManagerAndProductTop],
  )

  return (
    <Card className="app-data-card sales-chart-card" withBorder radius="md" padding={0}>
      <div className="app-filter-bar">
        <div className="sales-chart-filter-row is-manager-top">
          <Select
            clearable
            searchable
            className="sales-chart-filter-control"
            data={managerOptions}
            label={t('Менеджер')}
            placeholder={t('Усі')}
            value={netIdManager}
            onChange={setNetIdManager}
          />
          <Select
            clearable
            searchable
            className="sales-chart-filter-control"
            data={organizationOptions}
            label={t('Організація')}
            placeholder={t('Усі')}
            value={netIdOrganization}
            onChange={setNetIdOrganization}
          />
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
          <div>
            <Text className="app-section-title" fw={600} mb={8} size="sm">
              {t('Продано по менеджерах')}
            </Text>
          <BarChart
            data={chartData}
            dataKey="manager"
            h={260}
            series={[{ color: 'orange.6', label: t('Продажі'), name: 'total' }]}
            tickLine="y"
            valueFormatter={(value) => formatMoney(value)}
            withLegend={false}
          />
          </div>
        )}

        {columnKeys.length > 0 ? (
          <div className="sales-chart-table-wrap">
            <DataTable
              columns={columns}
              data={rows}
              defaultLayout={MANAGER_TOP_TABLE_DEFAULT_LAYOUT}
              distributeAvailableWidth
              emptyText={t('Дані відсутні')}
              getRowId={(row) => row.rowId}
              height="100%"
              isLoading={isLoading}
              layoutVersion="sales-charts-managertop-2"
              loadingText={t('Завантаження даних')}
              minWidth={720}
              showLayoutControls
              tableId="sales-charts-managertop"
              toolbarPortalTarget={tableToolbarSlot}
            />
          </div>
        ) : (
          <Text c="dimmed" size="sm">
            {isLoading ? t('Завантаження даних') : t('Дані відсутні')}
          </Text>
        )}
      </Stack>
    </Card>
  )
}

function managerLabel(manager: SalesChartsManagerOption): string {
  const fullName = `${manager.FirstName || ''} ${manager.LastName || ''}`.trim()

  return manager.FullName || fullName || manager.Name || manager.Abbreviation || ''
}

function buildRows(report: SalesByManagersAndTopReport, totalLabel: string): SalesChartsManagerTopRow[] {
  const columnKeys = Object.keys(report.TotalByColumn)

  const rows = report.SalesByManagerAndProductTop.map<SalesChartsManagerTopRow>((item, index) => ({
    isTotal: false,
    label: item.ManagerName,
    rowId: `${item.ManagerNetId || 'manager'}-${index}`,
    total: item.TotalValueSales,
    values: { ...item.SalesValueByProductTop },
  }))

  const totalValues: Record<string, number | undefined> = {}

  columnKeys.forEach((key) => {
    totalValues[key] = report.TotalByColumn[key]
  })

  const grandTotal = report.SalesByManagerAndProductTop.reduce((sum, item) => sum + item.TotalValueSales, 0)

  rows.push({
    isTotal: true,
    label: totalLabel,
    rowId: 'grand-total',
    total: grandTotal,
    values: totalValues,
  })

  return rows
}
