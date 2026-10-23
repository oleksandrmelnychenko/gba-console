import { ProductSourceHistoryRefresh } from '../../../shared/ui/product-movement-history/ProductSourceHistoryRefresh'
import { withProductSourceHistoryColumns } from '../../../shared/ui/product-movement-history/productSourceHistory'
import { ToolbarDateRangeFilter } from '../../../shared/ui/ToolbarDateRangeFilter'
import { TableChip } from '../../../shared/ui/TableChip'
import { PdfIcon } from '../../../shared/ui/PdfIcon'
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  FileInput,
  Group,
  Image,
  Loader,
  NumberInput,
  Popover,
  ScrollArea,
  Select,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core'
import { AppDrawer } from "../../../shared/ui/AppDrawer"
import { AppModal, AppModalFooter } from '../../../shared/ui/AppModal'
import { DocumentDetailChip, DocumentDetailLayout, DocumentDetailRow, DocumentDetailSection } from '../../../shared/ui/document-detail/DocumentDetail'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import { MovementDocumentTypeFilter } from '../../../shared/ui/product-movement-history/MovementDocumentTypeFilter'
import { useDataTableDensity } from '../../../shared/ui/data-table/useDataTableDensity'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { notifications } from '@mantine/notifications'
import { Archive, ArrowLeft, ArrowLeftRight, CalendarDays, Check, ChevronRight, CircleAlert, ClipboardList, FileText, History, Image as ImageIcon, Package, Plus, RefreshCw, Save, Sparkles, SquarePen, Trash2, TriangleAlert } from 'lucide-react'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { TableRowAction } from '../../../shared/ui/table-row-action'
import { DocumentExportModal } from '../../../shared/ui/document-export-modal/DocumentExportModal'
import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import './products.css'
import './product-detail-forms.css'
import { toProxiedAssetUrl } from '../../../shared/url/proxiedAssetUrl'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { realtimeEvents, useRealtimeEvent } from '../../../shared/realtime/events'
import { PermissionGate } from '../../auth/components/PermissionGate'
import { useAuth } from '../../auth/useAuth'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import {
  addOrUpdateProductWriteOffRule,
  addProductSpecificationCode,
  deleteProductWriteOffRule,
  exportProductMovementsDocument,
  getProductAuditEntities,
  getProductByNetId,
  getProductConsignmentRemainings,
  getProductGroupsByProductNetId,
  getProductMovements,
  getProductReservationByNetId,
  getProductStorageLocationHistory,
  getProductWriteOffRulesByProductGroupNetId,
  getProductWriteOffRulesByProductNetId,
  groupProductPlacementsForEditing,
  updateProduct,
  updateProductWithImages,
  updateProductPlacements,
} from '../api/productsApi'
import type {
  AuditEntity,
  CalculatedProductPrice,
  Product,
  ProductAuditField,
  ProductAvailability,
  ProductConsignmentRemaining,
  ProductGroup,
  ProductImage,
  ProductMovement,
  ProductMovementExportDocument,
  ProductPlacement,
  ProductReservation,
  ProductSiblingCard,
  ProductSpecification,
  ProductStorageLocationHistory,
  ProductWriteOffRule,
} from '../types'
import {
  displayValue,
  formatAmount,
  formatPrice,
  getBooleanBadgeColor,
  getProductCode,
  getProductGroupNames,
  getProductMainImage,
  getProductMainOriginalNumber,
  getProductOriginalNumbers,
  getProductTitle,
  isProductRealtimePayloadForProduct,
} from '../utils'
import { getProductPriceBreakdown } from '../productPricing'
import { canEditNativeProductClassification } from '../productNativeClassification'
import {
  PRODUCT_ANALYTICS_PERMISSION,
  PRODUCT_AUDIT_PERMISSION,
  PRODUCT_BALANCES_PERMISSION,
  PRODUCT_EDIT_PERMISSION,
  PRODUCT_MOVEMENT_EXPORT_PERMISSION,
  PRODUCT_MOVEMENT_PERMISSION,
  PRODUCT_PLACEMENT_EDIT_PERMISSION,
  PRODUCT_STORAGE_HISTORY_PERMISSION,
  PRODUCT_WRITE_OFF_CREATE_PERMISSION,
  PRODUCT_WRITE_OFF_DELETE_PERMISSION,
  PRODUCT_WRITE_OFF_PERMISSION,
} from '../permissions'
import { getProductAnalyticsId, ProductAnalyticsPanel } from '../components/ProductAnalyticsPanel'
import { ProductSiblingScopeControl } from '../components/ProductSiblingCards'
import { createProductSiblingCardColumn } from '../components/productSiblingCardColumn'
import { getProductSiblingRowKey, hasProductSiblingCards, type ProductSiblingScope } from '../productSiblings'
import {
  HistoricalSourceMovementPanel,
  InformationalMovementPanel,
} from '../../../shared/ui/product-movement-history/ProductMovementHistoryDrawers'

export type ProductDetailPanel =
  | 'analytics'
  | 'audit'
  | 'edit'
  | 'images'
  | 'movement'
  | 'remains'
  | 'specification'
  | 'storage-history'
  | 'writeoff'

const PRODUCT_IMAGE_ADD_PERMISSION = PermissionKeys.ProductsAssortment.Image.Upload
const PRODUCT_IMAGE_DELETE_PERMISSION = PermissionKeys.ProductsAssortment.Image.Delete
const PRODUCT_SPECIFICATION_CHANGE_PERMISSION = PermissionKeys.ProductsAssortment.Specification.Edit
type ProductWriteOffRuleScope = 'group' | 'product'

type ProductSpecificationDraft = {
  CustomsValue: number | ''
  Duty: number | ''
  SpecificationCode: string
  VATValue: number | ''
}

type ProductEditForm = {
  NativeIsService: boolean | null
  Description: string
  DescriptionUA: string
  IsForSale: boolean
  IsForZeroSale: boolean
  Notes: string
  NotesUA: string
  OrderStandard: string
  PackingStandard: string
  Size: string
  SynonymsUA: string
  Top: string
  Volume: string
  Weight: number | null
}

type SelectedProductImagePreview = {
  file: File
  url: string
}

type ProductPlacementGroup = {
  count: number
  key: string
  label: string
  qty: number
}

type ProductPlacementDraft = ProductPlacement & {
  DraftKey: string
}

const panelValues = new Set<ProductDetailPanel>([
  'analytics',
  'audit',
  'edit',
  'images',
  'movement',
  'remains',
  'specification',
  'storage-history',
  'writeoff',
])

const productAuditFieldOptions: Array<{ label: string; value: ProductAuditField }> = [
  { label: 'Опис', value: 'Description' },
  { label: 'Top', value: 'Top' },
  { label: 'Розмір', value: 'Size' },
  { label: "Об'єм", value: 'Volume' },
  { label: 'Вага', value: 'Weight' },
  { label: 'Пакування', value: 'PackingStandard' },
  { label: 'Оригінальні номери', value: 'MainOriginalNumber' },
  { label: 'Нотатки', value: 'Notes' },
  { label: 'Синоніми', value: 'Synonyms' },
]

const movementItemTypes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const movementItemTypeOptions: Array<{ label: string; value: number }> = [
  { label: 'Реалізація', value: 0 },
  { label: 'Повернення', value: 1 },
  { label: 'Акт редагування накладної', value: 2 },
  { label: 'Прихід товару', value: 3 },
  { label: 'Прихід на Україну', value: 4 },
  { label: 'Акт списання', value: 5 },
  { label: 'Повернення постачальнику', value: 6 },
  { label: 'Переміщення товару', value: 7 },
  { label: 'ВМД', value: 8 },
  { label: 'Tax Free', value: 9 },
  { label: 'Рух кошика', value: 10 },
  { label: 'Оприбуткування', value: 11 },
  { label: 'Акт редагування накладної (склад)', value: 12 },
]
const pageSizeOptions = ['20', '40', '60', '100']
const writeOffRuleTypeOptions = [
  { label: 'Списати по вазі', value: '0' },
  { label: 'Списати по ціні', value: '1' },
  { label: 'Списати по календарю', value: '2' },
]
const writeOffLocaleOptions = [{ label: 'Україна', value: 'uk' }]
const writeOffScopeOptions: Array<{ label: string; value: ProductWriteOffRuleScope }> = [
  { label: 'Товар', value: 'product' },
  { label: 'Група товарів', value: 'group' },
]
const movementTypeOptions = [
  { label: 'Загальний рух', value: '0' },
  { label: 'Бухгалтерський рух', value: '1' },
  { label: 'Управлінський рух', value: '2' },
]
const PRODUCT_MOVEMENT_DEFAULT_LOOKBACK_DAYS = 365
const noProductSiblingCards: ProductSiblingCard[] = []

const dateFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})
const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

export function ProductDetailPage() {
  return (
    <PermissionGate permissionKey={PermissionKeys.ProductsAssortment.Page.View} fallback={<ProductPermissionDeniedAlert />}>
      <ProductDetailPageContent />
    </PermissionGate>
  )
}

