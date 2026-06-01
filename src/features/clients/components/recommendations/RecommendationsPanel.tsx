import {
  ActionIcon,
  Alert,
  Box,
  Card,
  Group,
  Image,
  LoadingOverlay,
  Loader,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core'
import { IconAlertCircle, IconLayoutGrid, IconList, IconPhoto } from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { AppModal } from '../../../../shared/ui/AppModal'
import { DataTable } from '../../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../../shared/ui/data-table/types'
import {
  getMostPurchasedProductsByClientId,
  getProductById,
  getProductCoPurchaseRecommendations,
} from '../../api/clientRecommendationsApi'
import type { RecommendationProduct } from '../../recommendationsTypes'
import type { Client } from '../../types'

type RecommendationsPanelProps = {
  client: Client
  productNetId?: string
}

export function RecommendationsPanel({ client, productNetId }: RecommendationsPanelProps) {
  const { t } = useI18n()
  const [isByRegion, setByRegion] = useState(false)
  const [isGrid, setGrid] = useState(false)
  const [isLoading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [products, setProducts] = useState<RecommendationProduct[]>([])
  const [selectedProduct, setSelectedProduct] = useState<RecommendationProduct | null>(null)
  const [previewProduct, setPreviewProduct] = useState<RecommendationProduct | null>(null)

  const clientNetId = client.NetUid || ''

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function loadProducts() {
      setLoading(true)
      setError(null)

      try {
        if (productNetId) {
          const [product, coPurchase] = await Promise.all([
            getProductById(productNetId, controller.signal),
            getProductCoPurchaseRecommendations(productNetId, clientNetId, isByRegion, controller.signal),
          ])

          if (!cancelled) {
            setSelectedProduct(product)
            setProducts(coPurchase)
          }
        } else {
          const mostPurchased = await getMostPurchasedProductsByClientId(clientNetId, isByRegion, controller.signal)

          if (!cancelled) {
            setSelectedProduct(null)
            setProducts(mostPurchased)
          }
        }
      } catch (loadError) {
        if (!cancelled && controller.signal.aborted) {
          return
        }

        if (!cancelled) {
          setSelectedProduct(null)
          setProducts([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити рекомендації'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadProducts()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [clientNetId, isByRegion, productNetId, t])

  return (
    <Stack gap="md" pos="relative">
      <LoadingOverlay visible={isLoading} overlayProps={{ blur: 1 }} loaderProps={{ color: 'violet' }} />

      <Group justify="space-between" align="center" wrap="wrap">
        <Title order={4} size="h4">
          {t('Рекомендації')}
          {selectedProduct?.VendorCode ? ` - ${selectedProduct.VendorCode}` : ''}
        </Title>

        <Group gap="sm">
          <SegmentedControl
            data={[
              { value: 'sales', label: t('За продажами') },
              { value: 'region', label: t('За регіоном') },
            ]}
            value={isByRegion ? 'region' : 'sales'}
            onChange={(value) => setByRegion(value === 'region')}
          />
          <Tooltip label={isGrid ? t('Список') : t('Таблиця')}>
            <ActionIcon color="violet" variant="light" onClick={() => setGrid((current) => !current)}>
              {isGrid ? <IconList size={18} /> : <IconLayoutGrid size={18} />}
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {error}
        </Alert>
      )}

      {isLoading ? (
        <Group justify="center" py="xl">
          <Loader color="violet" size="sm" />
          <Text c="dimmed" size="sm">
            {t('Завантаження рекомендацій')}
          </Text>
        </Group>
      ) : selectedProduct ? (
        <SelectedProductCard product={selectedProduct} onPreview={() => setPreviewProduct(selectedProduct)} />
      ) : (
        <RecommendationsList isGrid={isGrid} products={products} onPreview={setPreviewProduct} />
      )}

      <ProductImagePreviewModal product={previewProduct} onClose={() => setPreviewProduct(null)} />
    </Stack>
  )
}

function SelectedProductCard({
  product,
  onPreview,
}: {
  product: RecommendationProduct
  onPreview: () => void
}) {
  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="sm">
        <ProductImage product={product} height={380} onPreview={onPreview} />
        <ProductFields product={product} />
      </Stack>
    </Card>
  )
}

function RecommendationsList({
  isGrid,
  products,
  onPreview,
}: {
  isGrid: boolean
  products: RecommendationProduct[]
  onPreview: (product: RecommendationProduct) => void
}) {
  const { t } = useI18n()

  const recommendationColumns = useMemo<DataTableColumn<RecommendationProduct>[]>(() => [
    { id: 'vendorCode', header: t('Артикул'), minWidth: 140, accessor: (row) => row.VendorCode, cell: (row) => displayValue(row.VendorCode) },
    { id: 'name', header: t('Назва'), minWidth: 220, accessor: (row) => row.Name, cell: (row) => displayValue(row.Name) },
    { id: 'mainOriginalNumber', header: t('Оригінальний номер'), minWidth: 180, accessor: (row) => row.MainOriginalNumber, cell: (row) => displayValue(row.MainOriginalNumber) },
    { id: 'size', header: t('Розмір'), minWidth: 120, accessor: (row) => row.Size, cell: (row) => displayValue(row.Size) },
    { id: 'description', header: t('Опис'), minWidth: 240, accessor: (row) => row.Description, cell: (row) => displayValue(row.Description) },
  ], [t])

  if (products.length === 0) {
    return (
      <Text c="dimmed" py="xl" ta="center">
        {t('Рекомендацій не знайдено')}
      </Text>
    )
  }

  if (isGrid) {
    return (
      <DataTable
        columns={recommendationColumns}
        data={products}
        emptyText={t('Рекомендацій не знайдено')}
        getRowId={(row, index) => getProductKey(row, index)}
        maxHeight="calc(100vh - 320px)"
        minWidth={900}
        tableId="client-recommendations-grid"
        layoutVersion="client-recommendations-1"
      />
    )
  }

  return (
    <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="md">
      {products.map((product, index) => (
        <Card key={getProductKey(product, index)} withBorder radius="md" padding="md">
          <Stack gap="sm">
            <ProductImage product={product} height={220} onPreview={() => onPreview(product)} />
            <ProductFields product={product} />
          </Stack>
        </Card>
      ))}
    </SimpleGrid>
  )
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
  if (!product.Image) {
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
          <IconPhoto size={28} />
        </ThemeIcon>
      </Box>
    )
  }

  return (
    <button
      type="button"
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
        src={product.Image}
      />
    </button>
  )
}

function ProductFields({ product }: { product: RecommendationProduct }) {
  return (
    <Stack gap={2}>
      <Text fw={700}>{displayValue(product.VendorCode)}</Text>
      <Text size="sm">{displayValue(product.Name)}</Text>
      <Text c="dimmed" size="sm">
        {displayValue(product.MainOriginalNumber)}
      </Text>
      <Text c="dimmed" size="sm">
        {displayValue(product.Size)}
      </Text>
      {product.Description && (
        <Text c="dimmed" size="xs">
          {product.Description}
        </Text>
      )}
    </Stack>
  )
}

function ProductImagePreviewModal({
  product,
  onClose,
}: {
  product: RecommendationProduct | null
  onClose: () => void
}) {
  const { t } = useI18n()
  const title = product ? `${displayValue(product.Name)} ${displayValue(product.VendorCode)}`.trim() : ''

  return (
    <AppModal
      centered
      opened={Boolean(product?.Image)}
      size="min(1100px, 96vw)"
      title={displayValue(title)}
      onClose={onClose}
    >
      {product?.Image ? (
        <Box
          style={{
            alignItems: 'center',
            display: 'flex',
            justifyContent: 'center',
            minHeight: 360,
          }}
        >
          <Image alt={displayValue(title)} fit="contain" mah="calc(100vh - 220px)" src={product.Image} w="100%" />
        </Box>
      ) : (
        <Text c="dimmed" size="sm">
          {t('Зображення недоступне')}
        </Text>
      )}
    </AppModal>
  )
}

function getProductKey(product: RecommendationProduct, index: number): string {
  return product.NetUid || (product.Id != null ? String(product.Id) : String(index))
}

function displayValue(value?: number | string | null): string {
  if (typeof value === 'number') {
    return String(value)
  }

  const normalized = value?.trim()
  return normalized || '-'
}
