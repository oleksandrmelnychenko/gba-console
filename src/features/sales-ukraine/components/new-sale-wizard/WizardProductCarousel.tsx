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
    <Box style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, position: 'relative' }}>
      <Box style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'flex-end', minHeight: 0, overflow: 'hidden' }}>
        <Stack gap={2}>
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
          placeholder={t('Пошук товару')}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: '2px solid var(--mantine-color-violet-4)',
            fontSize: 14,
            outline: 'none',
            padding: '6px 4px',
            width: '100%',
            ...(showInput ? {} : { height: 0, opacity: 0, padding: 0, pointerEvents: 'none', position: 'absolute' }),
          }}
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
          <Stack gap={2}>
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
    <Box px={6} py={4} style={{ alignItems: 'center', borderRadius: 6, display: 'flex', gap: 6, minWidth: 0 }} onClick={onPick}>
      <Box style={{ cursor: 'pointer', flex: 1, minWidth: 0 }}>
        <Text c={color} fw={600} size="xs" truncate>
          {code}
        </Text>
        <Text c="dimmed" size="sm" title={name} truncate>
          {name}
        </Text>
        {product.MainOriginalNumber && (
          <Text c="dimmed" size="xs" truncate>
            {product.MainOriginalNumber}
          </Text>
        )}
      </Box>
      <ProductMetaDetails meta={meta} />
      {product.NetUid && onProductInterest && (
        <Tooltip label={t('Цікавить товар')}>
          <ActionIcon
            aria-label={t('Цікавить товар')}
            color="orange"
            size="sm"
            style={{ flexShrink: 0 }}
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
            color="gray"
            size="sm"
            style={{ flexShrink: 0 }}
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
    <Stack gap={1} style={{ flexShrink: 0, minWidth: 96 }}>
      {hasAvailability && (
        <Group gap={6} justify="flex-end" wrap="nowrap">
          {meta.available != null && (
            <Text c={meta.available > 0 ? 'teal' : 'red'} fw={600} size="xs">
              {t('Дост.')}: {metaNumberFormatter.format(meta.available)}
            </Text>
          )}
          {meta.price != null && <Text size="xs">{metaNumberFormatter.format(meta.price)}</Text>}
        </Group>
      )}
      {hasResale && (
        <Group gap={6} justify="flex-end" wrap="nowrap">
          {meta.reSaleAvailable != null && (
            <Text c={meta.reSaleAvailable > 0 ? 'teal' : 'red'} fw={600} size="xs">
              {t('Перепродаж')}: {metaNumberFormatter.format(meta.reSaleAvailable)}
            </Text>
          )}
          {meta.reSalePrice != null && (
            <Text size="xs">
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
  const borderColor = active ? 'var(--mantine-color-violet-5)' : 'var(--mantine-color-gray-5)'

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
      px={8}
      py={6}
      title={t('Скопіювати код')}
      style={{
        background: 'var(--mantine-color-violet-light)',
        border: `2px solid ${borderColor}`,
        borderRadius: 8,
        boxShadow: '0 2px 10px rgba(20, 28, 38, 0.08)',
        cursor: 'pointer',
        minWidth: 0,
      }}
      onClick={copyCode}
    >
      <Group gap={6} justify="space-between" wrap="nowrap">
        <Text c={color ?? 'violet.7'} fw={700} size="sm" title={name} truncate>
          {code}
        </Text>
        <ProductMetaDetails meta={meta} />
      </Group>
      <Text c="dimmed" size="xs" title={name} truncate>
        {name}
      </Text>
      {product.MainOriginalNumber && (
        <Text c="dimmed" size="xs" truncate>
          {product.MainOriginalNumber}
        </Text>
      )}
    </Box>
  )
}

function getProductKey(product: WizardSaleProduct, index: number): string {
  return String(product.NetUid || product.VendorCode || product.Articul || index)
}