function ProductDetailPageContent() {
  const { t } = useI18n()
  const { netId } = useParams<{ netId?: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [product, setProduct] = useState<Product | null>(null)
  const [reservation, setReservation] = useState<ProductReservation>({})
  const [reservationError, setReservationError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setLoading] = useState(true)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const activePanel = useMemo(() => getPanelFromQuery(searchParams), [searchParams])

  useEffect(() => {
    if (searchParams.has('panel') && !activePanel) {
      setSearchParams((currentParams) => {
        const nextParams = new URLSearchParams(currentParams)
        nextParams.delete('panel')
        return nextParams
      }, { replace: true })
    }
  }, [activePanel, searchParams, setSearchParams])

  useEffect(() => {
    if (!netId) {
      return
    }

    const productNetId = netId
    let cancelled = false

    async function loadProduct() {
      setLoading(true)
      setError(null)
      setReservationError(null)

      try {
        const [nextProduct, nextReservationResult] = await Promise.all([
          getProductByNetId(productNetId),
          getProductReservationByNetId(productNetId)
            .then((value) => ({ error: null, value }))
            .catch((reservationLoadError: unknown) => ({
              error: reservationLoadError instanceof Error ? reservationLoadError.message : t('Не вдалося завантажити резерви товару'),
              value: {},
            })),
        ])

        if (!cancelled) {
          setProduct(nextProduct)
          setReservation(nextReservationResult.value)
          setReservationError(nextReservationResult.error)
        }
      } catch (loadError) {
        if (!cancelled) {
          setProduct(null)
          setReservation({})
          setReservationError(null)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити товар'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadProduct()

    return () => {
      cancelled = true
    }
  }, [netId, reloadKey, t])

  const mainImage = useMemo(() => getProductMainImage(product), [product])
  const originalNumbers = useMemo(() => getProductOriginalNumbers(product).slice(0, 8), [product])
  const prices = useMemo(() => product?.CalculatedPrices ?? [], [product])

  const openPanel = useCallback(
    (panel: ProductDetailPanel) => {
      setSearchParams((currentParams) => {
        const nextParams = new URLSearchParams(currentParams)
        nextParams.set('panel', panel)
        return nextParams
      })
    },
    [setSearchParams],
  )

  const closePanel = useCallback(() => {
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams)
      nextParams.delete('panel')
      return nextParams
    })
  }, [setSearchParams])

  const handleProductSaved = useCallback((nextProduct: Product | null) => {
    if (nextProduct) {
      setProduct(nextProduct)
      return
    }

    reload()
  }, [])
  const handleRealtimeProductUpdate = useCallback((payload: unknown) => {
    if (isProductRealtimePayloadForProduct(payload, product || { NetUid: netId })) {
      reload()
    }
  }, [netId, product])

  useRealtimeEvent(realtimeEvents.productReservationUpdated, handleRealtimeProductUpdate)

  if (!netId) {
    return <Navigate to="/products" replace />
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <Group align="flex-start" gap="sm" wrap="nowrap">
          <Tooltip label={t('Назад')}>
            <ActionIcon aria-label={t('Назад')} color="gray" variant="light" onClick={() => navigate('/products')}>
              <ArrowLeft size={18} />
            </ActionIcon>
          </Tooltip>
          <Box>
            <Text c={product && !product.VendorCode?.trim() ? 'dimmed' : undefined} fw={600} size="sm">
              {product ? getProductCode(product) : t('Товар')}
            </Text>
            <Text c="dimmed" size="sm">
              {product ? getProductTitle(product) : t('Завантаження')}
            </Text>
          </Box>
        </Group>
        <Group gap="xs" justify="flex-end">
          {product && (
            <ProductActionToolbar
              analyticsDisabled={getProductAnalyticsId(product) === null}
              openPanel={openPanel}
            />
          )}
          <Tooltip label={t('Оновити')}>
            <ActionIcon
              aria-label={t('Оновити')}
              color="gray"
              loading={isLoading}
              size={38}
              variant="light"
              onClick={() => reload()}
            >
              <RefreshCw size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {error && (
        <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
          {error}
        </Alert>
      )}

      {!error && !isLoading && !product && (
        <Alert color="yellow" icon={<CircleAlert size={18} />} variant="light">
          {t('Товар не знайдено')}
        </Alert>
      )}

      {product && (
        <>
          <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="md">
            <Card className="app-section-card" withBorder radius="md" padding="md">
              <Stack gap="sm">
                {mainImage?.ImageUrl ? (
                  <button
                    type="button"
                    style={{
                      background: 'transparent',
                      border: 0,
                      cursor: 'zoom-in',
                      padding: 0,
                      width: '100%',
                    }}
                    onClick={() => setPreviewImageUrl(mainImage.ImageUrl || null)}
                  >
                    <Image src={mainImage.ImageUrl} alt={getProductTitle(product)} radius="sm" fit="contain" h={220} />
                  </button>
                ) : (
                  <Box
                    h={220}
                    style={{
                      alignItems: 'center',
                      background: 'var(--mantine-color-gray-0)',
                      borderRadius: 'var(--mantine-radius-sm)',
                      display: 'flex',
                      justifyContent: 'center',
                    }}
                  >
                    <ImageIcon size={48} color="var(--mantine-color-gray-5)" />
                  </Box>
                )}
                <Group gap={6} wrap="wrap">
                  <Badge color={getBooleanBadgeColor(product.IsForSale)} variant="light">
                    {t('Для продажу')}
                  </Badge>
                  <Badge color={getBooleanBadgeColor(product.IsForWeb)} variant="light">
                    {t('Для сайту')}
                  </Badge>
                  <Badge color={getBooleanBadgeColor(product.IsForZeroSale)} variant="light">
                    {t('Нульовий продаж')}
                  </Badge>
                </Group>
              </Stack>
            </Card>

            <Card className="app-section-card" withBorder radius="md" padding="md">
              <Stack gap="xs">
                <Title order={4}>{t('Основне')}</Title>
                <InfoRow label="Код" value={getProductCode(product)} dimmed={!product.VendorCode?.trim()} />
                <InfoRow label="Назва" value={getProductTitle(product)} />
                <InfoRow label="Групи" value={getProductGroupNames(product)} />
                <InfoRow label="Оригінальний номер" value={getProductMainOriginalNumber(product)} />
                <InfoRow label="Одиниця" value={product.MeasureUnit?.Name} />
                <InfoRow label="Top" value={product.Top} />
              </Stack>
            </Card>

            <Card className="app-section-card" withBorder radius="md" padding="md">
                <ProductStockSummary
                  product={product}
                  reservation={reservation}
                  reservationError={reservationError}
                  onProductSaved={handleProductSaved}
                />
            </Card>
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
            <Card className="app-section-card" withBorder radius="md" padding="md">
              <Stack gap="xs">
                <Title order={4}>{t('Опис')}</Title>
                <InfoRow label="Опис" value={product.DescriptionUA || product.Description} multiline />
                <InfoRow label="Нотатки" value={product.NotesUA || product.Notes} multiline />
                <InfoRow label="Синоніми UA" value={product.SynonymsUA} />
              </Stack>
            </Card>

            <Card className="app-section-card" withBorder radius="md" padding="md">
              <Stack gap="xs">
                <Title order={4}>{t('Параметри')}</Title>
                <InfoRow label="Вага" value={formatAmount(product.Weight)} />
                <InfoRow label="Розмір" value={product.Size} />
                <InfoRow label="Об'єм" value={product.Volume} />
                <InfoRow label="Норма пакування" value={product.OrderStandard} />
                <InfoRow label="Пакування" value={product.PackingStandard} />
                <InfoRow label="УКТЗЕД" value={product.UCGFEA} />
              </Stack>
            </Card>
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
            <Card className="app-section-card" withBorder radius="md" padding="md">
              <Stack gap="xs">
                <Title order={4}>{t('Ціни')}</Title>
                <InfoRow mono label="EUR" value={formatPrice(product.CurrentPrice)} />
                <InfoRow mono label="Локальна" value={formatPrice(product.CurrentLocalPrice)} />
                <InfoRow mono label="EUR перепродаж" value={formatPrice(product.CurrentPriceReSale)} />
                <InfoRow mono label="Локальна перепродаж" value={formatPrice(product.CurrentLocalPriceReSale)} />
                {prices.length > 0 && (
                  <Stack gap={4} mt="xs">
                    {prices.map((price, index) => (
                      <PriceRow key={`${price.Pricing?.NetUid || price.Pricing?.Name || index}`} price={price} />
                    ))}
                  </Stack>
                )}
              </Stack>
            </Card>

            <Card className="app-section-card" withBorder radius="md" padding="md">
              <Stack gap="xs">
                <Title order={4}>{t('Номери')}</Title>
                {originalNumbers.length > 0 ? (
                  originalNumbers.map((item, index) => (
                    <InfoRow
                      key={`${item.NetUid || item.OriginalNumber?.NetUid || index}`}
                      label={item.IsMainOriginalNumber ? 'Основний' : 'Номер'}
                      value={item.OriginalNumber?.MainNumber || item.OriginalNumber?.Number}
                    />
                  ))
                ) : (
                  <Text c="dimmed" size="sm">
                    {t('Номерів не знайдено')}
                  </Text>
                )}
              </Stack>
            </Card>
          </SimpleGrid>

          <ProductActionDrawer
            activePanel={activePanel}
            product={product}
            onClose={closePanel}
            onProductSaved={handleProductSaved}
            onReload={() => reload()}
          />
          <ProductImageViewerModal
            imageUrl={previewImageUrl}
            title={getProductTitle(product)}
            onClose={() => setPreviewImageUrl(null)}
          />
        </>
      )}
    </Stack>
  )
}

function ProductActionToolbar({
  analyticsDisabled,
  openPanel,
}: {
  analyticsDisabled: boolean
  openPanel: (panel: ProductDetailPanel) => void
}) {
  const { t } = useI18n()

  return (
    <Group gap="xs" justify="flex-end">
      <PermissionGate permissionKey={PRODUCT_ANALYTICS_PERMISSION}>
        <Button
          aria-label={t('AI-аналітика товару')}
          color="orange"
          disabled={analyticsDisabled}
          h={38}
          leftSection={<Sparkles fill="currentColor" size={16} strokeWidth={0} />}
          px="sm"
          size="xs"
          onClick={() => openPanel('analytics')}
        >
          {t('AI-аналітика')}
        </Button>
      </PermissionGate>
      <PermissionGate permissionKey={PRODUCT_STORAGE_HISTORY_PERMISSION}>
        <Tooltip label={t('Історія місця зберігання')}>
          <ActionIcon aria-label={t('Історія місця зберігання')} color="gray" size={38} variant="light" onClick={() => openPanel('storage-history')}>
            <History size={18} />
          </ActionIcon>
        </Tooltip>
      </PermissionGate>
      <PermissionGate permissionKey={PRODUCT_AUDIT_PERMISSION}>
        <Tooltip label={t('Історія змін полів')}>
          <ActionIcon aria-label={t('Історія змін полів')} color="gray" size={38} variant="light" onClick={() => openPanel('audit')}>
            <ClipboardList size={18} />
          </ActionIcon>
        </Tooltip>
      </PermissionGate>
      <Tooltip label={t('Специфікація')}>
        <ActionIcon aria-label={t('Специфікація')} color="gray" size={38} variant="light" onClick={() => openPanel('specification')}>
          <FileText size={18} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label={t('Зображення')}>
        <ActionIcon aria-label={t('Зображення')} color="gray" size={38} variant="light" onClick={() => openPanel('images')}>
          <ImageIcon size={18} />
        </ActionIcon>
      </Tooltip>
      <PermissionGate permissionKey={PRODUCT_BALANCES_PERMISSION}>
        <Tooltip label={t('Залишки по партіям')}>
          <ActionIcon aria-label={t('Залишки по партіям')} color="gray" size={38} variant="light" onClick={() => openPanel('remains')}>
            <Package size={18} />
          </ActionIcon>
        </Tooltip>
      </PermissionGate>
      <PermissionGate permissionKey={PRODUCT_EDIT_PERMISSION}>
        <Tooltip label={t('Редагувати')}>
          <ActionIcon aria-label={t('Редагувати')} color="gray" size={38} variant="light" onClick={() => openPanel('edit')}>
            <SquarePen size={18} />
          </ActionIcon>
        </Tooltip>
      </PermissionGate>
      <PermissionGate permissionKey={PRODUCT_MOVEMENT_PERMISSION}>
        <Tooltip label={t('Рух товару')}>
          <ActionIcon aria-label={t('Рух товару')} color="gray" size={38} variant="light" onClick={() => openPanel('movement')}>
            <ArrowLeftRight size={18} />
          </ActionIcon>
        </Tooltip>
      </PermissionGate>
      <PermissionGate permissionKey={PRODUCT_WRITE_OFF_PERMISSION}>
        <Tooltip label={t('Правила списання')}>
          <ActionIcon aria-label={t('Правила списання')} color="gray" size={38} variant="light" onClick={() => openPanel('writeoff')}>
            <ClipboardList size={18} />
          </ActionIcon>
        </Tooltip>
      </PermissionGate>
    </Group>
  )
}

export function ProductImageViewerModal({
  imageUrl,
  onClose,
  title,
}: {
  imageUrl: string | null
  onClose: () => void
  title: string
}) {
  const { t } = useI18n()

  return (
    <AppModal centered opened={Boolean(imageUrl)} size="min(1100px, 96vw)" title={displayValue(title)} onClose={onClose}>
      {imageUrl ? (
        <Box
          style={{
            alignItems: 'center',
            display: 'flex',
            justifyContent: 'center',
            minHeight: 360,
          }}
        >
          <Image src={imageUrl} alt={displayValue(title)} fit="contain" mah="calc(100vh - 220px)" w="100%" />
        </Box>
      ) : (
        <Text c="dimmed" size="sm">
          {t('Зображення недоступне')}
        </Text>
      )}
    </AppModal>
  )
}

export function ProductStockSummary({
  combinedStockQty,
  onProductSaved,
  product,
  reservation,
  reservationError,
}: {
  combinedStockQty?: number | null
  onProductSaved?: (product: Product | null) => void
  product: Product
  reservation: ProductReservation
  reservationError: string | null
}) {
  const { t } = useI18n()
  const availabilityItems = product.ProductAvailabilities || []
  // Legacy "Всього" = the sum of the per-warehouse amounts (not a separate aggregate field).
  const warehousesTotal = availabilityItems.reduce((total, item) => total + (Number(item.Amount) || 0), 0)

  return (
    <Stack gap="xs">
      {reservationError && (
        <Alert color="yellow" icon={<CircleAlert size={18} />} variant="light">
          {reservationError}
        </Alert>
      )}
      <div className="product-stock-bar">
        {/* Static reserve fields, in the legacy stock-bar order. */}
        <TotalQtyTile label={t('В рахунку в ресейлі')} value={reservation.TotalProductReSaleQty} />
        {/* Hidden per request: <TotalQtyTile label={t('В рахунках в Польщі')} value={reservation.TotalReservedPL} /> */}
        <TotalQtyTile label={t('В рахунках в Україні')} value={reservation.TotalReservedUK} />
        {/* Hidden per request: <TotalQtyTile label={`${t('Резерв в корзині')} PL`} value={reservation.TotalCartReservedPL} /> */}
        <TotalQtyTile label={`${t('Резерв в корзині')} UK`} value={reservation.TotalCartReservedUK} />
        {/* Dynamic per-warehouse list (ProductAvailabilities). */}
        {availabilityItems.map((availability, index) => (
          <ProductAvailabilityPlacementRow
            availability={availability}
            key={`${availability.StorageId || availability.Storage?.Name || index}`}
            onProductSaved={onProductSaved}
          />
        ))}
        {/* Total = sum of the warehouse amounts (legacy "Всього"). */}
        <TotalQtyTile label={t('Всього')} value={warehousesTotal} />
        {typeof combinedStockQty === 'number' ? (
          <TotalQtyTile label={t('Разом на складах')} value={combinedStockQty} />
        ) : null}
      </div>
    </Stack>
  )
}

function ProductAvailabilityPlacementRow({
  availability,
  onProductSaved,
}: {
  availability: ProductAvailability
  onProductSaved?: (product: Product | null) => void
}) {
  const { t } = useI18n()
  const [opened, setOpened] = useState(false)
  const placements = availability.Storage?.ProductPlacements || []
  const hasPlacements = placements.length > 0
  const amount = Number(availability.Amount) || 0
  const content = (
    <Stack gap={0} style={{ cursor: hasPlacements ? 'pointer' : 'default', minWidth: 0 }}>
      <Group gap={6} align="center" wrap="nowrap">
        <Text className="app-money" size="xl" fw={700} lh={1.05}>
          {formatAmount(availability.Amount)}
        </Text>
        {amount > 0 && <span className="product-stock-dot" aria-hidden="true" />}
      </Group>
      <Text size="xs" c="dimmed" lh={1.2} lineClamp={2} title={displayValue(availability.Storage?.Name)}>
        {displayValue(availability.Storage?.Name)}
      </Text>
      {hasPlacements && (
        <Group className="product-stock-warehouse-hint" gap={4} wrap="nowrap">
          <Text size="xs">{t('Місця зберігання')}</Text>
          <ChevronRight size={13} aria-hidden="true" />
        </Group>
      )}
    </Stack>
  )

  if (!hasPlacements) {
    return content
  }

  return (
    <Popover offset={2} opened={opened} position="bottom-start" shadow="md" width={760} withinPortal onChange={setOpened}>
      <Popover.Target>
        <Box className="product-stock-warehouse" title={t('Місця зберігання')} role="button" tabIndex={0} aria-expanded={opened} aria-haspopup="dialog" aria-label={`${displayValue(availability.Storage?.Name)}: ${t('Місця зберігання')}`} onClick={() => setOpened((currentOpened) => !currentOpened)} onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            setOpened((currentOpened) => !currentOpened)
          }
        }}>
          {content}
        </Box>
      </Popover.Target>
      <Popover.Dropdown className="product-placement-popover" role="dialog" aria-label={t('Місця зберігання')}>
        <ProductPlacementEditor
          availability={availability}
          key={getProductPlacementsKey(placements)}
          onClose={() => setOpened(false)}
          onProductSaved={onProductSaved}
          placements={placements}
        />
      </Popover.Dropdown>
    </Popover>
  )
}

