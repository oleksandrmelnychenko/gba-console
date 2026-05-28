import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  FileInput,
  Group,
  Image,
  Loader,
  NumberInput,
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
  IconEdit,
  IconFileDescription,
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
import {
  addOrUpdateProductWriteOffRule,
  deleteProductWriteOffRule,
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
} from '../api/productsApi'
import type {
  CalculatedProductPrice,
  Product,
  ProductConsignmentRemaining,
  ProductGroup,
  ProductImage,
  ProductMovement,
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

export type ProductDetailPanel = 'edit' | 'images' | 'movement' | 'remains' | 'specification' | 'storage-history' | 'writeoff'
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

const panelValues = new Set<ProductDetailPanel>([
  'edit',
  'images',
  'movement',
  'remains',
  'specification',
  'storage-history',
  'writeoff',
])

const movementItemTypes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
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
                  <Image src={mainImage.ImageUrl} alt={getProductTitle(product)} radius="sm" fit="contain" h={220} />
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
                <ProductStockSummary product={product} reservation={reservation} reservationError={reservationError} />
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
      <Tooltip label={t('Залишки по партіям')}>
        <ActionIcon aria-label={t('Залишки по партіям')} color="gray" size={38} variant="light" onClick={() => openPanel('remains')}>
          <IconPackage size={18} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label={t('Редагувати')}>
        <ActionIcon aria-label={t('Редагувати')} color="gray" size={38} variant="light" onClick={() => openPanel('edit')}>
          <IconEdit size={18} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label={t('Рух товару')}>
        <ActionIcon aria-label={t('Рух товару')} color="gray" size={38} variant="light" onClick={() => openPanel('movement')}>
          <IconArrowsExchange size={18} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label={t('Правила списання')}>
        <ActionIcon aria-label={t('Правила списання')} color="gray" size={38} variant="light" onClick={() => openPanel('writeoff')}>
          <IconClipboardList size={18} />
        </ActionIcon>
      </Tooltip>
    </Group>
  )
}

