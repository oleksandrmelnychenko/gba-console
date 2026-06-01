import { ActionIcon, Badge, Box, Card, Collapse, Group, Stack, Text, Tooltip } from '@mantine/core'
import { IconChevronDown, IconChevronRight, IconLink, IconMessage, IconRestore, IconTrash } from '@tabler/icons-react'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { ClientShoppingCart, OfferOrderItem } from '../types'
import { OFFER_PROCESSING_STATUS } from '../types'
import {
  formatDate,
  formatDateTime,
  formatMoney,
  getDaysToEnd,
  getItemNotProcessed,
  getNotProcessedCount,
  getReasonStatus,
} from './offerHelpers'

const STATUS_COLOR: Record<number, string> = {
  [OFFER_PROCESSING_STATUS.FullyProcessed]: 'green',
  [OFFER_PROCESSING_STATUS.NotProcessed]: 'red',
  [OFFER_PROCESSING_STATUS.PartiallyProcessed]: 'yellow',
}

export function OfferCard({
  expanded,
  offer,
  onCopyLink,
  onDelete,
  onOpenItemReason,
  onOpenReason,
  onRestart,
  onToggle,
}: {
  expanded: boolean
  offer: ClientShoppingCart
  onCopyLink: (offer: ClientShoppingCart) => void
  onDelete: (offer: ClientShoppingCart) => void
  onOpenItemReason: (offer: ClientShoppingCart, item: OfferOrderItem) => void
  onOpenReason: (offer: ClientShoppingCart) => void
  onRestart: (offer: ClientShoppingCart) => void
  onToggle: (offer: ClientShoppingCart) => void
}) {
  const { t } = useI18n()
  const status = offer.OfferProcessingStatus ?? OFFER_PROCESSING_STATUS.NotProcessed
  const notProcessedCount = getNotProcessedCount(offer)
  const currencyCode = offer.ClientAgreement?.Agreement?.Currency?.Code ?? 'EUR'
  const daysToEnd = getDaysToEnd(offer.ValidUntil)
  const reasonStatus = getReasonStatus(offer)
  const showNotProcessed = offer.IsOfferProcessed === true && notProcessedCount !== 0
  const canOpenReason = status === OFFER_PROCESSING_STATUS.FullyProcessed && notProcessedCount !== 0

  return (
    <Card padding="sm" radius="md" withBorder>
      <Group align="flex-start" gap="sm" justify="space-between" wrap="nowrap">
        <Group align="flex-start" gap="sm" wrap="nowrap">
          <ActionIcon aria-label={t('Розгорнути')} variant="subtle" onClick={() => onToggle(offer)}>
            {expanded ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}
          </ActionIcon>
          <Tooltip label={statusLabel(status, t)}>
            <Box
              style={{
                backgroundColor: `var(--mantine-color-${STATUS_COLOR[status] ?? 'gray'}-6)`,
                borderRadius: '50%',
                flexShrink: 0,
                height: 12,
                marginTop: 6,
                width: 12,
              }}
            />
          </Tooltip>
          <Stack gap={2}>
            <Text fw={600}>{offer.ClientAgreement?.Client?.FullName ?? ''}</Text>
            <Text c="dimmed" size="sm">
              {offer.Number ?? ''} {t('Від')} {formatDateTime(offer.Created)}
            </Text>
            <Text c="dimmed" size="sm">
              {offer.CreatedBy?.LastName ?? ''}
              {offer.ClientAgreement?.Agreement?.Name
                ? ` : ${t('На договір')} ${offer.ClientAgreement.Agreement.Name}`
                : ''}
            </Text>
          </Stack>
        </Group>

        <Group align="center" gap="xs" wrap="nowrap">
          {showNotProcessed && (
            <Badge color="orange" variant="light">
              {t('Неопрацьовано')}: {notProcessedCount}
            </Badge>
          )}

          {status === OFFER_PROCESSING_STATUS.PartiallyProcessed && (
            <Badge color="yellow" variant="light">
              {daysToEnd} {dayUnitLabel(daysToEnd, t)} ({formatDate(offer.ValidUntil)})
            </Badge>
          )}

          {showNotProcessed && <ReasonBadge status={reasonStatus} />}

          {canOpenReason && (
            <Tooltip label={t('Причини')}>
              <ActionIcon color="blue" variant="subtle" onClick={() => onOpenReason(offer)}>
                <IconMessage size={18} />
              </ActionIcon>
            </Tooltip>
          )}

          {status === OFFER_PROCESSING_STATUS.PartiallyProcessed && (
            <Tooltip label={t('Копіювати посилання')}>
              <ActionIcon color="grape" variant="subtle" onClick={() => onCopyLink(offer)}>
                <IconLink size={18} />
              </ActionIcon>
            </Tooltip>
          )}

          {status === OFFER_PROCESSING_STATUS.NotProcessed && (
            <Tooltip label={t('Перезапустити')}>
              <ActionIcon color="teal" variant="subtle" onClick={() => onRestart(offer)}>
                <IconRestore size={18} />
              </ActionIcon>
            </Tooltip>
          )}

          {status === OFFER_PROCESSING_STATUS.PartiallyProcessed && (
            <Tooltip label={t('Видалити')}>
              <ActionIcon color="red" variant="subtle" onClick={() => onDelete(offer)}>
                <IconTrash size={18} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Group>

      <Collapse expanded={expanded}>
        <Stack gap="xs" mt="sm">
          {(offer.OrderItems ?? []).map((item) => (
            <OfferLine
              key={item.NetUid}
              currencyCode={currencyCode}
              isOfferProcessed={offer.IsOfferProcessed === true}
              item={item}
              onOpenReason={() => onOpenItemReason(offer, item)}
            />
          ))}
        </Stack>
      </Collapse>
    </Card>
  )
}

function OfferLine({
  currencyCode,
  isOfferProcessed,
  item,
  onOpenReason,
}: {
  currencyCode: string
  isOfferProcessed: boolean
  item: OfferOrderItem
  onOpenReason: () => void
}) {
  const { t } = useI18n()
  const notProcessed = getItemNotProcessed(item)
  const canOpenReason = isOfferProcessed && notProcessed > 0

  return (
    <Box
      style={{
        borderTop: '1px solid var(--mantine-color-gray-3)',
        display: 'grid',
        gap: 8,
        gridTemplateColumns: '2fr 1fr 1fr 2fr',
        paddingTop: 8,
      }}
    >
      <Stack gap={2}>
        <Text fw={500} size="sm">
          {[item.Product?.VendorCode, item.Product?.MainOriginalNumber, item.Product?.Name].filter(Boolean).join(' ')}
        </Text>
        <Text c="dimmed" size="xs">
          {t('Від')} {formatDateTime(item.Created)} {item.User?.LastName ?? ''}
        </Text>
      </Stack>

      <Stack gap={2}>
        <Text size="sm">
          {formatMoney(item.TotalAmount)} {currencyCode}
        </Text>
        <Text c="dimmed" size="xs">
          {t('Кількість')}: {item.Qty ?? 0}
        </Text>
      </Stack>

      <Box>
        {canOpenReason && (
          <Badge color="orange" style={{ cursor: 'pointer' }} variant="light" onClick={onOpenReason}>
            {t('Неопрацьовано')}: {notProcessed}
          </Badge>
        )}
      </Box>

      <Text c="dimmed" size="sm">
        {item.Comment ?? ''}
      </Text>
    </Box>
  )
}

function ReasonBadge({ status }: { status: 'all' | 'none' | 'partial' }) {
  const { t } = useI18n()

  if (status === 'all') {
    return (
      <Badge color="green" variant="light">
        {t('Причину вказано')}
      </Badge>
    )
  }

  if (status === 'partial') {
    return (
      <Badge color="red" variant="light">
        {t('Причину вказано частково')}
      </Badge>
    )
  }

  return (
    <Badge color="red" variant="light">
      {t('Причину не вказано')}
    </Badge>
  )
}

function dayUnitLabel(days: number, t: (key: string) => string): string {
  if (days === 1) {
    return t('День').toLowerCase()
  }

  if (days >= 5 || days === 0) {
    return t('Днів').toLowerCase()
  }

  return t('Дні').toLowerCase()
}

function statusLabel(status: number, t: (key: string) => string): string {
  if (status === OFFER_PROCESSING_STATUS.FullyProcessed) {
    return t('Опрацьовано')
  }

  if (status === OFFER_PROCESSING_STATUS.PartiallyProcessed) {
    return t('В опрацюванні')
  }

  return t('Не опрацьовано клієнтом')
}
