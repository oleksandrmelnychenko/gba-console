import { Anchor, Card, Collapse, Group, Stack, Table, Text } from '@mantine/core'
import { useId, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { TableChip } from '../../../shared/ui/TableChip'
import { TableRowAction } from '../../../shared/ui/table-row-action'
import { ProductCardModal } from '../../products/components/ProductCardModal'
import type { ClientShoppingCart, OfferOrderItem } from '../types'
import { OFFER_PROCESSING_STATUS } from '../types'
import { formatDate, formatDateTime, formatMoney, getDaysToEnd, getItemNotProcessed, getNotProcessedCount, getReasonStatus } from './offerHelpers'

export function OfferCard({
  canDelete,
  canEdit,
  canExtendValidity,
  expanded,
  offer,
  onCopyLink,
  onDelete,
  onOpenItemReason,
  onOpenReason,
  onRestart,
  onToggle,
}: {
  canDelete: boolean
  canEdit: boolean
  canExtendValidity: boolean
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
  const detailsId = useId()
  const [productCardNetId, setProductCardNetId] = useState<string | null>(null)
  const status = offer.OfferProcessingStatus ?? OFFER_PROCESSING_STATUS.NotProcessed
  const notProcessedCount = getNotProcessedCount(offer)
  const currencyCode = 'EUR'
  const daysToEnd = getDaysToEnd(offer.ValidUntil)
  const reasonStatus = getReasonStatus(offer)
  const showNotProcessed = offer.IsOfferProcessed === true && notProcessedCount !== 0
  const canOpenReason = status === OFFER_PROCESSING_STATUS.FullyProcessed && notProcessedCount !== 0

  return (
    <Card className="offer-card app-table-chips" padding={10} radius="md" withBorder>
      <div className="offer-card-header">
        <TableRowAction
          action={expanded ? 'collapse' : 'expand'}
          label={t(expanded ? 'Згорнути' : 'Розгорнути')}
          aria-expanded={expanded}
          aria-controls={detailsId}
          onClick={() => onToggle(offer)}
        />
        <div className="offer-card-identity">
          <Text className="offer-card-client">{offer.ClientAgreement?.Client?.FullName || '—'}</Text>
          <div className="offer-card-meta">
            <TableChip tone="document" value={offer.Number} />
            <span>{formatDateTime(offer.Created)}</span>
            {offer.CreatedBy?.LastName && <TableChip value={offer.CreatedBy.LastName} />}
            {offer.ClientAgreement?.Agreement?.Name && <TableChip value={offer.ClientAgreement.Agreement.Name} />}
          </div>
        </div>
        <div className="offer-card-state">
          <TableChip
            tone={status === OFFER_PROCESSING_STATUS.FullyProcessed ? 'success' : 'warning'}
            value={statusLabel(status, t)}
          />
          {showNotProcessed && <TableChip tone="warning" value={`${t('Неопрацьовано')}: ${notProcessedCount}`} />}
          {status === OFFER_PROCESSING_STATUS.PartiallyProcessed && (
            <TableChip tone="warning" value={`${daysToEnd} ${dayUnitLabel(daysToEnd, t)} (${formatDate(offer.ValidUntil)})`} />
          )}
          {showNotProcessed && <ReasonBadge status={reasonStatus} />}
        </div>
        <div className="offer-card-actions">
          {canEdit && canOpenReason && <TableRowAction action="status" label={t('Причини')} onClick={() => onOpenReason(offer)} />}
          {status === OFFER_PROCESSING_STATUS.PartiallyProcessed && <TableRowAction action="copy" label={t('Копіювати посилання')} onClick={() => onCopyLink(offer)} />}
          {canExtendValidity && status === OFFER_PROCESSING_STATUS.NotProcessed && <TableRowAction action="restore" label={t('Перезапустити')} onClick={() => onRestart(offer)} />}
          {canDelete && status === OFFER_PROCESSING_STATUS.PartiallyProcessed && <TableRowAction action="delete" label={t('Видалити')} onClick={() => onDelete(offer)} />}
        </div>
      </div>
      <Collapse expanded={expanded} id={detailsId}>
        <div className="offer-card-lines">
          <Table className="app-static-table" aria-label={t('Товари оферти')} miw={720}>
            <Table.Thead><Table.Tr>
              <Table.Th>{t('Товар')}</Table.Th>
              <Table.Th className="app-table-cell-number">{t('Кількість')}</Table.Th>
              <Table.Th className="app-table-cell-number">{t('Сума')}</Table.Th>
              <Table.Th>{t('Стан')}</Table.Th>
              <Table.Th>{t('Коментар')}</Table.Th>
            </Table.Tr></Table.Thead>
            <Table.Tbody>
              {(offer.OrderItems ?? []).map((item, index) => <OfferLine
                key={item.NetUid ?? item.Id ?? index}
                currencyCode={currencyCode}
                isOfferProcessed={offer.IsOfferProcessed === true}
                item={item}
                canEdit={canEdit}
                onOpenProductCard={setProductCardNetId}
                onOpenReason={() => onOpenItemReason(offer, item)}
              />)}
              {!offer.OrderItems?.length && <Table.Tr><Table.Td colSpan={5}>{t('Немає даних')}</Table.Td></Table.Tr>}
            </Table.Tbody>
          </Table>
        </div>
      </Collapse>
      <ProductCardModal productNetId={productCardNetId} onClose={() => setProductCardNetId(null)} />
    </Card>
  )
}

function OfferLine({ canEdit, currencyCode, isOfferProcessed, item, onOpenProductCard, onOpenReason }: {
  canEdit: boolean
  currencyCode: string
  isOfferProcessed: boolean
  item: OfferOrderItem
  onOpenProductCard: (productNetId: string) => void
  onOpenReason: () => void
}) {
  const { t } = useI18n()
  const notProcessed = getItemNotProcessed(item)
  const canOpenReason = canEdit && isOfferProcessed && notProcessed > 0
  const name = item.Product?.Name || item.Product?.VendorCode || '—'

  return (
    <Table.Tr>
      <Table.Td>
        <Stack gap={2}>
          {item.Product?.NetUid ? <Anchor className="offer-line-product-link" component="button" type="button" underline="hover"
            onClick={() => onOpenProductCard(item.Product!.NetUid!)}>{name}</Anchor>
            : <Text className="offer-line-product-name">{name}</Text>}
          <Group gap={6}>
            {item.Product?.VendorCode && <TableChip tone="product" value={item.Product.VendorCode} />}
            {item.Product?.MainOriginalNumber && <TableChip tone="product" value={item.Product.MainOriginalNumber} />}
            <span className="offer-line-meta">{formatDateTime(item.Created)} {item.User?.LastName ?? ''}</span>
          </Group>
        </Stack>
      </Table.Td>
      <Table.Td className="app-table-cell-number">{item.Qty ?? 0}</Table.Td>
      <Table.Td className="app-table-cell-number">
        <span className="app-money">{formatMoney(item.TotalAmount)}</span>
        <div className="app-money-meta">{currencyCode}</div>
      </Table.Td>
      <Table.Td>
        {canOpenReason && <Group gap={4} wrap="nowrap">
          <TableChip tone="warning" value={`${t('Неопрацьовано')}: ${notProcessed}`} />
          <TableRowAction action="status" label={t('Причини')} onClick={onOpenReason} />
        </Group>}
      </Table.Td>
      <Table.Td>{item.Comment || '—'}</Table.Td>
    </Table.Tr>
  )
}

function ReasonBadge({ status }: { status: 'all' | 'none' | 'partial' }) {
  const { t } = useI18n()
  return <TableChip tone={status === 'all' ? 'success' : 'warning'} value={t(status === 'all' ? 'Причину вказано' : status === 'partial' ? 'Причину вказано частково' : 'Причину не вказано')} />
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
