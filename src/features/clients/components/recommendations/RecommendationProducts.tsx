import { ActionIcon, Badge, Box, Button, Card, Group, Image, Stack, Text, ThemeIcon, Tooltip } from '@mantine/core'
import { Check, Image as ImageIcon, ShoppingCart, X } from 'lucide-react'
import { memo, useCallback, useLayoutEffect, useRef, useState } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { toProxiedAssetUrl } from '../../../../shared/url/proxiedAssetUrl'
import { AppModal } from '../../../../shared/ui/AppModal'
import { getProductShopImageUrlByCode } from '../../../products/utils'
import type { RecommendationProduct } from '../../recommendationsTypes'
import { canSelectRecommendationProduct, getRecommendationAvailableQty, hasRecommendationAvailabilityData } from './recommendationAvailability'
import { getRecommendationSourcePresentation } from './recommendationSourcePresentation'
import { getRecommendationProductKey as getProductKey } from './recommendationProductKey'

const priceFormatter = new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function SelectedProductCard({
  product,
  onPreview,
}: {
  product: RecommendationProduct
  onPreview: () => void
}) {
  return (
    <Card className="app-section-card" withBorder radius="md" padding="md">
      <Stack gap="sm">
        <ProductImage product={product} height={380} onPreview={onPreview} />
        <Text fw={700}>{displayValue(product.VendorCode)}</Text>
        <Text size="sm">{displayValue(product.Name)}</Text>
      </Stack>
    </Card>
  )
}

export function RecommendationsList({
  isVatSale,
  products,
  selectable,
  selectedKeys,
  onExclude,
  onPreview,
  onToggleSelect,
}: {
  isVatSale: boolean
  products: RecommendationProduct[]
  selectable: boolean
  selectedKeys: ReadonlySet<string>
  onExclude?: (product: RecommendationProduct, index: number) => void
  onPreview: (product: RecommendationProduct) => void
  onToggleSelect: (product: RecommendationProduct, index: number) => void
}) {
  const { t } = useI18n()
  const actionsRef = useRef({ onExclude, onPreview, onToggleSelect })
  useLayoutEffect(() => { actionsRef.current = { onExclude, onPreview, onToggleSelect } })
  const exclude = useCallback((product: RecommendationProduct, index: number) => actionsRef.current.onExclude?.(product, index), [])
  const preview = useCallback((product: RecommendationProduct) => actionsRef.current.onPreview(product), [])
  const toggle = useCallback((product: RecommendationProduct, index: number) => actionsRef.current.onToggleSelect(product, index), [])


  if (products.length === 0) {
    return (
      <Stack className="client-recommendations-empty" align="center" gap={6} role="status">
        <ShoppingCart size={24} aria-hidden="true" />
        <Text fw={500} size="sm">{t('Рекомендацій не знайдено')}</Text>
        <Text c="dimmed" size="xs">{t('За вибраним договором немає рекомендованих товарів')}</Text>
      </Stack>
    )
  }


  return (
    <div className="client-recommendations-grid">
      {products.map((product, index) => (
        <RecommendationCard key={getProductKey(product, index)} product={product} index={index}
          selected={selectedKeys.has(getProductKey(product, index))} selectable={selectable} isVatSale={isVatSale}
          onExclude={onExclude ? exclude : undefined} onPreview={preview} onToggleSelect={toggle} />
      ))}
    </div>
  )
}

const RecommendationCard = memo(function RecommendationCard({ product, index, selected, selectable, isVatSale, onExclude, onPreview, onToggleSelect }: {
  product: RecommendationProduct
  index: number
  selected: boolean
  selectable: boolean
  isVatSale: boolean
  onExclude?: (product: RecommendationProduct, index: number) => void
  onPreview: (product: RecommendationProduct) => void
  onToggleSelect: (product: RecommendationProduct, index: number) => void
}) {
  const { t } = useI18n()
  const available = getRecommendationAvailableQty(product, isVatSale)
  const hasAvailability = hasRecommendationAvailabilityData(product, isVatSale)
  const canSelect = canSelectRecommendationProduct(product, isVatSale)
  return (
    <article className={`recommendation-product${selected ? ' is-selected' : ''}`}>
      <div className="recommendation-product-media">
        <ProductImage product={product} height={210} onPreview={() => onPreview(product)} />
        <div className="recommendation-product-stock">
          <Badge color={!hasAvailability ? 'gray' : available > 0 ? 'teal' : 'red'} variant="light" size="sm">
            {!hasAvailability ? t('Наявність невідома') : available > 0 ? `${t('В наявності')}: ${available}` : t('Немає в наявності')}
          </Badge>
        </div>
      </div>
      <div className="recommendation-product-body">
        <Group justify="space-between" gap="xs">
          <Text className="recommendation-product-code" fw={600}>{displayValue(product.VendorCode)}</Text>
          {onExclude && <ExcludeRecommendationButton onClick={() => onExclude(product, index)} />}
        </Group>
        <Text fw={500} size="sm">{displayValue(product.NameUA || product.Name)}</Text>
        {product.MainOriginalNumber && (
          <Group gap={6}>
            <Text size="xs" fw={600}>OEM:</Text>
            <Badge className="recommendation-product-oem" color="orange" variant="light" size="sm">{product.MainOriginalNumber}</Badge>
          </Group>
        )}
        {product.Size && <Text size="xs" c="dimmed">{product.Size}</Text>}
        {(product.DescriptionUA || product.Description) && <Text size="xs" c="dimmed">{product.DescriptionUA || product.Description}</Text>}
        <RecommendationSourceBadge product={product} />
        <div className="recommendation-product-footer">
          <Text className="app-money" fw={600}>{formatPrice(product)}</Text>
          {selectable && (
            <Button
              aria-label={`${t('Вибрати товар')} ${displayValue(product.VendorCode)}`}
              aria-pressed={selected}
              className="recommendation-product-select"
              color={selected ? 'orange' : 'dark'}
              disabled={!canSelect}
              leftSection={selected ? <Check size={16} /> : <ShoppingCart size={16} />}
              size="xs"
              variant={selected ? 'outline' : 'filled'}
              onClick={() => onToggleSelect(product, index)}
            >
              {selected ? t('Вибрано') : t('Вибрати')}
            </Button>
          )}
        </div>
      </div>
    </article>
  )
})

