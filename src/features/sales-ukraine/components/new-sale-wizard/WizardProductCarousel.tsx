import { ActionIcon, Box, Group, Loader, Stack, Text, Tooltip } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconInfoCircle, IconStar } from '@tabler/icons-react'
import type { ReactNode, RefObject } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import type { ProductPickerMeta } from '../../../products/components/ProductPickerCarousel'
import type { WizardSaleProduct } from './wizardSaleProduct'

const metaNumberFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 })

// Vertical product picker that mirrors the client carousel on step 1: a "wheel" with the
// products above the focused one on top, the focused product (or the search input) in the
// middle, and the rest below. This is the layout skeleton — refine items/behaviour as needed.
export function WizardProductCarousel({
  products,
  active,
  detailSlot,
  emptyText,
  focusedIndex,
  hasFocus,
  isLoading,
  searchInputRef,
  searchMode,
  searchValue,
  getItemColor,
  getMeta,
  onOpenCard,
  onPick,
  onProductInterest,
  onSearchChange,
}: {
  active: boolean
  detailSlot?: ReactNode
  emptyText?: string
  focusedIndex: number
  getItemColor?: (product: WizardSaleProduct) => string | undefined
  getMeta?: (product: WizardSaleProduct) => ProductPickerMeta | undefined
  hasFocus: boolean
  isLoading?: boolean
  onOpenCard?: (productNetId: string) => void
  onPick: (index: number) => void
  onProductInterest?: (product: WizardSaleProduct) => void
  onSearchChange: (value: string) => void
  products: WizardSaleProduct[]
  searchInputRef: RefObject<HTMLInputElement | null>
  searchMode: boolean
  searchValue: string
}) {
  const { t } = useI18n()
  const focused = hasFocus && focusedIndex >= 0 ? products[focusedIndex] ?? null : null
  const topProducts = focused ? products.slice(0, focusedIndex) : []
  const bottomProducts = focused ? products.slice(focusedIndex + 1) : products
  const bottomOffset = focused ? focusedIndex + 1 : 0
  const showInput = searchMode || !focused

  return (
    <Box className="new-sale-product-picker">
      <Box style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'flex-end', minHeight: 0, overflow: 'hidden' }}>
        <Stack className="new-sale-product-picker__list" gap={0}>
          {topProducts.map((product, index) => (
            <ProductViewerRow
              key={getProductKey(product, index)}
              color={getItemColor?.(product)}
              meta={getMeta?.(product)}
              product={product}
              onOpenCard={onOpenCard}
              onPick={() => onPick(index)}
              onProductInterest={onProductInterest}
            />
          ))}
        </Stack>
      </Box>

      <Box py={6} style={{ flexShrink: 0, position: 'relative' }}>
        {/* Keep the input mounted even while hidden so it retains keyboard focus —
            otherwise arrow-key navigation stops working in selection mode. */}
        <input
          ref={searchInputRef}
          autoFocus
          className={`new-sale-product-picker__search ${showInput ? '' : 'is-hidden'}`}
          placeholder={t('Пошук товару')}
          type="text"
          value={searchValue}
          onChange={(event) => onSearchChange(event.currentTarget.value)}
        />
        {!showInput && focused && !detailSlot && (
          <ProductMiniCard
            active={active}
            color={getItemColor?.(focused)}
            meta={getMeta?.(focused)}
            product={focused}
            searchInputRef={searchInputRef}
          />
        )}
      </Box>

      <Box style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <Group justify="center" py="sm">
            <Loader size="sm" />
          </Group>
        ) : bottomProducts.length === 0 && !focused ? (
          <Text c="dimmed" py="sm" size="sm">
            {emptyText || t('Нічого не знайдено')}
          </Text>
        ) : (
          <Stack className="new-sale-product-picker__list" gap={0}>
            {bottomProducts.map((product, index) => (
              <ProductViewerRow
                key={getProductKey(product, index)}
                color={getItemColor?.(product)}
                meta={getMeta?.(product)}
                product={product}
                onOpenCard={onOpenCard}
                onPick={() => onPick(bottomOffset + index)}
                onProductInterest={onProductInterest}
              />
            ))}
          </Stack>
        )}
      </Box>

      {focused && detailSlot && (
        // Extended info replaces the compact card and floats out beyond the (narrow) column,
        // vertically centered over the main area, instead of widening the column.
        <Box
          style={{
            borderRadius: 'var(--mantine-radius-md)',
            boxShadow: '0 10px 34px rgba(20, 28, 38, 0.22)',
            left: 0,
            position: 'absolute',
            top: '50%',
            transform: 'translateY(-50%)',
            width: 'min(760px, calc(100vw - 380px))',
            zIndex: 100,
          }}
        >
          {detailSlot}
        </Box>
      )}
    </Box>
  )
}

