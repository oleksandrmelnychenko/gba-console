import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Divider,
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
  Switch,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core'
import { AppDrawer } from "../../../shared/ui/AppDrawer"
import { AppModal } from '../../../shared/ui/AppModal'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconArrowLeft,
  IconArrowsExchange,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconClipboardList,
  IconDeviceFloppy,
  IconDownload,
  IconEdit,
  IconFileDescription,
  IconFileTypePdf,
  IconFileTypeXls,
  IconHistory,
  IconPackage,
  IconPhoto,
  IconPlus,
  IconRefresh,
  IconTrash,
} from '@tabler/icons-react'
import { type FormEvent, useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PermissionGate } from '../../auth/components/PermissionGate'
import {
  addOrUpdateProductWriteOffRule,
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
  ProductSpecification,
  ProductStorageLocationHistory,
  ProductWriteOffRule,
} from '../types'
import {
  displayValue,
  formatAmount,
  formatPrice,
  getBooleanBadgeColor,
  getProductAvailableQty,
  getProductCode,
  getProductGroupNames,
  getProductMainImage,
  getProductMainOriginalNumber,
  getProductOriginalNumbers,
  getProductTitle,
} from '../utils'

export type ProductDetailPanel = 'audit' | 'edit' | 'images' | 'movement' | 'remains' | 'specification' | 'storage-history' | 'writeoff'

export const PRODUCT_BALANCES_PERMISSION = 'Product_Entire_Assortment_BalancesOnParties_Btn_PKEY'
export const PRODUCT_EDIT_PERMISSION = 'Product_Entire_Assortment_EditBtn_PKEY'
const PRODUCT_IMAGE_ADD_PERMISSION = 'Product_Entire_Assortment_Picture_AddBtn_PKEY'
const PRODUCT_IMAGE_DELETE_PERMISSION = 'Product_Entire_Assortment_Picture_DelBtn_PKEY'
export const PRODUCT_MOVEMENT_PERMISSION = 'Product_Entire_Assortment_Product_Movement_Btn_PKEY'
export const PRODUCT_WRITE_OFF_PERMISSION = 'Product_Entire_Assortment_Product_WriteOff_Rule_Btn_PKEY'
type ProductWriteOffRuleScope = 'group' | 'product'

