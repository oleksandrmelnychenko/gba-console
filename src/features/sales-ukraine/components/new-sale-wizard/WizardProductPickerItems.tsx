import { ActionIcon, Box, Text, Tooltip } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { Layers2, Package, Puzzle, X } from 'lucide-react'
import { memo, useState, type RefObject } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { TableChip } from '../../../../shared/ui/TableChip'
import { getProductMainImage, getProductShopImageUrl, isCriticalProductTop } from '../../../products/utils'
import type { WizardSaleProduct } from './wizardSaleProduct'

export const WizardProductPickerRow = memo(function WizardProductPickerRow({
  color,
  index,
  product,
  qty,
  onPick,
}: {
  color?: string
  index: number
  onPick: (index: number) => void
  product: WizardSaleProduct
  qty?: number
}) {
  const code = product.VendorCode || product.Articul || ''
  const name = product.NameUA || product.Name || ''
  const colorClassName = color?.startsWith('red')
    ? 'is-red'
    : color?.startsWith('blue')
      ? 'is-blue'
      : color?.startsWith('green')
        ? 'is-green'
        : ''

  return (
    <Box component="button" className="new-sale-product-picker-row" type="button" onClick={() => onPick(index)}>
      <Box className="new-sale-product-picker-row__content">
        <Box className="new-sale-product-picker-row__status">
          <Package size={18} strokeWidth={1.6} aria-hidden="true" />
          <Box className={`new-sale-product-picker-row__dot ${colorClassName}`} />
        </Box>
        <Box className="new-sale-product-picker-row__copy">
          <div className="new-sale-product-picker-code-line">
            {code && (
              <Text className="new-sale-product-picker-row__code" title={code} truncate>
                <TableChip tone="product" value={code} />
              </Text>
            )}
            {isCriticalProductTop(product.Top) && <TableChip tone="danger" value={product.Top} />}
            <ProductRelationIndicators product={product} />
          </div>
          <div className="new-sale-product-picker-name-line">
            <Text className="new-sale-product-picker-row__name" title={name} truncate>{name}</Text>
          </div>
        </Box>
        {typeof qty === 'number' && (
          <span className="new-sale-product-picker-row__qty">{qty}</span>
        )}
      </Box>
    </Box>
  )
})

export function WizardProductPickerCard({
  active,
  color,
  product,
  qty,
  searchInputRef,
}: {
  active: boolean
  color?: string
  product: WizardSaleProduct
  qty?: number
  searchInputRef: RefObject<HTMLInputElement | null>
}) {
  const { t } = useI18n()
  const code = product.VendorCode || product.Articul || ''
  const name = product.NameUA || product.Name || ''
  // Product photo right in the drum card (falls back to the shop image when the
  // sparse search payload carries no ProductImages) — same width as the card.
  const imageUrl = getProductMainImage(product)?.ImageUrl || getProductShopImageUrl(product)
  const [dismissedPhoto, setDismissedPhoto] = useState<string | null>(null)

  function closePhoto() {
    setDismissedPhoto(imageUrl || null)
    searchInputRef.current?.focus({ preventScroll: true })
  }

  function copyCode() {
    // Clicking the card blurs the (hidden) search input → keyboard events stop reaching the
    // wizard root. Restore focus so Enter still adds the product after a copy.
    searchInputRef.current?.focus({ preventScroll: true })

    const value = product.VendorCode || product.Articul || ''

    if (!value) {
      return
    }

    if (!navigator.clipboard?.writeText) {
      notifications.show({ color: 'red', message: t('Не вдалося скопіювати') })

      return
    }

    void navigator.clipboard.writeText(value).then(
      () => notifications.show({ color: 'green', message: `${value} — ${t('скопійовано')}` }),
      () => notifications.show({ color: 'red', message: t('Не вдалося скопіювати') }),
    )
  }

  return (
    <Box
      className="new-sale-product-picker-card-wrap"
      data-photo-dismissed={dismissedPhoto === imageUrl ? 'true' : undefined}
      onMouseLeave={() => setDismissedPhoto(null)}
    >
      <Box
        component="button"
        aria-label={`${t('Скопіювати код')}: ${code}`}
        className="new-sale-product-picker-card"
        data-active={active ? 'true' : undefined}
        title={t('Скопіювати код')}
        type="button"
        onClick={copyCode}
      >
        <Package className="new-sale-product-picker-card__icon" size={18} strokeWidth={1.6} aria-hidden="true" />
        <Box className="new-sale-product-picker-card__top">
          <div className="new-sale-product-picker-code-line">
            <Text c={color} className="new-sale-product-picker-card__code" title={name} truncate>
              <TableChip tone="product" value={code} />
            </Text>
            {isCriticalProductTop(product.Top) && <TableChip tone="danger" value={product.Top} />}
            <ProductRelationIndicators product={product} />
          </div>
          {typeof qty === 'number' && (
            <span className="new-sale-product-picker-card__qty">{qty}</span>
          )}
        </Box>
        <div className="new-sale-product-picker-name-line">
          <Text className="new-sale-product-picker-card__name" title={name}>{name}</Text>
        </div>
      </Box>
      {imageUrl && (
        <Box
          className="new-sale-product-picker-card__media"
          onKeyDown={(event) => {
            event.stopPropagation()
            if (event.key === 'Escape') {
              event.preventDefault()
              closePhoto()
            }
          }}
        >
          <img alt={name || code} loading="lazy" src={imageUrl} />
          <Tooltip label={t('Закрити фото')} withinPortal>
            <ActionIcon
              aria-label={t('Закрити фото')}
              className="new-sale-product-picker-card__photo-close"
              color="gray"
              size="sm"
              variant="default"
              onClick={closePhoto}
            >
              <X size={15} aria-hidden />
            </ActionIcon>
          </Tooltip>
        </Box>
      )}
    </Box>
  )
}

function ProductRelationIndicators({ product }: { product: WizardSaleProduct }) {
  const { t } = useI18n()
  const hasComponents = product.HasComponent
    || product.ComponentProducts?.some((item) => Boolean(item.ComponentProduct))
    || product.BaseSetProducts?.some((item) => Boolean(item.BaseProduct))

  return (
    <>
      {product.HasAnalogue && (
        <Tooltip label={t('Є аналоги')} withinPortal>
          <span className="new-sale-product-picker-relation is-analogue" role="img" aria-label={t('Є аналоги')}>
            <Layers2 size={14} aria-hidden />
          </span>
        </Tooltip>
      )}
      {hasComponents && (
        <Tooltip label={t('Є комплектуючі')} withinPortal>
          <span className="new-sale-product-picker-relation is-component" role="img" aria-label={t('Є комплектуючі')}>
            <Puzzle size={14} aria-hidden />
          </span>
        </Tooltip>
      )}
    </>
  )
}
