import { Alert, Anchor, Group, Image, Loader, Stack, Text } from '@mantine/core'
import { CircleAlert, ExternalLink, Image as ImageIcon, ZoomIn } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DocumentDetailRow, DocumentDetailSection } from '../../../shared/ui/document-detail/DocumentDetail'
import { AppModal } from '../../../shared/ui/AppModal'
import { TableChip, type TableChipTone } from '../../../shared/ui/TableChip'
import { getProductByNetId } from '../api/productsApi'
import type { Product } from '../types'
import { getProductMainImage, getProductTitle, isCriticalProductTop } from '../utils'
import { ShopImageGallery } from './ShopImageGallery'
import './product-card-modal.css'

const numberFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3, minimumFractionDigits: 0 })
const moneyFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })

export type ProductCardSalePrice = { currencyCode: string; unitPrice: number | null }

export function ProductCardModal({
  loadProduct = getProductByNetId,
  productNetId,
  salePrices,
  onClose,
}: {
  loadProduct?: typeof getProductByNetId
  onClose: () => void
  productNetId: string | null
  salePrices?: readonly ProductCardSalePrice[]
}) {
  const { t } = useI18n()

  return (
    <AppModal className="product-card-modal" centered opened={Boolean(productNetId)} size={1040} title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Картка товару')}</span>} onClose={onClose}>
      {productNetId && <ProductCardContent key={productNetId} loadProduct={loadProduct} productNetId={productNetId} salePrices={salePrices} />}
    </AppModal>
  )
}

