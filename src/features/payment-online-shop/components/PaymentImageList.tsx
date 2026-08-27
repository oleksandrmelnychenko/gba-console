import { ActionIcon, Anchor, Image, Text, Tooltip } from '@mantine/core'
import { Lock } from 'lucide-react'
import { useMemo } from 'react'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import { useI18n } from '../../../shared/i18n/useI18n'
import { TableRowAction } from '../../../shared/ui/table-row-action'
import { toProxiedAssetUrl } from '../../../shared/url/proxiedAssetUrl'
import { PaymentType, type RetailClientPaymentImageItem } from '../types'

export type PaymentImageListProps = {
  canEdit: boolean
  isEditing: boolean
  items: RetailClientPaymentImageItem[]
  onSelect: (item: RetailClientPaymentImageItem) => void
}

export function PaymentImageList({ canEdit, isEditing, items, onSelect }: PaymentImageListProps) {
  const { t } = useI18n()

  const columns = useMemo<DataTableColumn<RetailClientPaymentImageItem>[]>(() => [
    {
      id: 'image',
      header: 'IMG',
      minWidth: 72,
      width: 72,
      accessor: (row) => row.ImgUrl,
      cell: (row) => {
        const imageUrl = toProxiedAssetUrl(row.ImgUrl?.trim())

        return imageUrl ? (
          <Anchor
            aria-label={t('Відкрити підтвердження оплати')}
            href={imageUrl}
            rel="noreferrer"
            target="_blank"
          >
            <Image
              alt={t('Підтвердження оплати')}
              fit="cover"
              h={42}
              radius="sm"
              src={imageUrl}
              w={54}
            />
          </Anchor>
        ) : (
          ''
        )
      },
    },
    {
      id: 'amount',
      header: 'UAH',
      accessor: (row) => row.Amount,
      cell: (row) => displayValue(row.Amount),
    },
    {
      id: 'user',
      header: t('Користувач'),
      accessor: (row) => formatUserName(row),
      cell: (row) => formatUserName(row),
    },
    {
      id: 'comment',
      header: t('Коментар'),
      accessor: (row) => row.Comment,
      cell: (row) => (
        <Tooltip label={row.Comment || ''} disabled={!row.Comment} position="left">
          <Text size="sm" lineClamp={2}>
            {displayValue(row.Comment)}
          </Text>
        </Tooltip>
      ),
    },
    {
      id: 'paymentType',
      header: t('Тип'),
      accessor: (row) => row.PaymentType,
      cell: (row) =>
        row.PaymentType === PaymentType.Prepayment
          ? t('Передплата')
          : row.PaymentType === PaymentType.CashOnDelivery
            ? t('Накладений платіж')
            : t('Не вказано'),
    },
    {
      id: 'actions',
      header: '',
      accessor: (row) => row.IsLocked,
      cell: (row) =>
        !canEdit ? null : !isEditing || row.IsLocked ? (
          <Tooltip label={t('Змінити неможливо, оплата проведена')} position="left">
            <ActionIcon color="gray" variant="subtle" aria-label={t('Змінити неможливо, оплата проведена')}>
              <Lock size={16} />
            </ActionIcon>
          </Tooltip>
        ) : (
          <TableRowAction action="edit" label={t('Редагування')} onClick={() => onSelect(row)} />
        ),
    },
  ], [canEdit, isEditing, onSelect, t])

  return (
    <DataTable
      columns={columns}
      data={items}
      getRowId={(row, index) => String(row.NetUid || row.Id || index)}
      tableId="payment-online-shop-images"
      layoutVersion="payment-online-shop-images-1"
    />
  )
}

function formatUserName(item: RetailClientPaymentImageItem): string {
  const user = item.User

  if (!user) {
    return ''
  }

  return [user.FirstName, user.LastName].filter(Boolean).join(' ').trim() || user.FullName?.trim() || ''
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return ''
  }

  return String(value)
}
