import { Alert, Badge, Group, Stack, Table, Text } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { CockpitClient } from '../types'

const date = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short' })
function day(value: string | null) { return value ? date.format(new Date(`${value.slice(0, 10)}T12:00:00Z`)) : '—' }
const contactDate = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Kyiv' })
function contactTime(value: string | null) { return value && !Number.isNaN(Date.parse(value)) ? contactDate.format(new Date(value)) : '—' }

export function ClientRepeatEvidence({ client, compact = false }: { client: CockpitClient; compact?: boolean }) {
  const { t } = useI18n()
  const evidence = client.repeat_evidence
  const cooldown = client.contact_cooldown
  const cooldownLabel = cooldown.reason === 'scheduled_contact'
    ? `${t('Наступний контакт заплановано')}: ${contactTime(cooldown.next_contact_at)}`
    : t('Контакт у поточному циклі вже записано. Повторну пораду призупинено.')

  if (compact) return <Stack gap={3}>
    <Text size="xs">{evidence.reason}</Text>
    {!evidence.history_complete && <Text size="xs" c="dimmed">{t('Історія неповна')}</Text>}
    {cooldown.active && <Text size="xs" c="orange">{cooldownLabel}</Text>}
  </Stack>

  return <Stack gap="xs" p="sm">
    <Text fw={600} size="sm">{t('Підстава для повторної покупки')}</Text>
    <Text size="sm">{evidence.reason}</Text>
    <Text size="xs" c="dimmed">{t('Початок доступного джерела')}: {day(evidence.history_start)} · {t(evidence.history_complete ? 'Покриття періоду розрахунку повне' : 'Історія неповна: відсутність покупки за межами доступного періоду не підтверджена.')}</Text>
    {cooldown.active && <Alert color="orange">
      {cooldownLabel} {cooldown.next_action && <Text size="sm">{cooldown.next_action}</Text>}
      {cooldown.contacted_at && <Text size="xs">{t('Останній контакт')}: {contactTime(cooldown.contacted_at)}</Text>}
    </Alert>}
    {evidence.products.length > 0 && <Table.ScrollContainer minWidth={850}>
      <Table className="app-static-table">
        <Table.Thead><Table.Tr>
          <Table.Th>{t('Товар і причина')}</Table.Th><Table.Th>{t('Останні покупки')}</Table.Th>
          <Table.Th>{t('Кількість останньої покупки')}</Table.Th><Table.Th>{t('Цикл і наступна дата')}</Table.Th><Table.Th>{t('Наявність')}</Table.Th>
        </Table.Tr></Table.Thead>
        <Table.Tbody>{evidence.products.map((product) => <Table.Tr key={product.product_id}>
          <Table.Td><Text size="sm">{product.name}</Text><Text size="xs" c="dimmed">{product.reason}</Text></Table.Td>
          <Table.Td><Text size="xs">{product.recent_purchase_dates.map(day).join(', ')}</Text>
            <Group gap={4}><Text size="xs">{t('Покупок')}: {product.purchase_count}</Text>
              {product.history_status !== 'sufficient' && <Badge size="xs" color="gray">{t(product.history_status === 'short' ? 'Коротка історія' : 'Неповна історія')}</Badge>}
            </Group></Table.Td>
          <Table.Td>{product.last_quantity}</Table.Td>
          <Table.Td><Text size="xs">{product.cycle_days == null ? t('Цикл ще не визначено') : `${product.cycle_days} ${t('дн')}`}</Text>
            <Text size="xs">{t('Очікувана дата')}: {day(product.next_expected_on)}</Text>
            {(product.overdue_days ?? 0) > 0 && <Text size="xs" c="orange">{t('Пізніше очікуваної дати')}: {product.overdue_days} {t('дн')}</Text>}
          </Table.Td>
          <Table.Td>{product.availability_status === 'unknown' ? t('Наявність не підтверджена') : product.availability_status === 'out_of_stock' ? t('Немає в наявності') : product.available_qty}</Table.Td>
        </Table.Tr>)}</Table.Tbody>
      </Table>
    </Table.ScrollContainer>}
    <Text size="xs" c="dimmed">{t('Для пропозиції або продажу нижче виберіть договір: ціна та залишок перевіряються для нього окремо.')}</Text>
  </Stack>
}
