import { Box, Group, Loader, ScrollArea, Stack, Text } from '@mantine/core'
import { ArrowDown, ArrowUp, ChartNoAxesColumnIncreasing, CircleAlert } from 'lucide-react'
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
          <Loader size="xs" color="orange" />
          <Text size="sm" c="dimmed">
            {t('Завантаження')}
          </Text>
        </Group>
      )}

      {!isLoading && error && (
        <Stack align="center" gap={5} className="exchange-rates-history-state">
          <Box className="exchange-rates-history-state-icon is-error">
            <CircleAlert size={18} strokeWidth={1.8} />
          </Box>
          <Text size="sm" c="red">{t('Історія недоступна')}</Text>
        </Stack>
      )}

      {!isLoading && !error && !selectedRate && (
        <EmptyHistoryState title={t('Оберіть валюту')} />
      )}

      {!isLoading && !error && selectedRate && items.length === 0 && (
        <EmptyHistoryState title={t('Немає історії')} />
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

function EmptyHistoryState({ title }: { title: string }) {
  return (
    <Stack align="center" gap={5} className="exchange-rates-history-state">
      <Box className="exchange-rates-history-state-icon">
        <ChartNoAxesColumnIncreasing size={18} strokeWidth={1.8} />
      </Box>
      <Text size="sm" c="dimmed">{title}</Text>
    </Stack>
  )
}

function HistoryRow({ previous, rate }: { previous?: ExchangeRate; rate: ExchangeRate }) {
  const isIncrease = !previous || previous.Amount < rate.Amount
  const Icon = isIncrease ? ArrowUp : ArrowDown
  const [date, time] = formatHistoryDate(rate.Created).split(',').map((part) => part.trim())

  return (
    <Group gap="sm" wrap="nowrap" className="exchange-rates-history-row">
      <Box className="exchange-rates-history-date">
        <Text component="span" className="exchange-rates-history-date-day">{date}</Text>
        {time && <Text component="span" className="exchange-rates-history-date-time">{time}</Text>}
      </Box>
      <Box className={`exchange-rates-history-trend ${isIncrease ? 'is-up' : 'is-down'}`}>
        <Icon size={11} strokeWidth={2} aria-hidden />
        <Text component="span" className="exchange-rates-history-amount-value">{formatRate(rate.Amount)}</Text>
        {rate.Code && <Text component="span" className="exchange-rates-history-amount-code">{rate.Code}</Text>}
      </Box>
    </Group>
  )
}