type ProductEditForm = {
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
  { label: 'Замовлення постачання в Україну', value: 4 },
  { label: 'Акт уцінки', value: 5 },
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
  const prices = useMemo(() => product?.CalculatedPrices?.slice(0, 8) || [], [product])

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

  if (!netId) {
    return <Navigate to="/products" replace />
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <Group align="flex-start" gap="sm" wrap="nowrap">
          <Tooltip label={t('Назад')}>
            <ActionIcon aria-label={t('Назад')} color="gray" variant="light" onClick={() => navigate('/products')}>
              <IconArrowLeft size={18} />
            </ActionIcon>
          </Tooltip>
          <Box>
            <Text fw={600} size="sm">
              {product ? getProductCode(product) : t('Товар')}
            </Text>
            <Text c="dimmed" size="sm">
              {product ? getProductTitle(product) : t('Завантаження')}
            </Text>
          </Box>
        </Group>
        <Group gap="xs" justify="flex-end">
          {product && <ProductActionToolbar openPanel={openPanel} />}
          <Tooltip label={t('Оновити')}>
            <ActionIcon
              aria-label={t('Оновити')}
              color="gray"
              loading={isLoading}
              size={38}
              variant="light"
              onClick={() => reload()}
            >
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {error}
        </Alert>
      )}

      {!error && !isLoading && !product && (
        <Alert color="yellow" icon={<IconAlertCircle size={18} />} variant="light">
          {t('Товар не знайдено')}
        </Alert>
      )}

      {product && (
        <>
          <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="md">
            <Card withBorder radius="md" padding="md">
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
                    <IconPhoto size={48} color="var(--mantine-color-gray-5)" />
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

            <Card withBorder radius="md" padding="md">
              <Stack gap="xs">
                <Title order={4}>{t('Основне')}</Title>
                <InfoRow label="Код" value={getProductCode(product)} />
                <InfoRow label="Назва" value={getProductTitle(product)} />
                <InfoRow label="Групи" value={getProductGroupNames(product)} />
                <InfoRow label="Оригінальний номер" value={getProductMainOriginalNumber(product)} />
                <InfoRow label="Одиниця" value={product.MeasureUnit?.Name} />
                <InfoRow label="Top" value={product.Top} />
              </Stack>
            </Card>

            <Card withBorder radius="md" padding="md">
                <ProductStockSummary
                  product={product}
                  reservation={reservation}
                  reservationError={reservationError}
                  onProductSaved={handleProductSaved}
                />
            </Card>
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
            <Card withBorder radius="md" padding="md">
              <Stack gap="xs">
                <Title order={4}>{t('Опис')}</Title>
                <InfoRow label="Опис" value={product.DescriptionUA || product.Description} multiline />
                <InfoRow label="Нотатки" value={product.NotesUA || product.Notes} multiline />
                <InfoRow label="Синоніми UA" value={product.SynonymsUA} />
              </Stack>
            </Card>

            <Card withBorder radius="md" padding="md">
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
            <Card withBorder radius="md" padding="md">
              <Stack gap="xs">
                <Title order={4}>{t('Ціни')}</Title>
                <InfoRow label="EUR" value={formatPrice(product.CurrentPrice)} />
                <InfoRow label="Локальна" value={formatPrice(product.CurrentLocalPrice)} />
                <InfoRow label="EUR перепродаж" value={formatPrice(product.CurrentPriceReSale)} />
                <InfoRow label="Локальна перепродаж" value={formatPrice(product.CurrentLocalPriceReSale)} />
                {prices.length > 0 && (
                  <Stack gap={4} mt="xs">
                    {prices.map((price, index) => (
                      <PriceRow key={`${price.Pricing?.NetUid || price.Pricing?.Name || index}`} price={price} />
                    ))}
                  </Stack>
                )}
              </Stack>
            </Card>

            <Card withBorder radius="md" padding="md">
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

function ProductActionToolbar({ openPanel }: { openPanel: (panel: ProductDetailPanel) => void }) {
  const { t } = useI18n()

  return (
    <Group gap="xs" justify="flex-end">
      <Tooltip label={t('Історія місця зберігання')}>
        <ActionIcon aria-label={t('Історія місця зберігання')} color="gray" size={38} variant="light" onClick={() => openPanel('storage-history')}>
          <IconHistory size={18} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label={t('Історія змін полів')}>
        <ActionIcon aria-label={t('Історія змін полів')} color="gray" size={38} variant="light" onClick={() => openPanel('audit')}>
          <IconClipboardList size={18} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label={t('Специфікація')}>
        <ActionIcon aria-label={t('Специфікація')} color="gray" size={38} variant="light" onClick={() => openPanel('specification')}>
          <IconFileDescription size={18} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label={t('Зображення')}>
        <ActionIcon aria-label={t('Зображення')} color="gray" size={38} variant="light" onClick={() => openPanel('images')}>
          <IconPhoto size={18} />
        </ActionIcon>
      </Tooltip>
      <PermissionGate permissionKey={PRODUCT_BALANCES_PERMISSION}>
        <Tooltip label={t('Залишки по партіям')}>
          <ActionIcon aria-label={t('Залишки по партіям')} color="gray" size={38} variant="light" onClick={() => openPanel('remains')}>
            <IconPackage size={18} />
          </ActionIcon>
        </Tooltip>
      </PermissionGate>
      <PermissionGate permissionKey={PRODUCT_EDIT_PERMISSION}>
        <Tooltip label={t('Редагувати')}>
          <ActionIcon aria-label={t('Редагувати')} color="gray" size={38} variant="light" onClick={() => openPanel('edit')}>
            <IconEdit size={18} />
          </ActionIcon>
        </Tooltip>
      </PermissionGate>
      <PermissionGate permissionKey={PRODUCT_MOVEMENT_PERMISSION}>
        <Tooltip label={t('Рух товару')}>
          <ActionIcon aria-label={t('Рух товару')} color="gray" size={38} variant="light" onClick={() => openPanel('movement')}>
            <IconArrowsExchange size={18} />
          </ActionIcon>
        </Tooltip>
      </PermissionGate>
      <PermissionGate permissionKey={PRODUCT_WRITE_OFF_PERMISSION}>
        <Tooltip label={t('Правила списання')}>
          <ActionIcon aria-label={t('Правила списання')} color="gray" size={38} variant="light" onClick={() => openPanel('writeoff')}>
            <IconClipboardList size={18} />
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
  onProductSaved,
  product,
  reservation,
  reservationError,
}: {
  onProductSaved?: (product: Product | null) => void
  product: Product
  reservation: ProductReservation
  reservationError: string | null
}) {
  const { t } = useI18n()
  const availabilityItems = product.ProductAvailabilities || []

  return (
    <Stack gap="xs">
      <Title order={4}>{t('Залишки')}</Title>
      {reservationError && (
        <Alert color="yellow" icon={<IconAlertCircle size={18} />} variant="light">
          {reservationError}
        </Alert>
      )}
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={8}>
        <TotalQtyTile label={t('Усього доступно')} value={getProductAvailableQty(product)} />
        <TotalQtyTile label={t('Україна')} value={product.AvailableQtyUk} />
        <TotalQtyTile label={t('Україна ПДВ')} value={product.AvailableQtyUkVAT} />
        <TotalQtyTile label={t('У дорозі')} value={product.AvailableQtyRoad} />
        <TotalQtyTile label={`${t('Резерв в корзині')} UK`} value={reservation.TotalCartReservedUK} />
        <TotalQtyTile label={`${t('Резерв в корзині')} PL`} value={reservation.TotalCartReservedPL} />
        <TotalQtyTile label={t('В рахунках в Україні')} value={reservation.TotalReservedUK} />
        <TotalQtyTile label={t('В рахунках в Польщі')} value={reservation.TotalReservedPL} />
        <TotalQtyTile label={t('В рахунку в ресейлі')} value={reservation.TotalProductReSaleQty} />
        {reservation.SupplyOrderUkraineCartItem && (
          <TotalQtyTile label={t('В кошику постачання Україна')} value={reservation.SupplyOrderUkraineCartItem.ReservedQty} />
        )}
      </SimpleGrid>

      {availabilityItems.length > 0 && (
        <>
          <Divider my={4} />
          <Stack gap={6}>
            {availabilityItems.map((availability, index) => (
              <ProductAvailabilityPlacementRow
                availability={availability}
                key={`${availability.StorageId || availability.Storage?.Name || index}`}
                onProductSaved={onProductSaved}
              />
            ))}
          </Stack>
        </>
      )}
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
  const [opened, setOpened] = useState(false)
  const placements = availability.Storage?.ProductPlacements || []
  const hasPlacements = placements.length > 0
  const content = (
    <Group
      justify="space-between"
      gap="sm"
      wrap="nowrap"
      style={{
        border: '1px solid var(--mantine-color-gray-2)',
        borderRadius: 6,
        cursor: hasPlacements ? 'pointer' : 'default',
        padding: '6px 8px',
      }}
    >
      <Box style={{ minWidth: 0 }}>
        <Text size="sm" fw={600} lineClamp={1}>
          {displayValue(availability.Storage?.Name)}
        </Text>
        <Text size="xs" c="dimmed" lineClamp={1}>
          {displayValue(availability.Storage?.Organization?.Name)}
        </Text>
      </Box>
      <Text size="sm" fw={700}>
        {formatAmount(availability.Amount)}
      </Text>
    </Group>
  )

  if (!hasPlacements) {
    return content
  }

  return (
    <Popover opened={opened} position="bottom-start" shadow="md" width={760} withinPortal onChange={setOpened}>
      <Popover.Target>
        <Box role="button" tabIndex={0} onClick={() => setOpened((currentOpened) => !currentOpened)} onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            setOpened((currentOpened) => !currentOpened)
          }
        }}>
          {content}
        </Box>
      </Popover.Target>
      <Popover.Dropdown>
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
  const [drafts, setDrafts] = useState<ProductPlacementDraft[]>(() => cloneProductPlacements(placements))
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setEditing] = useState(false)
  const [isSaving, setSaving] = useState(false)
  const originalTotal = useMemo(() => sumProductPlacementQty(placements), [placements])
  const draftTotal = useMemo(() => sumProductPlacementQty(drafts), [drafts])
  const groupedPlacements = useMemo(() => groupProductPlacements(drafts), [drafts])

  function startEditing() {
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
    if (Math.abs(draftTotal - originalTotal) > 0.00001) {
      setError(t('Сума кількості по місцях має збігатися із залишком складу'))
      return
    }

    setSaving(true)
    setError(null)

    try {
      await updateProductPlacements(drafts.map(stripProductPlacementDraft))
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
    <Stack gap="sm">
      <Group justify="space-between" gap="sm" wrap="nowrap">
        <Box style={{ minWidth: 0 }}>
          <Text fw={700} size="sm" lineClamp={1}>{displayValue(availability.Storage?.Name)}</Text>
          <Text c="dimmed" size="xs" lineClamp={1}>{displayValue(availability.Storage?.Organization?.Name)}</Text>
        </Box>
        <Group gap="xs" wrap="nowrap">
          <Badge color={Math.abs(draftTotal - originalTotal) > 0.00001 ? 'red' : 'green'} variant="light">
            {formatAmount(draftTotal)} / {formatAmount(originalTotal)}
          </Badge>
          {!isEditing ? (
            <Button size="xs" variant="light" leftSection={<IconEdit size={14} />} onClick={startEditing}>
              {t('Редагувати')}
            </Button>
          ) : null}
        </Group>
      </Group>

      {error ? (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {error}
        </Alert>
      ) : null}

      {isEditing ? (
        <Stack gap="xs">
          <ScrollArea mah={320}>
            <Table withTableBorder miw={680}>
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
                        size="xs"
                        value={placement.StorageNumber || ''}
                        onChange={(event) => updatePlacementDraft(index, 'StorageNumber', event.currentTarget.value)}
                      />
                    </Table.Td>
                    <Table.Td>
                      <TextInput
                        size="xs"
                        value={placement.RowNumber || ''}
                        onChange={(event) => updatePlacementDraft(index, 'RowNumber', event.currentTarget.value)}
                      />
                    </Table.Td>
                    <Table.Td>
                      <TextInput
                        size="xs"
                        value={placement.CellNumber || ''}
                        onChange={(event) => updatePlacementDraft(index, 'CellNumber', event.currentTarget.value)}
                      />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        hideControls
                        min={0}
                        size="xs"
                        value={placement.Qty || 0}
                        onChange={(value) => updatePlacementDraft(index, 'Qty', readPlacementNumber(value))}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Tooltip label={t('Видалити новий рядок')}>
                        <ActionIcon
                          aria-label={t('Видалити новий рядок')}
                          color="red"
                          disabled={isPersistedPlacement(placement)}
                          size="sm"
                          variant="light"
                          onClick={() => removeLocalPlacement(index)}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Tooltip>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
          <Group justify="space-between" gap="sm">
            <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={addPlacement}>
              {t('Додати місце')}
            </Button>
            <Group gap="xs">
              <Button size="xs" color="gray" variant="light" disabled={isSaving} onClick={cancelEditing}>
                {t('Скасувати')}
              </Button>
              <Button size="xs" leftSection={<IconDeviceFloppy size={14} />} loading={isSaving} onClick={() => void savePlacements()}>
                {t('Зберегти')}
              </Button>
            </Group>
          </Group>
        </Stack>
      ) : (
        <ScrollArea mah={300}>
          <Table striped withTableBorder miw={540}>
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
                  <Table.Td>{placementGroup.label}</Table.Td>
                  <Table.Td ta="right">{formatAmount(placementGroup.qty)}</Table.Td>
                  <Table.Td ta="right">{placementGroup.count}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}
    </Stack>
  )
}

function TotalQtyTile({ label, value }: { label: string; value?: number | null }) {
  return (
    <Box
      style={{
        background: 'var(--mantine-color-gray-0)',
        border: '1px solid var(--mantine-color-gray-2)',
        borderRadius: 6,
        padding: '8px 10px',
      }}
    >
      <Text size="xs" c="dimmed" lineClamp={1}>
        {label}
      </Text>
      <Text size="md" fw={700}>
        {formatAmount(value)}
      </Text>
    </Box>
  )
}

export function ProductActionDrawer({
  activePanel,
  onClose,
  onProductSaved,
  onReload,
  product,
}: {
  activePanel: ProductDetailPanel | null
  onClose: () => void
  onProductSaved: (product: Product | null) => void
  onReload: () => void
  product: Product
}) {
  const { t } = useI18n()

  return (
    <AppDrawer
      opened={Boolean(activePanel)}
      position="right"
      size="min(1180px, 100vw)"
      title={activePanel ? getPanelTitle(activePanel, t) : ''}
      onClose={onClose}
    >
      {activePanel === 'audit' && <ProductAuditPanel key={getProductPanelKey(product)} product={product} />}
      {activePanel === 'edit' && (
        <PermissionGate permissionKey={PRODUCT_EDIT_PERMISSION} fallback={<ProductPermissionDeniedAlert />}>
          <ProductEditPanel key={getProductPanelKey(product)} product={product} onProductSaved={onProductSaved} />
        </PermissionGate>
      )}
      {activePanel === 'images' && <ProductImagesPanel key={getProductPanelKey(product)} product={product} onProductSaved={onProductSaved} />}
      {activePanel === 'movement' && (
        <PermissionGate permissionKey={PRODUCT_MOVEMENT_PERMISSION} fallback={<ProductPermissionDeniedAlert />}>
          <ProductMovementPanel product={product} />
        </PermissionGate>
      )}
      {activePanel === 'remains' && (
        <PermissionGate permissionKey={PRODUCT_BALANCES_PERMISSION} fallback={<ProductPermissionDeniedAlert />}>
          <ProductConsignmentRemainingsPanel product={product} />
        </PermissionGate>
      )}
      {activePanel === 'specification' && <ProductSpecificationPanel product={product} />}
      {activePanel === 'storage-history' && <ProductStorageHistoryPanel product={product} />}
      {activePanel === 'writeoff' && (
        <PermissionGate permissionKey={PRODUCT_WRITE_OFF_PERMISSION} fallback={<ProductPermissionDeniedAlert />}>
          <ProductWriteOffRulesPanel product={product} onChanged={onReload} />
        </PermissionGate>
      )}
    </AppDrawer>
  )
}

function ProductPermissionDeniedAlert() {
  const { t } = useI18n()

  return (
    <Alert color="yellow" icon={<IconAlertCircle size={18} />} variant="light">
      {t('Недостатньо прав для цієї дії')}
    </Alert>
  )
}

function ProductEditPanel({ onProductSaved, product }: { onProductSaved: (product: Product | null) => void; product: Product }) {
  const { t } = useI18n()
  const [form, setForm] = useState<ProductEditForm>(() => createProductEditForm(product))
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
    <form onSubmit={submitForm}>
      <Stack gap="md">
        {error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        )}
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <TextInput label={t('Top')} value={form.Top} maxLength={3} onChange={(event) => setField('Top', event.currentTarget.value)} />
          <TextInput label={t('Розмір')} value={form.Size} onChange={(event) => setField('Size', event.currentTarget.value)} />
          <TextInput label={t("Об'єм")} value={form.Volume} onChange={(event) => setField('Volume', event.currentTarget.value)} />
          <NumberInput label={t('Вага')} value={form.Weight ?? ''} min={0} onChange={(value) => setField('Weight', typeof value === 'number' ? value : null)} />
          <TextInput label={t('Норма пакування')} value={form.OrderStandard} onChange={(event) => setField('OrderStandard', event.currentTarget.value)} />
          <TextInput label={t('Пакування')} value={form.PackingStandard} onChange={(event) => setField('PackingStandard', event.currentTarget.value)} />
          <TextInput label={t('Синоніми UA')} value={form.SynonymsUA} onChange={(event) => setField('SynonymsUA', event.currentTarget.value)} />
        </SimpleGrid>
        <Textarea autosize minRows={3} label={t('Опис')} value={form.Description} onChange={(event) => setField('Description', event.currentTarget.value)} />
        <Textarea autosize minRows={3} label={t('Опис UA')} value={form.DescriptionUA} onChange={(event) => setField('DescriptionUA', event.currentTarget.value)} />
        <Textarea autosize minRows={3} label={t('Нотатки')} value={form.Notes} onChange={(event) => setField('Notes', event.currentTarget.value)} />
        <Textarea autosize minRows={3} label={t('Нотатки UA')} value={form.NotesUA} onChange={(event) => setField('NotesUA', event.currentTarget.value)} />
        <Group gap="lg">
          <Switch checked={form.IsForZeroSale} label={t('Нульовий продаж')} onChange={(event) => setField('IsForZeroSale', event.currentTarget.checked)} />
          <Switch checked={form.IsForSale} label={t('Для продажу')} onChange={(event) => setField('IsForSale', event.currentTarget.checked)} />
        </Group>
        <Group justify="flex-end">
          <Button type="submit" loading={isSaving} leftSection={<IconDeviceFloppy size={18} />}>
            {t('Зберегти')}
          </Button>
        </Group>
      </Stack>
    </form>
  )
}

