import { ActionIcon, Box, Stack, Text, Tooltip } from '@mantine/core'
import { Info, Package, Star } from 'lucide-react'
import type { ReactNode } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { getProductMainImage, getProductShopImageUrl } from '../../../products/utils'
import type { WizardSaleProduct } from './wizardSaleProduct'

export function WizardRelatedProductRows({
  products,
  active,
  focusedIndex,
  getItemColor,
  renderExtra,
  onOpenCard,
  onPick,
  onProductInterest,
}: {
  active: boolean
  focusedIndex: number
  getItemColor?: (product: WizardSaleProduct) => string | undefined
  onOpenCard?: (productNetId: string) => void
  onPick: (index: number) => void
  onProductInterest?: (product: WizardSaleProduct) => void
  products: WizardSaleProduct[]
  renderExtra?: (product: WizardSaleProduct) => ReactNode
}) {
  return (
    <Stack className="new-sale-related-list" gap={0}>
      {products.map((product, index) => (
        <WizardRelatedProductRow
          key={String(product.NetUid || product.VendorCode || product.Articul || index)}
          active={active}
          color={getItemColor?.(product)}
          focused={index === focusedIndex}
          product={product}
          renderExtra={renderExtra}
          onOpenCard={onOpenCard}
          onPick={() => onPick(index)}
          onProductInterest={onProductInterest}
        />
      ))}
    </Stack>
  )
}

function WizardRelatedProductRow({
  active,
  color,
  focused,
  product,
  renderExtra,
  onOpenCard,
  onPick,
  onProductInterest,
}: {
  active: boolean
  color?: string
  focused: boolean
  onOpenCard?: (productNetId: string) => void
  onPick: () => void
  onProductInterest?: (product: WizardSaleProduct) => void
  product: WizardSaleProduct
  renderExtra?: (product: WizardSaleProduct) => ReactNode
}) {
  const { t } = useI18n()
  const code = product.VendorCode || product.Articul || '-'
  const name = product.NameUA || product.Name || ''
  const extra = renderExtra?.(product)
  // Mini photo (shop image fallback for sparse payloads) — rounded mask per request.
  const imageUrl = getProductMainImage(product)?.ImageUrl || getProductShopImageUrl(product)

  return (
    <Box
      className="new-sale-related-row"
      data-active={active ? 'true' : undefined}
      data-focused={focused ? 'true' : undefined}
      onClick={onPick}
    >
      <Box className="new-sale-related-row__content">
        <Box className="new-sale-related-row__thumb" aria-hidden="true">
          {imageUrl ? <img alt="" loading="lazy" src={imageUrl} /> : <Package size={16} strokeWidth={1.6} />}
        </Box>
        <Box className="new-sale-related-row__copy">
          <Box className="new-sale-related-row__headline">
            <Text c={color} className="new-sale-related-row__code" truncate>
              {code}
            </Text>
            <RelatedInlineFacts product={product} />
          </Box>
          <Text className="new-sale-related-row__name" title={name}>
            {name}
          </Text>
        </Box>
      </Box>
      <Box className="new-sale-related-row__side">
        {extra && <Box className="new-sale-related-row__extra">{extra}</Box>}
        <Box className="new-sale-related-row__actions">
          {product.NetUid && onProductInterest && (
            <Tooltip label={t('Цікавить товар')}>
              <ActionIcon
                aria-label={t('Цікавить товар')}
                className="new-sale-related-row__action"
                color="orange"
                size="sm"
                variant="subtle"
                onClick={(event) => {
                  event.stopPropagation()
                  onProductInterest(product)
                }}
              >
                <Star size={15} />
              </ActionIcon>
            </Tooltip>
          )}
          {product.NetUid && onOpenCard && (
            <Tooltip label={t('Картка товару')}>
              <ActionIcon
                aria-label={t('Картка товару')}
                className="new-sale-related-row__action"
                color="gray"
                size="sm"
                variant="subtle"
                onClick={(event) => {
                  event.stopPropagation()
                  onOpenCard(product.NetUid as string)
                }}
              >
                <Info size={15} />
              </ActionIcon>
            </Tooltip>
          )}
        </Box>
      </Box>
    </Box>
  )
}

function RelatedInlineFacts({ product }: { product: WizardSaleProduct }) {
  const facts = [
    product.MainOriginalNumber,
    product.Top,
    product.Size,
    product.MeasureUnit?.Name,
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)

  if (facts.length === 0) {
    return null
  }

  return (
    <Box className="new-sale-related-row__facts">
      {facts.map((fact) => (
        <span key={fact}>{fact}</span>
      ))}
    </Box>
  )
}