function ProductPlacementEditor({
  availability,
  onClose,
  onProductSaved,
  placements,
}: {
  availability: ProductAvailability
  onClose: () => void
  onProductSaved?: (product: Product | null) => void
  placements: ProductPlacement[]
}) {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const [drafts, setDrafts] = useState<ProductPlacementDraft[]>(() => cloneProductPlacements(placements))
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setEditing] = useState(false)
  const [isSaving, setSaving] = useState(false)
  const originalTotal = useMemo(() => sumProductPlacementQty(placements), [placements])
  const draftTotal = useMemo(() => sumProductPlacementQty(drafts), [drafts])
  const groupedPlacements = useMemo(() => groupProductPlacements(drafts), [drafts])
  const canEditPlacements = hasPermission(PRODUCT_PLACEMENT_EDIT_PERMISSION)

  function startEditing() {
    if (!canEditPlacements) {
      return
    }

    setDrafts(cloneProductPlacements(placements))
    setError(null)
    setEditing(true)
  }

  function cancelEditing() {
    setDrafts(cloneProductPlacements(placements))
    setError(null)
    setEditing(false)
  }

  function addPlacement() {
    setDrafts((currentDrafts) => [
      ...currentDrafts,
      {
        CellNumber: '',
        DraftKey: createProductPlacementDraftKey(),
        ProductId: availability.ProductId,
        Qty: 0,
        RowNumber: '',
        StorageId: availability.StorageId || availability.Storage?.Id,
        StorageNumber: '',
      },
    ])
  }

  function updatePlacementDraft(index: number, field: keyof ProductPlacement, value: string | number) {
    setDrafts((currentDrafts) =>
      currentDrafts.map((draft, draftIndex) => (
        draftIndex === index
          ? {
              ...draft,
              [field]: value,
            }
          : draft
      )),
    )
  }

  function removeLocalPlacement(index: number) {
    setDrafts((currentDrafts) => currentDrafts.filter((draft, draftIndex) => draftIndex !== index || isPersistedPlacement(draft)))
  }

  async function savePlacements() {
    if (!canEditPlacements) {
      return
    }

    if (Math.abs(draftTotal - originalTotal) > 0.00001) {
      setError(t('Сума кількості по місцях має збігатися із залишком складу'))
      return
    }

    setSaving(true)
    setError(null)

    try {
      const savedPlacements = await updateProductPlacements(drafts.map(stripProductPlacementDraft))
      setDrafts(cloneProductPlacements(savedPlacements))
      notifications.show({ color: 'green', message: t('Місця зберігання збережено') })
      setEditing(false)
      onClose()
      onProductSaved?.(null)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти місця зберігання'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Stack className="product-placement-editor" gap="sm">
      <Group className="product-placement-editor__header" justify="space-between" gap="sm" wrap="nowrap">
        <Group gap={6} style={{ minWidth: 0 }}>
          <TableChip tone="storage" value={displayValue(availability.Storage?.Name)} />
          <TableChip tone="product" value={displayValue(availability.Storage?.Organization?.Name)} />
        </Group>
        <Group gap="xs" wrap="nowrap">
          <TableChip tone={Math.abs(draftTotal - originalTotal) > 0.00001 ? 'danger' : 'success'} value={`${formatAmount(draftTotal)} / ${formatAmount(originalTotal)}`} />
          {!isEditing ? (
            <PermissionGate permissionKey={PRODUCT_PLACEMENT_EDIT_PERMISSION}>
              <Button color={CREATE_ACTION_COLOR} size="xs" variant="default" leftSection={<SquarePen size={14} />} onClick={startEditing}>
                {t('Редагувати')}
              </Button>
            </PermissionGate>
          ) : null}
        </Group>
      </Group>

      {error ? (
        <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
          {error}
        </Alert>
      ) : null}

      {isEditing && canEditPlacements ? (
        <Stack className="product-placement-editor__edit-shell" gap="xs">
          <ScrollArea.Autosize className="product-placement-editor__scroll" mah="min(320px, calc(100vh - 360px))" type="auto">
            <Table className="app-static-table product-placement-editor__table" miw={680}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('Стелаж')}</Table.Th>
                  <Table.Th>{t('Ряд')}</Table.Th>
                  <Table.Th>{t('Комірка')}</Table.Th>
                  <Table.Th ta="right">{t('Кількість')}</Table.Th>
                  <Table.Th w={44} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {drafts.map((placement, index) => (
                  <Table.Tr key={placement.DraftKey}>
                    <Table.Td>
                      <TextInput
                        className="product-placement-editor__field"
                        maxLength={5}
                        size="xs"
                        value={placement.StorageNumber || ''}
                        onChange={(event) => updatePlacementDraft(index, 'StorageNumber', event.currentTarget.value)}
                      />
                    </Table.Td>
                    <Table.Td>
                      <TextInput
                        className="product-placement-editor__field"
                        maxLength={5}
                        size="xs"
                        value={placement.RowNumber || ''}
                        onChange={(event) => updatePlacementDraft(index, 'RowNumber', event.currentTarget.value)}
                      />
                    </Table.Td>
                    <Table.Td>
                      <TextInput
                        className="product-placement-editor__field"
                        maxLength={5}
                        size="xs"
                        value={placement.CellNumber || ''}
                        onChange={(event) => updatePlacementDraft(index, 'CellNumber', event.currentTarget.value)}
                      />
                    </Table.Td>
                    <Table.Td className="app-table-number">
                      <NumberInput
                        className="product-placement-editor__field product-placement-editor__field--qty"
                        hideControls
                        min={0}
                        size="xs"
                        value={placement.Qty || 0}
                        onChange={(value) => updatePlacementDraft(index, 'Qty', readPlacementNumber(value))}
                      />
                    </Table.Td>
                    <Table.Td>
                      <TableRowAction
                        action="delete"
                        disabled={isPersistedPlacement(placement)}
                        label={t('Видалити новий рядок')}
                        onClick={() => removeLocalPlacement(index)}
                      />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea.Autosize>
          <Group className="product-placement-editor__footer" justify="space-between" gap="sm">
            <Button color={CREATE_ACTION_COLOR} size="xs" leftSection={<Plus size={14} />} onClick={addPlacement}>
              {t('Додати місце')}
            </Button>
            <Group gap="xs">
              <Button size="xs" color="gray" variant="default" disabled={isSaving} onClick={cancelEditing}>
                {t('Скасувати')}
              </Button>
              <Button size="xs" color={CREATE_ACTION_COLOR} leftSection={<Save size={14} />} loading={isSaving} onClick={() => void savePlacements()}>
                {t('Зберегти')}
              </Button>
            </Group>
          </Group>
        </Stack>
      ) : (
        <ScrollArea.Autosize className="product-placement-editor__scroll" mah="min(300px, calc(100vh - 320px))" type="auto">
          <Table className="app-static-table product-placement-editor__table product-placement-editor__table--readonly" miw={540}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('Місце')}</Table.Th>
                <Table.Th ta="right">{t('Кількість')}</Table.Th>
                <Table.Th ta="right">{t('Партій')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {groupedPlacements.map((placementGroup) => (
                <Table.Tr key={placementGroup.key}>
                  <Table.Td><TableChip tone="storage" value={placementGroup.label} /></Table.Td>
                  <Table.Td className="app-table-number" ta="right">{formatAmount(placementGroup.qty)}</Table.Td>
                  <Table.Td className="app-table-number" ta="right">{placementGroup.count}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea.Autosize>
      )}
    </Stack>
  )
}

function TotalQtyTile({ label, value }: { label: string; value?: number | null }) {
  const numeric = Number(value) || 0

  return (
    <Stack gap={0} style={{ minWidth: 0 }}>
      <Group gap={6} align="center" wrap="nowrap">
        <Text className="app-money" size="xl" fw={700} lh={1.05}>
          {formatAmount(value)}
        </Text>
        {numeric > 0 && <span className="product-stock-dot" aria-hidden="true" />}
      </Group>
      <Text size="xs" c="dimmed" lh={1.2} lineClamp={2}>
        {label}
      </Text>
    </Stack>
  )
}

export function ProductActionDrawer({
  activePanel,
  onClose,
  onProductSaved,
  onReload,
  product,
  siblingCards = noProductSiblingCards,
}: {
  activePanel: ProductDetailPanel | null
  onClose: () => void
  onProductSaved: (product: Product | null) => void
  onReload: () => void
  product: Product
  siblingCards?: ProductSiblingCard[]
}) {
  const { t } = useI18n()

  if (activePanel === 'edit') {
    return (
      <AppModal opened title={t('Редагувати товар')} size={800} onClose={onClose} className="product-edit-modal app-compact-form" closeOnClickOutside={false}>
        <PermissionGate permissionKey={PRODUCT_EDIT_PERMISSION} fallback={<ProductPermissionDeniedAlert />}>
          <ProductEditPanel key={getProductPanelKey(product)} product={product} onProductSaved={onProductSaved} onClose={onClose} />
        </PermissionGate>
      </AppModal>
    )
  }

  if (activePanel === 'images') {
    return (
      <AppModal opened title={t('Зображення')} size={760} onClose={onClose} className="product-images-modal app-compact-form" closeOnClickOutside={false}>
        <ProductImagesPanel key={getProductPanelKey(product)} product={product} onProductSaved={onProductSaved} />
      </AppModal>
    )
  }

  if (activePanel === 'specification') {
    return (
      <AppModal opened title={t('Специфікація')} size={800} onClose={onClose} className="product-specification-modal app-compact-form" closeOnClickOutside={false}>
        <ProductSpecificationPanel key={getProductPanelKey(product)} product={product} onProductSaved={onProductSaved} onClose={onClose} />
      </AppModal>
    )
  }

  return (
    <AppDrawer
      opened={Boolean(activePanel)}
      position="right"
      size={activePanel === 'analytics' ? 'standard' : 'min(1180px, 100vw)'}
      // Shared form/detail-sheet scope: mono button captions, §9 field chrome,
      // orange checkboxes, mono combos/numbers/dates, borderless-shadow cards.
      classNames={{ body: 'app-form-sheet' }}
      className={activePanel === 'storage-history' || activePanel === 'remains' || activePanel === 'movement' || activePanel === 'writeoff' ? 'product-data-drawer' : undefined}
      title={activePanel ? <span className="app-sheet-title-mono">{getPanelTitle(activePanel, t)}</span> : ''}
      onClose={onClose}
    >
      {activePanel === 'analytics' && (
        <PermissionGate permissionKey={PRODUCT_ANALYTICS_PERMISSION} fallback={<ProductPermissionDeniedAlert />}>
          <ProductAnalyticsPanel key={getProductPanelKey(product)} product={product} />
        </PermissionGate>
      )}
      {activePanel === 'audit' && (
        <PermissionGate permissionKey={PRODUCT_AUDIT_PERMISSION} fallback={<ProductPermissionDeniedAlert />}>
          <ProductAuditPanel key={getProductPanelKey(product)} product={product} />
        </PermissionGate>
      )}
      {activePanel === 'movement' && (
        <PermissionGate permissionKey={PRODUCT_MOVEMENT_PERMISSION} fallback={<ProductPermissionDeniedAlert />}>
          <ProductDataSheet className="product-movement-sheet" product={product}>
            <ProductMovementPanel product={product} siblingCards={siblingCards} />
          </ProductDataSheet>
        </PermissionGate>
      )}
      {activePanel === 'remains' && (
        <PermissionGate permissionKey={PRODUCT_BALANCES_PERMISSION} fallback={<ProductPermissionDeniedAlert />}>
          <ProductDataSheet product={product}>
            <ProductConsignmentRemainingsPanel product={product} />
          </ProductDataSheet>
        </PermissionGate>
      )}
      {activePanel === 'storage-history' && (
        <PermissionGate permissionKey={PRODUCT_STORAGE_HISTORY_PERMISSION} fallback={<ProductPermissionDeniedAlert />}>
          <ProductDataSheet product={product}>
            <ProductStorageHistoryPanel product={product} />
          </ProductDataSheet>
        </PermissionGate>
      )}
      {activePanel === 'writeoff' && (
        <PermissionGate permissionKey={PRODUCT_WRITE_OFF_PERMISSION} fallback={<ProductPermissionDeniedAlert />}>
          <ProductDataSheet className="product-writeoff-sheet" product={product}>
            <ProductWriteOffRulesPanel product={product} onChanged={onReload} />
          </ProductDataSheet>
        </PermissionGate>
      )}
    </AppDrawer>
  )
}

function ProductPermissionDeniedAlert() {
  const { t } = useI18n()

  return (
    <Alert color="yellow" icon={<CircleAlert size={18} />} variant="light">
      {t('Недостатньо прав для цієї дії')}
    </Alert>
  )
}

function ProductEditPanel({ onClose, onProductSaved, product }: { onClose: () => void; onProductSaved: (product: Product | null) => void; product: Product }) {
  const { t } = useI18n()
  const [form, setForm] = useState<ProductEditForm>(() => createProductEditForm(product))
  const canEditClassification = canEditNativeProductClassification(product)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setSaving] = useState(false)

  function setField<K extends keyof ProductEditForm>(field: K, value: ProductEditForm[K]) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)

    try {
        const nextProduct = await updateProduct({
          ...product,
          ...(canEditClassification ? { NativeIsService: form.NativeIsService } : {}),
          Description: form.Description,
          DescriptionUA: form.DescriptionUA,
          IsForSale: form.IsForSale,
          IsForZeroSale: form.IsForZeroSale,
          Notes: form.Notes,
          NotesUA: form.NotesUA,
          OrderStandard: form.OrderStandard,
        PackingStandard: form.PackingStandard,
        Size: form.Size,
          SynonymsUA: form.SynonymsUA,
          Top: form.Top,
          Volume: form.Volume,
          Weight: form.Weight,
        })

      onProductSaved(nextProduct)
      notifications.show({ color: 'green', message: t('Товар збережено') })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти товар'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form id="product-edit-drawer-form" className="app-compact-form" onSubmit={submitForm}>
      <Stack gap={10}>
        <Group className="product-edit-identity" gap={8} wrap="wrap">
          <TableChip tone="product" value={getProductCode(product)} />
          <Text size="sm" fw={600}>{getProductTitle(product)}</Text>
        </Group>
        <div className="product-edit-fields">

          {error && (
            <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
              {error}
            </Alert>
          )}
          <Card className="app-section-card product-edit-section" withBorder radius="md" padding="sm">
            <Text className="app-section-title" mb={8}>{t('Характеристики')}</Text>
            <SimpleGrid cols={{ base: 1, xs: 2, sm: 3 }} spacing={10} verticalSpacing={10} style={{ alignItems: 'end' }}>
              {canEditClassification && (
                <Select
                  label={t('Тип позиції')}
                  data={[
                    ...(form.NativeIsService === null ? [{ value: 'unknown', label: t('Не визначено') }] : []),
                    { value: 'goods', label: t('Товар') },
                    { value: 'service', label: t('Послуга') },
                  ]}
                  value={form.NativeIsService === null ? 'unknown' : form.NativeIsService ? 'service' : 'goods'}
                  allowDeselect={false}
                  disabled={isSaving}
                  onChange={(value) => {
                    if (value === 'goods' || value === 'service') setField('NativeIsService', value === 'service')
                  }}
                />
              )}
              <TextInput label={t('Top')} value={form.Top} maxLength={3} onChange={(event) => setField('Top', event.currentTarget.value)} />
              <TextInput label={t('Розмір')} value={form.Size} onChange={(event) => setField('Size', event.currentTarget.value)} />
              <TextInput label={t("Об'єм")} value={form.Volume} onChange={(event) => setField('Volume', event.currentTarget.value)} />
              <NumberInput hideControls label={t('Вага')} value={form.Weight ?? ''} min={0} onChange={(value) => setField('Weight', typeof value === 'number' ? value : null)} />
              <TextInput label={t('Норма пакування')} value={form.OrderStandard} onChange={(event) => setField('OrderStandard', event.currentTarget.value)} />
              <TextInput label={t('Пакування')} value={form.PackingStandard} onChange={(event) => setField('PackingStandard', event.currentTarget.value)} />
              <TextInput label={t('Синоніми UA')} value={form.SynonymsUA} onChange={(event) => setField('SynonymsUA', event.currentTarget.value)} />
            </SimpleGrid>
          </Card>
          <Card className="app-section-card product-edit-section" withBorder radius="md" padding="sm">
            <Text className="app-section-title" mb={8}>{t('Опис та нотатки')}</Text>
            <SimpleGrid cols={{ base: 1, xs: 2 }} spacing={10} verticalSpacing={10} style={{ alignItems: 'end' }}>
              <Textarea autosize minRows={2} maxRows={5} label={t('Опис')} value={form.Description} onChange={(event) => setField('Description', event.currentTarget.value)} />
              <Textarea autosize minRows={2} maxRows={5} label={t('Опис UA')} value={form.DescriptionUA} onChange={(event) => setField('DescriptionUA', event.currentTarget.value)} />
              <Textarea autosize minRows={2} maxRows={5} label={t('Нотатки')} value={form.Notes} onChange={(event) => setField('Notes', event.currentTarget.value)} />
              <Textarea autosize minRows={2} maxRows={5} label={t('Нотатки UA')} value={form.NotesUA} onChange={(event) => setField('NotesUA', event.currentTarget.value)} />
            </SimpleGrid>
          </Card>
          <Group className="product-edit-flags" gap={12}>
            <Checkbox checked={form.IsForZeroSale} label={t('Нульовий продаж')} onChange={(event) => setField('IsForZeroSale', event.currentTarget.checked)} />
            <Checkbox checked={form.IsForSale} label={t('Для продажу')} onChange={(event) => setField('IsForSale', event.currentTarget.checked)} />
          </Group>
        </div>
        <AppModalFooter>
          <Button variant="default" onClick={onClose} disabled={isSaving}>{t('Скасувати')}</Button>
          <Button color={CREATE_ACTION_COLOR} leftSection={<Save size={16} />} loading={isSaving} type="submit">{t('Зберегти')}</Button>
        </AppModalFooter>
      </Stack>
    </form>
  )
}


function ProductImagesPanel({ onProductSaved, product }: { onProductSaved: (product: Product | null) => void; product: Product }) {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const [images, setImages] = useState<ProductImage[]>(() => [...(product.ProductImages || [])])
  const [files, setFiles] = useState<File[]>([])
  const [filePreviews, setFilePreviews] = useState<SelectedProductImagePreview[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setSaving] = useState(false)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
  const originalImages = product.ProductImages || []
  const hasExistingImageChanges = images.some((image, index) => image !== originalImages[index])
  const hasChanges = files.length > 0 || hasExistingImageChanges
  const canSaveChanges =
    (!files.length || hasPermission(PRODUCT_IMAGE_ADD_PERMISSION)) &&
    (!hasExistingImageChanges || hasPermission(PRODUCT_IMAGE_DELETE_PERMISSION))
  const displayedImages = images.reduce<Array<{ image: ProductImage; index: number }>>((currentImages, image, index) => {
    if (!image.Deleted || (image.Deleted && !originalImages[index]?.Deleted)) {
      currentImages.push({ image, index })
    }

    return currentImages
  }, [])

  useEffect(() => {
    return () => {
      revokeFilePreviewUrls(filePreviews.map((preview) => preview.url))
    }
  }, [filePreviews])

  function makeMain(image: ProductImage) {
    const imageKey = getProductImageKey(image)

    setImages((currentImages) =>
      currentImages.map((item) => ({
        ...item,
        IsMainImage: imageKey ? getProductImageKey(item) === imageKey : item === image,
      })),
    )
  }

  function removeImage(image: ProductImage) {
    const imageKey = getProductImageKey(image)

    setImages((currentImages) =>
      currentImages.map((item) =>
        (imageKey ? getProductImageKey(item) === imageKey : item === image)
          ? {
              ...item,
              Deleted: true,
            }
          : item,
      ),
    )
  }

  function updateSelectedFiles(nextFiles: File[]) {
    const nextPreviews = nextFiles.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }))

    setFiles(nextFiles)
    setFilePreviews(nextPreviews)
  }

  function resetImageChanges() {
    setImages([...originalImages])
    updateSelectedFiles([])
    setError(null)
  }

  async function saveImages() {
    setSaving(true)
    setError(null)

    try {
      const nextProduct = await updateProductWithImages(
        {
          ...product,
          ProductImages: images,
        },
        files,
        files.length > 0 && hasExistingImageChanges
          ? 'upload-and-delete'
          : files.length > 0
            ? 'upload'
            : 'delete',
      )

      onProductSaved(nextProduct)
      if (nextProduct) {
        setImages([...(nextProduct.ProductImages || [])])
      }
      updateSelectedFiles([])
      notifications.show({ color: 'green', message: t('Зображення збережено') })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти зображення'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Stack className="product-images-panel" gap={10}>
      <Group className="product-images-identity" gap={10} wrap="wrap">
        <TableChip tone="product" value={getProductCode(product)} />
        <Text fw={600} c="dark">{getProductTitle(product)}</Text>
      </Group>

      {error && (
        <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
          {error}
        </Alert>
      )}
      <PermissionGate permissionKey={PRODUCT_IMAGE_ADD_PERMISSION}>
        <Card className="app-section-card product-images-upload" withBorder radius="md" p="sm">
          <Text className="app-section-title" mb={10}>{t('Додати зображення')}</Text>
          <FileInput
            multiple
            clearable
            accept="image/*"
            aria-label={t('Додати зображення')}
            leftSection={<ImageIcon size={18} />}
            disabled={isSaving}
            placeholder={t('Оберіть файли')}
            value={files}
            onChange={(nextFiles) => updateSelectedFiles(nextFiles || [])}
          />
        </Card>
      </PermissionGate>
      {displayedImages.length === 0 && filePreviews.length === 0 ? (
        <div className="product-images-empty">
          <ImageIcon size={32} strokeWidth={1.5} aria-hidden="true" />
          <Text fw={600}>{t('Зображень не знайдено')}</Text>
          {hasPermission(PRODUCT_IMAGE_ADD_PERMISSION) && <Text size="sm">{t('Оберіть файли, щоб додати фото товару')}</Text>}
        </div>
      ) : (
        <SimpleGrid className="product-images-gallery" cols={{ base: 1, xs: 2, md: 3 }} spacing={10}>
          {displayedImages.map(({ image, index }) => (
            <Box
              key={`${image.NetUid || image.FileName || index}`}
              className="product-image-card"
              data-deleted={image.Deleted || undefined}
            >
              <Stack gap={10}>
                <button
                  type="button"
                  className="product-image-preview"
                  aria-label={t('Переглянути зображення')}
                  onClick={() => setPreviewImageUrl(toProxiedAssetUrl(image.ImageUrl) || null)}
                >
                  <Image src={toProxiedAssetUrl(image.ImageUrl)} alt={image.FileName || getProductTitle(product)} h={160} fit="contain" radius="sm" />
                </button>
                <Group justify="space-between" gap="xs" wrap="nowrap">
                  <TableChip tone={image.Deleted ? 'danger' : image.IsMainImage ? 'success' : 'neutral'} value={image.Deleted ? t('Буде видалено') : image.IsMainImage ? t('Головне') : t('Зображення')} />
                  <PermissionGate permissionKey={PRODUCT_IMAGE_DELETE_PERMISSION}>
                    <Group gap={4} wrap="nowrap">
                      <Tooltip label={t('Зробити головним')}>
                        <ActionIcon aria-label={t('Зробити головним')} color="gray" variant="subtle" disabled={isSaving || image.Deleted || image.IsMainImage} onClick={() => makeMain(image)}>
                          <Check size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label={t('Видалити')}>
                        <ActionIcon aria-label={t('Видалити')} color="red" variant="subtle" disabled={isSaving || image.Deleted} onClick={() => removeImage(image)}>
                          <Trash2 size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </PermissionGate>
                </Group>
              </Stack>
            </Box>
          ))}
          {filePreviews.map((preview) => (
            <Box
              key={preview.url}
              className="product-image-card"
            >
              <Stack gap={10}>
                <button
                  type="button"
                  className="product-image-preview"
                  aria-label={t('Переглянути зображення')}
                  onClick={() => setPreviewImageUrl(preview.url)}
                >
                  <Image src={preview.url} alt={preview.file.name || getProductTitle(product)} h={160} fit="contain" radius="sm" />
                </button>
                <Group justify="space-between" gap="xs" wrap="nowrap">
                  <TableChip tone="document" value={t('Нове')} />
                  <Text size="xs" c="dark" truncate="end">
                    {preview.file.name}
                  </Text>
                </Group>
              </Stack>
            </Box>
          ))}
        </SimpleGrid>
      )}
      <AppModalFooter>
        <Button variant="default" color="gray" disabled={!hasChanges || isSaving} onClick={resetImageChanges}>
          {t('Скасувати')}
        </Button>
        <Button color={CREATE_ACTION_COLOR} leftSection={<Save size={16} />} loading={isSaving} disabled={!hasChanges || !canSaveChanges} onClick={saveImages}>
          {t('Зберегти')}
        </Button>
      </AppModalFooter>
      <ProductImageViewerModal
        imageUrl={previewImageUrl}
        title={getProductTitle(product)}
        onClose={() => setPreviewImageUrl(null)}
      />
    </Stack>
  )
}

function ProductAuditPanel({ product }: { product: Product }) {
  const { t } = useI18n()
  const productNetUid = product.NetUid?.trim()
  const [field, setField] = useState<ProductAuditField>('Description')
  const [entries, setEntries] = useState<AuditEntity[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setLoading] = useState(false)
  const missingNetUidError = productNetUid ? null : t('У товару немає NetUid для завантаження історії змін')
  const activeError = missingNetUidError || error

  useEffect(() => {
    if (!productNetUid) {
      return
    }

    let cancelled = false
    const netUid = productNetUid
    const auditField = field

    async function loadEntries() {
      setLoading(true)
      setError(null)

      try {
        const nextEntries = await getProductAuditEntities(netUid, auditField)

        if (!cancelled) {
          setEntries(nextEntries)
        }
      } catch (loadError) {
        if (!cancelled) {
          setEntries([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити історію змін'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadEntries()

    return () => {
      cancelled = true
    }
  }, [field, productNetUid, t])

  return (
    <Stack className="product-audit-panel app-compact-form" gap={10}>
      <Select
        data={productAuditFieldOptions.map((option) => ({ ...option, label: t(option.label) }))}
        label={t('Поле')}
        value={field}
        w={260}
        maw="100%"
        onChange={(value) => setField((value as ProductAuditField) || 'Description')}
      />
      {activeError && <Alert color={missingNetUidError ? 'yellow' : 'red'} icon={<CircleAlert size={18} />} variant="light">{activeError}</Alert>}
      {isLoading ? (
        <LoadingState label={t('Завантаження історії змін')} />
      ) : entries.length === 0 && !activeError ? (
        <Text c="dimmed" size="sm">{t('Історію змін не знайдено')}</Text>
      ) : !activeError ? (
        <Stack gap="xs">
          {entries.map((entry, index) => (
            <Box
              key={`${entry.NetUid || entry.Id || index}`}
              style={{
                border: '1px solid var(--mantine-color-gray-2)',
                borderRadius: 6,
                padding: '8px 10px',
              }}
            >
              <Text size="sm" style={{ overflowWrap: 'anywhere' }}>{displayValue(entry.NewValues?.[0]?.Value)}</Text>
              <Group justify="space-between" gap={8} wrap="wrap" mt={6}>
                <TableChip tone="warning" value={entry.UpdatedBy} />
                <Text className="product-audit-date" size="xs">{formatDate(entry.Created)}</Text>
              </Group>
            </Box>
          ))}
        </Stack>
      ) : null}
    </Stack>
  )
}

function ProductSpecificationPanel({
  onClose,
  onProductSaved,
  product,
}: {
  onClose: () => void
  onProductSaved: (product: Product | null) => void
  product: Product
}) {
  const { t } = useI18n()
  const { user } = useAuth()
  const specifications = useMemo(
    () => dedupeSpecificationsByCodeAndRate(sortSpecificationsByCreatedDesc(product.ProductSpecifications || [])),
    [product],
  )
  const currentSpecification = specifications[0] || null
  const historySpecifications = specifications.slice(1)
  const [draft, setDraft] = useState<ProductSpecificationDraft>({
    CustomsValue: '',
    Duty: '',
    SpecificationCode: '',
    VATValue: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setSaving] = useState(false)

  function updateDraft<K extends keyof ProductSpecificationDraft>(key: K, value: ProductSpecificationDraft[K]) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [key]: value,
    }))
  }

  async function saveSpecification() {
    const specificationCode = draft.SpecificationCode.trim()

    if (!specificationCode) {
      setError(t('Вкажіть код специфікації'))
      return
    }

    setSaving(true)
    setError(null)

    try {
      const updatedProduct = await addProductSpecificationCode(product, {
        AddedBy: user
          ? {
              FirstName: user.FirstName,
              LastName: user.LastName,
            }
          : undefined,
        CustomsValue: toOptionalNumber(draft.CustomsValue),
        Duty: toOptionalNumber(draft.Duty),
        ProductId: product.Id,
        SpecificationCode: specificationCode,
        VATValue: toOptionalNumber(draft.VATValue),
      })

      notifications.show({ color: 'green', message: t('Специфікацію збережено') })
      setDraft({
        CustomsValue: '',
        Duty: '',
        SpecificationCode: '',
        VATValue: '',
      })
      onProductSaved(updatedProduct)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти специфікацію'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <DocumentDetailLayout
        summary={(
          <Group className="product-specification-summary" gap={8}>
            <TableChip tone="product" value={getProductCode(product)} />
            <Text size="sm" fw={600}>{getProductTitle(product)}</Text>
          </Group>
        )}
      >
        <div className="product-specification-content">
          <Stack gap={10}>
            <DocumentDetailSection title={t('Поточна специфікація')} stacked>
              {currentSpecification ? (
                <>
                  <SpecificationCodeChips specification={currentSpecification} />
                  <div className="product-specification-values">
                    {([
                      ['Митна вартість', currentSpecification.CustomsValue],
                      ['Мито', currentSpecification.Duty],
                      ['ПДВ', currentSpecification.VATValue],
                    ] as const).map(([label, value]) => (
                      <DocumentDetailRow key={label} label={t(label)} mono value={displayValue(value)} />
                    ))}
                  </div>
                  <SpecificationMetadata specification={currentSpecification} />
                </>
              ) : (
                <Text size="sm" c="gray.7">{t('Немає поточного коду')}</Text>
              )}
            </DocumentDetailSection>
            <PermissionGate permissionKey={PRODUCT_SPECIFICATION_CHANGE_PERMISSION}>
              <DocumentDetailSection title={t('Змінити специфікацію')} stacked>
                {error && <Alert color="red" icon={<CircleAlert size={18} />} variant="light">{error}</Alert>}
                <TextInput
                  classNames={{ input: 'app-money' }}
                  label={t('Код специфікації')}
                  value={draft.SpecificationCode}
                  onChange={(event) => updateDraft('SpecificationCode', event.currentTarget.value)}
                />
                <div className="product-specification-values">
                  <NumberInput classNames={{ input: 'app-money' }} decimalScale={2} label={t('Митна вартість')} min={0} hideControls
                    value={draft.CustomsValue}
                    onChange={(value) => updateDraft('CustomsValue', typeof value === 'number' ? value : '')} />
                  <NumberInput classNames={{ input: 'app-money' }} decimalScale={2} label={t('Мито')} min={0} hideControls
                    value={draft.Duty}
                    onChange={(value) => updateDraft('Duty', typeof value === 'number' ? value : '')} />
                  <NumberInput classNames={{ input: 'app-money' }} decimalScale={2} label={t('ПДВ')} min={0} hideControls
                    value={draft.VATValue}
                    onChange={(value) => updateDraft('VATValue', typeof value === 'number' ? value : '')} />
                </div>
              </DocumentDetailSection>
            </PermissionGate>
          </Stack>
          <DocumentDetailSection title={t('Історія')} subtitle={String(historySpecifications.length)} stacked>
            {historySpecifications.length === 0 ? (
              <div className="product-specification-empty">
                <Text size="sm">{t(specifications.length === 0 ? 'Специфікацій не знайдено' : 'Історію не знайдено')}</Text>
              </div>
            ) : (
              <Stack gap={10}>
                {historySpecifications.map((specification, index) => (
                  <Stack className="product-specification-history-item" gap={8} key={specification.NetUid || specification.Id || index}>
                    <SpecificationCodeChips specification={specification} />
                    <SpecificationMetadata specification={specification} />
                  </Stack>
                ))}
              </Stack>
            )}
          </DocumentDetailSection>
        </div>
      </DocumentDetailLayout>
      <AppModalFooter>
        <Button variant="default" disabled={isSaving} onClick={onClose}>{t('Скасувати')}</Button>
        <PermissionGate permissionKey={PRODUCT_SPECIFICATION_CHANGE_PERMISSION}>
          <Button color={CREATE_ACTION_COLOR} leftSection={<Save size={16} />} loading={isSaving} onClick={() => void saveSpecification()}>
            {t('Зберегти')}
          </Button>
        </PermissionGate>
      </AppModalFooter>
    </>
  )
}

function SpecificationCodeChips({ specification }: { specification: ProductSpecification }) {
  const { t } = useI18n()
  const code = specification.SpecificationCode?.trim()
  return (
    <Group gap={6}>
      <TableChip tone="warning" value={code || t('Код не вказано')} />
      {code && <TableChip tone="document" value={`${roundSpecificationPercent(getSpecificationDutyPercent(specification))}%`} />}
    </Group>
  )
}

function SpecificationMetadata({ specification }: { specification: ProductSpecification }) {
  const author = formatSpecificationAuthor(specification)
  const created = formatDate(specification.Created)
  return (
    <Group gap={8}>
      {author && author !== '-' && <TableChip tone="warning" value={author} />}
      {created && created !== '-' && (
        <DocumentDetailChip tone="document" icon={<CalendarDays size={13} />}>{created}</DocumentDetailChip>
      )}
    </Group>
  )
}

function ProductDataSheet({ children, className = '', product }: { children: ReactNode; className?: string; product: Product }) {
  return (
    <div className={`product-data-sheet ${className}`}>
      <DocumentDetailLayout summary={(
        <Group className="product-data-summary" gap={8}>
          <TableChip tone="product" value={getProductCode(product)} />
          <Text size="sm" fw={600}>{getProductTitle(product)}</Text>
        </Group>
      )}>
        {children}
      </DocumentDetailLayout>
    </div>
  )
}

function ProductConsignmentRemainingsPanel({ product }: { product: Product }) {
  const { t } = useI18n()
  const productNetUid = product.NetUid?.trim()
  const missingNetUidError = productNetUid ? null : t('У товару немає NetUid для завантаження залишків по партіям')
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const [rows, setRows] = useState<ProductConsignmentRemaining[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setLoading] = useState(Boolean(productNetUid))

  useEffect(() => {
    if (!productNetUid) {
      return
    }

    let cancelled = false
    const netUid = productNetUid

    async function loadRows() {
      setLoading(true)
      setError(null)

      try {
        const nextRows = await getProductConsignmentRemainings(netUid)

        if (!cancelled) {
          setRows(nextRows)
        }
      } catch (loadError) {
        if (!cancelled) {
          setRows([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити залишки по партіям'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadRows()

    return () => {
      cancelled = true
    }
  }, [productNetUid, reloadKey, t])

  const remainingsColumns = useMemo<DataTableColumn<ProductConsignmentRemaining>[]>(() => [
    { id: 'storage', header: t('Склад'), accessor: (row) => row.StorageName, cell: (row) => <TableChip tone="storage" value={displayValue(row.StorageName)} /> },
    { id: 'supplier', header: t('Постачальник'), accessor: (row) => row.SupplierName, cell: (row) => displayValue(row.SupplierName) },
    { id: 'date', header: t('Дата'), accessor: (row) => row.FromDate, cell: (row) => <span className="app-money">{formatDate(row.FromDate)}</span> },
    { id: 'invoice', header: t('Інвойс'), accessor: (row) => row.InvoiceNumber, cell: (row) => <TableChip tone="document" value={displayValue(row.InvoiceNumber)} /> },
    { id: 'income', header: t('Прихід'), accessor: (row) => row.ProductIncomeNumber, cell: (row) => <TableChip tone="document" value={displayValue(row.ProductIncomeNumber)} /> },
    { id: 'remaining', header: t('Залишок'), align: 'right', accessor: (row) => row.RemainingQty, cell: (row) => <span className="app-money">{formatAmount(row.RemainingQty)}</span> },
    { id: 'netPrice', header: t('Нетто'), align: 'right', accessor: (row) => row.NetPrice, cell: (row) => <span className="app-money">{formatPrice(row.NetPrice)}</span> },
    { id: 'totalNetPrice', header: t('Загальна нетто'), align: 'right', accessor: (row) => row.TotalNetPrice, cell: (row) => <span className="app-money">{formatPrice(row.TotalNetPrice)}</span> },
    { id: 'grossPrice', header: t('Брутто'), align: 'right', accessor: (row) => row.GrossPrice, cell: (row) => <span className="app-money">{formatPrice(row.GrossPrice)}</span> },
    { id: 'accountingGrossPrice', header: t('Облікова брутто'), align: 'right', accessor: (row) => row.AccountingGrossPrice, cell: (row) => <span className="app-money">{formatPrice(row.AccountingGrossPrice)}</span> },
    { id: 'currency', header: t('Валюта'), accessor: (row) => row.CurrencyName, cell: (row) => <TableChip tone="source" value={displayValue(row.CurrencyName)} /> },
    { id: 'organization', header: t('Організація'), accessor: (row) => row.OrganizationName, cell: (row) => <TableChip tone="product" value={row.OrganizationName} /> },
    { id: 'weight', header: t('Вага'), align: 'right', accessor: (row) => row.Weight, cell: (row) => <span className="app-money">{formatAmount(row.Weight)}</span> },
  ], [t])

  return (
    <div className="console-table-shell product-data-table-shell">
      <div className="app-filter-bar">
        <div className="app-filter-fields">
          <Text className="app-section-title" fw={600} size="sm">{t('Партії')}</Text>
          <div className="app-filter-actions">
            <Button variant="default" color="gray" leftSection={<RefreshCw size={16} />}
              disabled={Boolean(missingNetUidError)} loading={isLoading} onClick={() => reload()}>
              {t('Оновити')}
            </Button>
          </div>
          <div ref={setTableToolbarSlot} className="app-filter-table-toolbar-slot" />
        </div>
      </div>
      {(missingNetUidError || error) && (
        <Alert className="product-data-alert" color={missingNetUidError ? 'yellow' : 'red'} icon={<CircleAlert size={18} />} variant="light">
          {missingNetUidError || error}
        </Alert>
      )}
      {!missingNetUidError && !error && (
        <div className="product-data-table-body">
          <DataTable
            columns={remainingsColumns}
            data={rows}
            emptyText={t('Залишків по партіям не знайдено')}
            getRowId={(row, index) => String(row.NetUid || row.Id || row.InvoiceNumber || index)}
            height="100%"
            isLoading={isLoading}
            layoutVersion="product-consignment-remainings-1"
            loadingText={t('Завантаження залишків')}
            minWidth={1480}
            showLayoutControls
            tableId="product-consignment-remainings"
            toolbarPortalTarget={tableToolbarSlot}
          />
        </div>
      )}
    </div>
  )
}

function ProductStorageHistoryPanel({ product }: { product: Product }) {
  const { t } = useI18n()
  const productNetUid = product.NetUid?.trim()
  const [dateFrom, setDateFrom] = useState(getTodayDate)
  const [dateTo, setDateTo] = useState(getTodayDate)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [rows, setRows] = useState<ProductStorageLocationHistory[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setLoading] = useState(false)
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const { density, setDensity } = useDataTableDensity('product-storage-history', 'normal')
  const filterError = getDateRangeError(dateFrom, dateTo, t)
  const missingNetUidError = productNetUid ? null : t('У товару немає NetUid для завантаження історії місця зберігання')
  const activeError = filterError || missingNetUidError || error
  const total = rows[0]?.TotalRowsQty
  const totalPages = typeof total === 'number' ? Math.max(1, Math.ceil(total / pageSize)) : undefined
  const canMoveForward = typeof total === 'number' ? page * pageSize < total : rows.length === pageSize

  const storageHistoryColumns = useMemo<DataTableColumn<ProductStorageLocationHistory>[]>(() => [
    { id: 'date', header: t('Дата'), accessor: (row) => row.Created, cell: (row) => <span className="app-money">{formatDateTime(row.Created)}</span> },
    { id: 'product', header: t('Товар'), accessor: (row) => row.Product?.VendorCode || row.Product?.NameUA || row.Product?.Name, cell: (row) => row.Product?.VendorCode ? <TableChip tone="product" value={row.Product.VendorCode} /> : displayValue(row.Product?.NameUA || row.Product?.Name) },
    { id: 'storage', header: t('Склад'), accessor: (row) => row.Storage?.Name, cell: (row) => <TableChip tone="storage" value={displayValue(row.Storage?.Name)} /> },
    { id: 'placement', header: t('Місце'), accessor: (row) => row.Placement, cell: (row) => displayValue(row.Placement) },
    { id: 'status', header: t('Статус'), accessor: (row) => row.StorageLocationType, cell: (row) => <TableChip value={formatStorageLocationType(row.StorageLocationType, t)} /> },
    { id: 'qty', header: t('Кількість'), align: 'right', accessor: (row) => formatStorageLocationQty(row), cell: (row) => <span className="app-money">{formatStorageLocationQty(row)}</span> },
    { id: 'responsible', header: t('Відповідальний'), accessor: (row) => [row.User?.FirstName, row.User?.LastName].filter(Boolean).join(' '), cell: (row) => <TableChip tone="warning" value={displayValue([row.User?.FirstName, row.User?.LastName].filter(Boolean).join(' '))} /> },
  ], [t])

  useEffect(() => {
    if (filterError || !productNetUid) {
      return
    }

    let cancelled = false
    const netUid = productNetUid
    const offset = (page - 1) * pageSize

    async function loadRows() {
      setLoading(true)
      setError(null)

      try {
        const nextRows = await getProductStorageLocationHistory({
          from: dateFrom,
          limit: pageSize,
          offset,
          productNetId: netUid,
          to: dateTo,
        })

        if (!cancelled) {
          setRows(nextRows)
        }
      } catch (loadError) {
        if (!cancelled) {
          setRows([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити історію місця зберігання'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadRows()

    return () => {
      cancelled = true
    }
  }, [dateFrom, dateTo, filterError, page, pageSize, productNetUid, reloadKey, t])

  return (
    <div className="console-table-shell product-data-table-shell">
      <div className="app-filter-bar">
        <div className="app-filter-fields">
          <ToolbarDateRangeFilter from={dateFrom} to={dateTo} onChange={({ from, to }) => { setPage(1); setDateFrom(from); setDateTo(to) }} />
          <div className="app-filter-actions">
            <Paginator
              page={page}
              pageSize={pageSize}
              pageSizeOptions={pageSizeOptions}
              totalPages={totalPages}
              hasNext={canMoveForward}
              isLoading={isLoading || Boolean(filterError || missingNetUidError)}
              onPageChange={setPage}
              onPageSizeChange={(value) => { setPage(1); setPageSize(value) }}
              onRefresh={filterError || missingNetUidError ? undefined : reload}
            />
          </div>
          <div ref={setTableToolbarSlot} className="app-filter-table-toolbar-slot" />
        </div>
      </div>
      {activeError && <Alert className="product-data-alert" color={filterError || missingNetUidError ? 'yellow' : 'red'} icon={<CircleAlert size={18} />} variant="light">{activeError}</Alert>}
      {!activeError && (
        <div className="product-data-table-body">
          <DataTable
            columns={storageHistoryColumns}
            data={rows}
            density={density}
            onDensityChange={setDensity}
            emptyText={t('Історію місця зберігання не знайдено')}
            getRowId={(row, index) => String(row.NetUid || row.Id || index)}
            height="100%"
            isLoading={isLoading}
            layoutVersion="product-storage-history-1"
            loadingText={t('Завантаження історії')}
            minWidth={980}
            showLayoutControls
            tableId="product-storage-history"
            toolbarPortalTarget={tableToolbarSlot}
          />
        </div>
      )}
    </div>
  )
}

// Keep document identity pinned while the shared toolbar manages columns and density.
const PRODUCT_MOVEMENT_DEFAULT_LAYOUT = {
  columnPinning: { left: ['document', 'number'] },
  density: 'normal',
} satisfies DataTableDefaultLayout

function ProductMovementPanel({ product, siblingCards }: { product: Product; siblingCards: ProductSiblingCard[] }) {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<'movement' | 'historical-source' | 'informational'>('movement')

  return (
    <Tabs
      className="product-movement-history-tabs-root product-data-tabs"
      value={activeTab}
      onChange={(value) => {
        setActiveTab(value === 'historical-source' || value === 'informational' ? value : 'movement')
      }}
    >
      <Tabs.List className="product-movement-history-tabs">
        <Tabs.Tab leftSection={<ArrowLeftRight size={15} />} value="movement">{t('Рух')}</Tabs.Tab>
        <Tabs.Tab leftSection={<Archive size={15} />} value="historical-source">
          {t('Архівні партії 1С')}
        </Tabs.Tab>
        <Tabs.Tab leftSection={<TriangleAlert size={15} />} value="informational">
          {t('Контроль даних')}
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel className="product-data-tab-panel" value="movement" pt={0}>
        <CurrentProductMovementPanel product={product} siblingCards={siblingCards} />
      </Tabs.Panel>
      <Tabs.Panel className="product-data-tab-panel" value="historical-source" pt={0}>
        <HistoricalSourceMovementPanel
          active={activeTab === 'historical-source'}
          product={product}
          requestPath="/consignments/info/assortment/movement/historical-source/filtered"
        />
      </Tabs.Panel>
      <Tabs.Panel className="product-data-tab-panel" value="informational" pt={0}>
        <InformationalMovementPanel
          active={activeTab === 'informational'}
          product={product}
          requestPath="/consignments/info/assortment/movement/informational/filtered"
        />
      </Tabs.Panel>
    </Tabs>
  )
}

function CurrentProductMovementPanel({ product, siblingCards }: { product: Product; siblingCards: ProductSiblingCard[] }) {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const productNetUid = product.NetUid?.trim()
  const [dateFrom, setDateFrom] = useState(() => getDateDaysAgo(PRODUCT_MOVEMENT_DEFAULT_LOOKBACK_DAYS))
  const [dateTo, setDateTo] = useState(getTodayDate)
  const [movementType, setMovementType] = useState('0')
  const [selectedTypes, setSelectedTypes] = useState<number[]>(movementItemTypes)
  const [siblingScope, setSiblingScope] = useState<ProductSiblingScope>('card')
  const hasSiblings = hasProductSiblingCards(siblingCards)
  const includeSiblings = hasSiblings && siblingScope === 'all'
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const [rows, setRows] = useState<ProductMovement[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setLoading] = useState(false)
  const [exportState, dispatchExport] = useReducer((state: {
    document: ProductMovementExportDocument | null
    error: string | null
    isExporting: boolean
  }, action: { document?: ProductMovementExportDocument | null; error?: string | null; isExporting?: boolean }) => ({ ...state, ...action }), {
    document: null, error: null, isExporting: false,
  })
  const { document: exportDocument, error: exportError, isExporting } = exportState
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)
  const { density, setDensity } = useDataTableDensity('product-movement', 'normal')
  const filterError = getDateRangeError(dateFrom, dateTo, t)
  const missingNetUidError = productNetUid ? null : t('У товару немає NetUid для завантаження руху товару')
  const typesError = selectedTypes.length === 0 ? t('Оберіть хоча б один тип руху') : null
  const activeError = filterError || missingNetUidError || typesError || error
  const canExportMovements = hasPermission(PRODUCT_MOVEMENT_EXPORT_PERMISSION)

  const exportRequestRef = useRef(0)

  useEffect(() => {
    dispatchExport({ document: null, error: null, isExporting: false })
    return () => { exportRequestRef.current += 1 }
  }, [dateFrom, dateTo, includeSiblings, movementType, productNetUid, selectedTypes])

  useEffect(() => {
    if (filterError || typesError || !productNetUid) {
      return
    }

    let cancelled = false
    const netUid = productNetUid
    const types = selectedTypes

    async function loadRows() {
      setLoading(true)
      setError(null)

      try {
        const nextRows = await getProductMovements({
          from: dateFrom,
          movementType: Number(movementType),
          productNetId: netUid,
          to: dateTo,
          types,
          ...(includeSiblings ? { includeSiblings: true } : {}),
        })

        if (!cancelled) {
          setRows(nextRows)
        }
      } catch (loadError) {
        if (!cancelled) {
          setRows([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити рух товару'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadRows()

    return () => {
      cancelled = true
    }
  }, [dateFrom, dateTo, filterError, includeSiblings, movementType, productNetUid, reloadKey, selectedTypes, t, typesError])

  async function exportMovements() {
    if (!canExportMovements || !productNetUid || filterError || typesError || isExporting || includeSiblings) {
      return
    }

    const requestId = ++exportRequestRef.current
    dispatchExport({ document: null, error: null, isExporting: true })
    setError(null)

    try {
      const nextDocument = await exportProductMovementsDocument({
        from: dateFrom,
        movementType: Number(movementType),
        productNetId: productNetUid,
        to: dateTo,
        types: selectedTypes,
      })

      if (requestId === exportRequestRef.current) dispatchExport({ document: nextDocument })
    } catch (exportError) {
      if (requestId === exportRequestRef.current) dispatchExport({ error: exportError instanceof Error ? exportError.message : t('Не вдалося сформувати документ руху товару') })
    } finally {
      if (requestId === exportRequestRef.current) dispatchExport({ isExporting: false })
    }
  }

  const cardMovementColumns = useMemo<DataTableColumn<ProductMovement>[]>(() => withProductSourceHistoryColumns([
    { id: 'incomeNumber', header: t('Номер прихідної накладної'), minWidth: 160, accessor: (row) => row.IncomeDocumentNumber, cell: (row) => <TableChip tone="document" value={displayValue(row.IncomeDocumentNumber)} /> },
    { id: 'incomeDate', header: t('Дата прихідної накладної'), minWidth: 160, accessor: (row) => row.IncomeDocumentFromDate, cell: (row) => <span className="app-money">{formatDateTime(row.IncomeDocumentFromDate)}</span> },
    { id: 'document', header: t('Документ'), minWidth: 150, accessor: (row) => row.DocumentType || row.MovementType, cell: (row) => displayValue(row.DocumentType || row.MovementType) },
    { id: 'number', header: t('Номер'), minWidth: 130, accessor: (row) => row.DocumentNumber, cell: (row) => <TableChip tone="document" value={displayValue(row.DocumentNumber)} /> },
    { id: 'date', header: t('Дата'), minWidth: 140, accessor: (row) => row.DocumentFromDate || row.FromDate || row.Created, cell: (row) => (
      <span className="app-money product-movement-date">
        {row.IsEdited ? <span className="product-edited-dot" aria-hidden="true" title={t('Редаговано')} /> : null}
        {formatDateTime(row.DocumentFromDate || row.FromDate || row.Created)}
      </span>
    ) },
    { id: 'client', header: t('Клієнт'), minWidth: 220, accessor: (row) => row.ClientName, cell: (row) => displayValue(row.ClientName) },
    { id: 'storage', header: t('Склад'), minWidth: 120, accessor: (row) => row.StorageName, cell: (row) => <TableChip tone="storage" value={displayValue(row.StorageName)} /> },
    { id: 'organization', header: t('Організація'), minWidth: 160, accessor: (row) => row.OrganizationName, cell: (row) => <TableChip tone="product" value={displayValue(row.OrganizationName)} /> },
    { id: 'responsible', header: t('Відповідальний'), minWidth: 150, accessor: (row) => row.Responsible || row.UserName, cell: (row) => <TableChip tone="warning" value={displayValue(row.Responsible || row.UserName)} /> },
    { id: 'price', header: t('Собівартість'), minWidth: 120, align: 'right', accessor: (row) => row.Price, cell: (row) => <span className="app-money">{formatPrice(row.Price)}</span> },
    { id: 'accountingPrice', header: t('Облікова собівартість'), minWidth: 160, align: 'right', accessor: (row) => row.AccountingPrice, cell: (row) => <span className="app-money">{formatPrice(row.AccountingPrice)}</span> },
    { id: 'discount', header: t('Знижка'), minWidth: 110, align: 'right', accessor: (row) => row.Discount, cell: (row) => <span className="app-money">{formatPrice(row.Discount)}</span> },
    { id: 'income', header: t('Прихід'), minWidth: 110, align: 'right', accessor: (row) => row.IncomeQty, cell: (row) => <span className="app-money">{formatAmount(row.IncomeQty)}</span> },
    { id: 'outcome', header: t('Розхід'), minWidth: 110, align: 'right', accessor: (row) => row.OutcomeQty, cell: (row) => <span className="app-money">{formatAmount(row.OutcomeQty)}</span> },
    { id: 'comment', header: t('Коментар'), minWidth: 220, accessor: (row) => row.Comment, cell: (row) => displayValue(row.Comment) },
  ], t), [t])
  const movementColumns = useMemo<DataTableColumn<ProductMovement>[]>(
    () => includeSiblings
      ? [createProductSiblingCardColumn<ProductMovement>(t('Картка')), ...cardMovementColumns]
      : cardMovementColumns,
    [cardMovementColumns, includeSiblings, t],
  )

  return (
    <div className="console-table-shell product-data-table-shell">
      <ProductSourceHistoryRefresh hideControls productNetId={productNetUid} includeSiblings={includeSiblings} onRefreshed={() => {
        exportRequestRef.current += 1
        dispatchExport({ document: null, error: null, isExporting: false })
        reload()
      }} />
      <div className="app-filter-bar product-movement-sheet-toolbar">
        <div className="app-filter-fields product-movement-sheet-filters">
          <ToolbarDateRangeFilter from={dateFrom} to={dateTo} fromLabel={t('З')} toLabel={t('По')}
            min="1900-01-01" max="9999-12-30" required
            onChange={({ from, to }) => { setDateFrom(from); setDateTo(to) }} />
          <Select label={t('Тип руху')} data={movementTypeOptions.map((option) => ({ ...option, label: t(option.label) }))} value={movementType} onChange={(value) => setMovementType(value || '0')} />
          <MovementDocumentTypeFilter options={movementItemTypeOptions} value={selectedTypes} onChange={setSelectedTypes} />
          {hasSiblings ? (
            <ProductSiblingScopeControl id="product-movement-sibling-scope" value={siblingScope} onChange={setSiblingScope} />
          ) : null}
        </div>
        <div className="app-filter-actions">
          <Button color="gray" variant="default" size="sm" disabled={Boolean(filterError || typesError || missingNetUidError)} leftSection={<RefreshCw size={16} />} loading={isLoading} onClick={() => reload()}>
            {t('Оновити')}
          </Button>
          <PermissionGate permissionKey={PRODUCT_MOVEMENT_EXPORT_PERMISSION}>
            <Button color="gray" variant="default" size="sm" disabled={!productNetUid || Boolean(filterError) || Boolean(typesError) || includeSiblings} leftSection={<PdfIcon size={20} />} loading={isExporting} onClick={() => void exportMovements()}>
              {t('Друк PDF')}
            </Button>
          </PermissionGate>
        </div>
        <div ref={setTableToolbarSlot} className="app-filter-table-toolbar-slot" />
      </div>
      {activeError && <Alert className="product-data-alert" color={filterError || missingNetUidError || typesError ? 'yellow' : 'red'} icon={<CircleAlert size={18} />} variant="light">{activeError}</Alert>}
      {!activeError && (
        <div className="product-data-table-body">
          <DataTable
            columns={movementColumns}
            data={rows}
            defaultLayout={PRODUCT_MOVEMENT_DEFAULT_LAYOUT}
            density={density}
            onDensityChange={setDensity}
            emptyText={t('Рух товару не знайдено')}
            getRowId={(row, index) => getProductSiblingRowKey(row.Card, String(row.SourceHistory?.RowKey || row.NetUid || row.Id || `${row.DocumentNumber || 'movement'}-${index}`))}
            height="100%"
            isLoading={isLoading}
            layoutVersion="product-movement-2"
            loadingText={t('Завантаження руху товару')}
            minWidth={1640}
            showLayoutControls
            tableId="product-movement"
            toolbarPortalTarget={tableToolbarSlot}
          />
        </div>
      )}
      <DocumentExportModal
        document={exportDocument}
        error={exportError}
        isLoading={isExporting}
        opened={isExporting || Boolean(exportDocument) || Boolean(exportError)}
        title={t('Друк PDF')}
        onClose={() => {
          exportRequestRef.current += 1
          dispatchExport({ document: null, error: null, isExporting: false })
        }}
      />
    </div>
  )
}

function ProductWriteOffRulesPanel({ onChanged, product }: { onChanged: () => void; product: Product }) {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const { density, setDensity } = useDataTableDensity('product-writeoff-rules', 'normal')
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)
  const productNetUid = product.NetUid?.trim()
  const fallbackProductGroups = useMemo(() => getProductGroupsFromProduct(product), [product])
  const [rows, setRows] = useState<ProductWriteOffRule[]>([])
  const [scope, setScope] = useState<ProductWriteOffRuleScope>('product')
  const [productGroups, setProductGroups] = useState<ProductGroup[]>(fallbackProductGroups)
  const [selectedProductGroupNetUid, setSelectedProductGroupNetUid] = useState(() => fallbackProductGroups[0]?.NetUid || '')
  const [ruleType, setRuleType] = useState('0')
  const [locale, setLocale] = useState('uk')
  const [error, setError] = useState<string | null>(null)
  const [groupError, setGroupError] = useState<string | null>(null)
  const [isLoading, setLoading] = useState(Boolean(productNetUid))
  const [isLoadingGroups, setLoadingGroups] = useState(Boolean(productNetUid))
  const [isSaving, setSaving] = useState(false)
  const [removingNetUid, setRemovingNetUid] = useState<string | null>(null)
  const selectedProductGroup = useMemo(
    () => productGroups.find((group) => group.NetUid === selectedProductGroupNetUid) || null,
    [productGroups, selectedProductGroupNetUid],
  )
  const productGroupOptions = useMemo(
    () => productGroups.reduce<Array<{ label: string; value: string }>>((options, group) => {
      const netUid = group.NetUid?.trim()

      if (netUid) {
        options.push({
          label: getProductGroupLabel(group),
          value: netUid,
        })
      }

      return options
    }, []),
    [productGroups],
  )
  const selectedProductGroupNetId = selectedProductGroup?.NetUid?.trim() || ''
  const activeRuleScopeKey = scope === 'group'
    ? `group:${selectedProductGroupNetId}`
    : `product:${productNetUid || ''}`
  const activeRuleScopeKeyRef = useRef(activeRuleScopeKey)
  const missingNetUidError = productNetUid ? null : t('У товару немає NetUid для завантаження правил списання')
  const groupSelectionError = scope === 'group' && !selectedProductGroupNetId
    ? t('Оберіть групу товарів для правил списання')
    : null
  const activeError = missingNetUidError || (scope === 'group' ? groupError || groupSelectionError : null) || error
  const canCreateRule = hasPermission(PRODUCT_WRITE_OFF_CREATE_PERMISSION)
  const canDeleteRule = hasPermission(PRODUCT_WRITE_OFF_DELETE_PERMISSION)

  useEffect(() => {
    activeRuleScopeKeyRef.current = activeRuleScopeKey
  }, [activeRuleScopeKey])

  useEffect(() => {
    if (!productNetUid) {
      return
    }

    let cancelled = false
    const netUid = productNetUid

    async function loadGroups() {
      setLoadingGroups(true)
      setGroupError(null)

      try {
        const nextGroups = mergeProductGroups(fallbackProductGroups, await getProductGroupsByProductNetId(netUid))

        if (!cancelled) {
          setProductGroups(nextGroups)
          setSelectedProductGroupNetUid((currentNetUid) => (
            currentNetUid && nextGroups.some((group) => group.NetUid === currentNetUid)
              ? currentNetUid
              : nextGroups[0]?.NetUid || ''
          ))
        }
      } catch (loadError) {
        if (!cancelled) {
          setProductGroups(fallbackProductGroups)
          setSelectedProductGroupNetUid((currentNetUid) => (
            currentNetUid && fallbackProductGroups.some((group) => group.NetUid === currentNetUid)
              ? currentNetUid
              : fallbackProductGroups[0]?.NetUid || ''
          ))
          setGroupError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити групи товару'))
        }
      } finally {
        if (!cancelled) {
          setLoadingGroups(false)
        }
      }
    }

    void loadGroups()

    return () => {
      cancelled = true
    }
  }, [fallbackProductGroups, productNetUid, t])

  useEffect(() => {
    if (!productNetUid) {
      return
    }

    if (scope === 'group' && !selectedProductGroupNetId) {
      return
    }

    let cancelled = false
    const netUid = productNetUid
    const groupNetUid = selectedProductGroupNetId
    const nextScope = scope

    async function loadRules() {
      setLoading(true)
      setError(null)

      try {
        const nextRows = nextScope === 'group'
          ? await getProductWriteOffRulesByProductGroupNetId(groupNetUid)
          : await getProductWriteOffRulesByProductNetId(netUid)

        if (!cancelled) {
          setRows(nextRows)
        }
      } catch (loadError) {
        if (!cancelled) {
          setRows([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити правила списання'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadRules()

    return () => {
      cancelled = true
    }
  }, [productNetUid, scope, selectedProductGroupNetId, t])

  const reloadRules = useCallback(async () => {
    if (!productNetUid) {
      return
    }

    const requestedScopeKey = activeRuleScopeKey

    if (scope === 'group') {
      if (!selectedProductGroupNetId) {
        if (activeRuleScopeKeyRef.current === requestedScopeKey) {
          setRows([])
        }
        return
      }

      const nextRows = await getProductWriteOffRulesByProductGroupNetId(selectedProductGroupNetId)
      if (activeRuleScopeKeyRef.current === requestedScopeKey) {
        setRows(nextRows)
      }
      return
    }

    const nextRows = await getProductWriteOffRulesByProductNetId(productNetUid)
    if (activeRuleScopeKeyRef.current === requestedScopeKey) {
      setRows(nextRows)
    }
  }, [activeRuleScopeKey, productNetUid, scope, selectedProductGroupNetId])

  async function addRule() {
    if (!canCreateRule) {
      return
    }

    if (!productNetUid) {
      setError(t('У товару немає NetUid для збереження правила списання'))
      return
    }

    if (scope === 'group' && (!selectedProductGroup || !selectedProductGroupNetId)) {
      setError(t('Оберіть групу товарів для правила списання'))
      return
    }

    setSaving(true)
    setError(null)
    const requestedScopeKey = activeRuleScopeKey

    try {
      const nextRule = await addOrUpdateProductWriteOffRule({
        Product: scope === 'product'
          ? {
              Id: product.Id,
              NetUid: productNetUid,
              VendorCode: product.VendorCode,
            }
          : null,
        ProductGroup: scope === 'group' && selectedProductGroup
          ? {
              Id: selectedProductGroup.Id,
              Name: selectedProductGroup.Name,
              NetUid: selectedProductGroupNetId,
            }
          : null,
        RuleLocale: locale,
        RuleType: Number(ruleType),
      })

      if (nextRule && activeRuleScopeKeyRef.current === requestedScopeKey) {
        setRows((currentRows) => upsertProductWriteOffRule(currentRows, nextRule))
      } else {
        await reloadRules()
      }

      onChanged()
      notifications.show({ color: 'green', message: t('Правило списання збережено') })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти правило списання'))
    } finally {
      setSaving(false)
    }
  }

  const removeRule = useCallback(
    async (rule: ProductWriteOffRule) => {
      if (!canDeleteRule || !rule.NetUid) {
        return
      }

      setRemovingNetUid(rule.NetUid)
      setError(null)

      try {
        await deleteProductWriteOffRule(rule.NetUid)
        setRows((currentRows) => currentRows.filter((row) => row.NetUid !== rule.NetUid))
        onChanged()
        notifications.show({ color: 'green', message: t('Правило списання видалено') })
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : t('Не вдалося видалити правило списання'))
      } finally {
        setRemovingNetUid(null)
      }
    },
    [canDeleteRule, onChanged, t],
  )

  const writeOffColumns = useMemo<DataTableColumn<ProductWriteOffRule>[]>(() => [
    { id: 'date', header: t('Дата'), width: 156, accessor: (row) => row.Created, cell: (row) => <span className="app-money">{formatDate(row.Created)}</span> },
    { id: 'locale', header: t('Регіон'), width: 150, accessor: (row) => row.RuleLocale, cell: (row) => <TableChip tone="source" value={formatRuleLocale(row.RuleLocale)} /> },
    { id: 'rule', header: t('Правило'), width: 220, accessor: (row) => row.RuleType, cell: (row) => <TableChip tone="document" value={formatRuleType(row.RuleType)} /> },
    { id: 'source', header: t('Джерело'), width: 220, fill: true, accessor: (row) => row.Product?.VendorCode || getProductGroupLabel(row.ProductGroup), cell: (row) => row.Product?.VendorCode ? <TableChip tone="product" value={row.Product.VendorCode} /> : displayValue(getProductGroupLabel(row.ProductGroup)) },
    {
      id: 'actions',
      header: '',
      width: 64,
      accessor: () => null,
      cell: (row) => (
        <PermissionGate permissionKey={PRODUCT_WRITE_OFF_DELETE_PERMISSION}>
          <TableRowAction
            action="delete"
            disabled={!row.NetUid || Boolean(removingNetUid)}
            label={t('Видалити')}
            loading={removingNetUid === row.NetUid}
            onClick={() => removeRule(row)}
          />
        </PermissionGate>
      ),
    },
  ], [removingNetUid, removeRule, t])

  return (
    <div className="console-table-shell product-data-table-shell">
      <div className="app-filter-bar product-writeoff-toolbar">
        <div className="app-filter-fields product-writeoff-fields">
          <div className="app-filter-field" style={{ flexBasis: 210 }}>
            <span className="app-filter-label" id="product-writeoff-scope-label">{t('Джерело')}</span>
            <SegmentedControl
              aria-labelledby="product-writeoff-scope-label"
              data={writeOffScopeOptions.map((option) => ({ ...option, label: t(option.label) }))}
              disabled={isSaving || Boolean(removingNetUid)}
              value={scope}
              onChange={(value) => setScope(value as ProductWriteOffRuleScope)}
            />
          </div>
          {scope === 'group' ? (
            <Select
              data={productGroupOptions}
              disabled={isLoadingGroups || isSaving || Boolean(removingNetUid) || productGroupOptions.length === 0}
              label={t('Група товарів')}
              placeholder={isLoadingGroups ? t('Завантаження') : t('Оберіть групу')}
              value={selectedProductGroupNetUid || null}
              onChange={(value) => setSelectedProductGroupNetUid(value || '')}
            />
          ) : null}
          <Select label={t('Правило')} data={writeOffRuleTypeOptions.map((option) => ({ ...option, label: t(option.label) }))} value={ruleType} onChange={(value) => setRuleType(value || '0')} />
          <Select label={t('Регіон')} data={writeOffLocaleOptions.map((option) => ({ ...option, label: t(option.label) }))} value={locale} onChange={(value) => setLocale(value || 'uk')} />
        </div>
        <div className="app-filter-actions">
          <PermissionGate permissionKey={PRODUCT_WRITE_OFF_CREATE_PERMISSION}>
            <Button className="app-filter-primary-action" disabled={!productNetUid || isLoading || (scope === 'group' && (isLoadingGroups || !selectedProductGroupNetId))} color={CREATE_ACTION_COLOR} leftSection={<Plus size={16} />} loading={isSaving} onClick={addRule}>
              {t('Додати')}
            </Button>
          </PermissionGate>
        </div>
        <div ref={setTableToolbarSlot} className="app-filter-table-toolbar-slot" />
      </div>
      {activeError && <Alert className="product-data-alert" color={missingNetUidError ? 'yellow' : 'red'} icon={<CircleAlert size={18} />} variant="light">{activeError}</Alert>}
      {!activeError ? (
        <div className="product-data-table-body">
          <DataTable
            columns={writeOffColumns}
            data={rows}
            density={density}
            emptyText={t('Правил списання не знайдено')}
            getRowId={(row, index) => String(row.NetUid || row.Id || index)}
            height="100%"
            isLoading={isLoading}
            layoutVersion="product-writeoff-rules-1"
            loadingText={t('Завантаження правил списання')}
            minWidth={760}
            onDensityChange={setDensity}
            tableId="product-writeoff-rules"
            toolbarPortalTarget={tableToolbarSlot}
          />
        </div>
      ) : null}
    </div>
  )
}

function LoadingState({ label }: { label: string }) {
  return (
    <Group gap="xs">
      <Loader size="xs" />
      <Text c="dimmed" size="sm">
        {label}
      </Text>
    </Group>
  )
}

function InfoRow({ dimmed, label, mono, multiline, value }: { dimmed?: boolean; label: string; mono?: boolean; multiline?: boolean; value?: number | string | null }) {
  const { t } = useI18n()

  return (
    <Group align={multiline ? 'flex-start' : 'center'} justify="space-between" gap="xs" wrap="wrap">
      <Text c="dimmed" size="sm" style={{ flex: '0 0 140px', maxWidth: '100%' }}>
        {t(label)}
      </Text>
      <Text
        c={dimmed ? 'dimmed' : undefined}
        className={mono ? 'app-money' : undefined}
        size="sm"
        style={{
          flex: '1 1 220px',
          minWidth: 0,
          overflowWrap: 'anywhere',
          textAlign: 'right',
          whiteSpace: multiline ? 'pre-wrap' : undefined,
        }}
      >
        {displayValue(value)}
      </Text>
    </Group>
  )
}

function sortSpecificationsByCreatedDesc(specifications: ProductSpecification[]): ProductSpecification[] {
  return specifications.toSorted((first, second) => {
    const firstTime = first.Created ? new Date(first.Created).getTime() : 0
    const secondTime = second.Created ? new Date(second.Created).getTime() : 0

    return secondTime - firstTime
  })
}

// Duty as a % of the customs value — prefer the backend value, fall back to the legacy formula
// (Duty / CustomsValue * 100) used when adding a specification.
function getSpecificationDutyPercent(specification: ProductSpecification): number {
  const stored = Number(specification.DutyPercent)

  if (Number.isFinite(stored)) {
    return stored
  }

  const customsValue = Number(specification.CustomsValue) || 0
  const duty = Number(specification.Duty) || 0

  return customsValue > 0 ? (duty / customsValue) * 100 : 0
}

function roundSpecificationPercent(value: number): number {
  return Math.round(value * 100) / 100
}

// The legacy history keeps only the latest entry per distinct (code, duty %) pair. The input is
// already newest-first, so the first occurrence we keep for each key is the most recent.
function dedupeSpecificationsByCodeAndRate(specifications: ProductSpecification[]): ProductSpecification[] {
  const seen = new Set<string>()
  const result: ProductSpecification[] = []

  specifications.forEach((specification) => {
    const key = `${(specification.SpecificationCode || '').trim()}|${roundSpecificationPercent(getSpecificationDutyPercent(specification))}`

    if (!seen.has(key)) {
      seen.add(key)
      result.push(specification)
    }
  })

  return result
}

function formatSpecificationAuthor(specification: ProductSpecification): string {
  const author = specification.AddedBy

  if (!author) {
    return ''
  }

  return [author.LastName, author.FirstName].filter(Boolean).join(' ')
}

function PriceRow({ price }: { price: CalculatedProductPrice }) {
  const { t } = useI18n()
  const breakdown = getProductPriceBreakdown(price)

  return (
    <Box py={4}>
      <Group justify="space-between" gap="md" wrap="nowrap">
        <Text size="sm">{displayValue(breakdown.pricingName)}</Text>
        <Text className="app-money" size="sm" fw={600}>
          {formatPrice(breakdown.retailPriceEUR)} / {formatPrice(breakdown.retailPriceLocal)}
        </Text>
      </Group>
      {(breakdown.hasBasePrice || breakdown.hasDiscount) ? (
        <Group gap={6} mt={4} wrap="wrap">
          {breakdown.hasBasePrice ? (
            <Text c="dimmed" size="xs">{t('База EUR')}: <span className="app-money app-money-meta">{formatPrice(breakdown.basePriceEUR)}</span></Text>
          ) : null}
          {breakdown.discountPriceEUR !== undefined ? (
            <Text c="teal.8" size="xs" fw={650}>{t('Після знижки EUR')}: <span className="app-money">{formatPrice(breakdown.discountPriceEUR)}</span></Text>
          ) : null}
          {breakdown.discountRate !== undefined ? (
            <Badge size="xs" variant="light" color="teal">{t('Знижка')} {formatAmount(breakdown.discountRate)}%</Badge>
          ) : null}
        </Group>
      ) : null}
    </Box>
  )
}

function createProductEditForm(product: Product): ProductEditForm {
  return {
    NativeIsService: typeof product.NativeIsService === 'boolean' ? product.NativeIsService : null,
    Description: product.Description || '',
    DescriptionUA: product.DescriptionUA || '',
    IsForSale: Boolean(product.IsForSale),
    IsForZeroSale: Boolean(product.IsForZeroSale),
    Notes: product.Notes || '',
    NotesUA: product.NotesUA || '',
    OrderStandard: product.OrderStandard || '',
    PackingStandard: product.PackingStandard || '',
    Size: product.Size || '',
    SynonymsUA: product.SynonymsUA || '',
    Top: product.Top || '',
    Volume: product.Volume || '',
    Weight: typeof product.Weight === 'number' ? product.Weight : null,
  }
}

function getProductImageKey(image: ProductImage): string {
  if (image.NetUid) {
    return `net:${image.NetUid}`
  }

  if (typeof image.Id === 'number') {
    return `id:${image.Id}`
  }

  if (image.FileName || image.ImageUrl) {
    return `file:${image.FileName || ''}:${image.ImageUrl || ''}`
  }

  return ''
}

function revokeFilePreviewUrls(urls: string[]) {
  urls.forEach((url) => URL.revokeObjectURL(url))
}

function cloneProductPlacements(placements: ProductPlacement[]): ProductPlacementDraft[] {
  return groupProductPlacementsForEditing(placements).map((placement) => ({
    ...placement,
    DraftKey: createProductPlacementDraftKey(placement),
  }))
}

function createProductPlacementDraftKey(placement?: ProductPlacement): string {
  if (placement?.NetUid) {
    return placement.NetUid
  }

  if (placement?.Id) {
    return String(placement.Id)
  }

  return `new-${Math.random().toString(36).slice(2)}`
}

function stripProductPlacementDraft(placement: ProductPlacementDraft): ProductPlacement {
  const { DraftKey: _draftKey, ...payload } = placement
  void _draftKey

  return payload
}

function getProductPlacementsKey(placements: ProductPlacement[]): string {
  return placements.map((placement, index) => `${placement.NetUid || placement.Id || index}:${placement.Qty || 0}`).join('|')
}

function sumProductPlacementQty(placements: ProductPlacement[]): number {
  return placements.reduce((total, placement) => total + readPlacementNumber(placement.Qty || 0), 0)
}

function groupProductPlacements(placements: ProductPlacement[]): ProductPlacementGroup[] {
  const groups = new Map<string, ProductPlacementGroup>()

  placements.forEach((placement) => {
    const storageNumber = placement.StorageNumber?.trim() || '-'
    const rowNumber = placement.RowNumber?.trim() || '-'
    const cellNumber = placement.CellNumber?.trim() || '-'
    const key = `${storageNumber}|${rowNumber}|${cellNumber}`
    const currentGroup = groups.get(key)

    if (currentGroup) {
      currentGroup.count += 1
      currentGroup.qty += readPlacementNumber(placement.Qty || 0)
      return
    }

    groups.set(key, {
      count: 1,
      key,
      label: `${storageNumber} / ${rowNumber} / ${cellNumber}`,
      qty: readPlacementNumber(placement.Qty || 0),
    })
  })

  return Array.from(groups.values())
}

function isPersistedPlacement(placement: ProductPlacement): boolean {
  return Boolean(placement.Id || placement.NetUid)
}

function readPlacementNumber(value: number | string): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  const parsedValue = Number(value)

  return Number.isFinite(parsedValue) ? parsedValue : 0
}

function toOptionalNumber(value: number | ''): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function getPanelFromQuery(searchParams: URLSearchParams): ProductDetailPanel | null {
  const panel = searchParams.get('panel')

  return panel && panelValues.has(panel as ProductDetailPanel) ? (panel as ProductDetailPanel) : null
}

function getProductPanelKey(product: Product): string {
  return `${product.NetUid || product.Id || 'product'}-${product.Updated || ''}`
}

function getPanelTitle(panel: ProductDetailPanel, t: (key: string) => string): string {
  switch (panel) {
    case 'analytics':
      return t('AI-аналітика товару')
    case 'audit':
      return t('Історія змін полів')
    case 'edit':
      return t('Редагувати товар')
    case 'images':
      return t('Зображення')
    case 'movement':
      return t('Рух товару')
    case 'remains':
      return t('Залишки по партіям')
    case 'specification':
      return t('Специфікація')
    case 'storage-history':
      return t('Історія місця зберігання')
    case 'writeoff':
      return t('Правила списання')
    default:
      return t('Товар')
  }
}

function getTodayDate(): string {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${date.getFullYear()}-${month}-${day}`
}

function getDateDaysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${date.getFullYear()}-${month}-${day}`
}

function formatDate(value?: Date | string | null): string {
  if (!value) {
    return '-'
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? String(value) : dateFormatter.format(date)
}

function formatDateTime(value?: Date | string | null): string {
  if (!value) {
    return '-'
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? String(value) : dateTimeFormatter.format(date)
}

function formatStorageLocationType(type: number | undefined, t: (key: string) => string): string {
  switch (type) {
    case 0:
      return t('Редагування')
    case 1:
      return t('Розміщення')
    case 2:
      return t('Замовлення постачання')
    case 3:
      return t('Переміщення')
    default:
      return t('Невідомо')
  }
}

function formatStorageLocationQty(row: ProductStorageLocationHistory): string {
  if (typeof row.Qty !== 'number') {
    return '-'
  }

  if (row.AdditionType === 1) {
    return `-${formatAmount(Math.abs(row.Qty))}`
  }

  if (typeof row.AdditionType === 'number') {
    return `+${formatAmount(Math.abs(row.Qty))}`
  }

  return formatAmount(row.Qty)
}

function getProductGroupsFromProduct(product: Product): ProductGroup[] {
  return (product.ProductProductGroups || []).reduce<ProductGroup[]>((groups, relation) => {
    if (!relation.Deleted && relation.ProductGroup && !relation.ProductGroup.Deleted) {
      groups.push(relation.ProductGroup)
    }

    return groups
  }, [])
}

function mergeProductGroups(...collections: ProductGroup[][]): ProductGroup[] {
  const groupsByKey = new Map<string, ProductGroup>()

  collections.flat().forEach((group) => {
    const key = getProductGroupKey(group)

    if (!key) {
      return
    }

    groupsByKey.set(key, {
      ...groupsByKey.get(key),
      ...group,
    })
  })

  return [...groupsByKey.values()]
}

function getProductGroupKey(group: ProductGroup): string {
  if (group.NetUid) {
    return `net:${group.NetUid}`
  }

  if (typeof group.Id === 'number') {
    return `id:${group.Id}`
  }

  return group.Name ? `name:${group.Name}` : ''
}

function getProductGroupLabel(group?: ProductGroup | null): string {
  if (!group) {
    return ''
  }

  return group.FullName || group.Name || group.NetUid || (typeof group.Id === 'number' ? String(group.Id) : '')
}

function formatRuleType(type: number | undefined): string {
  switch (type) {
    case 0:
      return 'Списати по вазі'
    case 1:
      return 'Списати по ціні'
    case 2:
      return 'Списати по календарю'
    default:
      return 'Невідомий тип'
  }
}

function getDateRangeError(dateFrom: string, dateTo: string, t: (key: string) => string): string | null {
  if (!dateFrom || !dateTo) {
    return t('Вкажіть дату початку та дату завершення')
  }

  if (dateFrom > dateTo) {
    return t('Дата початку не може бути пізнішою за дату завершення')
  }

  return null
}

function formatRuleLocale(locale: string | undefined): string {
  switch (locale) {
    case 'uk':
      return 'Україна'
    case 'pl':
      return 'Польща'
    default:
      return 'Невідомий регіон'
  }
}

function getProductWriteOffRuleKey(rule: ProductWriteOffRule): string {
  if (rule.NetUid) {
    return `net:${rule.NetUid}`
  }

  if (typeof rule.Id === 'number') {
    return `id:${rule.Id}`
  }

  return [
    'scope',
    rule.RuleLocale || '',
    rule.RuleType ?? '',
    rule.Product?.NetUid || rule.ProductId || '',
    rule.ProductGroup?.NetUid || rule.ProductGroupId || '',
  ].join(':')
}

function upsertProductWriteOffRule(rows: ProductWriteOffRule[], nextRule: ProductWriteOffRule): ProductWriteOffRule[] {
  const nextKey = getProductWriteOffRuleKey(nextRule)

  if (!nextKey) {
    return rows.concat(nextRule)
  }

  const existingIndex = rows.findIndex((row) => getProductWriteOffRuleKey(row) === nextKey)

  if (existingIndex === -1) {
    return rows.concat(nextRule)
  }

  return rows.map((row, index) => (index === existingIndex ? nextRule : row))
}