export function ProductStockSummary({
  product,
  reservation,
  reservationError,
}: {
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
              <Group
                key={`${availability.StorageId || availability.Storage?.Name || index}`}
                justify="space-between"
                gap="sm"
                wrap="nowrap"
                style={{
                  border: '1px solid var(--mantine-color-gray-2)',
                  borderRadius: 6,
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
            ))}
          </Stack>
        </>
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
      {activePanel === 'edit' && <ProductEditPanel key={getProductPanelKey(product)} product={product} onProductSaved={onProductSaved} />}
      {activePanel === 'images' && <ProductImagesPanel key={getProductPanelKey(product)} product={product} onProductSaved={onProductSaved} />}
      {activePanel === 'movement' && <ProductMovementPanel product={product} />}
      {activePanel === 'remains' && <ProductConsignmentRemainingsPanel product={product} />}
      {activePanel === 'specification' && <ProductSpecificationPanel product={product} />}
      {activePanel === 'storage-history' && <ProductStorageHistoryPanel product={product} />}
      {activePanel === 'writeoff' && <ProductWriteOffRulesPanel product={product} onChanged={onReload} />}
    </AppDrawer>
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
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setSaving] = useState(false)
  const visibleImages = images.filter((image) => !image.Deleted)
  const hasChanges = files.length > 0 || images.some((image, index) => image !== (product.ProductImages || [])[index])

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
      setFiles([])
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
        <FileInput
          multiple
          clearable
          accept="image/*"
          label={t('Додати зображення')}
          placeholder={t('Оберіть файли')}
          value={files}
          style={{ flex: '1 1 280px' }}
          onChange={(nextFiles) => setFiles(nextFiles || [])}
        />
        <Button leftSection={<IconDeviceFloppy size={18} />} loading={isSaving} disabled={!hasChanges} onClick={saveImages}>
          {t('Зберегти')}
        </Button>
      </Group>
      {visibleImages.length === 0 && files.length === 0 ? (
        <Text c="dimmed" size="sm">
          {t('Зображень не знайдено')}
        </Text>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {visibleImages.map((image, index) => (
            <Box
              key={`${image.NetUid || image.FileName || index}`}
              style={{ border: '1px solid var(--mantine-color-gray-2)', borderRadius: 6, padding: 10 }}
            >
              <Stack gap="sm">
                <Image src={image.ImageUrl} alt={image.FileName || getProductTitle(product)} h={190} fit="contain" radius="sm" />
                <Group justify="space-between" gap="xs" wrap="nowrap">
                  <Badge color={image.IsMainImage ? 'green' : 'gray'} variant="light">
                    {image.IsMainImage ? t('Головне') : t('Зображення')}
                  </Badge>
                  <Group gap={4} wrap="nowrap">
                    <Tooltip label={t('Зробити головним')}>
                      <ActionIcon color="gray" variant="light" disabled={image.IsMainImage} onClick={() => makeMain(image)}>
                        <IconCheck size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label={t('Видалити')}>
                      <ActionIcon color="red" variant="light" onClick={() => removeImage(image)}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Group>
              </Stack>
            </Box>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  )
}

function ProductSpecificationPanel({ product }: { product: Product }) {
  const { t } = useI18n()
  const specifications = product.ProductSpecifications || []

  if (specifications.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        {t('Специфікацій не знайдено')}
      </Text>
    )
  }

  return (
    <ScrollArea>
      <Table striped highlightOnHover withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('Код специфікації')}</Table.Th>
            <Table.Th>{t('Митна вартість')}</Table.Th>
            <Table.Th>{t('Мито')}</Table.Th>
            <Table.Th>{t('ПДВ')}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {specifications.map((specification, index) => (
            <SpecificationRow key={`${specification.NetUid || specification.Id || index}`} specification={specification} />
          ))}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  )
}

function SpecificationRow({ specification }: { specification: ProductSpecification }) {
  return (
    <Table.Tr>
      <Table.Td>{displayValue(specification.SpecificationCode)}</Table.Td>
      <Table.Td>{displayValue(specification.CustomsValue)}</Table.Td>
      <Table.Td>{displayValue(specification.Duty)}</Table.Td>
      <Table.Td>{displayValue(specification.VATValue)}</Table.Td>
    </Table.Tr>
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
      <Table striped highlightOnHover withTableBorder miw={980}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('Склад')}</Table.Th>
            <Table.Th>{t('Постачальник')}</Table.Th>
            <Table.Th>{t('Дата')}</Table.Th>
            <Table.Th>{t('Інвойс')}</Table.Th>
            <Table.Th>{t('Прихід')}</Table.Th>
            <Table.Th ta="right">{t('Залишок')}</Table.Th>
            <Table.Th ta="right">{t('Нетто')}</Table.Th>
            <Table.Th ta="right">{t('Брутто')}</Table.Th>
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
              <Table.Td ta="right">{formatPrice(row.GrossPrice)}</Table.Td>
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
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const [rows, setRows] = useState<ProductMovement[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setLoading] = useState(false)
  const filterError = getDateRangeError(dateFrom, dateTo, t)
  const missingNetUidError = productNetUid ? null : t('У товару немає NetUid для завантаження руху товару')
  const activeError = filterError || missingNetUidError || error

  useEffect(() => {
    if (filterError || !productNetUid) {
      return
    }

    let cancelled = false
    const netUid = productNetUid

    async function loadRows() {
      setLoading(true)
      setError(null)

      try {
        const nextRows = await getProductMovements({
          from: dateFrom,
          movementType: Number(movementType),
          productNetId: netUid,
          to: dateTo,
          types: movementItemTypes,
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
  }, [dateFrom, dateTo, filterError, movementType, productNetUid, reloadKey, t])

  return (
    <Stack gap="md">
      <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
        <TextInput label={t('З')} type="date" value={dateFrom} onChange={(event) => setDateFrom(event.currentTarget.value)} />
        <TextInput label={t('По')} type="date" value={dateTo} onChange={(event) => setDateTo(event.currentTarget.value)} />
        <Select label={t('Тип руху')} data={movementTypeOptions.map((option) => ({ ...option, label: t(option.label) }))} value={movementType} w={220} onChange={(value) => setMovementType(value || '0')} />
        <Button disabled={Boolean(filterError)} leftSection={<IconRefresh size={18} />} loading={isLoading} variant="light" onClick={() => reload()}>
          {t('Оновити')}
        </Button>
      </Group>
      {activeError && <Alert color={filterError || missingNetUidError ? 'yellow' : 'red'} icon={<IconAlertCircle size={18} />} variant="light">{activeError}</Alert>}
      {isLoading ? (
        <LoadingState label={t('Завантаження руху товару')} />
      ) : rows.length === 0 && !activeError ? (
        <Text c="dimmed" size="sm">{t('Рух товару не знайдено')}</Text>
      ) : !activeError ? (
        <ScrollArea>
          <Table striped highlightOnHover withTableBorder miw={1080}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('Дата')}</Table.Th>
                <Table.Th>{t('Документ')}</Table.Th>
                <Table.Th>{t('Номер')}</Table.Th>
                <Table.Th>{t('Склад')}</Table.Th>
                <Table.Th>{t('Клієнт')}</Table.Th>
                <Table.Th ta="right">{t('Прихід')}</Table.Th>
                <Table.Th ta="right">{t('Розхід')}</Table.Th>
                <Table.Th ta="right">{t('Кількість')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((row, index) => (
                <Table.Tr key={`${row.NetUid || row.Id || row.DocumentNumber || index}`}>
                  <Table.Td>{formatDateTime(row.DocumentFromDate || row.FromDate || row.Created)}</Table.Td>
                  <Table.Td>{displayValue(row.DocumentType || row.MovementType)}</Table.Td>
                  <Table.Td>{displayValue(row.DocumentNumber)}</Table.Td>
                  <Table.Td>{displayValue(row.StorageName)}</Table.Td>
                  <Table.Td>{displayValue(row.ClientName)}</Table.Td>
                  <Table.Td ta="right">{formatAmount(row.IncomeQty)}</Table.Td>
                  <Table.Td ta="right">{formatAmount(row.OutcomeQty)}</Table.Td>
                  <Table.Td ta="right">{formatAmount(row.Qty)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      ) : null}
    </Stack>
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

function getPanelFromQuery(searchParams: URLSearchParams): ProductDetailPanel | null {
  const panel = searchParams.get('panel')

  return panel && panelValues.has(panel as ProductDetailPanel) ? (panel as ProductDetailPanel) : null
}

function getProductPanelKey(product: Product): string {
  return `${product.NetUid || product.Id || 'product'}-${product.Updated || ''}`
}

function getPanelTitle(panel: ProductDetailPanel, t: (key: string) => string): string {
  switch (panel) {
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
