import { Badge, Group, Loader, ScrollArea, Stack, Text } from '@mantine/core'
import { IconArrowDown, IconArrowUp } from '@tabler/icons-react'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { ExchangeRate } from '../types'
import { formatHistoryDate, formatRate } from '../utils'

type CurrencyRatesHistoryProps = {
  error: Error | null
  isLoading: boolean
  items: ExchangeRate[]
  selectedRate: ExchangeRate | null
}

export function CurrencyRatesHistory({ error, isLoading, items, selectedRate }: CurrencyRatesHistoryProps) {
  const { t } = useI18n()

  return (
    <ScrollArea className="exchange-rates-history-scroll" type="auto">
      {isLoading && (
        <Group gap="xs" justify="center" className="exchange-rates-history-state">
          <Loader size="xs" color="violet" />
          <Text size="sm" c="dimmed">
            {t('Завантаження')}
          </Text>
        </Group>
      )}

      {!isLoading && error && (
        <Text size="sm" c="red" className="exchange-rates-history-state">
          {t('Історія недоступна')}
        </Text>
      )}

      {!isLoading && !error && !selectedRate && (
        <Text size="sm" c="dimmed" className="exchange-rates-history-state">
          {t('Оберіть валюту')}
        </Text>
      )}

      {!isLoading && !error && selectedRate && items.length === 0 && (
        <Text size="sm" c="dimmed" className="exchange-rates-history-state">
          {t('Немає історії')}
        </Text>
      )}

      {!isLoading && !error && items.length > 0 && (
        <Stack gap={5} className="exchange-rates-history-list">
          {items.map((rate, index) => (
            <HistoryRow key={rate.NetUid || `${rate.Code}-${rate.Created || index}`} rate={rate} previous={items[index - 1]} />
          ))}
        </Stack>
      )}
    </ScrollArea>
  )
}

function HistoryRow({ previous, rate }: { previous?: ExchangeRate; rate: ExchangeRate }) {
  const isIncrease = !previous || previous.Amount < rate.Amount
  const Icon = isIncrease ? IconArrowUp : IconArrowDown

  return (
    <Group gap="sm" wrap="nowrap" className="exchange-rates-history-row">
      <Text size="sm" className="exchange-rates-history-date">
        {formatHistoryDate(rate.Created)}
      </Text>
      <Badge color={isIncrease ? 'green' : 'red'} variant="light" radius="sm" className="exchange-rates-history-direction">
        <Icon size={13} stroke={2} />
      </Badge>
      <Text size="sm" className="exchange-rates-history-amount">
        {formatRate(rate.Amount)} <span>{rate.Code}</span>
      </Text>
    </Group>
  )
}
