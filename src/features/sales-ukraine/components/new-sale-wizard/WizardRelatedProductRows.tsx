import { TableChip, type TableChipTone } from '../../../../shared/ui/TableChip'
import { Box, Stack, Text } from '@mantine/core'
import type { ReactNode } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { TableRowAction } from '../../../../shared/ui/table-row-action'
import { getProductMainOriginalNumber, isCriticalProductTop } from '../../../products/utils'
import type { WizardSaleProduct } from './wizardSaleProduct'
import { WizardProductPhoto } from './WizardProductPhoto'

export function WizardRelatedProductRows({
  products,
  active,
  focusedIndex,
  getItemColor,
  renderExtra,
  onOpenCard,
  onOpenImage,
  onPick,
  onProductInterest,
}: {
  active: boolean
  focusedIndex: number
  getItemColor?: (product: WizardSaleProduct) => string | undefined
  onOpenCard?: (productNetId: string) => void
  onOpenImage?: (product: WizardSaleProduct) => void
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
          onOpenImage={onOpenImage}
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
  onOpenImage,
  onPick,
  onProductInterest,
}: {
  active: boolean
  color?: string
  focused: boolean
  onOpenCard?: (productNetId: string) => void
  onOpenImage?: (product: WizardSaleProduct) => void
  onPick: () => void
  onProductInterest?: (product: WizardSaleProduct) => void
  product: WizardSaleProduct
  renderExtra?: (product: WizardSaleProduct) => ReactNode
}) {
  const { t } = useI18n()
  const code = product.VendorCode || product.Articul || '-'
  const name = product.NameUA || product.Name || ''
  const extra = renderExtra?.(product)

  return (
    <Box
      className="new-sale-related-row app-table-chips"
      data-active={active ? 'true' : undefined}
      data-focused={focused ? 'true' : undefined}
      onClick={onPick}
    >
      <Box className="new-sale-related-row__content">
        <WizardProductPhoto
          className="new-sale-related-row__thumb"
          product={product}
          onOpen={onOpenImage ? () => onOpenImage(product) : undefined}
        />
        <Box className="new-sale-related-row__copy">
          <Box className="new-sale-related-row__headline">
            <Box className="new-sale-related-row__identity-line">
              <Text c={color} className="new-sale-related-row__code" truncate>
                <TableChip tone="product" value={code} />
              </Text>
              {product.Top?.trim() && !['-', '—'].includes(product.Top.trim()) && (
                <span className="new-sale-related-row__top">Top <TableChip tone={isCriticalProductTop(product.Top) ? 'danger' : 'neutral'} value={product.Top} /></span>
              )}
            </Box>
            <Box className="new-sale-related-row__actions">
              {product.NetUid && onProductInterest && (
                <TableRowAction
                  action="recommend"
                  label={t('Цікавить товар')}
                  onClick={() => onProductInterest(product)}
                />
              )}
              {product.NetUid && onOpenCard && (
                <TableRowAction
                  action="details"
                  label={t('Картка товару')}
                  onClick={() => onOpenCard(product.NetUid as string)}
                />
              )}
            </Box>
          </Box>
          <Text className="new-sale-related-row__name" title={name}>
            {name}
          </Text>
          <RelatedInlineFacts product={product} />
        </Box>
      </Box>
      <Box className="new-sale-related-row__side">
        {extra && <Box className="new-sale-related-row__extra">{extra}</Box>}

      </Box>
    </Box>
  )
}

function RelatedInlineFacts({ product }: { product: WizardSaleProduct }) {
  const facts: { label: string; value: string | null | undefined; tone: TableChipTone }[] = [
    { label: 'Оригінальний номер', value: getProductMainOriginalNumber(product), tone: 'warning' },
    { label: 'Розмір', value: product.Size, tone: 'warning' },
  ]
  const visibleFacts = facts.filter(({ value }) => value?.trim() && !['-', '—'].includes(value.trim()))

  if (visibleFacts.length === 0) {
    return null
  }

  return (
    <Box className="new-sale-related-row__facts">
      {visibleFacts.map((fact) => (
        <Box key={fact.label} title={`${fact.label}: ${fact.value}`}>
          <TableChip value={fact.value} tone={fact.tone} />
        </Box>
      ))}
    </Box>
  )
}
