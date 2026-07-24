import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Group,
  Image,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core'
import { CircleAlert, Image as ImageIcon, LayoutGrid, List, ShoppingCart } from 'lucide-react'
import { useEffect, useReducer, useState } from 'react'
import { AiFeatureBadge } from '../../../../shared/ai/AiFeatureBadge'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { toProxiedAssetUrl } from '../../../../shared/url/proxiedAssetUrl'
import { AppModal } from '../../../../shared/ui/AppModal'
import { CREATE_ACTION_COLOR } from '../../../../shared/ui/page-header-actions/PageHeaderActions'
import { useAuth } from '../../../auth/useAuth'
import { SALES_UKRAINE_EDIT_PERMISSION } from '../../../sales-ukraine/permissions'
import { NewSaleWizard, type NewSaleWizardPrefill } from '../../../sales-ukraine/components/new-sale-wizard/NewSaleWizard'
import { getWizardClientAgreements } from '../../../sales-ukraine/components/new-sale-wizard/wizardClientStepApi'
import type { SalesUkraineProduct } from '../../../sales-ukraine/types'
import {
  getMostPurchasedProductsByClientId,
  getProductById,
  getProductCoPurchaseRecommendations,
} from '../../api/clientRecommendationsApi'
import { getProductShopImageUrlByCode } from '../../../products/utils'
import type { RecommendationProduct } from '../../recommendationsTypes'
import type { Client } from '../../types'
import { OrbSplash } from '../../../../shared/ui/orb/Orb'

type RecommendationsPanelProps = {
  client: Client
  productNetId?: string
}

type RecommendationsState = {
  error: string | null
  isGrid: boolean
  isLoading: boolean
  previewProduct: RecommendationProduct | null
  products: RecommendationProduct[]
  selectedProduct: RecommendationProduct | null
}

type RecommendationsAction =
  | { type: 'failed'; error: string }
  | { type: 'loadedMostPurchased'; products: RecommendationProduct[] }
  | { type: 'loadedProductRecommendations'; products: RecommendationProduct[]; selectedProduct: RecommendationProduct | null }
  | { type: 'loading' }
  | { type: 'previewProduct'; product: RecommendationProduct | null }
  | { type: 'toggleGrid' }

const initialRecommendationsState: RecommendationsState = {
  error: null,
  isGrid: false,
  isLoading: true,
  previewProduct: null,
  products: [],
  selectedProduct: null,
}

function recommendationsReducer(state: RecommendationsState, action: RecommendationsAction): RecommendationsState {
  switch (action.type) {
    case 'failed':
      return {
        ...state,
        error: action.error,
        isLoading: false,
        products: [],
        selectedProduct: null,
      }
    case 'loadedMostPurchased':
      return {
        ...state,
        error: null,
        isLoading: false,
        products: action.products,
        selectedProduct: null,
      }
    case 'loadedProductRecommendations':
      return {
        ...state,
        error: null,
        isLoading: false,
        products: action.products,
        selectedProduct: action.selectedProduct,
      }
    case 'loading':
      return { ...state, error: null, isLoading: true }
    case 'previewProduct':
      return { ...state, previewProduct: action.product }
    case 'toggleGrid':
      return { ...state, isGrid: !state.isGrid }
  }
}

