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
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { CircleAlert, Image as ImageIcon, LayoutGrid, Link as LinkIcon, List, ShoppingCart, X } from 'lucide-react'
import { useEffect, useReducer, useState } from 'react'
import { AiFeatureBadge } from '../../../../shared/ai/AiFeatureBadge'
import { AiHistoryLineageNote } from '../../../../shared/ai/AiHistoryLineageNote'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { toProxiedAssetUrl } from '../../../../shared/url/proxiedAssetUrl'
import { AppModal } from '../../../../shared/ui/AppModal'
import { CREATE_ACTION_COLOR } from '../../../../shared/ui/page-header-actions/PageHeaderActions'
import { useAuth } from '../../../auth/useAuth'
import { SALES_UKRAINE_EDIT_PERMISSION } from '../../../sales-ukraine/permissions'
import { NewSaleWizard, type NewSaleWizardPrefill } from '../../../sales-ukraine/components/new-sale-wizard/NewSaleWizard'
import { getWizardClientAgreements } from '../../../sales-ukraine/components/new-sale-wizard/wizardClientStepApi'
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
import { OrbSplash } from '../../../../shared/ui/orb/Orb'
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
  isGrid: boolean
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
  | { type: 'toggleGrid' }
  | { type: 'toggleSelected'; key: string }

