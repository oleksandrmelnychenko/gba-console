import { Stack, Text } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { formatContactDate } from '../utils/contactDate'

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

export function TaskSourceEvidence({ value }: { value: unknown }) {
  const { t } = useI18n()
  if (!record(value)) return null
  const observed = typeof value.observed_at === 'string' && Number.isFinite(Date.parse(value.observed_at))
    ? formatContactDate(value.observed_at) : null
  let label: string
  let documents: string[] = []
  if (value.kind === 'debt_settled' && record(value.debts)) {
    label = t('Погашено борги за документами')
    documents = Object.keys(value.debts).filter((id) => /^\d+$/.test(id)).map((id) => `${t('Борг')} #${id}`)
  } else if (value.kind === 'purchase' && record(value.orders)) {
    label = t('Виявлено нову покупку')
    documents = [...new Set(Object.values(value.orders).flatMap((order) => record(order)
      && typeof order.order_id === 'number' && Number.isSafeInteger(order.order_id) && order.order_id > 0
      ? [`${t('Замовлення')} #${order.order_id}${typeof order.purchased_at === 'string' && Number.isFinite(Date.parse(order.purchased_at)) ? ` · ${formatContactDate(order.purchased_at)}` : ''}`] : []))]
  } else if (value.kind === 'duplicate_recommendation') {
    label = t('Повторну пораду об’єднано з активною')
  } else return null
  return <Stack gap={2}>
    <Text size="sm">{label}{observed ? ` · ${t('Перевірено')}: ${observed}` : ''}</Text>
    {documents.map((document) => <Text size="xs" key={document}>{document}</Text>)}
    {value.kind === 'purchase' && <Text size="xs" c="dimmed">{t('Покупка пояснює оновлення поради; це не підтвердження оплати чи виручки від контакту.')}</Text>}
  </Stack>
}
