import { ActionIcon, Anchor, Table, Text, Tooltip } from '@mantine/core'
import { IconEdit, IconLock, IconPhoto } from '@tabler/icons-react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { PaymentType, type RetailClientPaymentImageItem } from '../types'

export type PaymentImageListProps = {
  isEditing: boolean
  items: RetailClientPaymentImageItem[]
  onSelect: (item: RetailClientPaymentImageItem) => void
}

export function PaymentImageList({ isEditing, items, onSelect }: PaymentImageListProps) {
  const { t } = useI18n()

  return (
    <Table withTableBorder withColumnBorders striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>IMG</Table.Th>
          <Table.Th>UAH</Table.Th>
          <Table.Th>{t('Користувач')}</Table.Th>
          <Table.Th>{t('Коментар')}</Table.Th>
          <Table.Th>{t('Тип')}</Table.Th>
          <Table.Th />
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {items.map((item, index) => (
          <Table.Tr key={item.NetUid || item.Id || index}>
            <Table.Td>
              {item.ImgUrl ? (
                <Anchor href={item.ImgUrl} target="_blank" rel="noreferrer">
                  <IconPhoto size={18} />
                </Anchor>
              ) : (
                ''
              )}
            </Table.Td>
            <Table.Td>{displayValue(item.Amount)}</Table.Td>
            <Table.Td>{formatUserName(item)}</Table.Td>
            <Table.Td>
              <Tooltip label={item.Comment || ''} disabled={!item.Comment} position="left">
                <Text size="sm" lineClamp={2}>
                  {displayValue(item.Comment)}
                </Text>
              </Tooltip>
            </Table.Td>
            <Table.Td>
              {item.PaymentType === PaymentType.Prepayment ? t('Предоплата') : t('Наложений платіж')}
            </Table.Td>
            <Table.Td>
              {!isEditing || item.IsLocked ? (
                <Tooltip label={t('Змінити неможливо, оплата проведена')} position="left">
                  <ActionIcon color="gray" variant="subtle" aria-label={t('Змінити неможливо, оплата проведена')}>
                    <IconLock size={16} />
                  </ActionIcon>
                </Tooltip>
              ) : (
                <ActionIcon color="gray" variant="subtle" aria-label={t('Редагування')} onClick={() => onSelect(item)}>
                  <IconEdit size={16} />
                </ActionIcon>
              )}
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
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
