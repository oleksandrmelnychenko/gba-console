import { TableChip } from '../../../../shared/ui/TableChip'
import { ActionIcon, Box, Group, Loader, Stack, Text, Tooltip } from '@mantine/core'
import { Layers2, Package, Puzzle, X } from 'lucide-react'
import { notifications } from '@mantine/notifications'
import { memo, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { getProductMainImage, getProductShopImageUrl, isCriticalProductTop, splitProductSearchResults } from '../../../products/utils'
import { getComponentCarouselEntries, type WizardSaleProduct } from './wizardSaleProduct'

// Keystrokes are settled locally for this long before the value is lifted to the
// parent step — the step is ~2600 lines, so re-rendering it per keystroke is the
// single biggest source of typing lag.
const SEARCH_LIFT_DEBOUNCE_MS = 260

// Vertical product picker that mirrors the client carousel on step 1: a "wheel" with the
// products above the focused one on top, the focused product (or the search input) in the
// middle, and the rest below. This is the layout skeleton — refine items/behaviour as needed.
export function WizardProductCarousel({
  products,
  active,
  detailSlot,
  focusedIndex,
  hasFocus,
  isLoading,
  searchInputRef,
  searchMode,
  searchValue,
  getItemColor,
  getItemQty,
  onPick,
  onSearchChange,
}: {
  active: boolean
  detailSlot?: ReactNode
  focusedIndex: number
  getItemColor?: (product: WizardSaleProduct) => string | undefined
  getItemQty?: (product: WizardSaleProduct) => number | undefined
  hasFocus: boolean
  isLoading?: boolean
  onPick: (index: number) => void
  onSearchChange: (value: string) => void
  products: WizardSaleProduct[]
  searchInputRef: RefObject<HTMLInputElement | null>
  searchMode: boolean
  searchValue: string
}) {
  const { t } = useI18n()
  // The input text is local state: typing re-renders only this carousel, and the
  // (huge) parent step receives the value once per SEARCH_LIFT_DEBOUNCE_MS pause.
  const [text, setText] = useState(searchValue)
  const lastLiftedRef = useRef(searchValue)
  const liftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Adopt external resets (e.g. the step clears the query after adding to cart).
  useEffect(() => {
    if (searchValue === lastLiftedRef.current) {
      return
    }

    lastLiftedRef.current = searchValue
    setText((current) => (current === searchValue ? current : searchValue))
  }, [searchValue])

  useEffect(() => () => {
    if (liftTimerRef.current) {
      clearTimeout(liftTimerRef.current)
    }
  }, [])

  function handleTextChange(value: string) {
    // Mirror the parent's guard (it ignores query changes outside ProductSearch
    // mode) — otherwise the local text would drift from the parent query.
    if (!searchMode) {
      return
    }

    setText(value)

    if (liftTimerRef.current) {
      clearTimeout(liftTimerRef.current)
    }

    liftTimerRef.current = setTimeout(() => {
      liftTimerRef.current = null
      lastLiftedRef.current = value
      onSearchChange(value)
    }, SEARCH_LIFT_DEBOUNCE_MS)
  }

  const pendingSearchLift = searchMode && text !== searchValue
  // Hide results belonging to the previous query immediately while the local
  // debounce settles. This avoids briefly presenting stale products as matches.
  const visibleProducts = pendingSearchLift ? [] : products
  const focused = hasFocus && focusedIndex >= 0 ? visibleProducts[focusedIndex] ?? null : null
  // No focused product: mirror the assortment drum («барабанчик» on /products) —
  // the search results split in half around the centered search slot instead of
  // all stacking below it. Shared helper: splitProductSearchResults.
  const searchSplit = focused ? null : splitProductSearchResults(visibleProducts)
  const topProducts = focused ? visibleProducts.slice(0, focusedIndex) : searchSplit?.topProducts ?? []
  const bottomProducts = focused ? visibleProducts.slice(focusedIndex + 1) : searchSplit?.bottomProducts ?? []
  const bottomOffset = focused ? focusedIndex + 1 : topProducts.length
  const showInput = searchMode || !focused

  return (
    <Box className={`new-sale-product-picker ${searchMode ? 'is-search-mode' : ''}`}>
      <Box
        className="new-sale-product-picker__upper"
        style={{
          display: 'flex',
          flex: 1,
          flexDirection: 'column',
          justifyContent: 'flex-end',
          minHeight: 0,
        }}
      >
        <Stack className="new-sale-product-picker__list" gap={0}>
          {topProducts.map((product, index) => (
            <ProductViewerRow
              key={getProductKey(product, index)}
              color={getItemColor?.(product)}
              index={index}
              product={product}
              qty={getItemQty?.(product)}
              onPick={onPick}
            />
          ))}
        </Stack>
      </Box>

      <Box className="new-sale-product-picker__focus" py={0} style={{ flexShrink: 0, position: 'relative' }}>
        {/* Keep the input mounted even while hidden so it retains keyboard focus —
            otherwise arrow-key navigation stops working in selection mode. */}
        <input
          ref={searchInputRef}
          aria-autocomplete="list"
          aria-busy={isLoading || pendingSearchLift || undefined}
          aria-expanded={visibleProducts.length > 0}
          aria-label={t('Пошук товару')}
          autoFocus
          className={`new-sale-product-picker__search ${showInput ? '' : 'is-hidden'}`}
          placeholder={t('Пошук товару')}
          type="text"
          value={text}
          onChange={(event) => handleTextChange(event.currentTarget.value)}
        />
        {!showInput && focused && !detailSlot && (
          <ProductMiniCard
            active={active}
            color={getItemColor?.(focused)}
            product={focused}
            qty={getItemQty?.(focused)}
            searchInputRef={searchInputRef}
          />
        )}
      </Box>

      <Box className="new-sale-product-picker__lower" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {isLoading || pendingSearchLift ? (
          <Group justify="center" py="sm">
            <Loader size="sm" />
          </Group>
        ) : bottomProducts.length === 0 && !focused ? null : (
          <Stack className="new-sale-product-picker__list" gap={0}>
            {bottomProducts.map((product, index) => (
              <ProductViewerRow
                key={getProductKey(product, index)}
                color={getItemColor?.(product)}
                index={bottomOffset + index}
                product={product}
                qty={getItemQty?.(product)}
                onPick={onPick}
              />
            ))}
          </Stack>
        )}
      </Box>

      {focused && detailSlot && (
        // Extended info replaces the compact card and floats out beyond the (narrow) column,
        // vertically centered over the main area, instead of widening the column.
        <Box className="new-sale-product-picker__detail-slot">
          {detailSlot}
        </Box>
      )}
    </Box>
  )
}

const ProductViewerRow = memo(function ProductViewerRow({
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

function ProductMiniCard({
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
  const hasComponents = product.HasComponent || getComponentCarouselEntries(product).entries.length > 0

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

function getProductKey(product: WizardSaleProduct, index: number): string {
  return String(product.NetUid || product.VendorCode || product.Articul || index)
}
