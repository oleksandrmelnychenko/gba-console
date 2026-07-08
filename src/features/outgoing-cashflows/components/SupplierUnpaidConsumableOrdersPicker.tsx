import { Badge, Checkbox, Group, SimpleGrid, Stack, Text } from '@mantine/core'
import type { ReactNode } from 'react'
import type { ConsumablesOrder } from '../../consumable-orders/types'
import { useI18n } from '../../../shared/i18n/useI18n'
import { moneyFormatter } from './outgoingModeShared'
import {
  getConsumableOrderPaymentLabel,
  getConsumableOrderSelectionValue,
} from './supplierUnpaidConsumableOrders'

type SupplierUnpaidConsumableOrdersPickerProps = {
  disabled?: boolean
  isLoading?: boolean
  orders: ConsumablesOrder[]
  selectedAmount: number
  selectedCount: number
  selectedValues: string[]
  onChange: (values: string[]) => void
}

export function SupplierUnpaidConsumableOrdersPicker({
  disabled = false,
  isLoading = false,
  orders,
  selectedAmount,
  selectedCount,
  selectedValues,
  onChange,
}: SupplierUnpaidConsumableOrdersPickerProps) {
  const { t } = useI18n()
  const checkboxes = buildOrderCheckboxes(orders, disabled)

  return (
    <Stack gap="xs">
      <Group justify="space-between" wrap="wrap">
        <Text fw={600}>{t('Неоплачені накладні постачальника')}</Text>
        <Badge color={selectedCount ? 'blue' : 'gray'} variant="light">
          {selectedCount}/{orders.length}
          {selectedAmount > 0 ? ` · ${moneyFormatter.format(selectedAmount)}` : ''}
        </Badge>
      </Group>
      {isLoading ? (
        <Text c="dimmed" size="sm">{t('Завантаження')}</Text>
      ) : checkboxes.length ? (
        <Checkbox.Group value={selectedValues} onChange={onChange}>
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            {checkboxes}
          </SimpleGrid>
        </Checkbox.Group>
      ) : (
        <Text c="dimmed" size="sm">{t('Неоплачених накладних не знайдено')}</Text>
      )}
    </Stack>
  )
}

function buildOrderCheckboxes(orders: ConsumablesOrder[], disabled: boolean): ReactNode[] {
  const checkboxes: ReactNode[] = []

  for (const order of orders) {
    const value = getConsumableOrderSelectionValue(order)

    if (!value) {
      continue
    }

    checkboxes.push(
      <Checkbox
        key={value}
        disabled={disabled}
        label={getConsumableOrderPaymentLabel(order)}
        value={value}
      />,
    )
  }

  return checkboxes
}
