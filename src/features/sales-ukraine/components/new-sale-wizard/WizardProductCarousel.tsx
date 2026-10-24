import { Box, Group, Loader, Stack } from '@mantine/core'
import type { ReactNode, RefObject } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import type { WizardSaleProduct } from './wizardSaleProduct'
import { useWizardProductCarousel } from './useWizardProductCarousel'
import { WizardProductPickerCard, WizardProductPickerRow } from './WizardProductPickerItems'

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
  searchContextKey = '',
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
  searchContextKey?: string
}) {
  const { t } = useI18n()
  const {
    text, handleTextChange, handlePick, pendingSearchLift,
    visibleProducts, focused, topProducts, bottomProducts, bottomOffset, showInput,
  } = useWizardProductCarousel({
    products, focusedIndex, hasFocus, searchMode, searchValue, searchContextKey, onPick, onSearchChange,
  })

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
            <WizardProductPickerRow
              key={getProductKey(product, index)}
              color={getItemColor?.(product)}
              index={index}
              product={product}
              qty={getItemQty?.(product)}
              onPick={handlePick}
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
          <WizardProductPickerCard
            key={getProductKey(focused, focusedIndex)}
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
              <WizardProductPickerRow
                key={getProductKey(product, index)}
                color={getItemColor?.(product)}
                index={bottomOffset + index}
                product={product}
                qty={getItemQty?.(product)}
                onPick={handlePick}
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

function getProductKey(product: WizardSaleProduct, index: number): string {
  return String(product.NetUid || product.VendorCode || product.Articul || index)
}
