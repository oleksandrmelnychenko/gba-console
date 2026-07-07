import { Anchor, Badge, Button, Divider, Group, Stack, Text } from '@mantine/core'
import { ExternalLink, FileText } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getDocumentHref } from '../../../shared/url/getDocumentHref'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import type { AccountingCashFlowHeadItem } from '../types'
import {
  type CashFlowDetailRow,
  type CashFlowDetailViewModel,
  mapItemToDetailViewModel,
} from './cashFlowDetailMapper'

const DETAIL_GRID_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['date'],
  },
  density: 'compact',
} satisfies DataTableDefaultLayout

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  dateStyle: 'short',
  timeStyle: 'short',
})

const dateFormatter = new Intl.DateTimeFormat('uk-UA', {
  dateStyle: 'short',
})

export function CashFlowDetailContent({ item }: { item: AccountingCashFlowHeadItem }) {
  const detail = useMemo(() => mapItemToDetailViewModel(item), [item])

  if (!detail) {
    return null
  }

  return <CashFlowDetailView detail={detail} />
}

function CashFlowDetailView({ detail }: { detail: CashFlowDetailViewModel }) {
  const { t } = useI18n()
  const columns = useDetailColumns(detail.columnKind)
  const orderLink = detail.orderLink

  return (
    <Stack gap="md">
      {(detail.documents.length > 0 || orderLink) && (
        <>
          <Group gap="xs" wrap="wrap">
            {detail.documents.map((document) => (
              <Anchor
                key={document.url}
                href={getDocumentHref(document.url)}
                target="_blank"
                rel="noreferrer"
                className="document-link"
              >
                <span className="document-link-badge document-link-badge-pdf">
                  <FileText size={18} strokeWidth={1.8} />
                </span>
                <span>{document.name || t('Документ')}</span>
              </Anchor>
            ))}
            {orderLink ? (
              orderLink.isNavigable ? (
                <Button
                  color="gray"
                  component={Link}
                  leftSection={<ExternalLink size={16} />}
                  to={orderLink.route}
                  variant="light"
                >
                  {t('На логістичний шлях')}
                </Button>
              ) : (
                <Text c="dimmed" size="sm">
                  {t('На логістичний шлях')}
                </Text>
              )
            ) : null}
          </Group>
          <Divider />
        </>
      )}

      <DataTable
        columns={columns}
        data={detail.rows}
        defaultLayout={DETAIL_GRID_DEFAULT_LAYOUT}
        emptyText={t('Позицій не знайдено')}
        getRowId={(row, index) => `${row.ServiceNumber || row.Number || 'row'}-${index}`}
        layoutVersion={`accounting-cash-flow-detail-${detail.columnKind}-1`}
        maxHeight={360}
        minWidth={detail.columnKind === 'supplyPaymentTask' ? 760 : 980}
        tableId={`accounting-cash-flow-detail-${detail.columnKind}`}
      />
    </Stack>
  )
}

