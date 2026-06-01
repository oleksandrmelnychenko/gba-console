import { ActionIcon, Anchor, Text, Tooltip } from '@mantine/core'
import { IconEdit, IconLock, IconPhoto } from '@tabler/icons-react'
import { useMemo } from 'react'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import { useI18n } from '../../../shared/i18n/useI18n'
import { PaymentType, type RetailClientPaymentImageItem } from '../types'

export type PaymentImageListProps = {
  isEditing: boolean
  items: RetailClientPaymentImageItem[]
  onSelect: (item: RetailClientPaymentImageItem) => void
}

export function PaymentImageList({ isEditing, items, onSelect }: PaymentImageListProps) {
  const { t } = useI18n()

  const columns = useMemo<DataTableColumn<RetailClientPaymentImageItem>[]>(() => [
    {
      id: 'image',
      header: 'IMG',
      accessor: (row) => row.ImgUrl,
      cell: (row) =>
        row.ImgUrl ? (
          <Anchor href={row.ImgUrl} target="_blank" rel="noreferrer">
            <IconPhoto size={18} />
          </Anchor>
        ) : (
          ''
        ),
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
        row.PaymentType === PaymentType.Prepayment ? t('Предоплата') : t('Наложений платіж'),
    },
    {
      id: 'actions',
      header: '',
      accessor: (row) => row.IsLocked,
      cell: (row) =>
        !isEditing || row.IsLocked ? (
          <Tooltip label={t('Змінити неможливо, оплата проведена')} position="left">
            <ActionIcon color="gray" variant="subtle" aria-label={t('Змінити неможливо, оплата проведена')}>
              <IconLock size={16} />
            </ActionIcon>
          </Tooltip>
        ) : (
          <ActionIcon color="gray" variant="subtle" aria-label={t('Редагування')} onClick={() => onSelect(row)}>
            <IconEdit size={16} />
          </ActionIcon>
        ),
    },
  ], [isEditing, onSelect, t])

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