function ProductCardContent({
  loadProduct,
  productNetId,
  salePrices,
}: {
  loadProduct: typeof getProductByNetId
  productNetId: string
  salePrices?: readonly ProductCardSalePrice[]
}) {
  const { t } = useI18n()
  const [product, setProduct] = useState<Product | null>(null)
  const [isLoading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const next = await loadProduct(productNetId, controller.signal)

        if (!cancelled) {
          setProduct(next)
        }
      } catch (loadError) {
        if (!cancelled && !controller.signal.aborted) {
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
      controller.abort()
    }
  }, [loadProduct, productNetId, t])

  if (isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
    )
  }

  if (error) {
    return (
      <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
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

  const name = getProductTitle(product)
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

  const prices = salePrices ?? [{ currencyCode: 'EUR', unitPrice: product.CurrentPrice ?? null }, { currencyCode: t('Локальна'), unitPrice: product.CurrentLocalPrice ?? null }]

  return (
    <Stack gap={10} className="product-card-content">
      <div className="product-card-hero">
      <Group className="product-card-summary" justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={2}>
          <Group gap={8} wrap="wrap">
            <TableChip tone="product" size="lg" value={product.VendorCode} />
            {product.Top && <span className="product-card-original"><span>Top</span><TableChip tone={isCriticalProductTop(product.Top) ? 'danger' : 'neutral'} value={product.Top} /></span>}
            {product.MainOriginalNumber && (
              <span className="product-card-original">
                <span>OEM</span>
                <TableChip tone="product" size="md" value={product.MainOriginalNumber} />
              </span>
            )}
          </Group>
          <Text className="product-card-name" fw={600} size="md">{name}</Text>
          {product.ProductGroupNames && (
            <Text c="gray.7" size="xs">
              {product.ProductGroupNames}
            </Text>
          )}
        </Stack>
        {product.NetUid && (
          <Anchor className="product-card-open-link" c="dark.6" fw={600} href={`/products?netId=${encodeURIComponent(product.NetUid)}`} rel="noopener noreferrer" target="_blank" underline="always">
            <Group gap={4} wrap="nowrap">
              <ExternalLink size={14} />
              <Text size="sm">{t('Відкрити')}</Text>
            </Group>
          </Anchor>
        )}
      </Group>

        {mainImage?.ImageUrl ? (
          <div className="product-card-media">
            <button
              type="button"
              aria-label={`${t('Відкрити зображення')}: ${name}`}
              className="product-card-main-image"
              onClick={() => window.open(mainImage.ImageUrl, '_blank', 'noopener,noreferrer')}
            >
              <Image src={mainImage.ImageUrl} alt={name} fit="contain" h="100%" w="100%" />
              <span aria-hidden className="product-card-image-zoom"><ZoomIn size={18} /></span>
            </button>
            {persistedImageUrls.length > 1 ? (
              <Group gap={6} className="product-inline-thumbs">
                {persistedImageUrls.slice(0, 8).map((imageUrl, index) => (
                  <button
                    type="button"
                    aria-label={`${t('Відкрити зображення')} ${index + 1}`}
                    className="product-inline-thumb"
                    key={imageUrl}
                    onClick={() => window.open(imageUrl, '_blank', 'noopener,noreferrer')}
                  >
                    <Image src={imageUrl} alt={`${name} ${index + 1}`} fit="cover" h="100%" w="100%" />
                  </button>
                ))}
              </Group>
            ) : null}
            <ShopImageGallery
              vendorCode={product.VendorCode}
              onImageClick={(url) => window.open(url, '_blank', 'noopener,noreferrer')}
            />
          </div>
        ) : (
          <div className="product-card-media">
            <div className="product-card-image-empty"><ImageIcon aria-label={t('Фото відсутнє')} size={36} /></div>
            <ShopImageGallery vendorCode={product.VendorCode} onImageClick={(url) => window.open(url, '_blank', 'noopener,noreferrer')} />
          </div>
        )}
      <div className="product-card-facts">
        <DetailRow label={t('Од. виміру')} chip="neutral" value={product.MeasureUnit?.Name} />
        <DetailRow label={t('Вага')} mono value={formatNumber(product.Weight)} />
        <DetailRow label={t('Розмір')} chip="warning" value={product.Size} />
        <DetailRow label={t("Об'єм")} mono value={product.Volume} />
      </div>
      <div className="product-card-prices">
        <table className="app-static-table" aria-label={t('Ціни товару')}>
          <thead><tr><th scope="col">{t('Тип ціни')}</th>
            {prices.map((price, index) => (
              <th scope="col" className="app-table-cell-number" key={index}><TableChip tone="source" value={price.currencyCode || t('Валюта договору')} /></th>
            ))}
          </tr></thead>
          <tbody><tr><th scope="row">{salePrices ? t('Ціна продажу') : t('Ціна')}</th>
            {prices.map((price, index) => (
              <td className="app-table-cell-number" key={index}>{formatMoney(price.unitPrice) || '—'}</td>
            ))}
          </tr></tbody>
        </table>
        {salePrices && <Text size="xs" c="dimmed" mt={8}>{t('Ціна за одиницю з урахуванням знижок у вибраному продажі.')}</Text>}
      </div>
      </div>
      <div className="document-detail-tree">
        <DocumentDetailSection title={t('Наявність')}>
          <DetailRow label={t('Доступно (UA)')} mono value={formatNumber(product.AvailableQtyUk)} />
          <DetailRow label={t('В дорозі')} mono value={formatNumber(product.AvailableQtyRoad)} />
          <DetailRow label={t('Доступно (ПДВ)')} mono value={formatNumber(product.AvailableQtyUkVAT)} />
          <DetailRow label={t('Доступно (перепродаж)')} mono value={formatNumber(product.AvailableQtyUkReSale)} />
          <DetailRow label={t('Браковані')} mono value={formatNumber(product.AvailableDefectiveQtyUk)} />
        </DocumentDetailSection>
      {description && (
        <DocumentDetailSection title={t('Опис')} stacked>
          <Text size="sm">{description}</Text>
        </DocumentDetailSection>
      )}

      {notes && (
        <DocumentDetailSection title={t('Примітки')} stacked>
          <Text size="sm">{notes}</Text>
        </DocumentDetailSection>
      )}
      </div>
    </Stack>
  )
}

function DetailRow({ chip, label, money = false, mono = false, value }: { chip?: TableChipTone; label: string; money?: boolean; mono?: boolean; value: unknown }) {
  const text = displayValue(value)

  if (!text) {
    return null
  }

  return (
    <div className={money ? 'product-card-money-row' : undefined}>
      {chip ? (
        <div className="document-detail-row">
          <span className="document-detail-row__label">{label}</span>
          <span className="document-detail-row__value"><TableChip tone={chip} value={text} /></span>
        </div>
      ) : <DocumentDetailRow label={label} mono={mono} value={text} />}
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