function ProductImagesPanel({ onProductSaved, product }: { onProductSaved: (product: Product | null) => void; product: Product }) {
  const { t } = useI18n()
  const [images, setImages] = useState<ProductImage[]>(() => [...(product.ProductImages || [])])
  const [files, setFiles] = useState<File[]>([])
  const [filePreviews, setFilePreviews] = useState<SelectedProductImagePreview[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setSaving] = useState(false)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
  const originalImages = product.ProductImages || []
  const hasChanges = files.length > 0 || images.some((image, index) => image !== (product.ProductImages || [])[index])
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
    <Stack gap="md">
      {error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {error}
        </Alert>
      )}
      <Group align="end" justify="space-between" gap="md">
        <PermissionGate permissionKey={PRODUCT_IMAGE_ADD_PERMISSION}>
          <FileInput
            multiple
            clearable
            accept="image/*"
            label={t('Додати зображення')}
            placeholder={t('Оберіть файли')}
            value={files}
            style={{ flex: '1 1 280px' }}
            onChange={(nextFiles) => updateSelectedFiles(nextFiles || [])}
          />
        </PermissionGate>
        <Group gap="xs" wrap="nowrap">
          <Button variant="light" color="gray" leftSection={<IconRefresh size={18} />} disabled={!hasChanges || isSaving} onClick={resetImageChanges}>
            {t('Скасувати')}
          </Button>
          <Button leftSection={<IconDeviceFloppy size={18} />} loading={isSaving} disabled={!hasChanges} onClick={saveImages}>
            {t('Зберегти')}
          </Button>
        </Group>
      </Group>
      {displayedImages.length === 0 && filePreviews.length === 0 ? (
        <Text c="dimmed" size="sm">
          {t('Зображень не знайдено')}
        </Text>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {displayedImages.map(({ image, index }) => (
            <Box
              key={`${image.NetUid || image.FileName || index}`}
              style={{
                border: '1px solid var(--mantine-color-gray-2)',
                borderRadius: 6,
                opacity: image.Deleted ? 0.55 : 1,
                padding: 10,
              }}
            >
              <Stack gap="sm">
                <button
                  type="button"
                  style={{ background: 'transparent', border: 0, cursor: 'zoom-in', padding: 0 }}
                  onClick={() => setPreviewImageUrl(image.ImageUrl || null)}
                >
                  <Image src={image.ImageUrl} alt={image.FileName || getProductTitle(product)} h={190} fit="contain" radius="sm" />
                </button>
                <Group justify="space-between" gap="xs" wrap="nowrap">
                  <Badge color={image.Deleted ? 'red' : image.IsMainImage ? 'green' : 'gray'} variant="light">
                    {image.Deleted ? t('Буде видалено') : image.IsMainImage ? t('Головне') : t('Зображення')}
                  </Badge>
                  <PermissionGate permissionKey={PRODUCT_IMAGE_DELETE_PERMISSION}>
                    <Group gap={4} wrap="nowrap">
                      <Tooltip label={t('Зробити головним')}>
                        <ActionIcon color="gray" variant="light" disabled={image.Deleted || image.IsMainImage} onClick={() => makeMain(image)}>
                          <IconCheck size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label={t('Видалити')}>
                        <ActionIcon color="red" variant="light" disabled={image.Deleted} onClick={() => removeImage(image)}>
                          <IconTrash size={16} />
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
              style={{ border: '1px solid var(--mantine-color-gray-2)', borderRadius: 6, padding: 10 }}
            >
              <Stack gap="sm">
                <button
                  type="button"
                  style={{ background: 'transparent', border: 0, cursor: 'zoom-in', padding: 0 }}
                  onClick={() => setPreviewImageUrl(preview.url)}
                >
                  <Image src={preview.url} alt={preview.file.name || getProductTitle(product)} h={190} fit="contain" radius="sm" />
                </button>
                <Group justify="space-between" gap="xs" wrap="nowrap">
                  <Badge color="violet" variant="light">
                    {t('Нове')}
                  </Badge>
                  <Text size="sm" c="dimmed" truncate="end">
                    {preview.file.name}
                  </Text>
                </Group>
              </Stack>
            </Box>
          ))}
        </SimpleGrid>
      )}
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
    <Stack gap="md">
      <Select
        data={productAuditFieldOptions.map((option) => ({ ...option, label: t(option.label) }))}
        label={t('Поле')}
        value={field}
        w={260}
        onChange={(value) => setField((value as ProductAuditField) || 'Description')}
      />
      {activeError && <Alert color={missingNetUidError ? 'yellow' : 'red'} icon={<IconAlertCircle size={18} />} variant="light">{activeError}</Alert>}
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
              <Group justify="space-between" gap="xs" wrap="nowrap" mt={4}>
                <Text c="dimmed" size="xs">{displayValue(entry.UpdatedBy)}</Text>
                <Text c="dimmed" size="xs">{formatDate(entry.Created)}</Text>
              </Group>
            </Box>
          ))}
        </Stack>
      ) : null}
    </Stack>
  )
}

