import { Alert, Text } from '@mantine/core'
import { useI18n } from '../../i18n/useI18n'
import { physicalQuantityValue, type PhysicalQuantityException, type PhysicalQuantityState } from './physicalQuantityExceptions'
const quantity = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 8 })
const date = new Intl.DateTimeFormat('uk-UA', { timeZone: 'Europe/Kyiv', day: '2-digit', month: '2-digit', year: 'numeric' })
export function PhysicalQuantityExceptionNotice({ exceptions = [] }: { exceptions?: readonly PhysicalQuantityException[] }) {
  const { t } = useI18n()
  if (!exceptions.length) return null
  return <Alert color="yellow" title={t('Партію не підтверджено')}>
    <Text size="sm">{t('Пов’язану кількість і залежні підсумки позначено «—». Вони не дорівнюють нулю.')}</Text>
    {exceptions.map(item => <Text size="sm" key={JSON.stringify(item)}>
      {item.DocumentNumber || t('Документ')} · {date.format(new Date(item.OccurredAtUtc))} · {t(item.Direction === 'Incoming' ? 'Прихід' : 'Розхід')}: {quantity.format(item.UnclassifiedQuantity)} — {t('партію не підтверджено')}
    </Text>)}
  </Alert>
}
export function PhysicalQuantityRowNote({ row }: { row: PhysicalQuantityState }) {
  const { t } = useI18n()
  if (row.QuantityKnown !== false && row.QuantityStatus !== 'unconfirmed_batch') return null
  return <Text component="span" display="block" size="xs" c="dimmed">{t('Партію не підтверджено')}{typeof row.UnclassifiedQuantity === 'number' && Number.isFinite(row.UnclassifiedQuantity) ? ` — ${quantity.format(row.UnclassifiedQuantity)}` : ''}</Text>
}

export function PhysicalQuantityCell({ row, value }: { row: PhysicalQuantityState; value: number | null | undefined }) {
  const admitted = physicalQuantityValue(row, value)
  return <span className="app-money">{typeof admitted === 'number' && Number.isFinite(admitted) ? quantity.format(admitted) : '—'}<PhysicalQuantityRowNote row={row} /></span>
}
