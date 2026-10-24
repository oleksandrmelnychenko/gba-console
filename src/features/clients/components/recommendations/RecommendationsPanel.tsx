import { useSingleFlight } from '../../../../shared/hooks/useSingleFlight'
import './recommendations-panel.css'
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Loader,
  Image,
  Select,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { Check, CircleAlert, Image as ImageIcon, Link as LinkIcon, ShoppingCart, X } from 'lucide-react'
import { useEffect, useReducer, useState } from 'react'
import { AiFeatureBadge } from '../../../../shared/ai/AiFeatureBadge'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { toProxiedAssetUrl } from '../../../../shared/url/proxiedAssetUrl'
import { AppModal } from '../../../../shared/ui/AppModal'
import { CREATE_ACTION_COLOR } from '../../../../shared/ui/page-header-actions/PageHeaderActions'
import { useAuth } from '../../../auth/useAuth'
import { PermissionKeys } from '../../../../shared/auth/permissionKeys'
import { NewSaleWizard, type NewSaleWizardPrefill } from '../../../sales-ukraine/components/new-sale-wizard/NewSaleWizard'
import { RecommendationAgreementScope } from './RecommendationAgreementScope'
import type { SalesUkraineClientAgreement, SalesUkraineProduct } from '../../../sales-ukraine/types'
import { OfferLinkModal } from '../../../sales-offers/components/OfferLinkModal'
import { useOfferFromRecommendations } from '../../../sales-offers/useOfferFromRecommendations'
import type { OfferClientAgreement } from '../../../sales-offers/types'
import {
  getMostPurchasedProductsByClientId,
  getProductById,
  getProductCoPurchaseRecommendations,
  sendRecommendationFeedback,
} from '../../api/clientRecommendationsApi'
import { getProductShopImageUrlByCode } from '../../../products/utils'
import type { RecommendationProduct } from '../../recommendationsTypes'
import type { Client, ClientAgreement } from '../../types'
import {
  canSelectRecommendationProduct,
  getRecommendationAvailableQty,
  hasRecommendationAvailabilityData,
} from './recommendationAvailability'
import { getRecommendationSourcePresentation } from './recommendationSourcePresentation'

type RecommendationsPanelProps = {
  client: Client
  productNetId?: string
}

type RecommendationsState = {
  error: string | null
  isLoading: boolean
  previewProduct: RecommendationProduct | null
  products: RecommendationProduct[]
  selectedKeys: ReadonlySet<string>
  selectedProduct: RecommendationProduct | null
}

type RecommendationsAction =
  | { type: 'failed'; error: string }
  | { type: 'loadedMostPurchased'; products: RecommendationProduct[] }
  | { type: 'loadedProductRecommendations'; products: RecommendationProduct[]; selectedProduct: RecommendationProduct | null }
  | { type: 'loading' }
  | { type: 'previewProduct'; product: RecommendationProduct | null }
  | { type: 'removeProduct'; key: string }
  | { type: 'toggleSelected'; key: string }

const initialRecommendationsState: RecommendationsState = {
  error: null,
  isLoading: true,
  previewProduct: null,
  products: [],
  selectedKeys: new Set(),
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
        selectedKeys: new Set(),
        selectedProduct: null,
      }
    case 'loadedMostPurchased':
      return {
        ...state,
        error: null,
        isLoading: false,
        products: action.products,
        selectedKeys: new Set(),
        selectedProduct: null,
      }
    case 'loadedProductRecommendations':
      return {
        ...state,
        error: null,
        isLoading: false,
        products: action.products,
        selectedKeys: new Set(),
        selectedProduct: action.selectedProduct,
      }
    case 'loading':
      return { ...state, error: null, isLoading: true, products: [], selectedProduct: null, selectedKeys: new Set() }
    case 'previewProduct':
      return { ...state, previewProduct: action.product }
    case 'removeProduct': {
      const selectedKeys = new Set(state.selectedKeys)
      selectedKeys.delete(action.key)

      return {
        ...state,
        products: state.products.filter((product, index) => getProductKey(product, index) !== action.key),
        selectedKeys,
      }
    }
    case 'toggleSelected': {
      const selectedKeys = new Set(state.selectedKeys)

      if (selectedKeys.has(action.key)) {
        selectedKeys.delete(action.key)
      } else {
        selectedKeys.add(action.key)
      }

      return { ...state, selectedKeys }
    }
  }
}