function ProductSpecificationPanel({ product }: { product: Product }) {
  const { t } = useI18n()
  const specifications = useMemo(() => sortSpecificationsByCreatedDesc(product.ProductSpecifications || []), [product])
  const currentSpecification = specifications[0] || null
  const historySpecifications = specifications.slice(1)

  if (specifications.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        {t('Специфікацій не знайдено')}
      </Text>
    )
  }

  return (
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
      <Card withBorder radius="md" padding="md">
        <Stack gap="xs">
          <Title order={5}>{t('Поточний')}</Title>
          {currentSpecification ? (
            <Stack gap={4}>
              <Text fw={700} size="sm">{displayValue(currentSpecification.SpecificationCode)}</Text>
              {currentSpecification.Name ? <Text c="dimmed" size="sm">{currentSpecification.Name}</Text> : null}
              <SimpleGrid cols={3} spacing={6} mt={4}>
                <InfoBlock label="Митна вартість" value={displayValue(currentSpecification.CustomsValue)} />
                <InfoBlock label="Мито" value={displayValue(currentSpecification.Duty)} />
                <InfoBlock label="ПДВ" value={displayValue(currentSpecification.VATValue)} />
              </SimpleGrid>
              <Text c="dimmed" size="xs" mt={4}>
                {[formatSpecificationAuthor(currentSpecification), formatDate(currentSpecification.Created)].filter((part) => part && part !== '-').join(' · ')}
              </Text>
            </Stack>
          ) : (
            <Text c="dimmed" size="sm">{t('Немає поточного коду')}</Text>
          )}
        </Stack>
      </Card>

      <Card withBorder radius="md" padding="md">
        <Stack gap="xs">
          <Title order={5}>{t('Історія')}</Title>
          {historySpecifications.length === 0 ? (
            <Text c="dimmed" size="sm">{t('Історію не знайдено')}</Text>
          ) : (
            <ScrollArea mah={420}>
              <Stack gap="xs">
                {historySpecifications.map((specification, index) => (
                  <Box
                    key={`${specification.NetUid || specification.Id || index}`}
                    style={{
                      border: '1px solid var(--mantine-color-gray-2)',
                      borderRadius: 6,
                      padding: '8px 10px',
                    }}
                  >
                    <Group justify="space-between" gap="xs" wrap="nowrap">
                      <Text fw={600} size="sm">{displayValue(specification.SpecificationCode)}</Text>
                      <Text c="dimmed" size="xs">{formatDate(specification.Created)}</Text>
                    </Group>
                    <Text c="dimmed" size="xs">{formatSpecificationAuthor(specification)}</Text>
                  </Box>
                ))}
              </Stack>
            </ScrollArea>
          )}
        </Stack>
      </Card>
    </SimpleGrid>
  )
}

