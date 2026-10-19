import { Alert, Group, Loader, Text } from '@mantine/core'
import { ArrowDown, ArrowUp, CircleAlert, Minus } from 'lucide-react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { TableChip } from '../../../shared/ui/TableChip'
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
    <div className="exchange-rates-history-scroll">
      {isLoading ? (
        <Group gap="xs" justify="center" className="exchange-rates-history-state" role="status">
          <Loader size="xs" />
          <Text size="sm" c="dimmed">{t('Завантаження')}</Text>
        </Group>
      ) : error ? (
        <Alert color="red" icon={<CircleAlert size={18} />} m="sm">{t('Історія недоступна')}</Alert>
      ) : !selectedRate || items.length === 0 ? (
        <div className="exchange-rates-history-state">
          <Text size="sm" c="dimmed">{t(selectedRate ? 'Немає історії' : 'Оберіть валюту')}</Text>
        </div>
      ) : (
        <table className="app-static-table" aria-label={t('Історія курсів валют')}>
          <thead>
            <tr>
              <th scope="col">{t('Дата')}</th>
              <th scope="col" className="app-table-cell-number">{t('Курс')}</th>
              <th scope="col" className="app-table-cell-number">{t('Зміна')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((rate, index) => (
              <HistoryRow key={`${rate.NetUid || rate.Code}-${rate.Created || index}-${index}`} rate={rate} previous={items[index - 1]} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function HistoryRow({ previous, rate }: { previous?: ExchangeRate; rate: ExchangeRate }) {
  const difference = previous ? rate.Amount - previous.Amount : 0
  const direction = difference > 0 ? 'up' : difference < 0 ? 'down' : 'flat'
  const Icon = direction === 'up' ? ArrowUp : direction === 'down' ? ArrowDown : Minus
  const [date, time] = formatHistoryDate(rate.Created).split(',').map((part) => part.trim())

  return (
    <tr>
      <td>
        <span className="exchange-rates-history-date app-money">{date || '—'}</span>
        {time && time !== '00:00' && <small className="exchange-rates-history-time">{time}</small>}
      </td>
      <td className="app-table-cell-number">{formatRate(rate.Amount)}</td>
      <td className="app-table-cell-number">
        <span className={`exchange-rates-history-change is-${direction}`}>
          {previous && <Icon size={13} aria-hidden="true" />}
          <TableChip tone={direction === 'up' ? 'success' : direction === 'down' ? 'danger' : 'neutral'} value={previous ? `${difference > 0 ? '+' : ''}${formatRate(difference)}` : '—'} />
        </span>
      </td>
    </tr>
  )
}
