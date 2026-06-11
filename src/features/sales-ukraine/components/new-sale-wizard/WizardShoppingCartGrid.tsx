import { ActionIcon, Group, ScrollArea, Table, Text, Tooltip } from '@mantine/core'
import { IconTrash } from '@tabler/icons-react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { roundMoney } from '../../saleMoney'
import type { SalesUkraineOrderItem } from '../../types'
import {
  getOrderItemDiscount,
  getOrderItemLocalPrice,
  getOrderItemLocalTotal,
  getWizardProductNumber,
  type WizardSaleProduct,
} from './wizardSaleProduct'

const qtyFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3 })
const priceFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })

export function WizardShoppingCartGrid({
  busy = false,
  items,
  localCurrencyCode,
  useEurToUah,
  onRemove,
  onRowClick,
}: {
  busy?: boolean
  items: SalesUkraineOrderItem[]
  localCurrencyCode: string
  useEurToUah: boolean
  onRemove?: (item: SalesUkraineOrderItem) => void
  onRowClick?: (item: SalesUkraineOrderItem) => void
}) {
  const { t } = useI18n()
  const totalQty = items.reduce((sum, item) => sum + (getWizardProductNumber(item.Qty) ?? 0), 0)
  const totalAmount = roundMoney(items.reduce((sum, item) => sum + (getWizardProductNumber(item.TotalAmount) ?? 0), 0))
  const totalAmountLocal = roundMoney(items.reduce((sum, item) => sum + getOrderItemLocalTotal(item, useEurToUah), 0))

  return (
    <div>
      <ScrollArea.Autosize mah={320} type="auto">
        <Table highlightOnHover stickyHeader verticalSpacing={6} withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={40} />
              <Table.Th>{t('Код товару')}</Table.Th>
              <Table.Th>{t('Назва')}</Table.Th>
              <Table.Th>{t('Коментар')}</Table.Th>
              <Table.Th>{t('Оригінальний номер')}</Table.Th>
              <Table.Th>{t('Митний код')}</Table.Th>
              <Table.Th>{t('Додав')}</Table.Th>
              <Table.Th ta="right">{t('Кількість')}</Table.Th>
              <Table.Th ta="right">EUR</Table.Th>
              <Table.Th ta="right">{localCurrencyCode}</Table.Th>
              <Table.Th ta="right">{t('Сума в EUR')}</Table.Th>
              <Table.Th ta="right">{t('Знижка')}</Table.Th>
              <Table.Th ta="right">{t('Ручна знижка')}</Table.Th>
              <Table.Th ta="right">{`${t('Сума в')} ${localCurrencyCode}`}</Table.Th>
              {onRemove && <Table.Th w={44} />}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={onRemove ? 15 : 14}>
                  <Text c="dimmed" py="sm" size="sm" ta="center">
                    {t('Кошик порожній')}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              items.map((item, index) => (
                <Table.Tr
                  key={String(item.NetUid || item.Id || index)}
                  style={onRowClick ? { cursor: 'pointer' } : undefined}
                  onClick={() => onRowClick?.(item)}
                >
                  <Table.Td>{index + 1}</Table.Td>
                  <Table.Td>
                    <Text fw={600} size="sm">
                      {item.Product?.VendorCode || item.Product?.Articul || '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td>{item.Product?.NameUA || item.Product?.Name || '—'}</Table.Td>
                  <Table.Td>{item.Comment || ''}</Table.Td>
                  <Table.Td>{item.Product?.MainOriginalNumber || ''}</Table.Td>
                  <Table.Td>{item.AssignedSpecification?.SpecificationCode || ''}</Table.Td>
                  <Table.Td>{item.User?.LastName || ''}</Table.Td>
                  <Table.Td ta="right">{qtyFormatter.format(getWizardProductNumber(item.Qty) ?? 0)}</Table.Td>
                  <Table.Td ta="right">
                    {priceFormatter.format(getWizardProductNumber((item.Product as WizardSaleProduct | undefined)?.CurrentPrice) ?? 0)}
                  </Table.Td>
                  <Table.Td ta="right">{priceFormatter.format(getOrderItemLocalPrice(item, useEurToUah))}</Table.Td>
                  <Table.Td ta="right">{priceFormatter.format(getWizardProductNumber(item.TotalAmount) ?? 0)}</Table.Td>
                  <Table.Td ta="right">{priceFormatter.format(getOrderItemDiscount(item))}</Table.Td>
                  <Table.Td ta="right">{priceFormatter.format(getWizardProductNumber(item.OneTimeDiscount) ?? 0)}</Table.Td>
                  <Table.Td ta="right">{priceFormatter.format(getOrderItemLocalTotal(item, useEurToUah))}</Table.Td>
                  {onRemove && (
                    <Table.Td>
                      <Tooltip label={t('Видалити')}>
                        <ActionIcon
                          aria-label={t('Видалити')}
                          color="red"
                          disabled={busy}
                          variant="subtle"
                          onClick={(event) => {
                            event.stopPropagation()
                            onRemove(item)
                          }}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Table.Td>
                  )}
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </ScrollArea.Autosize>

      {items.length > 0 && (
        <Group gap="xl" justify="flex-end" mt="xs">
          <Text size="sm">
            {t('К-сть')}:{' '}
            <Text fw={600} span>
              {qtyFormatter.format(totalQty)}
            </Text>
          </Text>
          <Text size="sm">
            EUR:{' '}
            <Text fw={600} span>
              {priceFormatter.format(totalAmount)}
            </Text>
          </Text>
          <Text size="sm">
            {localCurrencyCode}:{' '}
            <Text fw={700} span>
              {priceFormatter.format(totalAmountLocal)}
            </Text>
          </Text>
        </Group>
      )}
    </div>
  )
}
