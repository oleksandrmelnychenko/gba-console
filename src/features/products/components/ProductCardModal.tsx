import { Alert, Anchor, Badge, Group, Loader, Stack, Text } from '@mantine/core'
import { IconAlertCircle, IconExternalLink } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { getProductByNetId } from '../api/productsApi'
import type { Product } from '../types'
import { ShopImageGallery } from './ShopImageGallery'

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
    <AppModal centered opened={Boolean(productNetId)} size="lg" title={t('Картка товару')} onClose={onClose}>
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

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={2}>
          <Group gap={8} wrap="wrap">
            <Text fw={700} size="lg">
              {displayValue(product.VendorCode)}
            </Text>
            {product.MainOriginalNumber && (
              <Badge color="gray" variant="light">
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
          <Anchor href={`/products?netId=${encodeURIComponent(product.NetUid)}`} target="_blank" rel="noopener noreferrer">
            <Group gap={4} wrap="nowrap">
              <IconExternalLink size={14} />
              <Text size="sm">{t('Відкрити')}</Text>
            </Group>
          </Anchor>
        )}
      </Group>

      {product.VendorCode && (
        <ShopImageGallery
          vendorCode={product.VendorCode}
          onImageClick={(url) => window.open(url, '_blank', 'noopener,noreferrer')}
        />
      )}

      <Stack gap={4}>
        <DetailRow label={t('Доступно (UA)')} value={formatNumber(product.AvailableQtyUk)} />
        <DetailRow label={t('В дорозі')} value={formatNumber(product.AvailableQtyRoad)} />
        <DetailRow label={t('Доступно (ПДВ)')} value={formatNumber(product.AvailableQtyUkVAT)} />
        <DetailRow label={t('Доступно (перепродаж)')} value={formatNumber(product.AvailableQtyUkReSale)} />
        <DetailRow label={t('Браковані')} value={formatNumber(product.AvailableDefectiveQtyUk)} />
        <DetailRow label={t('Ціна (локальна)')} value={formatMoney(product.CurrentLocalPrice)} />
        <DetailRow label={t('Ціна (EUR)')} value={formatMoney(product.CurrentPrice)} />
        <DetailRow label={t('Од. виміру')} value={product.MeasureUnit?.Name} />
        <DetailRow label={t('Вага')} value={formatNumber(product.Weight)} />
        <DetailRow label={t('Розмір')} value={product.Size} />
        <DetailRow label={t("Об'єм")} value={product.Volume} />
      </Stack>

      {description && (
        <Stack gap={2}>
          <Text c="dimmed" size="xs" tt="uppercase">
            {t('Опис')}
          </Text>
          <Text size="sm">{description}</Text>
        </Stack>
      )}

      {notes && (
        <Stack gap={2}>
          <Text c="dimmed" size="xs" tt="uppercase">
            {t('Примітки')}
          </Text>
          <Text size="sm">{notes}</Text>
        </Stack>
      )}
    </Stack>
  )
}

function DetailRow({ label, value }: { label: string; value: unknown }) {
  const text = displayValue(value)

  if (text === '-') {
    return null
  }

  return (
    <Group justify="space-between" align="flex-start" gap="lg" wrap="nowrap">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={500} ta="right">
        {text}
      </Text>
    </Group>
  )
}

function formatNumber(value?: number | null): string {
  return typeof value === 'number' && Number.isFinite(value) ? numberFormatter.format(value) : '-'
}

function formatMoney(value?: number | null): string {
  return typeof value === 'number' && Number.isFinite(value) ? moneyFormatter.format(value) : '-'
}

function displayValue(value: unknown): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '-'
  }

  if (typeof value === 'string') {
    return value.trim() || '-'
  }

  return '-'
}
