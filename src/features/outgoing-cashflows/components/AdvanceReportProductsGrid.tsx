import { ActionIcon, Tooltip } from '@mantine/core'
import { IconTrash } from '@tabler/icons-react'
import { useMemo } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import type { AdvanceReportConsumableRow } from '../advanceReportTypes'

export function AdvanceReportProductsGrid({
  canRemove,
  onRemove,
  rows,
}: {
  canRemove: boolean
  onRemove?: (row: AdvanceReportConsumableRow) => void
  rows: AdvanceReportConsumableRow[]
}) {
  const { t } = useI18n()
  const columns = useMemo<DataTableColumn<AdvanceReportConsumableRow>[]>(() => {
    const base: DataTableColumn<AdvanceReportConsumableRow>[] = [
      {
        id: 'organization',
        header: t('Постачальник послуг'),
        width: 200,
        minWidth: 160,
        accessor: (row) => row.organization,
        cell: (row) => displayValue(row.organization),
      },
      {
        id: 'organizationFromNumber',
        header: t('Вхідний номер'),
        width: 180,
        minWidth: 140,
        accessor: (row) => row.organizationFromNumber,
        cell: (row) => displayValue(row.organizationFromNumber),
      },
      {
        id: 'vendorCode',
        header: t('Артикул'),
        width: 110,
        minWidth: 80,
        accessor: (row) => row.vendorCode,
        cell: (row) => displayValue(row.vendorCode),
      },
      {
        id: 'name',
        header: t('Назва'),
        width: 280,
        minWidth: 200,
        accessor: (row) => row.name,
        cell: (row) => displayValue(row.name),
      },
      {
        id: 'category',
        header: t('Категорія'),
        width: 170,
        minWidth: 130,
        accessor: (row) => row.category,
        cell: (row) => displayValue(row.category),
      },
      {
        id: 'quantity',
        header: t('Кількість'),
        width: 110,
        minWidth: 90,
        align: 'right',
        accessor: (row) => row.quantity,
        cell: (row) => formatNumber(row.quantity),
      },
      {
        id: 'pricePerUnit',
        header: t('Ціна за одиницю'),
        width: 170,
        minWidth: 130,
        align: 'right',
        accessor: (row) => row.pricePerUnit,
        cell: (row) => formatMoney(row.pricePerUnit),
      },
      {
        id: 'amount',
        header: t('Сума'),
        width: 120,
        minWidth: 100,
        align: 'right',
        accessor: (row) => row.amount,
        cell: (row) => formatMoney(row.amount),
      },
      {
        id: 'vatPercent',
        header: `${t('ПДВ')} %`,
        width: 90,
        minWidth: 70,
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
        id: 'organizationName',
        header: t('Організація'),
        width: 220,
        minWidth: 160,
        accessor: (row) => row.organizationName,
        cell: (row) => displayValue(row.organizationName),
      },
      {
        id: 'agreementName',
        header: t('Договір'),
        width: 200,
        minWidth: 150,
        accessor: (row) => row.agreementName,
        cell: (row) => displayValue(row.agreementName),
      },
      {
        id: 'storageName',
        header: t('Склад'),
        width: 200,
        minWidth: 150,
        accessor: (row) => row.storageName,
        cell: (row) => displayValue(row.storageName),
      },
      {
        id: 'totalAmount',
        header: t('Вся сума'),
        width: 130,
        minWidth: 110,
        align: 'right',
        accessor: (row) => row.totalAmount,
        cell: (row) => formatMoney(row.totalAmount),
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
      minWidth={1980}
      tableId="advance-report-products"
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