export function RecommendationsPanel({ client, productNetId }: RecommendationsPanelProps) {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const [state, dispatch] = useReducer(recommendationsReducer, initialRecommendationsState)
  const { error, isGrid, isLoading, previewProduct, products, selectedProduct } = state
  const [agreementNetId, setAgreementNetId] = useState<string | null>(null)
  const [agreementResolved, setAgreementResolved] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<ReadonlySet<string>>(new Set())
  const [wizardPrefill, setWizardPrefill] = useState<NewSaleWizardPrefill | null>(null)

  const clientNetId = client.NetUid || ''
  const canCreateSale = hasPermission(SALES_UKRAINE_EDIT_PERMISSION)
  const selectedCount = selectedKeys.size

  useEffect(() => {
    let cancelled = false

    async function resolveAgreement() {
      setAgreementResolved(false)
      setAgreementNetId(null)

      try {
        const agreements = clientNetId ? await getWizardClientAgreements(clientNetId) : []
        const active = agreements.find((item) => item.Agreement?.IsActive) ?? agreements[0]

        if (!cancelled) {
          setAgreementNetId(active?.NetUid || null)
        }
      } catch {
        /* Recommendations still load without agreement pricing/availability. */
      } finally {
        if (!cancelled) {
          setAgreementResolved(true)
        }
      }
    }

    void resolveAgreement()

    return () => {
      cancelled = true
    }
  }, [clientNetId])

  useEffect(() => {
    if (!agreementResolved) {
      return
    }

    let cancelled = false
    const controller = new AbortController()
    const options = {
      signal: controller.signal,
      ...(agreementNetId ? { clientAgreementNetId: agreementNetId } : {}),
    }

    async function loadProducts() {
      dispatch({ type: 'loading' })

      try {
        if (productNetId) {
          const [product, coPurchase] = await Promise.all([
            getProductById(productNetId, controller.signal),
            getProductCoPurchaseRecommendations(productNetId, clientNetId, false, options),
          ])

          if (!cancelled) {
            dispatch({ products: coPurchase, selectedProduct: product, type: 'loadedProductRecommendations' })
          }
        } else {
          const mostPurchased = await getMostPurchasedProductsByClientId(clientNetId, false, options)

          if (!cancelled) {
            dispatch({ products: mostPurchased, type: 'loadedMostPurchased' })
          }
        }
      } catch (loadError) {
        if (!cancelled && controller.signal.aborted) {
          return
        }

        if (!cancelled) {
          dispatch({
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити рекомендації'),
            type: 'failed',
          })
        }
      }
    }

    void loadProducts()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [agreementNetId, agreementResolved, clientNetId, productNetId, t])

  useEffect(() => {
    setSelectedKeys(new Set())
  }, [products])

  function toggleSelected(product: RecommendationProduct, index: number) {
    const key = getProductKey(product, index)

    setSelectedKeys((current) => {
      const next = new Set(current)

      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }

      return next
    })
  }

  function openSaleWizard() {
    if (!clientNetId) {
      return
    }

    const chosen = products
      .filter((product, index) => selectedKeys.has(getProductKey(product, index)))
      .filter((product) => (product.Id ?? 0) > 0 && product.NetUid)

    setWizardPrefill({
      clientNetId,
      products: chosen as unknown as SalesUkraineProduct[],
    })
  }

  return (
    <Stack gap="md" pos="relative">
      <Card className="app-section-card" withBorder radius="md" padding="md">
        <Stack gap="md">
          <Group justify="space-between" align="center" wrap="wrap">
            <Group align="center" gap="xs" wrap="nowrap">
              <Title order={4} size="h4">
                {t('Рекомендації')}
                {selectedProduct?.VendorCode ? ` - ${selectedProduct.VendorCode}` : ''}
              </Title>
              <AiFeatureBadge size="sm" tooltip={t('AI-рекомендації для клієнта')} />
            </Group>

            <Group gap="sm">
              {canCreateSale && (
                <Button
                  color={CREATE_ACTION_COLOR}
                  disabled={isLoading || !clientNetId}
                  leftSection={<ShoppingCart size={16} />}
                  size="sm"
                  variant="filled"
                  onClick={openSaleWizard}
                >
                  {selectedCount > 0 ? `${t('Утворити продажу')} (${selectedCount})` : t('Утворити продажу')}
                </Button>
              )}
              <Tooltip label={isGrid ? t('Список') : t('Таблиця')}>
                <ActionIcon color="gray" variant="light" onClick={() => dispatch({ type: 'toggleGrid' })}>
                  {isGrid ? <List size={18} /> : <LayoutGrid size={18} />}
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>

          {error && (
            <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
              {error}
            </Alert>
          )}

          {isLoading ? (
            <OrbSplash label={t('Завантаження рекомендацій')} size={40} variant="thinking" />
          ) : selectedProduct ? (
            <SelectedProductCard product={selectedProduct} onPreview={() => dispatch({ product: selectedProduct, type: 'previewProduct' })} />
          ) : (
            <RecommendationsList
              isGrid={isGrid}
              products={products}
              selectable={canCreateSale}
              selectedKeys={selectedKeys}
              onPreview={(product) => dispatch({ product, type: 'previewProduct' })}
              onToggleSelect={toggleSelected}
            />
          )}
        </Stack>
      </Card>

      <ProductImagePreviewModal product={previewProduct} onClose={() => dispatch({ product: null, type: 'previewProduct' })} />

      {canCreateSale && (
        <NewSaleWizard
          opened={Boolean(wizardPrefill)}
          prefill={wizardPrefill}
          onClose={() => setWizardPrefill(null)}
          onCreated={() => setWizardPrefill(null)}
        />
      )}
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
    <Card className="app-section-card" withBorder radius="md" padding="md">
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
  selectable,
  selectedKeys,
  onPreview,
  onToggleSelect,
}: {
  isGrid: boolean
  products: RecommendationProduct[]
  selectable: boolean
  selectedKeys: ReadonlySet<string>
  onPreview: (product: RecommendationProduct) => void
  onToggleSelect: (product: RecommendationProduct, index: number) => void
}) {
  const { t } = useI18n()

  if (products.length === 0) {
    return (
      <Text c="dimmed" py="xl" ta="center">
        {t('Рекомендацій не знайдено')}
      </Text>
    )
  }

  if (isGrid) {
    return (
      <Table striped highlightOnHover withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            {selectable && <Table.Th w={40} />}
            <Table.Th>{t('Артикул')}</Table.Th>
            <Table.Th>{t('Назва')}</Table.Th>
            <Table.Th>{t('Оригінальний номер')}</Table.Th>
            <Table.Th>{t('Тип')}</Table.Th>
            <Table.Th>{t('Ціна')}</Table.Th>
            <Table.Th>{t('Наявність')}</Table.Th>
            <Table.Th>{t('Опис')}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {products.map((product, index) => (
            <Table.Tr key={getProductKey(product, index)}>
              {selectable && (
                <Table.Td>
                  <Checkbox
                    aria-label={t('Вибрати товар')}
                    checked={selectedKeys.has(getProductKey(product, index))}
                    onChange={() => onToggleSelect(product, index)}
                  />
                </Table.Td>
              )}
              <Table.Td>{displayValue(product.VendorCode)}</Table.Td>
              <Table.Td>{displayValue(product.Name)}</Table.Td>
              <Table.Td>{displayValue(product.MainOriginalNumber)}</Table.Td>
              <Table.Td>
                <RecommendationSourceBadge product={product} />
              </Table.Td>
              <Table.Td>{formatPrice(product)}</Table.Td>
              <Table.Td>{formatAvailability(product)}</Table.Td>
              <Table.Td>{displayValue(product.Description)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    )
  }

  return (
    <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="md">
      {products.map((product, index) => (
        <Card key={getProductKey(product, index)} className="app-section-card" withBorder radius="md" padding="md">
          <Stack gap="sm">
            <Group justify="space-between" align="center" gap="xs">
              <RecommendationSourceBadge product={product} />
              {selectable && (
                <Checkbox
                  aria-label={t('Вибрати товар')}
                  checked={selectedKeys.has(getProductKey(product, index))}
                  onChange={() => onToggleSelect(product, index)}
                />
              )}
            </Group>
            <ProductImage product={product} height={220} onPreview={() => onPreview(product)} />
            <ProductFields product={product} />
          </Stack>
        </Card>
      ))}
    </SimpleGrid>
  )
}

function RecommendationSourceBadge({ product }: { product: RecommendationProduct }) {
  const { t } = useI18n()

  if (product.RecommendationSource === 'repurchase') {
    return (
      <Tooltip label={t('Клієнт регулярно купує цей товар')}>
        <Badge color="blue" size="sm" variant="light">
          {t('Повторна закупівля')}
        </Badge>
      </Tooltip>
    )
  }

  if (product.RecommendationSource === 'discovery') {
    return (
      <Tooltip label={t('Схожі клієнти купують цей товар, а цей клієнт ще ні')}>
        <Badge color="grape" size="sm" variant="light">
          {t('Нове для клієнта')}
        </Badge>
      </Tooltip>
    )
  }

  return <span />
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
  const [failed, setFailed] = useState(false)
  const imageUrl = getRecommendationImageUrl(product)

  if (!imageUrl || failed) {
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
        onError={() => setFailed(true)}
      />
    </button>
  )
}

function ProductFields({ product }: { product: RecommendationProduct }) {
  const { t } = useI18n()
  const price = formatPrice(product)
  const availability = formatAvailability(product)

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
      {(price !== '-' || availability !== '-') && (
        <Group gap="xs" mt={4}>
          {price !== '-' && (
            <Text fw={600} size="sm">
              {price}
            </Text>
          )}
          {availability !== '-' && (
            <Text c={getAvailableQty(product) > 0 ? 'teal' : 'red'} size="sm">
              {availability === '0' ? t('Немає в наявності') : `${availability} ${t('шт')}`}
            </Text>
          )}
        </Group>
      )}
      {product.Description && (
        <Text c="dimmed" size="xs">
          {product.Description}
        </Text>
      )}
    </Stack>
  )
}

function getAvailableQty(product: RecommendationProduct): number {
  return (product.AvailableQtyUk ?? 0) + (product.AvailableQtyUkVAT ?? 0)
}

function formatAvailability(product: RecommendationProduct): string {
  if (typeof product.AvailableQtyUk !== 'number' && typeof product.AvailableQtyUkVAT !== 'number') {
    return '-'
  }

  return String(getAvailableQty(product))
}

function formatPrice(product: RecommendationProduct): string {
  const price = product.CurrentPrice

  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
    return '-'
  }

  return `€${price.toFixed(2)}`
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