const initialRecommendationsState: RecommendationsState = {
  error: null,
  isGrid: false,
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
      return { ...state, error: null, isLoading: true, selectedKeys: new Set() }
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
    case 'toggleGrid':
      return { ...state, isGrid: !state.isGrid }
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

export function RecommendationsPanel({ client, productNetId }: RecommendationsPanelProps) {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const [state, dispatch] = useReducer(recommendationsReducer, initialRecommendationsState)
  const { error, isGrid, isLoading, previewProduct, products, selectedKeys, selectedProduct } = state
  const [agreement, setAgreement] = useState<ClientAgreement | null>(null)
  const [agreementNetId, setAgreementNetId] = useState<string | null>(null)
  const [agreementResolved, setAgreementResolved] = useState(false)
  const [wizardPrefill, setWizardPrefill] = useState<NewSaleWizardPrefill | null>(null)
  const [offerValidDays, setOfferValidDays] = useState('2')
  const { clearCreatedOffer, createdOffer, createOfferFromSelection, isCreatingOffer } =
    useOfferFromRecommendations()

  const clientNetId = client.NetUid || ''
  const canCreateSale = hasPermission(SALES_UKRAINE_EDIT_PERMISSION)
  const isVatSale = Boolean(agreement?.Agreement?.WithVATAccounting)
  const selectedCount = selectedKeys.size
  const createSaleDisabled = isLoading || !clientNetId || !agreementNetId || selectedCount === 0
  const createSaleDisabledReason = !agreementResolved
    ? t('Завантаження договору')
    : !agreementNetId
      ? t('Щоб створити продаж, додайте клієнту активний договір із цінами продажу')
      : selectedCount === 0
        ? t('Виберіть хоча б один товар')
        : ''

  useEffect(() => {
    let cancelled = false

    async function resolveAgreement() {
      setAgreementResolved(false)
      setAgreement(null)
      setAgreementNetId(null)

      try {
        const agreements = clientNetId ? await getWizardClientAgreements(clientNetId) : []
        const active = agreements.find((item) => item.Agreement?.IsActive) ?? agreements[0]

        if (!cancelled) {
          setAgreement(active ?? null)
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
  }

  async function handleExcludeProduct(product: RecommendationProduct, index: number) {
    if (!clientNetId || !(product.Id ?? 0)) {
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

  const firstRecommendation = products[0]
  const recommendationLineage =
    firstRecommendation?.RecommendationSourceHistoryStart &&
    firstRecommendation.RecommendationEffectiveStart &&
    typeof firstRecommendation.RecommendationHistoryComplete === 'boolean'
      ? {
          source_history_start: firstRecommendation.RecommendationSourceHistoryStart,
          effective_start: firstRecommendation.RecommendationEffectiveStart,
          history_complete: firstRecommendation.RecommendationHistoryComplete,
        }
      : null

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
                      {selectedCount > 0 ? `${t('Утворити продажу')} (${selectedCount})` : t('Утворити продажу')}
                    </Button>
                  </span>
                </Tooltip>
              )}
              {canCreateSale && (
                <Group gap={6} wrap="nowrap">
                  <Tooltip disabled={!createSaleDisabledReason} label={createSaleDisabledReason} withArrow>
                    <span>
                      <Button
                        disabled={createSaleDisabled}
                        leftSection={<LinkIcon size={16} />}
                        loading={isCreatingOffer}
                        size="sm"
                        variant="light"
                        onClick={handleCreateOffer}
                      >
                        {selectedCount > 0 ? `${t('Створити оферту')} (${selectedCount})` : t('Створити оферту')}
                      </Button>
                    </span>
                  </Tooltip>
                  <Tooltip label={t('Термін дії оферти')} withArrow>
                    <Select
                      allowDeselect={false}
                      data={[
                        { value: '1', label: `1 ${t('дн')}` },
                        { value: '2', label: `2 ${t('дн')}` },
                        { value: '7', label: `7 ${t('дн')}` },
                        { value: '14', label: `14 ${t('дн')}` },
                      ]}
                      size="sm"
                      value={offerValidDays}
                      w={86}
                      onChange={(value) => setOfferValidDays(value ?? '2')}
                    />
                  </Tooltip>
                </Group>
              )}
              <Tooltip label={isGrid ? t('Список') : t('Таблиця')}>
                <ActionIcon color="gray" variant="light" onClick={() => dispatch({ type: 'toggleGrid' })}>
                  {isGrid ? <List size={18} /> : <LayoutGrid size={18} />}
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
          {recommendationLineage && <AiHistoryLineageNote lineage={recommendationLineage} />}

          {error && (
            <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
              {error}
            </Alert>
          )}

          {isLoading ? (
            <OrbSplash label={t('Завантаження рекомендацій')} size={40} variant="thinking" />
          ) : selectedProduct ? (
            <SelectedProductCard
              isVatSale={isVatSale}
              product={selectedProduct}
              onPreview={() => dispatch({ product: selectedProduct, type: 'previewProduct' })}
            />
          ) : (
            <RecommendationsList
              isGrid={isGrid}
              isVatSale={isVatSale}
              products={products}
              selectable={canCreateSale}
              selectedKeys={selectedKeys}
              onExclude={canCreateSale ? handleExcludeProduct : undefined}
              onPreview={(product) => dispatch({ product, type: 'previewProduct' })}
              onToggleSelect={toggleSelected}
            />
          )}
        </Stack>
      </Card>

      <ProductImagePreviewModal product={previewProduct} onClose={() => dispatch({ product: null, type: 'previewProduct' })} />

      <OfferLinkModal offer={createdOffer} onClose={clearCreatedOffer} />

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
  isVatSale,
  product,
  onPreview,
}: {
  isVatSale: boolean
  product: RecommendationProduct
  onPreview: () => void
}) {
  return (
    <Card className="app-section-card" withBorder radius="md" padding="md">
      <Stack gap="sm">
        <ProductImage product={product} height={380} onPreview={onPreview} />
        <ProductFields isVatSale={isVatSale} product={product} />
      </Stack>
    </Card>
  )
}

function RecommendationsList({
  isGrid,
  isVatSale,
  products,
  selectable,
  selectedKeys,
  onExclude,
  onPreview,
  onToggleSelect,
}: {
  isGrid: boolean
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
            {onExclude && <Table.Th w={40} />}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {products.map((product, index) => (
            <Table.Tr key={getProductKey(product, index)}>
              {selectable && (
                <Table.Td>
                  <RecommendationCheckbox
                    checked={selectedKeys.has(getProductKey(product, index))}
                    isVatSale={isVatSale}
                    product={product}
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
              <Table.Td className="app-table-number">{formatPrice(product)}</Table.Td>
              <Table.Td className="app-table-number">{formatAvailability(product, isVatSale)}</Table.Td>
              <Table.Td>{displayValue(product.Description)}</Table.Td>
              {onExclude && (
                <Table.Td>
                  <ExcludeRecommendationButton onClick={() => onExclude(product, index)} />
                </Table.Td>
              )}
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
              <Group gap={6} wrap="nowrap">
                {onExclude && <ExcludeRecommendationButton onClick={() => onExclude(product, index)} />}
                {selectable && (
                  <RecommendationCheckbox
                    checked={selectedKeys.has(getProductKey(product, index))}
                    isVatSale={isVatSale}
                    product={product}
                    onChange={() => onToggleSelect(product, index)}
                  />
                )}
              </Group>
            </Group>
            <ProductImage product={product} height={220} onPreview={() => onPreview(product)} />
            <ProductFields isVatSale={isVatSale} product={product} />
          </Stack>
        </Card>
      ))}
    </SimpleGrid>
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

function RecommendationCheckbox({
  checked,
  isVatSale,
  product,
  onChange,
}: {
  checked: boolean
  isVatSale: boolean
  product: RecommendationProduct
  onChange: () => void
}) {
  const { t } = useI18n()
  const disabled = !canSelectRecommendationProduct(product, isVatSale)

  return (
    <Tooltip disabled={!disabled} label={t('Немає в наявності')} withArrow>
      <span>
        <Checkbox
          aria-label={disabled ? t('Немає в наявності') : t('Вибрати товар')}
          checked={!disabled && checked}
          disabled={disabled}
          onChange={onChange}
        />
      </span>
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

function ProductFields({ isVatSale, product }: { isVatSale: boolean; product: RecommendationProduct }) {
  const { t } = useI18n()
  const price = formatPrice(product)
  const availability = formatAvailability(product, isVatSale)

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
            <Text c={getRecommendationAvailableQty(product, isVatSale) > 0 ? 'teal' : 'red'} size="sm">
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

function formatAvailability(product: RecommendationProduct, isVatSale: boolean): string {
  if (!hasRecommendationAvailabilityData(product, isVatSale)) {
    return '-'
  }

  return String(getRecommendationAvailableQty(product, isVatSale))
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
