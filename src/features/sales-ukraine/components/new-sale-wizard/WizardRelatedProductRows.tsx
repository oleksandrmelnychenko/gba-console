import { ActionIcon, Box, Stack, Text, Tooltip } from '@mantine/core'
import { IconInfoCircle, IconStar } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import type { WizardSaleProduct } from './wizardSaleProduct'

// Compact one-line rows for related products (analogues / components) — replaces the bulky card
// grid so the list takes far less vertical space. The focused row is highlighted like the
// legacy picker; clicking a row focuses it (Enter adds it to the cart via the keyboard handler).
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
    <Stack gap={2}>
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
  const code = product.VendorCode || product.Articul || '—'
  const name = product.NameUA || product.Name || ''
  const borderColor = focused
    ? active
      ? 'var(--mantine-color-violet-5)'
      : 'var(--mantine-color-gray-4)'
    : 'transparent'

  return (
    <Box
      px={8}
      py={4}
      style={{
        alignItems: 'center',
        background: focused ? 'var(--mantine-color-violet-light)' : undefined,
        border: `1px solid ${borderColor}`,
        borderRadius: 6,
        cursor: 'pointer',
        display: 'flex',
        gap: 10,
        minWidth: 0,
      }}
      onClick={onPick}
    >
      <Box style={{ flex: 1, minWidth: 0 }}>
        <Text c={color} fw={600} size="sm" truncate>
          {code}
        </Text>
        <Text c="dimmed" size="xs" title={name} truncate>
          {name}
        </Text>
        {product.MainOriginalNumber && (
          <Text c="dimmed" size="xs" truncate>
            {product.MainOriginalNumber}
          </Text>
        )}
      </Box>
      {renderExtra?.(product)}
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
