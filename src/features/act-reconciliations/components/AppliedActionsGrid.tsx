import { Card, Stack, Text } from '@mantine/core'
import { useMemo } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { translate } from '../../../shared/i18n/translate'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import {
  ActReconciliationAppliedActionType,
  type ActReconciliationAppliedAction,
  type ActReconciliationAppliedActionItem,
} from '../types'

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  dateStyle: 'short',
  timeStyle: 'short',
})

export function AppliedActionsGrid({ appliedAction }: { appliedAction: ActReconciliationAppliedAction }) {
  const { t } = useI18n()
  const items = useMemo(() => appliedAction.Items || [], [appliedAction.Items])
  const columns = useAppliedActionColumns(items)

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="sm">
        <Text fw={700}>{appliedAction.ActReconciliationItem?.Product?.VendorCode || '-'}</Text>
        <DataTable
          columns={columns}
          data={items}
          emptyText={t('Документів не знайдено')}
          getRowId={(_item, index) => String(index)}
          layoutVersion="act-reconciliation-applied-actions-table-1"
          maxHeight="40vh"
          minWidth={840}
          tableId="act-reconciliation-applied-actions"
        />
      </Stack>
    </Card>
  )
}

function useAppliedActionColumns(
  items: ActReconciliationAppliedActionItem[],
): DataTableColumn<ActReconciliationAppliedActionItem>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<ActReconciliationAppliedActionItem>[]>(
    () => [
      {
        id: 'index',
        header: '#',
        width: 56,
        minWidth: 48,
        align: 'right',
        enableSorting: false,
        cell: (item) => String(items.indexOf(item) + 1),
      },
      {
        id: 'document',
        header: t('Документ'),
        width: 240,
        minWidth: 180,
        accessor: (item) => getRowData(item).documentName,
        cell: (item) => <Text fw={600}>{getRowData(item).documentName}</Text>,
      },
      {
        id: 'documentNumber',
        header: t('Номер документу'),
        width: 200,
        minWidth: 150,
        accessor: (item) => getRowData(item).documentNumber,
        cell: (item) => displayValue(getRowData(item).documentNumber),
      },
      {
        id: 'documentDate',
        header: t('Дата документу'),
        width: 180,
        minWidth: 150,
        accessor: (item) => getRowData(item).documentDate,
        cell: (item) => formatDateTime(getRowData(item).documentDate),
      },
      {
        id: 'storage',
        header: t('Склад'),
        minWidth: 200,
        accessor: (item) => getRowData(item).storage,
        cell: (item) => (
          <Text size="sm" lineClamp={2}>
            {displayValue(getRowData(item).storage)}
          </Text>
        ),
      },
      {
        id: 'qty',
        header: t('К-сть'),
        width: 96,
        minWidth: 80,
        align: 'right',
        accessor: (item) => getRowData(item).qty,
        cell: (item) => displayValue(getRowData(item).qty),
      },
    ],
    [items, t],
  )
}

type AppliedActionRowData = {
  documentDate?: Date | string
  documentName: string
  documentNumber?: string
  qty: number
  storage: string
}

function getRowData(item: ActReconciliationAppliedActionItem): AppliedActionRowData {
  switch (item.ActionType) {
    case ActReconciliationAppliedActionType.ProductIncome:
      return {
        documentDate: item.ProductIncome?.FromDate,
        documentName: translate('Прихідна накладна на товар'),
        documentNumber: item.ProductIncome?.Number,
        qty: item.ProductIncome?.ProductIncomeItems?.[0]?.Qty || 0,
        storage: item.ProductIncome?.Storage?.Name || '',
      }
    case ActReconciliationAppliedActionType.DepreciatedOrder:
      return {
        documentDate: item.DepreciatedOrder?.FromDate,
        documentName: translate('Акт списання'),
        documentNumber: item.DepreciatedOrder?.Number,
        qty: item.DepreciatedOrder?.DepreciatedOrderItems?.[0]?.Qty || 0,
        storage: item.DepreciatedOrder?.Storage?.Name || '',
      }
    case ActReconciliationAppliedActionType.ProductTransfer:
      return {
        documentDate: item.ProductTransfer?.FromDate,
        documentName: translate('Переміщення'),
        documentNumber: item.ProductTransfer?.Number,
        qty: item.ProductTransfer?.ProductTransferItems?.[0]?.Qty || 0,
        storage: `${translate('З складу')}: "${item.ProductTransfer?.FromStorage?.Name || ''}". ${translate('На склад')}: "${item.ProductTransfer?.ToStorage?.Name || ''}"`,
      }
    default:
      return {
        documentName: '-',
        qty: 0,
        storage: '',
      }
  }
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