export function RecommendationsPanel(props: RecommendationsPanelProps) {
  return (
    <RecommendationAgreementScope clientNetId={props.client.NetUid || ''}>
      {(agreement) => <RecommendationsForAgreement {...props} agreement={agreement} />}
    </RecommendationAgreementScope>
  )
}

function RecommendationsForAgreement({
  client, productNetId, agreement,
}: RecommendationsPanelProps & { agreement: ClientAgreement }) {
  const runActionOnce = useSingleFlight()
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const [state, dispatch] = useReducer(recommendationsReducer, initialRecommendationsState)
  const { error, isLoading, previewProduct, products, selectedKeys, selectedProduct } = state
  const agreementNetId = agreement.NetUid || ''
  const [wizardPrefill, setWizardPrefill] = useState<NewSaleWizardPrefill | null>(null)
  const [offerValidDays, setOfferValidDays] = useState('2')
  const { clearCreatedOffer, createdOffer, createOfferFromSelection, isCreatingOffer } =
    useOfferFromRecommendations()

  const clientNetId = client.NetUid || ''
  const canCreateSale = hasPermission(PermissionKeys.SalesUkraine.Sale.Create)
  const canExcludeProduct = hasPermission(PermissionKeys.Clients.Recommendations.ExcludeProduct)
  const isVatSale = Boolean(agreement?.Agreement?.WithVATAccounting)
  const selectedCount = selectedKeys.size
  const createSaleDisabled = isLoading || !clientNetId || !agreementNetId || selectedCount === 0
  const createSaleDisabledReason = !agreementNetId
    ? t('Щоб створити продаж, додайте клієнту активний договір із цінами продажу')
      : selectedCount === 0
        ? t('Виберіть хоча б один товар')
        : ''

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const options = {
      signal: controller.signal,
      clientAgreementNetId: agreementNetId,
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
  }, [agreementNetId, clientNetId, productNetId, t])

  function toggleSelected(product: RecommendationProduct, index: number) {
    if (!canSelectRecommendationProduct(product, isVatSale)) {
      return
    }

    const key = getProductKey(product, index)
    dispatch({ key, type: 'toggleSelected' })
  }

  function getChosenProducts(): RecommendationProduct[] {
    return products.filter(
      (product, index) =>
        selectedKeys.has(getProductKey(product, index))
        && canSelectRecommendationProduct(product, isVatSale)
        && (product.Id ?? 0) > 0
        && product.NetUid,
    )
  }

  function openSaleWizard() {
    if (!clientNetId || !agreementNetId || !agreement) {
      return
    }

    setWizardPrefill({
      agreement: agreement as unknown as SalesUkraineClientAgreement,
      agreementNetId,
      client,
      clientNetId,
      products: getChosenProducts() as unknown as SalesUkraineProduct[],
    })
  }

  async function handleCreateOffer() {
    return runActionOnce('handleCreateOffer', async () => {
      if (!agreement) {
        return
      }

      const chosen = getChosenProducts()

      if (chosen.length > 0) {
        await createOfferFromSelection(
          agreement as unknown as OfferClientAgreement,
          chosen,
          Number(offerValidDays) || undefined,
        )
      }
    })
  }

  async function handleExcludeProduct(product: RecommendationProduct, index: number) {
    if (!canExcludeProduct || !clientNetId || !(product.Id ?? 0)) {
      return
    }

    const key = getProductKey(product, index)

    try {
      await sendRecommendationFeedback(clientNetId, [product.Id as number])
      dispatch({ key, type: 'removeProduct' })
      notifications.show({ color: 'green', message: t('Більше не пропонуватимемо цей товар клієнту') })
    } catch (feedbackError) {
      notifications.show({
        color: 'red',
        message: feedbackError instanceof Error ? feedbackError.message : t('Не вдалося зберегти відгук'),
      })
    }
  }


  return (
    <Stack className="client-recommendations" gap="sm" pos="relative">
      <Card className="app-section-card client-recommendations-card" withBorder radius="md" padding="md">
        <Stack gap="sm">
          <Group className="client-recommendations-toolbar" justify="space-between" align="center" wrap="wrap" gap="xs">
            <Group align="center" gap="xs" wrap="nowrap">
              <Text className="client-section-title" fw={600} size="sm">
                {t('Рекомендації')}
                {selectedProduct?.VendorCode ? ` - ${selectedProduct.VendorCode}` : ''}
              </Text>
              <AiFeatureBadge size="sm" tooltip={t('AI-рекомендації для клієнта')} />
            </Group>

            <Group className="client-recommendations-actions" gap="xs" align="end">
              {canCreateSale && (
                <Tooltip disabled={!createSaleDisabledReason} label={createSaleDisabledReason} withArrow>
                  <span>
                    <Button
                      color={CREATE_ACTION_COLOR}
                      disabled={createSaleDisabled}
                      leftSection={<ShoppingCart size={16} />}
                      size="sm"
                      variant="filled"
                      onClick={openSaleWizard}
                    >
                      {selectedCount > 0 ? `${t('Створити продаж')} (${selectedCount})` : t('Створити продаж')}
                    </Button>
                  </span>
                </Tooltip>
              )}
              {canCreateSale && (
                <Group gap={6} wrap="wrap" align="end">
                  <Tooltip disabled={!createSaleDisabledReason} label={createSaleDisabledReason} withArrow>
                    <span>
                      <Button
                        disabled={createSaleDisabled}
                        leftSection={<LinkIcon size={16} />}
                        loading={isCreatingOffer}
                        size="sm"
                        variant="default"
                        onClick={handleCreateOffer}
                      >
                        {selectedCount > 0 ? `${t('Створити пропозицію')} (${selectedCount})` : t('Створити пропозицію')}
                      </Button>
                    </span>
                  </Tooltip>
                  <Tooltip label={t('Термін дії пропозиції')} withArrow>
                    <Select
                      className="client-recommendations-term"
                      label={t('Термін пропозиції')}
                      allowDeselect={false}
                      data={[
                        { value: '1', label: `1 ${t('дн')}` },
                        { value: '2', label: `2 ${t('дн')}` },
                        { value: '7', label: `7 ${t('дн')}` },
                        { value: '14', label: `14 ${t('дн')}` },
                      ]}
                      size="sm"
                      value={offerValidDays}
                      onChange={(value) => setOfferValidDays(value ?? '2')}
                    />
                  </Tooltip>
                </Group>
              )}

            </Group>
          </Group>

          {error && (
            <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
              {error}
            </Alert>
          )}

          {isLoading ? (
            <Group role="status" gap="xs" py="md"><Loader size="sm" color="orange" /><Text size="sm" c="dimmed">{t('Завантаження рекомендацій')}</Text></Group>
          ) : !error && (
            <Stack gap="md">
              {selectedProduct && (
                <SelectedProductCard
                  product={selectedProduct}
                  onPreview={() => dispatch({ product: selectedProduct, type: 'previewProduct' })}
                />
              )}
              <RecommendationsList
                isVatSale={isVatSale}
                products={products}
                selectable={canCreateSale}
                selectedKeys={selectedKeys}
                onExclude={canExcludeProduct ? handleExcludeProduct : undefined}
                onPreview={(product) => dispatch({ product, type: 'previewProduct' })}
                onToggleSelect={toggleSelected}
              />
            </Stack>
          )}
        </Stack>
      </Card>

      <ProductImagePreviewModal product={previewProduct} onClose={() => dispatch({ product: null, type: 'previewProduct' })} />

      <OfferLinkModal offer={createdOffer} onClose={clearCreatedOffer} />

      {canCreateSale && (
        <NewSaleWizard
          canConvertMergedToBill={hasPermission(PermissionKeys.SalesUkraine.Sale.ConvertMergedToBill)}
          opened={Boolean(wizardPrefill)}
          permissionScopedSalesUkraineApi
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
        <Text fw={700}>{displayValue(product.VendorCode)}</Text>
        <Text size="sm">{displayValue(product.Name)}</Text>
      </Stack>
    </Card>
  )
}

function RecommendationsList({
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
      {products.map((product, index) => {
        const selected = selectedKeys.has(getProductKey(product, index))
        const available = getRecommendationAvailableQty(product, isVatSale)
        const hasAvailability = hasRecommendationAvailabilityData(product, isVatSale)
        const canSelect = canSelectRecommendationProduct(product, isVatSale)
        return (
          <article key={getProductKey(product, index)} className={`recommendation-product${selected ? ' is-selected' : ''}`}>
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
      })}
    </div>
  )
}

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
        onError={() => setFailed(true)}
      />
    </button>
  )
}

function formatPrice(product: RecommendationProduct): string {
  const price = product.CurrentPrice

  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
    return '-'
  }

  return `${new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(price)} EUR`
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
