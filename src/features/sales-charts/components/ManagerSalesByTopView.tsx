import { Alert, Card, Group, Select, Stack, Text, TextInput } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useEffect, useMemo } from 'react'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import { DataTableDensityToggle } from '../../../shared/ui/data-table/DataTableDensityToggle'
import { useDataTableDensity } from '../../../shared/ui/data-table/useDataTableDensity'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import { getSalesByManagersAndTop, getSalesManagers, getSalesOrganizations } from '../api/salesChartsApi'
import { formatMoney } from '../money'
import type {
  SalesByManagersAndTopReport,
  SalesChartsManagerOption,
  SalesChartsManagerTopRow,
  SalesChartsOrganizationOption,
} from '../types'

const EMPTY_REPORT: SalesByManagersAndTopReport = { SalesByManagerAndProductTop: [], TotalByColumn: {} }

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
  const { density, toggleDensity } = useDataTableDensity('sales-charts-managertop', 'normal')

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
      cell: (row) => formatMoney(row.values[key]),
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
        cell: (row) => formatMoney(row.total),
        enableSorting: false,
        header: t('Всього'),
        id: 'total',
        minWidth: 160,
      },
    ]
  }, [columnKeys, t])

  const rows = useMemo<SalesChartsManagerTopRow[]>(() => buildRows(report, t('Всього')), [report, t])

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="md">
        <Group align="end" gap="sm" wrap="wrap">
          <Select
            clearable
            searchable
            data={managerOptions}
            label={t('Менеджер')}
            placeholder={t('Усі')}
            value={netIdManager}
            w={250}
            onChange={setNetIdManager}
          />
          <Select
            clearable
            searchable
            data={organizationOptions}
            label={t('Організація')}
            placeholder={t('Усі')}
            value={netIdOrganization}
            w={250}
            onChange={setNetIdOrganization}
          />
          <TextInput
            label={t('З')}
            max={to || undefined}
            type="date"
            value={from}
            w={150}
            onChange={(event) => setFrom(event.currentTarget.value)}
          />
          <TextInput
            label={t('По')}
            min={from || undefined}
            type="date"
            value={to}
            w={150}
            onChange={(event) => setTo(event.currentTarget.value)}
          />
          <DataTableDensityToggle density={density} onToggle={toggleDensity} size={36} />
        </Group>

        {error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        )}

        {columnKeys.length > 0 ? (
          <DataTable
            columns={columns}
            data={rows}
            density={density}
            emptyText={t('Дані відсутні')}
            getRowId={(row) => row.rowId}
            isLoading={isLoading}
            layoutVersion="sales-charts-managertop-1"
            loadingText={t('Завантаження даних')}
            maxHeight="calc(100vh - 360px)"
            minWidth={720}
            tableId="sales-charts-managertop"
          />
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