function ProductConsignmentRemainingsPanel({ product }: { product: Product }) {
  const { t } = useI18n()
  const productNetUid = product.NetUid?.trim()
  const missingNetUidError = productNetUid ? null : t('У товару немає NetUid для завантаження залишків по партіям')
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
  }, [productNetUid, t])

  if (missingNetUidError) {
    return <Alert color="yellow" icon={<IconAlertCircle size={18} />} variant="light">{missingNetUidError}</Alert>
  }

  if (isLoading) {
    return <LoadingState label={t('Завантаження залишків')} />
  }

  if (error) {
    return <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">{error}</Alert>
  }

  if (rows.length === 0) {
    return <Text c="dimmed" size="sm">{t('Залишків по партіям не знайдено')}</Text>
  }

  return (
    <ScrollArea>
      <Table striped highlightOnHover withTableBorder miw={1480}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('Склад')}</Table.Th>
            <Table.Th>{t('Постачальник')}</Table.Th>
            <Table.Th>{t('Дата')}</Table.Th>
            <Table.Th>{t('Інвойс')}</Table.Th>
            <Table.Th>{t('Прихід')}</Table.Th>
            <Table.Th ta="right">{t('Залишок')}</Table.Th>
            <Table.Th ta="right">{t('Нетто')}</Table.Th>
            <Table.Th ta="right">{t('Загальна нетто')}</Table.Th>
            <Table.Th ta="right">{t('Брутто')}</Table.Th>
            <Table.Th ta="right">{t('Облікова брутто')}</Table.Th>
            <Table.Th>{t('Валюта')}</Table.Th>
            <Table.Th>{t('Організація')}</Table.Th>
            <Table.Th ta="right">{t('Вага')}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row, index) => (
            <Table.Tr key={`${row.NetUid || row.Id || row.InvoiceNumber || index}`}>
              <Table.Td>{displayValue(row.StorageName)}</Table.Td>
              <Table.Td>{displayValue(row.SupplierName)}</Table.Td>
              <Table.Td>{formatDate(row.FromDate)}</Table.Td>
              <Table.Td>{displayValue(row.InvoiceNumber)}</Table.Td>
              <Table.Td>{displayValue(row.ProductIncomeNumber)}</Table.Td>
              <Table.Td ta="right">{formatAmount(row.RemainingQty)}</Table.Td>
              <Table.Td ta="right">{formatPrice(row.NetPrice)}</Table.Td>
              <Table.Td ta="right">{formatPrice(row.TotalNetPrice)}</Table.Td>
              <Table.Td ta="right">{formatPrice(row.GrossPrice)}</Table.Td>
              <Table.Td ta="right">{formatPrice(row.AccountingGrossPrice)}</Table.Td>
              <Table.Td>{displayValue(row.CurrencyName)}</Table.Td>
              <Table.Td>{displayValue(row.OrganizationName)}</Table.Td>
              <Table.Td ta="right">{formatAmount(row.Weight)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </ScrollArea>
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
  const filterError = getDateRangeError(dateFrom, dateTo, t)
  const missingNetUidError = productNetUid ? null : t('У товару немає NetUid для завантаження історії місця зберігання')
  const activeError = filterError || missingNetUidError || error
  const total = rows[0]?.TotalRowsQty
  const canMoveBack = page > 1
  const canMoveForward = typeof total === 'number' ? page * pageSize < total : rows.length === pageSize

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
  }, [dateFrom, dateTo, filterError, page, pageSize, productNetUid, t])

  return (
    <Stack gap="md">
      <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
        <TextInput label={t('З')} type="date" value={dateFrom} onChange={(event) => { setPage(1); setDateFrom(event.currentTarget.value) }} />
        <TextInput label={t('По')} type="date" value={dateTo} onChange={(event) => { setPage(1); setDateTo(event.currentTarget.value) }} />
        <Select label={t('Розмір сторінки')} data={pageSizeOptions} value={String(pageSize)} w={140} onChange={(value) => { setPage(1); setPageSize(Number(value || 20)) }} />
        <Group gap="xs">
          <ActionIcon aria-label={t('Попередня сторінка')} color="gray" disabled={!canMoveBack || isLoading || Boolean(filterError)} variant="light" onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}>
            <IconChevronLeft size={18} />
          </ActionIcon>
          <ActionIcon aria-label={t('Наступна сторінка')} color="gray" disabled={!canMoveForward || isLoading || Boolean(filterError)} variant="light" onClick={() => setPage((currentPage) => currentPage + 1)}>
            <IconChevronRight size={18} />
          </ActionIcon>
        </Group>
      </Group>
      {activeError && <Alert color={filterError || missingNetUidError ? 'yellow' : 'red'} icon={<IconAlertCircle size={18} />} variant="light">{activeError}</Alert>}
      {isLoading ? (
        <LoadingState label={t('Завантаження історії')} />
      ) : rows.length === 0 && !activeError ? (
        <Text c="dimmed" size="sm">{t('Історію місця зберігання не знайдено')}</Text>
      ) : !activeError ? (
        <ScrollArea>
          <Table striped highlightOnHover withTableBorder miw={980}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('Дата')}</Table.Th>
                <Table.Th>{t('Товар')}</Table.Th>
                <Table.Th>{t('Склад')}</Table.Th>
                <Table.Th>{t('Місце')}</Table.Th>
                <Table.Th>{t('Статус')}</Table.Th>
                <Table.Th ta="right">{t('Кількість')}</Table.Th>
                <Table.Th>{t('Відповідальний')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((row, index) => (
                <Table.Tr key={`${row.NetUid || row.Id || index}`}>
                  <Table.Td>{formatDateTime(row.Created)}</Table.Td>
                  <Table.Td>{displayValue(row.Product?.VendorCode || row.Product?.NameUA || row.Product?.Name)}</Table.Td>
                  <Table.Td>{displayValue(row.Storage?.Name)}</Table.Td>
                  <Table.Td>{displayValue(row.Placement)}</Table.Td>
                  <Table.Td>{formatStorageLocationType(row.StorageLocationType, t)}</Table.Td>
                  <Table.Td ta="right">{formatStorageLocationQty(row)}</Table.Td>
                  <Table.Td>{displayValue([row.User?.FirstName, row.User?.LastName].filter(Boolean).join(' '))}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      ) : null}
    </Stack>
  )
}

