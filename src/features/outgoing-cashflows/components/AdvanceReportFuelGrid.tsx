import { ActionIcon, Tooltip } from '@mantine/core'
import { IconTrash } from '@tabler/icons-react'
import { useMemo } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import type { AdvanceReportFuelRow } from '../advanceReportTypes'

export function AdvanceReportFuelGrid({
  canRemove,
  onRemove,
  rows,
}: {
  canRemove: boolean
  onRemove?: (row: AdvanceReportFuelRow) => void
  rows: AdvanceReportFuelRow[]
}) {
  const { t } = useI18n()
  const columns = useMemo<DataTableColumn<AdvanceReportFuelRow>[]>(() => {
    const base: DataTableColumn<AdvanceReportFuelRow>[] = [
      {
        id: 'companyCar',
        header: t('Автомобілі компанії'),
        width: 360,
        minWidth: 240,
        accessor: (row) => row.companyCar,
        cell: (row) => displayValue(row.companyCar),
      },
      {
        id: 'serviceOrganization',
        header: t('Постачальники послуг'),
        width: 220,
        minWidth: 160,
        accessor: (row) => row.serviceOrganization,
        cell: (row) => displayValue(row.serviceOrganization),
      },
      {
        id: 'paymentCostMovement',
        header: t('Статті витрат'),
        width: 220,
        minWidth: 160,
        accessor: (row) => row.paymentCostMovement,
        cell: (row) => displayValue(row.paymentCostMovement),
      },
      {
        id: 'fuelAmount',
        header: t('Кількість пального'),
        width: 190,
        minWidth: 150,
        align: 'right',
        accessor: (row) => row.fuelAmount,
        cell: (row) => formatNumber(row.fuelAmount),
      },
      {
        id: 'pricePerLiter',
        header: t('Ціна за літр'),
        width: 140,
        minWidth: 110,
        align: 'right',
        accessor: (row) => row.pricePerLiter,
        cell: (row) => formatMoney(row.pricePerLiter),
      },
      {
        id: 'totalAmountWithoutVat',
        header: t('Сума'),
        width: 120,
        minWidth: 100,
        align: 'right',
        accessor: (row) => row.totalAmountWithoutVat,
        cell: (row) => formatMoney(row.totalAmountWithoutVat),
      },
      {
        id: 'vatPercent',
        header: `${t('ПДВ')} %`,
        width: 110,
        minWidth: 80,
        align: 'right',
        accessor: (row) => row.vatPercent,
        cell: (row) => formatNumber(row.vatPercent),
      },
      {
        id: 'vatAmount',
        header: t('Сума ПДВ'),
        width: 120,
        minWidth: 100,
        align: 'right',
        accessor: (row) => row.vatAmount,
        cell: (row) => formatMoney(row.vatAmount),
      },
      {
        id: 'totalPrice',
        header: t('Вся сума'),
        width: 120,
        minWidth: 100,
        align: 'right',
        accessor: (row) => row.totalPrice,
        cell: (row) => formatMoney(row.totalPrice),
      },
    ]

    if (canRemove && onRemove) {
      base.push({
        id: 'remove',
        header: '',
        width: 56,
        minWidth: 56,
        maxWidth: 56,
        align: 'center',
        enableHiding: false,
        enableReorder: false,
        enableResizing: false,
        enableSorting: false,
        cell: (row) => (
          <Tooltip label={t('Видалити')}>
            <ActionIcon
              aria-label={t('Видалити')}
              color="red"
              variant="subtle"
              onClick={(event) => {
                event.stopPropagation()
                onRemove(row)
              }}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        ),
      })
    }

    return base
  }, [canRemove, onRemove, t])

  return (
    <DataTable
      columns={columns}
      data={rows}
      emptyText={t('Немає рядків')}
      getRowId={(row) => row.id}
      maxHeight="40vh"
      minWidth={1640}
      tableId="advance-report-fuel"
    />
  )
}

function displayValue(value?: string): string {
  return value ? value : '—'
}

function formatNumber(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '—'
}

function formatMoney(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
    : '—'
}
