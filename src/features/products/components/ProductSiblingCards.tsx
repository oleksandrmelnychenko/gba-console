import { Box, Group, SegmentedControl, Text } from '@mantine/core'
import { Files } from 'lucide-react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { TableChip } from '../../../shared/ui/TableChip'
import {
  findCurrentProductSiblingCard,
  formatProductCardsCount,
  formatProductSiblingCountHint,
  formatProductSiblingNotice,
  getProductSiblingCardLabel,
  getProductSiblingCardSoldQty,
  getProductSiblingCardStockQty,
  getProductSiblingCardsTotals,
  getProductSiblingSourceLabel,
  hasProductSiblingCards,
  productSiblingScopeOptions,
  type ProductSiblingScope,
} from '../productSiblings'
import type { ProductSiblingCard, ProductSiblingCardRef } from '../types'
import { formatAmount } from '../utils'
import './product-sibling-cards.css'

export function ProductSiblingCardsNotice({
  cards,
  currentProductNetId,
  onSelectCard,
}: {
  cards: ProductSiblingCard[]
  currentProductNetId?: string | null
  onSelectCard: (productNetId: string) => void
}) {
  const { t } = useI18n()
  const currentCard = findCurrentProductSiblingCard(cards, currentProductNetId)
  const currentCardNetId = currentCard?.ProductNetId || ''

  if (!hasProductSiblingCards(cards) || !currentCardNetId) {
    return null
  }

  const totals = getProductSiblingCardsTotals(cards)

  return (
    <Box className="product-sibling-cards" role="group" aria-label={t('Картки артикула')}>
      <Group className="product-sibling-cards__summary" gap={8} wrap="wrap">
        <Files className="product-sibling-cards__icon" size={16} strokeWidth={1.8} aria-hidden="true" />
        <Text className="product-sibling-cards__notice" component="span" size="sm" fw={650}>
          {formatProductSiblingNotice(cards.length - 1)}
        </Text>
        <Text className="product-sibling-cards__totals" component="span" size="xs">
          {t('Разом')}: {t('залишок')} <span className="app-money">{formatAmount(totals.stockQty)}</span>
          {' · '}
          {t('продано')} <span className="app-money">{formatAmount(totals.soldQty)}</span>
        </Text>
      </Group>
      <SegmentedControl
        aria-label={t('Перемкнути картку артикула')}
        className="product-sibling-cards__switch"
        data={cards.map((card) => ({
          label: <ProductSiblingCardOption card={card} />,
          value: card.ProductNetId || '',
        }))}
        size="xs"
        value={currentCardNetId}
        onChange={(value) => {
          if (value && value !== currentCardNetId) {
            onSelectCard(value)
          }
        }}
      />
    </Box>
  )
}

function ProductSiblingCardOption({ card }: { card: ProductSiblingCard }) {
  const { t } = useI18n()
  const label = getProductSiblingCardLabel(card)

  return (
    <span className="product-sibling-card-option" title={card.Name ? `${label} — ${card.Name}` : label}>
      <span className="product-sibling-card-option__code">{getProductSiblingSourceLabel(card)}</span>
      <span className="product-sibling-card-option__facts">
        {t('залишок')} {formatAmount(getProductSiblingCardStockQty(card))}
        {' · '}
        {t('продано')} {formatAmount(getProductSiblingCardSoldQty(card))}
      </span>
    </span>
  )
}

export function ProductSiblingCardCell({ card }: { card?: ProductSiblingCardRef | null }) {
  const { t } = useI18n()

  if (!card) {
    return <span>-</span>
  }

  const label = getProductSiblingCardLabel(card)

  return (
    <span className="product-sibling-card-cell" data-current={card.IsCurrent ? 'true' : undefined}>
      <TableChip
        tone={card.IsCurrent ? 'product' : 'neutral'}
        title={card.Name ? `${label} — ${card.Name}` : label}
        value={label}
      />
      {card.IsCurrent ? (
        <span className="product-sibling-card-cell__current">{t('ця картка')}</span>
      ) : null}
    </span>
  )
}

export function ProductSiblingCountMarker({ siblingCount }: { siblingCount?: number }) {
  if (typeof siblingCount !== 'number' || !(siblingCount > 0)) {
    return null
  }

  const hint = formatProductSiblingCountHint(siblingCount)

  return (
    <span className="product-carousel-sibling-marker" data-sibling-count={siblingCount}>
      <TableChip tone="source" title={hint} value={formatProductCardsCount(siblingCount + 1)} />
    </span>
  )
}

export function ProductSiblingScopeControl({
  disabled,
  id,
  value,
  onChange,
}: {
  disabled?: boolean
  id: string
  value: ProductSiblingScope
  onChange: (value: ProductSiblingScope) => void
}) {
  const { t } = useI18n()
  const labelId = `${id}-label`

  return (
    <div className="app-filter-field product-sibling-scope">
      <span className="app-filter-label" id={labelId}>{t('Картки')}</span>
      <SegmentedControl
        aria-labelledby={labelId}
        data={productSiblingScopeOptions.map((option) => ({ ...option, label: t(option.label) }))}
        disabled={disabled}
        value={value}
        onChange={(nextValue) => onChange(nextValue === 'all' ? 'all' : 'card')}
      />
    </div>
  )
}