function ProductViewerRow({
  color,
  meta,
  product,
  onOpenCard,
  onPick,
  onProductInterest,
}: {
  color?: string
  meta?: ProductPickerMeta
  onOpenCard?: (productNetId: string) => void
  onPick: () => void
  onProductInterest?: (product: WizardSaleProduct) => void
  product: WizardSaleProduct
}) {
  const { t } = useI18n()
  const code = product.VendorCode || product.Articul || '—'
  const name = product.NameUA || product.Name || ''

  return (
    <Box className="new-sale-product-picker-row" onClick={onPick}>
      <Box className="new-sale-product-picker-row__content">
        <Box className="new-sale-product-picker-row__headline">
          <Text c={color} className="new-sale-product-picker-row__code" truncate>
            {code}
          </Text>
          {product.MainOriginalNumber && (
            <Text className="new-sale-product-picker-row__number" truncate>
              {product.MainOriginalNumber}
            </Text>
          )}
        </Box>
        <Text className="new-sale-product-picker-row__name" title={name}>
          {name}
        </Text>
      </Box>
      <Box className="new-sale-product-picker-row__side">
        <ProductMetaDetails meta={meta} />
        <Box className="new-sale-product-picker-row__actions">
          {product.NetUid && onProductInterest && (
            <Tooltip label={t('Цікавить товар')}>
              <ActionIcon
                aria-label={t('Цікавить товар')}
                className="new-sale-product-picker-row__action"
                color="orange"
                size="sm"
                variant="subtle"
                onClick={(event) => {
                  event.stopPropagation()
                  onProductInterest(product)
                }}
              >
                <IconStar size={15} />
              </ActionIcon>
            </Tooltip>
          )}
          {product.NetUid && onOpenCard && (
            <Tooltip label={t('Картка товару')}>
              <ActionIcon
                aria-label={t('Картка товару')}
                className="new-sale-product-picker-row__action"
                color="gray"
                size="sm"
                variant="subtle"
                onClick={(event) => {
                  event.stopPropagation()
                  onOpenCard(product.NetUid as string)
                }}
              >
                <IconInfoCircle size={15} />
              </ActionIcon>
            </Tooltip>
          )}
        </Box>
      </Box>
    </Box>
  )
}

function ProductMetaDetails({ meta }: { meta?: ProductPickerMeta }) {
  const { t } = useI18n()
  const hasAvailability = meta?.available != null || meta?.price != null
  const hasResale = meta?.reSaleAvailable != null || meta?.reSalePrice != null

  if (!meta || (!hasAvailability && !hasResale)) {
    return null
  }

  return (
    <Stack className="new-sale-product-picker-row__metrics" gap={2}>
      {hasAvailability && (
        <Group className="new-sale-product-picker-row__metric-line" gap={6} justify="flex-end" wrap="nowrap">
          {meta.available != null && (
            <Text className={`new-sale-product-picker-row__availability ${meta.available > 0 ? 'is-good' : 'is-bad'}`}>
              {t('Дост.')}: {metaNumberFormatter.format(meta.available)}
            </Text>
          )}
          {meta.price != null && <Text className="new-sale-product-picker-row__price">{metaNumberFormatter.format(meta.price)}</Text>}
        </Group>
      )}
      {hasResale && (
        <Group className="new-sale-product-picker-row__metric-line" gap={6} justify="flex-end" wrap="nowrap">
          {meta.reSaleAvailable != null && (
            <Text className={`new-sale-product-picker-row__availability ${meta.reSaleAvailable > 0 ? 'is-good' : 'is-bad'}`}>
              {t('Перепродаж')}: {metaNumberFormatter.format(meta.reSaleAvailable)}
            </Text>
          )}
          {meta.reSalePrice != null && (
            <Text className="new-sale-product-picker-row__price">
              {metaNumberFormatter.format(meta.reSalePrice)}
              {meta.reSaleCurrency ? ` ${meta.reSaleCurrency}` : ''}
            </Text>
          )}
        </Group>
      )}
    </Stack>
  )
}

function ProductMiniCard({
  active,
  color,
  meta,
  product,
  searchInputRef,
}: {
  active: boolean
  color?: string
  meta?: ProductPickerMeta
  product: WizardSaleProduct
  searchInputRef: RefObject<HTMLInputElement | null>
}) {
  const { t } = useI18n()
  const code = product.VendorCode || product.Articul || '—'
  const name = product.NameUA || product.Name || ''

  function copyCode() {
    // Clicking the card blurs the (hidden) search input → keyboard events stop reaching the
    // wizard root. Restore focus so Enter still adds the product after a copy.
    searchInputRef.current?.focus()

    const value = product.VendorCode || product.Articul || ''

    if (!value) {
      return
    }

    void navigator.clipboard.writeText(value).then(
      () => notifications.show({ color: 'green', message: `${value} — ${t('скопійовано')}` }),
      () => notifications.show({ color: 'red', message: t('Не вдалося скопіювати') }),
    )
  }

  return (
    <Box
      className="new-sale-product-picker-card"
      data-active={active ? 'true' : undefined}
      title={t('Скопіювати код')}
      onClick={copyCode}
    >
      <Box className="new-sale-product-picker-card__top">
        <Text c={color} className="new-sale-product-picker-card__code" title={name} truncate>
          {code}
        </Text>
        <ProductMetaDetails meta={meta} />
      </Box>
      <Text className="new-sale-product-picker-card__name" title={name}>
        {name}
      </Text>
      {product.MainOriginalNumber && (
        <Text className="new-sale-product-picker-card__number" truncate>
          {product.MainOriginalNumber}
        </Text>
      )}
    </Box>
  )
}

function getProductKey(product: WizardSaleProduct, index: number): string {
  return String(product.NetUid || product.VendorCode || product.Articul || index)
}
