import { Alert, Anchor, Badge, Group, Image, Loader, Stack, Text } from '@mantine/core'
import { IconAlertCircle, IconExternalLink } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { getProductByNetId } from '../api/productsApi'
import type { Product } from '../types'
import { getProductMainImage, getProductTitle } from '../utils'
import { ShopImageGallery } from './ShopImageGallery'
import './product-card-modal.css'

const numberFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3, minimumFractionDigits: 0 })
const moneyFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })

export function ProductCardModal({
  productNetId,
  onClose,
}: {
  onClose: () => void
  productNetId: string | null
}) {
  const { t } = useI18n()

  return (
    <AppModal centered opened={Boolean(productNetId)} size="lg" title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Картка товару')}</span>} onClose={onClose}>
      {productNetId && <ProductCardContent key={productNetId} productNetId={productNetId} />}
    </AppModal>
  )
}

function ProductCardContent({ productNetId }: { productNetId: string }) {
  const { t } = useI18n()
  const [product, setProduct] = useState<Product | null>(null)
  const [isLoading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const next = await getProductByNetId(productNetId)

        if (!cancelled) {
          setProduct(next)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити товар'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [productNetId, t])

  if (isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
    )
  }

  if (error) {
    return (
      <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
        {error}
      </Alert>
    )
  }

  if (!product) {
    return (
      <Text c="dimmed" size="sm">
        {t('Товар не знайдено')}
      </Text>
    )
  }

  const name = product.NameUA || product.Name || ''
  const description = product.DescriptionUA || product.Description
  const notes = product.NotesUA || product.Notes
  const mainImage = getProductMainImage(product)
  const persistedImageUrls = product.ProductImages?.filter((image) => image.ImageUrl && !image.Deleted)
    .reduce<string[]>((urls, image) => {
      const imageUrl = image.ImageUrl?.trim()

      if (imageUrl && !urls.includes(imageUrl)) {
        urls.push(imageUrl)
      }

      return urls
    }, mainImage?.ImageUrl ? [mainImage.ImageUrl] : []) || []

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={2}>
          <Group gap={8} wrap="wrap">
            <Text className="product-card-vendor-code" fw={600} size="lg">
              {displayValue(product.VendorCode)}
            </Text>
            {product.MainOriginalNumber && (
              <Badge className="app-role-pill is-gray product-card-original-pill" variant="light">
                {product.MainOriginalNumber}
              </Badge>
            )}
          </Group>
          <Text>{displayValue(name)}</Text>
          {product.ProductGroupNames && (
            <Text c="dimmed" size="xs">
              {product.ProductGroupNames}
            </Text>
          )}
        </Stack>
        {product.NetUid && (
          <Anchor c="dark.6" fw={600} href={`/products?netId=${encodeURIComponent(product.NetUid)}`} rel="noopener noreferrer" target="_blank" underline="always">
            <Group gap={4} wrap="nowrap">
              <IconExternalLink size={14} />
              <Text size="sm">{t('Відкрити')}</Text>
            </Group>
          </Anchor>
        )}
      </Group>

      {mainImage?.ImageUrl ? (
        <button
          type="button"
          className="product-inline-image"
          onClick={() => window.open(mainImage.ImageUrl, '_blank', 'noopener,noreferrer')}
        >
          <Image src={mainImage.ImageUrl} alt={getProductTitle(product)} fit="contain" h="100%" w="100%" />
        </button>
      ) : null}

      {persistedImageUrls.length > 1 ? (
        <Group gap={6} className="product-inline-thumbs">
          {persistedImageUrls.slice(0, 8).map((imageUrl, index) => (
            <button
              type="button"
              className="product-inline-thumb"
              key={imageUrl}
              onClick={() => window.open(imageUrl, '_blank', 'noopener,noreferrer')}
            >
              <Image src={imageUrl} alt={`${getProductTitle(product)} ${index + 1}`} fit="cover" h="100%" w="100%" />
            </button>
          ))}
        </Group>
      ) : null}

      <ShopImageGallery
        vendorCode={product.VendorCode}
        onImageClick={(url) => window.open(url, '_blank', 'noopener,noreferrer')}
      />

      <Stack gap={10}>
        <DetailRow label={t('Доступно (UA)')} mono value={formatNumber(product.AvailableQtyUk)} />
        <DetailRow label={t('В дорозі')} mono value={formatNumber(product.AvailableQtyRoad)} />
        <DetailRow label={t('Доступно (ПДВ)')} mono value={formatNumber(product.AvailableQtyUkVAT)} />
        <DetailRow label={t('Доступно (перепродаж)')} mono value={formatNumber(product.AvailableQtyUkReSale)} />
        <DetailRow label={t('Браковані')} mono value={formatNumber(product.AvailableDefectiveQtyUk)} />
        <DetailRow label={t('Ціна (локальна)')} money={(product.CurrentLocalPrice ?? 0) > 0} mono value={formatMoney(product.CurrentLocalPrice)} />
        <DetailRow label={t('Ціна (EUR)')} money={(product.CurrentPrice ?? 0) > 0} mono value={formatMoney(product.CurrentPrice)} />
        <DetailRow label={t('Од. виміру')} mono value={product.MeasureUnit?.Name} />
        <DetailRow label={t('Вага')} mono value={formatNumber(product.Weight)} />
        <DetailRow label={t('Розмір')} mono value={product.Size} />
        <DetailRow label={t("Об'єм")} mono value={product.Volume} />
      </Stack>

      {description && (
        <Stack gap={2}>
          <Text className="app-section-title" fw={600} size="sm">
            {t('Опис')}
          </Text>
          <Text size="sm">{description}</Text>
        </Stack>
      )}

      {notes && (
        <Stack gap={2}>
          <Text className="app-section-title" fw={600} size="sm">
            {t('Примітки')}
          </Text>
          <Text size="sm">{notes}</Text>
        </Stack>
      )}
    </Stack>
  )
}

function DetailRow({ label, money = false, mono = false, value }: { label: string; money?: boolean; mono?: boolean; value: unknown }) {
  const text = displayValue(value)

  if (!text) {
    return null
  }

  return (
    <div className={`product-card-field${money ? ' is-money' : mono ? ' is-mono' : ''}`}>
      <span>{label}</span>
      <strong>{text}</strong>
    </div>
  )
}

function formatNumber(value?: number | null): string {
  return typeof value === 'number' && Number.isFinite(value) ? numberFormatter.format(value) : ''
}

function formatMoney(value?: number | null): string {
  return typeof value === 'number' && Number.isFinite(value) ? moneyFormatter.format(value) : ''
}

function displayValue(value: unknown): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : ''
  }

  if (typeof value === 'string') {
    return value.trim() || ''
  }

  return ''
}
