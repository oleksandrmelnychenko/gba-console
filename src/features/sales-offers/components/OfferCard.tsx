import { ActionIcon, Anchor, Badge, Box, Card, Collapse, Group, Stack, Text, Tooltip } from '@mantine/core'
import { ChevronDown, ChevronRight, Link, MessageSquare, RotateCcw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { ProductCardModal } from '../../products/components/ProductCardModal'
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

const STATUS_CLASS: Record<number, string> = {
  [OFFER_PROCESSING_STATUS.FullyProcessed]: 'is-green',
  [OFFER_PROCESSING_STATUS.NotProcessed]: 'is-red',
  [OFFER_PROCESSING_STATUS.PartiallyProcessed]: 'is-yellow',
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
  const [productCardNetId, setProductCardNetId] = useState<string | null>(null)
  const status = offer.OfferProcessingStatus ?? OFFER_PROCESSING_STATUS.NotProcessed
  const notProcessedCount = getNotProcessedCount(offer)
  const currencyCode = 'EUR'
  const daysToEnd = getDaysToEnd(offer.ValidUntil)
  const reasonStatus = getReasonStatus(offer)
  const showNotProcessed = offer.IsOfferProcessed === true && notProcessedCount !== 0
  const canOpenReason = status === OFFER_PROCESSING_STATUS.FullyProcessed && notProcessedCount !== 0

  return (
    <Card className="offer-card" padding="sm" radius="md" withBorder>
      <Group align="flex-start" gap="sm" justify="space-between" wrap="nowrap">
        <Group align="flex-start" gap="sm" wrap="nowrap">
          <ActionIcon className="offer-card-toggle" aria-label={t('Розгорнути')} variant="subtle" onClick={() => onToggle(offer)}>
            {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </ActionIcon>
          <Tooltip label={statusLabel(status, t)}>
            <Box className={`offer-card-status-dot ${STATUS_CLASS[status] ?? 'is-gray'}`} />
          </Tooltip>
          <Stack gap={2}>
            <Text className="offer-card-client">{offer.ClientAgreement?.Client?.FullName ?? ''}</Text>
            <Text className="offer-card-meta">
              {offer.Number ?? ''} {t('Від')} {formatDateTime(offer.Created)}
            </Text>
            <Text className="offer-card-secondary">
              {offer.CreatedBy?.LastName ?? ''}
              {offer.ClientAgreement?.Agreement?.Name
                ? ` : ${t('На договір')} ${offer.ClientAgreement.Agreement.Name}`
                : ''}
            </Text>
          </Stack>
        </Group>

        <Group align="center" gap="xs" wrap="nowrap">
          {status === OFFER_PROCESSING_STATUS.NotProcessed && (
            <Badge className="app-role-pill is-red" variant="light">
              {t('Не опрацьовано клієнтом')}
            </Badge>
          )}
          {showNotProcessed && (
            <Badge className="app-role-pill is-orange" variant="light">
              {t('Неопрацьовано')}: {notProcessedCount}
            </Badge>
          )}

          {status === OFFER_PROCESSING_STATUS.PartiallyProcessed && (
            <Badge className="app-role-pill is-yellow" variant="light">
              {daysToEnd} {dayUnitLabel(daysToEnd, t)} ({formatDate(offer.ValidUntil)})
            </Badge>
          )}

          {showNotProcessed && <ReasonBadge status={reasonStatus} />}

          {canOpenReason && (
            <Tooltip label={t('Причини')}>
              <ActionIcon color="blue" variant="subtle" onClick={() => onOpenReason(offer)}>
                <MessageSquare size={18} />
              </ActionIcon>
            </Tooltip>
          )}

          {status === OFFER_PROCESSING_STATUS.PartiallyProcessed && (
            <Tooltip label={t('Копіювати посилання')}>
              <ActionIcon color="orange" variant="subtle" onClick={() => onCopyLink(offer)}>
                <Link size={18} />
              </ActionIcon>
            </Tooltip>
          )}

          {status === OFFER_PROCESSING_STATUS.NotProcessed && (
            <Tooltip label={t('Перезапустити')}>
              <ActionIcon color="teal" variant="subtle" onClick={() => onRestart(offer)}>
                <RotateCcw size={18} />
              </ActionIcon>
            </Tooltip>
          )}

          {status === OFFER_PROCESSING_STATUS.PartiallyProcessed && (
            <Tooltip label={t('Видалити')}>
              <ActionIcon color="red" variant="subtle" onClick={() => onDelete(offer)}>
                <Trash2 size={18} />
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
              onOpenProductCard={setProductCardNetId}
              onOpenReason={() => onOpenItemReason(offer, item)}
            />
          ))}
        </Stack>
      </Collapse>
      <ProductCardModal productNetId={productCardNetId} onClose={() => setProductCardNetId(null)} />
    </Card>
  )
}

function OfferLine({
  currencyCode,
  isOfferProcessed,
  item,
  onOpenProductCard,
  onOpenReason,
}: {
  currencyCode: string
  isOfferProcessed: boolean
  item: OfferOrderItem
  onOpenProductCard: (productNetId: string) => void
  onOpenReason: () => void
}) {
  const { t } = useI18n()
  const notProcessed = getItemNotProcessed(item)
  const canOpenReason = isOfferProcessed && notProcessed > 0

  return (
    <Box className="offer-line">
      <Stack gap={2}>
        {item.Product?.NetUid ? (
          <Anchor
            className="offer-line-product-link"
            component="button"
            type="button"
            underline="always"
            onClick={(event) => {
              event.stopPropagation()
              onOpenProductCard(item.Product?.NetUid as string)
            }}
          >
            {[item.Product?.VendorCode, item.Product?.MainOriginalNumber, item.Product?.Name]
              .filter(Boolean)
              .join(' ')}
          </Anchor>
        ) : (
          <Text className="offer-line-product-name">
            {[item.Product?.VendorCode, item.Product?.MainOriginalNumber, item.Product?.Name]
              .filter(Boolean)
              .join(' ')}
          </Text>
        )}
        <Text c="dimmed" size="xs">
          {t('Від')} {formatDateTime(item.Created)} {item.User?.LastName ?? ''}
        </Text>
      </Stack>

      <Stack gap={2}>
        <Text className="offer-line-money">
          <span className="app-money">{formatMoney(item.TotalAmount)}</span>
          <span className="app-money-meta">{currencyCode}</span>
        </Text>
        <Text className="offer-line-qty">
          {t('Кількість')}: {item.Qty ?? 0}
        </Text>
      </Stack>

      <Box>
        {canOpenReason && (
          <Badge className="app-role-pill is-orange offer-line-reason-pill" variant="light" onClick={onOpenReason}>
            {t('Неопрацьовано')}: {notProcessed}
          </Badge>
        )}
      </Box>

      <Text className="offer-line-comment">
        {item.Comment ?? ''}
      </Text>
    </Box>
  )
}

function ReasonBadge({ status }: { status: 'all' | 'none' | 'partial' }) {
  const { t } = useI18n()

  if (status === 'all') {
    return (
      <Badge className="app-role-pill is-green" variant="light">
        {t('Причину вказано')}
      </Badge>
    )
  }

  if (status === 'partial') {
    return (
      <Badge className="app-role-pill is-red" variant="light">
        {t('Причину вказано частково')}
      </Badge>
    )
  }

  return (
    <Badge className="app-role-pill is-red" variant="light">
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