function ProductMovementPanel({ product }: { product: Product }) {
  const { t } = useI18n()
  const productNetUid = product.NetUid?.trim()
  const [dateFrom, setDateFrom] = useState(getTodayDate)
  const [dateTo, setDateTo] = useState(getTodayDate)
  const [movementType, setMovementType] = useState('0')
  const [selectedTypes, setSelectedTypes] = useState<number[]>(movementItemTypes)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const [rows, setRows] = useState<ProductMovement[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setLoading] = useState(false)
  const [exportDocument, setExportDocument] = useState<ProductMovementExportDocument | null>(null)
  const [isExporting, setExporting] = useState(false)
  const filterError = getDateRangeError(dateFrom, dateTo, t)
  const missingNetUidError = productNetUid ? null : t('У товару немає NetUid для завантаження руху товару')
  const typesError = selectedTypes.length === 0 ? t('Оберіть хоча б один тип руху') : null
  const activeError = filterError || missingNetUidError || typesError || error

  function toggleMovementItemType(value: number) {
    setSelectedTypes((currentTypes) => (
      currentTypes.includes(value)
        ? currentTypes.filter((type) => type !== value)
        : currentTypes.concat(value)
    ))
  }

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
  }, [dateFrom, dateTo, filterError, movementType, productNetUid, reloadKey, selectedTypes, t, typesError])

  async function exportMovements() {
    if (!productNetUid || filterError || typesError || isExporting) {
      return
    }

    setExporting(true)
    setError(null)

    try {
      const nextDocument = await exportProductMovementsDocument({
        from: dateFrom,
        movementType: Number(movementType),
        productNetId: productNetUid,
        to: dateTo,
        types: selectedTypes,
      })

      setExportDocument(nextDocument)
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : t('Не вдалося сформувати документ руху товару'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <Stack gap="md">
      <Group align="end" gap="sm" wrap="wrap" className="clients-filter-row">
        <TextInput label={t('З')} type="date" value={dateFrom} onChange={(event) => setDateFrom(event.currentTarget.value)} />
        <TextInput label={t('По')} type="date" value={dateTo} onChange={(event) => setDateTo(event.currentTarget.value)} />
        <Select label={t('Тип руху')} data={movementTypeOptions.map((option) => ({ ...option, label: t(option.label) }))} value={movementType} w={220} onChange={(value) => setMovementType(value || '0')} />
        <Button disabled={Boolean(filterError) || Boolean(typesError)} leftSection={<IconRefresh size={18} />} loading={isLoading} variant="light" onClick={() => reload()}>
          {t('Оновити')}
        </Button>
        <Button disabled={!productNetUid || Boolean(filterError) || Boolean(typesError)} leftSection={<IconDownload size={18} />} loading={isExporting} variant="light" onClick={() => void exportMovements()}>
          {t('Друк')}
        </Button>
      </Group>
      <Group gap="md" wrap="wrap" align="center">
        {movementItemTypeOptions.map((option) => (
          <Checkbox
            key={option.value}
            checked={selectedTypes.includes(option.value)}
            label={t(option.label)}
            size="xs"
            onChange={() => toggleMovementItemType(option.value)}
          />
        ))}
        <Button size="xs" color="gray" variant="subtle" onClick={() => setSelectedTypes(movementItemTypes)}>
          {t('Скинути')}
        </Button>
      </Group>
      {activeError && <Alert color={filterError || missingNetUidError || typesError ? 'yellow' : 'red'} icon={<IconAlertCircle size={18} />} variant="light">{activeError}</Alert>}
      {isLoading ? (
        <LoadingState label={t('Завантаження руху товару')} />
      ) : rows.length === 0 && !activeError ? (
        <Text c="dimmed" size="sm">{t('Рух товару не знайдено')}</Text>
      ) : !activeError ? (
        <ScrollArea>
          <Table striped highlightOnHover withTableBorder miw={1640}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('Номер прихідної накладної')}</Table.Th>
                <Table.Th>{t('Дата прихідної накладної')}</Table.Th>
                <Table.Th>{t('Документ')}</Table.Th>
                <Table.Th>{t('Номер')}</Table.Th>
                <Table.Th>{t('Дата')}</Table.Th>
                <Table.Th>{t('Клієнт')}</Table.Th>
                <Table.Th>{t('Склад')}</Table.Th>
                <Table.Th>{t('Організація')}</Table.Th>
                <Table.Th>{t('Відповідальний')}</Table.Th>
                <Table.Th ta="right">{t('Собівартість')}</Table.Th>
                <Table.Th ta="right">{t('Облікова собівартість')}</Table.Th>
                <Table.Th ta="right">{t('Знижка')}</Table.Th>
                <Table.Th ta="right">{t('Прихід')}</Table.Th>
                <Table.Th ta="right">{t('Розхід')}</Table.Th>
                <Table.Th>{t('Коментар')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((row, index) => (
                <Table.Tr key={`${row.NetUid || row.Id || row.DocumentNumber || index}`}>
                  <Table.Td>{displayValue(row.IncomeDocumentNumber)}</Table.Td>
                  <Table.Td>{formatDateTime(row.IncomeDocumentFromDate)}</Table.Td>
                  <Table.Td>{row.IsEdited ? <Text component="span" c="orange.7" fw={600}>{displayValue(row.DocumentType || row.MovementType)}</Text> : displayValue(row.DocumentType || row.MovementType)}</Table.Td>
                  <Table.Td>{row.IsEdited ? <Text component="span" c="orange.7" fw={600}>{displayValue(row.DocumentNumber)}</Text> : displayValue(row.DocumentNumber)}</Table.Td>
                  <Table.Td>{formatDateTime(row.DocumentFromDate || row.FromDate || row.Created)}</Table.Td>
                  <Table.Td>{displayValue(row.ClientName)}</Table.Td>
                  <Table.Td>{displayValue(row.StorageName)}</Table.Td>
                  <Table.Td>{displayValue(row.OrganizationName)}</Table.Td>
                  <Table.Td>{displayValue(row.Responsible || row.UserName)}</Table.Td>
                  <Table.Td ta="right">{formatPrice(row.Price)}</Table.Td>
                  <Table.Td ta="right">{formatPrice(row.AccountingPrice)}</Table.Td>
                  <Table.Td ta="right">{formatPrice(row.Discount)}</Table.Td>
                  <Table.Td ta="right">{formatAmount(row.IncomeQty)}</Table.Td>
                  <Table.Td ta="right">{formatAmount(row.OutcomeQty)}</Table.Td>
                  <Table.Td>{displayValue(row.Comment)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      ) : null}
      <ProductDocumentDownloadModal
        document={exportDocument}
        title={t('Документ руху товару')}
        onClose={() => setExportDocument(null)}
      />
    </Stack>
  )
}

function ProductDocumentDownloadModal({
  document,
  onClose,
  title,
}: {
  document: ProductMovementExportDocument | null
  onClose: () => void
  title: string
}) {
  const { t } = useI18n()

  return (
    <AppModal centered opened={Boolean(document)} title={title} onClose={onClose}>
      <Stack gap="sm">
        {document?.DocumentURL || document?.PdfDocumentURL ? (
          <>
            {document.DocumentURL ? (
              <Anchor href={document.DocumentURL} target="_blank" rel="noreferrer" className="document-link">
                <span className="document-link-badge document-link-badge-excel">
                  <IconFileTypeXls size={22} stroke={1.8} />
                </span>
                <span>{t('Excel документ')}</span>
              </Anchor>
            ) : null}
            {document.PdfDocumentURL ? (
              <Anchor href={document.PdfDocumentURL} target="_blank" rel="noreferrer" className="document-link">
                <span className="document-link-badge document-link-badge-pdf">
                  <IconFileTypePdf size={22} stroke={1.8} />
                </span>
                <span>{t('PDF документ')}</span>
              </Anchor>
            ) : null}
          </>
        ) : (
          <Text c="dimmed" size="sm">
            {t('Документ недоступний для завантаження')}
          </Text>
        )}
      </Stack>
    </AppModal>
  )
}

function ProductWriteOffRulesPanel({ onChanged, product }: { onChanged: () => void; product: Product }) {
  const { t } = useI18n()
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
  const missingNetUidError = productNetUid ? null : t('У товару немає NetUid для завантаження правил списання')
  const groupSelectionError = scope === 'group' && !selectedProductGroupNetId
    ? t('Оберіть групу товарів для правил списання')
    : null
  const activeError = missingNetUidError || (scope === 'group' ? groupError || groupSelectionError : null) || error

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

    if (scope === 'group') {
      if (!selectedProductGroupNetId) {
        setRows([])
        return
      }

      const nextRows = await getProductWriteOffRulesByProductGroupNetId(selectedProductGroupNetId)
      setRows(nextRows)
      return
    }

    const nextRows = await getProductWriteOffRulesByProductNetId(productNetUid)
    setRows(nextRows)
  }, [productNetUid, scope, selectedProductGroupNetId])

  async function addRule() {
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

      if (nextRule) {
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

  async function removeRule(rule: ProductWriteOffRule) {
    if (!rule.NetUid) {
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
  }

  return (
    <Stack gap="md">
      <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
        <SegmentedControl
          data={writeOffScopeOptions.map((option) => ({ ...option, label: t(option.label) }))}
          value={scope}
          onChange={(value) => setScope(value as ProductWriteOffRuleScope)}
        />
        {scope === 'group' ? (
          <Select
            data={productGroupOptions}
            disabled={isLoadingGroups || productGroupOptions.length === 0}
            label={t('Група товарів')}
            placeholder={isLoadingGroups ? t('Завантаження') : t('Оберіть групу')}
            value={selectedProductGroupNetUid || null}
            w={260}
            onChange={(value) => setSelectedProductGroupNetUid(value || '')}
          />
        ) : null}
        <Select label={t('Правило')} data={writeOffRuleTypeOptions.map((option) => ({ ...option, label: t(option.label) }))} value={ruleType} w={220} onChange={(value) => setRuleType(value || '0')} />
        <Select label={t('Регіон')} data={writeOffLocaleOptions.map((option) => ({ ...option, label: t(option.label) }))} value={locale} w={180} onChange={(value) => setLocale(value || 'uk')} />
        <Button disabled={!productNetUid || isLoading || (scope === 'group' && (isLoadingGroups || !selectedProductGroupNetId))} leftSection={<IconPlus size={18} />} loading={isSaving} onClick={addRule}>
          {t('Додати')}
        </Button>
      </Group>
      {activeError && <Alert color={missingNetUidError ? 'yellow' : 'red'} icon={<IconAlertCircle size={18} />} variant="light">{activeError}</Alert>}
      {isLoading ? (
        <LoadingState label={t('Завантаження правил списання')} />
      ) : rows.length === 0 && !activeError ? (
        <Text c="dimmed" size="sm">{t('Правил списання не знайдено')}</Text>
      ) : !activeError ? (
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('Дата')}</Table.Th>
              <Table.Th>{t('Регіон')}</Table.Th>
              <Table.Th>{t('Правило')}</Table.Th>
              <Table.Th>{t('Джерело')}</Table.Th>
              <Table.Th w={64} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row, index) => (
              <Table.Tr key={`${row.NetUid || row.Id || index}`}>
                <Table.Td>{formatDate(row.Created)}</Table.Td>
                <Table.Td>{formatRuleLocale(row.RuleLocale)}</Table.Td>
                <Table.Td>{formatRuleType(row.RuleType)}</Table.Td>
                <Table.Td>{displayValue(row.Product?.VendorCode || getProductGroupLabel(row.ProductGroup))}</Table.Td>
                <Table.Td>
                  <Tooltip label={t('Видалити')}>
                    <ActionIcon
                      aria-label={t('Видалити')}
                      color="red"
                      disabled={!row.NetUid || Boolean(removingNetUid)}
                      loading={removingNetUid === row.NetUid}
                      variant="subtle"
                      onClick={() => removeRule(row)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : null}
    </Stack>
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

function InfoRow({ label, multiline, value }: { label: string; multiline?: boolean; value?: number | string | null }) {
  const { t } = useI18n()

  return (
    <Group align={multiline ? 'flex-start' : 'center'} justify="space-between" gap="xs" wrap="wrap">
      <Text c="dimmed" size="sm" style={{ flex: '0 0 140px', maxWidth: '100%' }}>
        {t(label)}
      </Text>
      <Text
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

function InfoBlock({ label, value }: { label: string; value?: number | string | null }) {
  const { t } = useI18n()

  return (
    <Box>
      <Text c="dimmed" size="xs" lineClamp={1}>
        {t(label)}
      </Text>
      <Text size="sm" fw={600} style={{ overflowWrap: 'anywhere' }}>
        {displayValue(value)}
      </Text>
    </Box>
  )
}

function sortSpecificationsByCreatedDesc(specifications: ProductSpecification[]): ProductSpecification[] {
  return [...specifications].sort((first, second) => {
    const firstTime = first.Created ? new Date(first.Created).getTime() : 0
    const secondTime = second.Created ? new Date(second.Created).getTime() : 0

    return secondTime - firstTime
  })
}

function formatSpecificationAuthor(specification: ProductSpecification): string {
  const author = specification.AddedBy

  if (!author) {
    return ''
  }

  return [author.LastName, author.FirstName].filter(Boolean).join(' ')
}

function PriceRow({ price }: { price: CalculatedProductPrice }) {
  return (
    <Group justify="space-between" gap="md" wrap="nowrap">
      <Text size="sm">{displayValue(price.Pricing?.Name)}</Text>
      <Text size="sm" fw={600}>
        {formatPrice(price.RetailPriceEUR)} / {formatPrice(price.RetailPriceLocal)}
      </Text>
    </Group>
  )
}

function createProductEditForm(product: Product): ProductEditForm {
  return {
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
  return placements.map((placement) => ({
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

function getPanelFromQuery(searchParams: URLSearchParams): ProductDetailPanel | null {
  const panel = searchParams.get('panel')

  return panel && panelValues.has(panel as ProductDetailPanel) ? (panel as ProductDetailPanel) : null
}

function getProductPanelKey(product: Product): string {
  return `${product.NetUid || product.Id || 'product'}-${product.Updated || ''}`
}

function getPanelTitle(panel: ProductDetailPanel, t: (key: string) => string): string {
  switch (panel) {
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
    if (relation.ProductGroup) {
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
