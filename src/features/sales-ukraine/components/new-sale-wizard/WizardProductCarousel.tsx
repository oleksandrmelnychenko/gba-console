import { Box, Group, Loader, Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import type { WizardSaleProduct } from './wizardSaleProduct'

// Keystrokes are settled locally for this long before the value is lifted to the
// parent step — the step is ~2600 lines, so re-rendering it per keystroke is the
// single biggest source of typing lag.
const SEARCH_LIFT_DEBOUNCE_MS = 160

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
  onPick,
  onSearchChange,
}: {
  active: boolean
  detailSlot?: ReactNode
  focusedIndex: number
  getItemColor?: (product: WizardSaleProduct) => string | undefined
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
  if (searchValue !== lastLiftedRef.current) {
    lastLiftedRef.current = searchValue

    if (text !== searchValue) {
      setText(searchValue)
    }
  }

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

  const focused = hasFocus && focusedIndex >= 0 ? products[focusedIndex] ?? null : null
  const topProducts = focused ? products.slice(0, focusedIndex) : []
  const bottomProducts = focused ? products.slice(focusedIndex + 1) : products
  const bottomOffset = focused ? focusedIndex + 1 : 0
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
          overflow: 'hidden',
        }}
      >
        <Stack className="new-sale-product-picker__list" gap={0}>
          {topProducts.map((product, index) => (
            <ProductViewerRow
              key={getProductKey(product, index)}
              color={getItemColor?.(product)}
              product={product}
              onPick={() => onPick(index)}
            />
          ))}
        </Stack>
      </Box>

      <Box className="new-sale-product-picker__focus" py={0} style={{ flexShrink: 0, position: 'relative' }}>
        {/* Keep the input mounted even while hidden so it retains keyboard focus —
            otherwise arrow-key navigation stops working in selection mode. */}
        <input
          ref={searchInputRef}
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
            searchInputRef={searchInputRef}
          />
        )}
      </Box>

      <Box className="new-sale-product-picker__lower" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <Group justify="center" py="sm">
            <Loader size="sm" />
          </Group>
        ) : bottomProducts.length === 0 && !focused ? null : (
          <Stack className="new-sale-product-picker__list" gap={0}>
            {bottomProducts.map((product, index) => (
              <ProductViewerRow
                key={getProductKey(product, index)}
                color={getItemColor?.(product)}
                product={product}
                onPick={() => onPick(bottomOffset + index)}
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

function ProductViewerRow({
  color,
  product,
  onPick,
}: {
  color?: string
  onPick: () => void
  product: WizardSaleProduct
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
    <Box className="new-sale-product-picker-row" onClick={onPick}>
      <Box className="new-sale-product-picker-row__content">
        <Box className="new-sale-product-picker-row__status">
          <Box className={`new-sale-product-picker-row__dot ${colorClassName}`} />
        </Box>
        <Box className="new-sale-product-picker-row__copy">
          {code && (
            <Text className="new-sale-product-picker-row__code" title={code} truncate>
              {code}
            </Text>
          )}
          <Text className="new-sale-product-picker-row__name" title={name} truncate>
            {name}
          </Text>
        </Box>
      </Box>
    </Box>
  )
}

function ProductMiniCard({
  active,
  color,
  product,
  searchInputRef,
}: {
  active: boolean
  color?: string
  product: WizardSaleProduct
  searchInputRef: RefObject<HTMLInputElement | null>
}) {
  const { t } = useI18n()
  const code = product.VendorCode || product.Articul || ''
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
      </Box>
      <Text className="new-sale-product-picker-card__name" title={name}>
        {name}
      </Text>
    </Box>
  )
}

function getProductKey(product: WizardSaleProduct, index: number): string {
  return String(product.NetUid || product.VendorCode || product.Articul || index)
}
