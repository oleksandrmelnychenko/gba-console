import { ActionIcon, Box, Card, Group, Loader, ScrollArea, Text, Tooltip } from '@mantine/core'
import { IconInfoCircle } from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'

export type ProductPickerItem = {
  Articul?: string
  MainOriginalNumber?: string
  Name?: string
  NameUA?: string
  NetUid?: string
  VendorCode?: string
}

export function ProductPickerCarousel<T extends ProductPickerItem>({
  products,
  isLoading,
  emptyText,
  onPick,
  onOpenCard,
}: {
  emptyText?: string
  isLoading?: boolean
  onOpenCard?: (productNetId: string) => void
  onPick: (product: T) => void
  products: T[]
}) {
  const { t } = useI18n()
  const [focused, setFocused] = useState(0)
  const [prevProducts, setPrevProducts] = useState(products)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const cardRefs = useRef<Array<HTMLDivElement | null>>([])

  if (products !== prevProducts) {
    setPrevProducts(products)
    setFocused(0)
  }

  const safeFocused = products.length === 0 ? 0 : Math.min(focused, products.length - 1)

  useEffect(() => {
    cardRefs.current[safeFocused]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  }, [safeFocused])

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (products.length === 0) {
      return
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault()
      setFocused((index) => Math.min(products.length - 1, index + 1))
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      setFocused((index) => Math.max(0, index - 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const product = products[safeFocused]

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
      ref={containerRef}
      tabIndex={0}
      style={{ outline: 'none' }}
      onKeyDown={handleKeyDown}
    >
      <ScrollArea type="auto" offsetScrollbars>
        <Group gap="xs" wrap="nowrap" align="stretch" py={4}>
          {products.map((product, index) => {
            const isActive = index === safeFocused
            const code = product.VendorCode || product.Articul || '—'
            const name = product.NameUA || product.Name || ''

            return (
              <Card
                key={product.NetUid || code || index}
                ref={(node: HTMLDivElement | null) => {
                  cardRefs.current[index] = node
                }}
                withBorder
                padding="xs"
                radius="md"
                style={{
                  borderColor: isActive ? 'var(--mantine-color-violet-6)' : undefined,
                  cursor: 'pointer',
                  flex: '0 0 200px',
                  minWidth: 200,
                }}
                onClick={() => {
                  setFocused(index)
                  onPick(product)
                }}
              >
                <Group justify="space-between" gap={4} wrap="nowrap">
                  <Text fw={700} size="sm" lineClamp={1}>
                    {code}
                  </Text>
                  {product.NetUid && onOpenCard && (
                    <Tooltip label={t('Картка товару')}>
                      <ActionIcon
                        aria-label={t('Картка товару')}
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
                </Group>
                <Text c="dimmed" size="xs" lineClamp={2} mt={2} style={{ minHeight: 32 }}>
                  {name}
                </Text>
                {product.MainOriginalNumber && (
                  <Text c="dimmed" size="xs" lineClamp={1}>
                    {product.MainOriginalNumber}
                  </Text>
                )}
              </Card>
            )
          })}
        </Group>
      </ScrollArea>
    </Box>
  )
}
