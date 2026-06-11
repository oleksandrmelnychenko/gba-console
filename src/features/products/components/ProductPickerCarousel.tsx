import { ActionIcon, Box, Card, Group, Loader, ScrollArea, Text, Tooltip } from '@mantine/core'
import { IconInfoCircle, IconStar } from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'

export type ProductPickerItem = {
  Articul?: string
  MainOriginalNumber?: string
  Name?: string
  NameUA?: string
  NetUid?: string
  VendorCode?: string
}

export type ProductPickerMeta = {
  available?: number
  price?: number
  reSaleAvailable?: number
  reSaleCurrency?: string
  reSalePrice?: number
}

const metaNumberFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 })

export function ProductPickerCarousel<T extends ProductPickerItem>({
  products,
  active,
  disabled = false,
  focusedIndex,
  isLoading,
  emptyText,
  keyboardNavigation = true,
  getItemColor,
  getMeta,
  renderItemExtra,
  onFocusedChange,
  onPick,
  onOpenCard,
  onProductInterest,
}: {
  active?: boolean
  disabled?: boolean
  emptyText?: string
  focusedIndex?: number | null
  getItemColor?: (product: T) => string | undefined
  getMeta?: (product: T) => ProductPickerMeta | undefined
  isLoading?: boolean
  keyboardNavigation?: boolean
  onFocusedChange?: (index: number) => void
  onOpenCard?: (productNetId: string) => void
  onPick: (product: T) => void
  onProductInterest?: (product: T) => void
  products: T[]
  renderItemExtra?: (product: T) => ReactNode
}) {
  const { t } = useI18n()
  const [internalFocused, setInternalFocused] = useState(0)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const cardRefs = useRef<Array<HTMLDivElement | null>>([])

  const isControlled = focusedIndex !== undefined
  const rawFocused = isControlled ? focusedIndex ?? -1 : internalFocused
  const safeFocused = products.length === 0 ? -1 : rawFocused < 0 ? (isControlled ? -1 : 0) : Math.min(rawFocused, products.length - 1)

  useEffect(() => {
    if (safeFocused >= 0) {
      cardRefs.current[safeFocused]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    }
  }, [safeFocused])

  function changeFocus(index: number) {
    if (!isControlled) {
      setInternalFocused(index)
    }

    onFocusedChange?.(index)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!keyboardNavigation || disabled || products.length === 0 || isNestedInteractiveEvent(event)) {
      return
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault()
      changeFocus(Math.min(products.length - 1, Math.max(0, safeFocused) + 1))
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      changeFocus(Math.max(0, Math.max(0, safeFocused) - 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const product = safeFocused >= 0 ? products[safeFocused] : undefined

      if (product) {
        onPick(product)
      }
    }
  }

  if (isLoading) {
    return (
      <Group justify="center" py="lg">
        <Loader size="sm" />
      </Group>
    )
  }

  if (products.length === 0) {
    return (
      <Text c="dimmed" size="sm" py="sm">
        {emptyText || t('Нічого не знайдено')}
      </Text>
    )
  }

  return (
    <Box
      aria-label={t('Результати пошуку товарів')}
      aria-disabled={disabled || undefined}
      ref={containerRef}
      role="listbox"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={handleKeyDown}
    >
      <ScrollArea type="auto" offsetScrollbars>
        <Group gap="xs" wrap="nowrap" align="stretch" py={4}>
          {products.map((product, index) => {
            const isActive = index === safeFocused
            const code = product.VendorCode || product.Articul || '—'
            const name = product.NameUA || product.Name || ''
            const meta = getMeta?.(product)
            const itemColor = getItemColor?.(product)

            return (
              <Card
                key={product.NetUid || code || index}
                aria-disabled={disabled || undefined}
                aria-selected={isActive}
                ref={(node: HTMLDivElement | null) => {
                  cardRefs.current[index] = node
                }}
                role="option"
                withBorder
                padding="xs"
                radius="md"
                style={{
                  borderColor: isActive
                    ? active === false
                      ? 'var(--mantine-color-gray-5)'
                      : 'var(--mantine-color-violet-6)'
                    : undefined,
                  cursor: 'pointer',
                  flex: '0 0 200px',
                  minWidth: 200,
                }}
                onClick={() => {
                  if (disabled) {
                    return
                  }

                  changeFocus(index)
                  onPick(product)
                }}
              >
                <Group justify="space-between" gap={4} wrap="nowrap">
                  <Text c={itemColor} fw={700} size="sm" lineClamp={1}>
                    {code}
                  </Text>
                  {product.NetUid && (onProductInterest || onOpenCard) && (
                    <Group gap={2} wrap="nowrap">
                      {onProductInterest && (
                        <Tooltip label={t('Зацікавленість')}>
                          <ActionIcon
                            aria-label={t('Зацікавленість')}
                            color="gray"
                            disabled={disabled}
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
                      {onOpenCard && (
                        <Tooltip label={t('Картка товару')}>
                          <ActionIcon
                            aria-label={t('Картка товару')}
                            color="gray"
                            disabled={disabled}
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
                    </Group>
                  )}
                </Group>
                <Text c="dimmed" size="xs" lineClamp={2} mt={2} style={{ minHeight: 32 }}>
                  {name}
                </Text>
                {product.MainOriginalNumber && (
                  <Text c="dimmed" size="xs" lineClamp={1}>
                    {product.MainOriginalNumber}
                  </Text>
                )}
                {meta && (meta.available != null || meta.price != null) && (
                  <Group gap={8} mt={4} wrap="nowrap">
                    {meta.available != null && (
                      <Text c={meta.available > 0 ? 'teal' : 'red'} fw={600} size="xs">
                        {t('Дост.')}: {metaNumberFormatter.format(meta.available)}
                      </Text>
                    )}
                    {meta.price != null && (
                      <Text size="xs">{metaNumberFormatter.format(meta.price)}</Text>
                    )}
                  </Group>
                )}
                {meta && (meta.reSaleAvailable != null || meta.reSalePrice != null) && (
                  <Group gap={8} mt={2} wrap="nowrap">
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
                {renderItemExtra?.(product)}
              </Card>
            )
          })}
        </Group>
      </ScrollArea>
    </Box>
  )
}

function isNestedInteractiveEvent(event: React.KeyboardEvent<HTMLDivElement>): boolean {
  const target = event.target

  if (!(target instanceof HTMLElement) || target === event.currentTarget) {
    return false
  }

  return Boolean(target.closest('button,a,input,select,textarea,[role="button"]'))
}
