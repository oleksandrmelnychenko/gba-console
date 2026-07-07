import { Box, Group, Stack, Text, ThemeIcon } from '@mantine/core'
import { Tag } from 'lucide-react'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { SaleOrderItem } from '../salesTypes'

const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

const weightFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 3,
  minimumFractionDigits: 3,
})

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

type IncompleteSaleItemsListProps = {
  emptyText: string
  items: SaleOrderItem[]
}

export function IncompleteSaleItemsList({ emptyText, items }: IncompleteSaleItemsListProps) {
  const { t } = useI18n()

  if (items.length === 0) {
    return (
      <Text ta="center" c="dimmed" py="xl">
        {t(emptyText)}
      </Text>
    )
  }

  return (
    <Stack gap="sm">
      {items.map((item, index) => (
        <IncompleteSaleItemRow key={item.Product?.NetUid || item.NetUid || String(item.Id || index)} item={item} />
      ))}
    </Stack>
  )
}

function IncompleteSaleItemRow({ item }: { item: SaleOrderItem }) {
  const { t } = useI18n()
  const product = item.Product

  return (
    <Group align="flex-start" gap="sm" wrap="nowrap">
      <ThemeIcon color="gray" radius="sm" variant="light">
        <Tag size={16} />
      </ThemeIcon>
      <Box flex={1} miw={0}>
        <Text fw={600} lineClamp={2} size="sm">
          {displayValue(product?.Name)}
        </Text>
        <Group gap="xs">
          <Text c="dimmed" size="xs">
            {displayValue(product?.VendorCode)}
          </Text>
          <Text c="dimmed" size="xs">
            {displayValue(product?.MainOriginalNumber)}
          </Text>
        </Group>
        <Group gap={4} mt={2}>
          <Text c="dimmed" size="xs">
            {t('Від')} {formatDateTime(item.Created)}
          </Text>
        </Group>
      </Box>
      <Stack align="flex-end" gap={2}>
        <Text fw={700} size="sm">
          {formatAmount(item.TotalAmount)} EUR
        </Text>
        <Text c="dimmed" size="xs">
          {formatAmount(item.TotalAmountLocal)} UAH
        </Text>
        <Text c="dimmed" size="xs">
          {item.Qty ?? 0} {t('штук')}
        </Text>
        <Text c="dimmed" size="xs">
          {formatWeight(item.TotalWeight)} {t('Вага')}
        </Text>
      </Stack>
    </Group>
  )
}

function formatAmount(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return amountFormatter.format(0)
  }

  return amountFormatter.format(value)
}

function formatWeight(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return weightFormatter.format(0)
  }

  return weightFormatter.format(value)
}

function formatDateTime(value?: Date | string): string {
  if (!value) {
    return ''
  }

  const date = value instanceof Date ? value : new Date(value)

  return Number.isNaN(date.getTime()) ? '' : dateTimeFormatter.format(date)
}

function displayValue(value?: number | string | null): string {
  if (typeof value === 'number') {
    return String(value)
  }

  const normalized = value?.trim()

  return normalized || '-'
}