function useDetailColumns(columnKind: CashFlowDetailViewModel['columnKind']): DataTableColumn<CashFlowDetailRow>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<CashFlowDetailRow>[]>(() => {
    if (columnKind === 'supplyPaymentTask') {
      return [
        {
          id: 'date',
          header: t('Дата'),
          width: 200,
          minWidth: 150,
          accessor: (row) => row.FromData,
          cell: (row) => formatDateTime(row.FromData),
        },
        {
          id: 'serviceNumber',
          header: t('Номер документу'),
          width: 170,
          minWidth: 130,
          accessor: (row) => row.ServiceNumber,
          cell: (row) => displayValue(row.ServiceNumber),
        },
        {
          id: 'number',
          header: t('Номер'),
          width: 130,
          minWidth: 110,
          accessor: (row) => row.Number,
          cell: (row) => displayValue(row.Number),
        },
        {
          id: 'containerNumber',
          header: t('Номер контейнера'),
          width: 160,
          minWidth: 130,
          accessor: (row) => row.ContainerNumber,
          cell: (row) => displayValue(row.ContainerNumber),
        },
        {
          id: 'currency',
          header: t('Валюта'),
          width: 90,
          minWidth: 80,
          accessor: (row) => row.Currency,
          cell: (row) => displayValue(row.Currency),
        },
        {
          id: 'paymentStatus',
          header: t('Оплата'),
          width: 140,
          minWidth: 120,
          accessor: (row) => row.PaymentStatus?.label,
          cell: (row) => renderPaymentStatus(row, t),
        },
        {
          id: 'netPrice',
          header: t('Вартість'),
          width: 160,
          minWidth: 120,
          align: 'right',
          accessor: (row) => row.NetPrice,
          cell: (row) => formatMoney(row.NetPrice),
        },
      ]
    }

    return [
      {
        id: 'date',
        header: t('Дата'),
        width: 140,
        minWidth: 120,
        accessor: (row) => row.FromData,
        cell: (row) => formatDate(row.FromData),
      },
      {
        id: 'serviceNumber',
        header: t('Номер документу'),
        width: 160,
        minWidth: 130,
        accessor: (row) => row.ServiceNumber,
        cell: (row) => displayValue(row.ServiceNumber),
      },
      {
        id: 'number',
        header: t('Номер'),
        width: 130,
        minWidth: 110,
        accessor: (row) => row.Number,
        cell: (row) => displayValue(row.Number),
      },
      {
        id: 'name',
        header: t('Назва'),
        width: 240,
        minWidth: 180,
        accessor: (row) => row.Name,
        cell: (row) => displayValue(row.Name),
      },
      {
        id: 'symbol',
        header: t('Символ'),
        width: 90,
        minWidth: 80,
        accessor: (row) => row.Symbol,
        cell: (row) => displayValue(row.Symbol),
      },
      {
        id: 'currency',
        header: t('Валюта'),
        width: 80,
        minWidth: 70,
        accessor: (row) => row.Currency,
        cell: (row) => displayValue(row.Currency),
      },
      {
        id: 'paymentStatus',
        header: t('Оплата'),
        width: 140,
        minWidth: 120,
        accessor: (row) => row.PaymentStatus?.label,
        cell: (row) => renderPaymentStatus(row, t),
      },
      {
        id: 'netPrice',
        header: t('Вартість Нетто'),
        width: 130,
        minWidth: 110,
        align: 'right',
        accessor: (row) => row.NetPrice,
        cell: (row) => formatMoney(row.NetPrice),
      },
      {
        id: 'vatPercent',
        header: t('ПДВ %'),
        width: 80,
        minWidth: 70,
        align: 'right',
        accessor: (row) => row.VatPercent,
        cell: (row) => displayValue(row.VatPercent),
      },
      {
        id: 'vat',
        header: t('ПДВ'),
        width: 110,
        minWidth: 90,
        align: 'right',
        accessor: (row) => row.Vat,
        cell: (row) => formatMoney(row.Vat),
      },
      {
        id: 'grossPrice',
        header: t('Вартість Брутто'),
        width: 140,
        minWidth: 110,
        align: 'right',
        accessor: (row) => row.GrossPrice,
        cell: (row) => formatMoney(row.GrossPrice),
      },
    ]
  }, [columnKind, t])
}

function renderPaymentStatus(row: CashFlowDetailRow, t: (key: string) => string) {
  if (!row.PaymentStatus) {
    return displayValue(undefined)
  }

  return (
    <Badge color={row.PaymentStatus.color} size="sm" variant="light">
      {t(row.PaymentStatus.label)}
    </Badge>
  )
}

function formatDateTime(value?: string): string {
  if (!value) {
    return '-'
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? value : dateTimeFormatter.format(date)
}

function formatDate(value?: string): string {
  if (!value) {
    return '-'
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date)
}

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

function formatMoney(value?: number): string {
  return moneyFormatter.format(typeof value === 'number' && Number.isFinite(value) ? value : 0)
}

function displayValue(value?: string | number): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '-'
  }

  return value || '-'
}