function ExcludeRecommendationButton({ onClick }: { onClick: () => void }) {
  const { t } = useI18n()

  return (
    <Tooltip label={t('Не пропонувати цей товар клієнту')} withArrow>
      <ActionIcon aria-label={t('Не пропонувати')} color="gray" size="sm" variant="subtle" onClick={onClick}>
        <X size={14} />
      </ActionIcon>
    </Tooltip>
  )
}

function RecommendationSourceBadge({ product }: { product: RecommendationProduct }) {
  const { t } = useI18n()
  const presentation = getRecommendationSourcePresentation(product)

  if (!presentation) {
    return <span />
  }

  return (
    <Tooltip label={t(presentation.tooltip)}>
      <Badge color={presentation.color} size="sm" variant="light">
        {t(presentation.label)}
      </Badge>
    </Tooltip>
  )
}

function getRecommendationImageUrl(product?: RecommendationProduct | null): string {
  if (!product) {
    return ''
  }

  return toProxiedAssetUrl(product.Image) || getProductShopImageUrlByCode(product.VendorCode)
}

function ProductImage({
  product,
  height,
  onPreview,
}: {
  product: RecommendationProduct
  height: number
  onPreview: () => void
}) {
  const [failedUrl, setFailedUrl] = useState('')
  const imageUrl = getRecommendationImageUrl(product)

  if (!imageUrl || failedUrl === imageUrl) {
    return (
      <Box
        h={height}
        style={{
          alignItems: 'center',
          background: 'var(--mantine-color-gray-0)',
          borderRadius: 'var(--mantine-radius-sm)',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <ThemeIcon color="gray" size="xl" variant="light">
          <ImageIcon size={28} />
        </ThemeIcon>
      </Box>
    )
  }

  return (
    <button
      type="button"
      aria-label={`Відкрити фото ${displayValue(product.VendorCode)}`}
      style={{
        background: 'transparent',
        border: 0,
        cursor: 'zoom-in',
        padding: 0,
        width: '100%',
      }}
      onClick={onPreview}
    >
      <Image
        alt={`${displayValue(product.Name)} ${displayValue(product.VendorCode)}`.trim()}
        fit="contain"
        h={height}
        radius="sm"
        src={imageUrl}
        onError={() => setFailedUrl(imageUrl)}
      />
    </button>
  )
}

function formatPrice(product: RecommendationProduct): string {
  const price = product.CurrentPrice

  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
    return '-'
  }

  return `${priceFormatter.format(price)} EUR`
}

export function ProductImagePreviewModal({
  product,
  onClose,
}: {
  product: RecommendationProduct | null
  onClose: () => void
}) {
  const { t } = useI18n()
  const title = product ? `${displayValue(product.Name)} ${displayValue(product.VendorCode)}`.trim() : ''
  const imageUrl = getRecommendationImageUrl(product)

  return (
    <AppModal
      centered
      opened={Boolean(imageUrl)}
      size="min(1100px, 96vw)"
      title={displayValue(title)}
      onClose={onClose}
    >
      {imageUrl ? (
        <Box
          style={{
            alignItems: 'center',
            display: 'flex',
            justifyContent: 'center',
            minHeight: 360,
          }}
        >
          <Image alt={displayValue(title)} fit="contain" mah="calc(100vh - 220px)" src={imageUrl} w="100%" />
        </Box>
      ) : (
        <Text c="dimmed" size="sm">
          {t('Зображення недоступне')}
        </Text>
      )}
    </AppModal>
  )
}

function displayValue(value?: number | string | null): string {
  if (typeof value === 'number') {
    return String(value)
  }

  const normalized = value?.trim()
  return normalized || '-'
}
