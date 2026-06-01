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
  Menu,
  NumberInput,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconArrowsExchange,
  IconBox,
  IconClipboardList,
  IconDeviceFloppy,
  IconDownload,
  IconEdit,
  IconFileTypePdf,
  IconFileTypeXls,
  IconFileDescription,
  IconHistory,
  IconPackage,
  IconPhoto,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSettings,
  IconStar,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react'
import { type KeyboardEvent, type ReactNode, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import {
  createProductOriginalNumber,
  deleteProductOriginalNumber,
  exportProductIncomeMovementsDocument,
  exportProductOutcomeMovementsDocument,
  getNonDefectiveStorages,
  getProductIncomeMovements,
  getProductOutcomeMovements,
  getProductUploadPricings,
  removeProductAnalogue,
  removeProductComponent,
  updateProductOriginalNumber,
  uploadProductsFromFile,
  uploadProductPlacementStorageFile,
  uploadProductPlacementStorageReturn,
  uploadProductRelatedDocument,
} from '../api/productsApi'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import { PermissionGate } from '../../auth/components/PermissionGate'
import { useAuth } from '../../auth/useAuth'
import type {
  Product,
  ProductFileUploadConfiguration,
  ProductFileUploadMode,
  ProductIncomeMovement,
  ProductMovementExportDocument,
  ProductOriginalNumber,
  ProductOutcomeMovement,
  ProductPlacementStorage,
  ProductRelatedUploadType,
  ProductReservation,
  ProductUploadDocumentPayload,
  Pricing,
  Storage,
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
  getRelatedProductRowColor,
  PRODUCT_SEARCH_MODE_OPTIONS,
  PRODUCT_SORT_MODE_OPTIONS,
} from '../utils'
import {
  PRODUCT_BALANCES_PERMISSION,
  PRODUCT_EDIT_PERMISSION,
  PRODUCT_MOVEMENT_PERMISSION,
  PRODUCT_WRITE_OFF_PERMISSION,
  ProductActionDrawer,
  ProductImageViewerModal,
  ProductStockSummary,
  type ProductDetailPanel,
} from './ProductDetailPage'
import './products.css'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { ShopImageGallery } from '../components/ShopImageGallery'
import { useAssortment } from '../hooks/useAssortment'

const PRODUCT_UPLOAD_DOCUMENT_PERMISSION = 'Product_Entire_Assortment_Product_Upload_Document_Btn_PKEY'
const inlineMovementLabels = {
  income: {
    empty: 'Приходів не знайдено',
    exportTitle: 'Документ приходу',
    loading: 'Завантаження приходів',
  },
  outcome: {
    empty: 'Виходів не знайдено',
    exportTitle: 'Документ виходу',
    loading: 'Завантаження виходів',
  },
} as const
const productUploadDocumentLabels = {
  analogues: {
    articleLabel: 'Артикул аналога',
    button: 'Завантажити аналоги',
    title: 'Завантаження аналогів',
  },
  components: {
    articleLabel: 'Артикул комплектуючої',
    button: 'Завантажити комплектуючі',
    title: 'Завантаження комплектуючих',
  },
  originalNumbers: {
    articleLabel: 'Оригінальний номер',
    button: 'Завантажити номери',
    title: 'Завантаження оригінальних номерів',
  },
} as const
const productFileUploadModeOptions: Array<{ label: string; value: string }> = [
  { label: 'Додати', value: '0' },
  { label: 'Оновити', value: '1' },
  { label: 'Видалити', value: '2' },
]
const productFileUploadFieldLabels: Array<{ field: keyof ProductFileUploadColumnForm; label: string; required?: boolean }> = [
  { field: 'startRow', label: 'З', required: true },
  { field: 'endRow', label: 'По', required: true },
  { field: 'vendorCode', label: 'Код виробника', required: true },
  { field: 'newVendorCode', label: 'Новий код виробника' },
  { field: 'nameRU', label: 'Назва RU' },
  { field: 'nameUA', label: 'Назва UA' },
  { field: 'descriptionRU', label: 'Опис RU' },
  { field: 'descriptionUA', label: 'Опис UA' },
  { field: 'productGroup', label: 'Група товару' },
  { field: 'measureUnit', label: 'Одиниця' },
  { field: 'weight', label: 'Вага' },
  { field: 'mainOriginalNumber', label: 'Оригінальний номер' },
  { field: 'top', label: 'Top' },
  { field: 'orderStandard', label: 'Норма пакування' },
  { field: 'packingStandard', label: 'Пакування' },
  { field: 'size', label: 'Розмір' },
  { field: 'volume', label: 'Обʼєм' },
  { field: 'ucgfea', label: 'УКТЗЕД' },
  { field: 'isForWeb', label: 'Сайт' },
  { field: 'isForSale', label: 'Продаж' },
]

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

type InlineMovementDirection = 'income' | 'outcome'
type InlineMovementRow = ProductIncomeMovement | ProductOutcomeMovement
type InlineMovementState = {
  document: ProductMovementExportDocument | null
  error: string | null
  exportError: string | null
  isExporting: boolean
  isLoading: boolean
  rows: InlineMovementRow[]
}
type InlineMovementAction =
  | { type: 'export-clear' }
  | { type: 'export-error'; error: string }
  | { type: 'export-loading' }
  | { type: 'export-success'; document: ProductMovementExportDocument }
  | { type: 'error'; error: string }
  | { type: 'loading' }
  | { type: 'success'; rows: InlineMovementRow[] }
type RelatedProductRow = {
  isProductSet: boolean
  product: Partial<Product>
  quantity?: number | string
  source: unknown
}
type ProductFileUploadColumnForm = {
  descriptionRU: number
  descriptionUA: number
  endRow: number
  isForSale: number
  isForWeb: number
  mainOriginalNumber: number
  measureUnit: number
  nameRU: number
  nameUA: number
  newVendorCode: number
  orderStandard: number
  packingStandard: number
  productGroup: number
  size: number
  startRow: number
  top: number
  ucgfea: number
  vendorCode: number
  volume: number
  weight: number
}
type ProductFileUploadPriceRow = {
  columnNumber: number
  key: string
  pricingId: string
}
type ProductFileUploadForm = ProductFileUploadColumnForm & {
  files: File[]
  mode: ProductFileUploadMode
  prices: ProductFileUploadPriceRow[]
}

export function ProductsPage() {
  const { t } = useI18n()
  const searchModeOptions = useMemo(() => PRODUCT_SEARCH_MODE_OPTIONS.map((option) => ({ label: t(option.label), value: option.value })), [t])
  const sortModeOptions = useMemo(() => PRODUCT_SORT_MODE_OPTIONS.map((option) => ({ label: t(option.label), value: option.value })), [t])
  const assortment = useAssortment()

  return (
    <Stack gap="md">
      {assortment.error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {assortment.error}
        </Alert>
      )}

      <Box className="product-assortment-workspace">
        <Box className="product-assortment-column">
          <Box className="product-assortment-controls">
            <Group justify="flex-start">
              <ProductUploadDocumentToolbar product={assortment.selectedProduct} onUploadSuccess={assortment.handleAssortmentUploadSuccess} />
            </Group>
            <Group grow gap={8} align="flex-end">
              <Select
                allowDeselect={false}
                aria-label={t('Місце вводу для пошуку')}
                label={t('Місце вводу для пошуку')}
                data={searchModeOptions}
                disabled={assortment.isLoading}
                size="xs"
                value={assortment.searchMode}
                onChange={assortment.changeSearchMode}
              />
              <Select
                allowDeselect={false}
                aria-label={t('Сортувати За')}
                label={t('Сортувати За')}
                data={sortModeOptions}
                disabled={assortment.isLoading}
                size="xs"
                value={assortment.sortMode}
                onChange={assortment.changeSortMode}
              />
            </Group>
          </Box>
          <ProductAssortmentCarousel
            bottomProducts={assortment.bottomProducts}
            canMoveBack={assortment.canMoveBack}
            canMoveForward={assortment.canMoveForward}
            isLoading={assortment.isLoading}
            isSelectionMode={assortment.carouselMode === 'selection'}
            isVirtualLoad={assortment.isVirtualLoad}
            searchDraft={assortment.searchDraft}
            selectedProduct={assortment.selectedProduct}
            topProducts={assortment.topProducts}
            onKeyDown={assortment.handleCarouselKeyDown}
            onNext={assortment.selectNextProduct}
            onPrevious={assortment.selectPreviousProduct}
            onRefresh={assortment.commitSearch}
            onReset={assortment.resetSearch}
            onSearchDraftChange={assortment.updateSearchDraft}
            onSelectProduct={assortment.selectProduct}
          />
        </Box>

        <ProductInlineView
          detailError={assortment.detailState.error}
          isLoading={assortment.detailState.isLoading}
          product={assortment.productForView}
          reservation={assortment.detailState.reservation}
          reservationError={assortment.detailState.reservationError}
          onOpenPanel={assortment.setActivePanel}
          onProductChanged={assortment.handleProductSaved}
          onReload={assortment.reloadProductDetail}
          onSelectRelatedProduct={assortment.selectRelatedProduct}
        />
      </Box>

      {assortment.productForView && (
        <ProductActionDrawer
          activePanel={assortment.activePanel}
          product={assortment.productForView}
          onClose={() => assortment.setActivePanel(null)}
          onProductSaved={assortment.handleProductSaved}
          onReload={assortment.reloadProductDetail}
        />
      )}
    </Stack>
  )
}

function ProductAssortmentCarousel({
  bottomProducts,
  isLoading,
  isSelectionMode,
  isVirtualLoad,
  onKeyDown,
  onSearchDraftChange,
  onSelectProduct,
  searchDraft,
  selectedProduct,
  topProducts,
}: {
  bottomProducts: Product[]
  canMoveBack: boolean
  canMoveForward: boolean
  isLoading: boolean
  isSelectionMode: boolean
  isVirtualLoad: boolean
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
  onNext: () => void
  onPrevious: () => void
  onRefresh: () => void
  onReset: () => void
  onSearchDraftChange: (value: string) => void
  onSelectProduct: (product: Product) => void
  searchDraft: string
  selectedProduct: Product | null
  topProducts: Product[]
}) {
  const { t } = useI18n()

  return (
    <Box className="product-assortment-carousel" role="region" onKeyDown={onKeyDown}>
      <Box className="product-assortment-rail product-assortment-rail-top">
        {isLoading && !isVirtualLoad ? (
          <Stack align="center" justify="center" h="100%">
            <Loader size="sm" />
          </Stack>
        ) : (
          topProducts.slice(-10).map((product) => (
            <ProductCarouselRow
              key={getProductRowKey(product)}
              product={product}
              onSelect={onSelectProduct}
            />
          ))
        )}
      </Box>

      <Box className="product-assortment-drum">
        {isSelectionMode && selectedProduct ? (
          <button
            key={getProductIdentity(selectedProduct)}
            type="button"
            className={`product-assortment-selected ${getProductRowToneClass(selectedProduct)}`}
            autoFocus
            title={t('Скопіювати код')}
            onClick={() => copyToClipboard(getProductCode(selectedProduct))}
          >
            <span className="product-assortment-selected-code">{getProductCode(selectedProduct)}</span>
            <span className="product-assortment-selected-name">{getProductTitle(selectedProduct)}</span>
            {selectedProduct.Top?.trim() ? (
              <span className="product-assortment-selected-top">{selectedProduct.Top.trim()}</span>
            ) : null}
          </button>
        ) : (
          <TextInput
            autoFocus
            aria-label={t('Введіть товар')}
            leftSection={<IconSearch size={15} />}
            placeholder={t('Введіть артикул або назву товару')}
            size="sm"
            value={searchDraft}
            className="product-assortment-search-input"
            onChange={(event) => onSearchDraftChange(event.currentTarget.value)}
          />
        )}
      </Box>

      <Box className="product-assortment-rail product-assortment-rail-bottom">
        {bottomProducts.slice(0, 10).map((product) => (
          <ProductCarouselRow
            key={getProductRowKey(product)}
            product={product}
            onSelect={onSelectProduct}
          />
        ))}
        {isVirtualLoad ? (
          <Group justify="center" py="xs">
            <Loader size="xs" />
          </Group>
        ) : null}
      </Box>
    </Box>
  )
}

function ProductCarouselRow({
  onSelect,
  product,
}: {
  onSelect: (product: Product) => void
  product: Product
}) {
  return (
    <button
      type="button"
      className={`product-carousel-row ${getProductRowToneClass(product)}`}
      onClick={() => onSelect(product)}
    >
      <span className="product-carousel-row-code">{getProductCode(product)}</span>
      <span className="product-carousel-row-name">{getProductTitle(product)}</span>
    </button>
  )
}

function ProductInlineView({
  detailError,
  isLoading,
  onOpenPanel,
  onProductChanged,
  onReload,
  onSelectRelatedProduct,
  product,
  reservation,
  reservationError,
}: {
  detailError: string | null
  isLoading: boolean
  onOpenPanel: (panel: ProductDetailPanel) => void
  onProductChanged: (product: Product | null) => void
  onReload: () => void
  onSelectRelatedProduct: (product: Partial<Product>) => void
  product: Product | null
  reservation: ProductReservation
  reservationError: string | null
}) {
  const { t } = useI18n()
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)

  if (!product) {
    return (
      <Box className="product-inline-view product-inline-view-empty">
        <Text c="dimmed" size="sm">{t('Оберіть товар у барабанчику')}</Text>
      </Box>
    )
  }

  const mainImage = getProductMainImage(product)
  const productImages = product.ProductImages?.filter((image) => image.ImageUrl && !image.Deleted) || []
  const prices = product.CalculatedPrices || []

  return (
    <Box className="product-inline-view">
      {detailError && (
        <Alert color="yellow" icon={<IconAlertCircle size={18} />} variant="light">
          {detailError}
        </Alert>
      )}

      <Box className="product-inline-main">
        <Box className="product-inline-primary">
          <Group justify="space-between" align="center" gap="sm" className="product-inline-headline">
            <Text component="span" fw={800} className="product-inline-code">{getProductCode(product)}</Text>
            <Group gap="xs" justify="flex-end" className="product-inline-title-actions">
              <ProductInlineActions disabled={isLoading} onOpenPanel={onOpenPanel} />
              <Tooltip label={t('Оновити')}>
                <ActionIcon aria-label={t('Оновити')} color="gray" loading={isLoading} variant="light" onClick={onReload}>
                  <IconRefresh size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>

          <Box className="product-inline-info">
            <Box
              className="product-inline-image"
              role={mainImage?.ImageUrl ? 'button' : undefined}
              tabIndex={mainImage?.ImageUrl ? 0 : undefined}
              onClick={() => mainImage?.ImageUrl ? setPreviewImageUrl(mainImage.ImageUrl || null) : onOpenPanel('images')}
              onKeyDown={(event) => {
                if (mainImage?.ImageUrl && (event.key === 'Enter' || event.key === ' ')) {
                  event.preventDefault()
                  setPreviewImageUrl(mainImage.ImageUrl || null)
                }
              }}
            >
              {mainImage?.ImageUrl ? (
                <Image src={mainImage.ImageUrl} alt={getProductTitle(product)} fit="contain" h="100%" w="100%" />
              ) : (
                <IconPackage size={42} stroke={1.5} />
              )}
            </Box>
            {productImages.length > 1 ? (
              <Group gap={6} className="product-inline-thumbs">
                {productImages.slice(0, 8).map((image, index) => (
                  <button
                    type="button"
                    className="product-inline-thumb"
                    key={`${image.NetUid || image.ImageUrl || index}`}
                    onClick={() => setPreviewImageUrl(image.ImageUrl || null)}
                  >
                    <Image src={image.ImageUrl} alt={image.FileName || getProductTitle(product)} fit="cover" h="100%" w="100%" />
                  </button>
                ))}
              </Group>
            ) : null}
            <ShopImageGallery vendorCode={product.VendorCode} onImageClick={setPreviewImageUrl} />
          </Box>

          <Box className="product-inline-description">
            <InfoBlock label="Опис" value={product.DescriptionUA || product.Description} wide />
            <InfoBlock label="Нотатки" value={product.NotesUA || product.Notes} wide />
            <InfoBlock label="Top" value={product.Top} />
            <InfoBlock label="Вага" value={formatAmount(product.Weight)} />
            <InfoBlock label="Розмір" value={product.Size} />
            <InfoBlock label="Об'єм" value={product.Volume} />
            <InfoBlock label="Норма пакування" value={product.OrderStandard} />
            <InfoBlock label="Пакування" value={product.PackingStandard} />
            <InfoBlock label="Оригінальний номер" value={getProductMainOriginalNumber(product)} />
            <InfoBlock label="Синоніми UA" value={product.SynonymsUA} />
            <InfoBlock label="Група товару" value={getProductGroupNames(product)} />
            <InfoBlock label="Одиниця" value={product.MeasureUnit?.Name} />
          </Box>
        </Box>

        <Box className="product-inline-aside">
          <Text component="span" fw={700} className="product-inline-name">{getProductTitle(product)}</Text>

          <Box className="product-inline-prices">
            {prices.length > 0 ? (
              <table className="product-inline-price-table">
                <thead>
                  <tr>
                    <th className="product-inline-price-name">{t('Тип ціни')}</th>
                    <th className="product-inline-price-num">{t('EUR')}</th>
                    <th className="product-inline-price-num">{t('UAH')}</th>
                  </tr>
                </thead>
                <tbody>
                  {prices.map((price, index) => (
                    <tr key={`${price.Pricing?.NetUid || price.Pricing?.Name || index}`}>
                      <td className="product-inline-price-name">{displayValue(price.Pricing?.Name)}</td>
                      <td className="product-inline-price-num">{formatPrice(price.RetailPriceEUR)}</td>
                      <td className="product-inline-price-num">{formatPrice(price.RetailPriceLocal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Text c="dimmed" size="sm">{t('Цін не знайдено')}</Text>
            )}
            <Divider my="sm" />
            <Group gap="xs">
              <Badge color={getBooleanBadgeColor(product.IsForZeroSale)} variant="light">{t('Нульовий продаж')}</Badge>
              <Badge color={getBooleanBadgeColor(product.IsForSale)} variant="light">{t('Продаж')}</Badge>
              <Badge color={getBooleanBadgeColor(product.IsForWeb)} variant="light">{t('Сайт')}</Badge>
            </Group>
          </Box>
        </Box>
      </Box>

      <Box className="product-inline-stock-bar">
        <ProductStockSummary
          product={product}
          reservation={reservation}
          reservationError={reservationError}
          onProductSaved={onProductChanged}
        />
      </Box>

      <ProductInlineTabs product={product} onProductChanged={onProductChanged} onSelectRelatedProduct={onSelectRelatedProduct} />
      <ProductImageViewerModal
        imageUrl={previewImageUrl}
        title={getProductTitle(product)}
        onClose={() => setPreviewImageUrl(null)}
      />
    </Box>
  )
}

function ProductInlineActions({
  disabled,
  onOpenPanel,
}: {
  disabled: boolean
  onOpenPanel: (panel: ProductDetailPanel) => void
}) {
  const { t } = useI18n()

  return (
    <Group gap={6} className="product-inline-actions">
      <Button size="xs" variant="light" disabled={disabled} leftSection={<IconHistory size={15} />} onClick={() => onOpenPanel('storage-history')}>
        {t('Історія місця зберігання')}
      </Button>
      <Button size="xs" variant="light" disabled={disabled} leftSection={<IconFileDescription size={15} />} onClick={() => onOpenPanel('specification')}>
        {t('Специфікація')}
      </Button>
      <Button size="xs" variant="light" disabled={disabled} leftSection={<IconPhoto size={15} />} onClick={() => onOpenPanel('images')}>
        {t('Зображення')}
      </Button>
      <PermissionGate permissionKey={PRODUCT_BALANCES_PERMISSION}>
        <Button size="xs" variant="light" disabled={disabled} leftSection={<IconPackage size={15} />} onClick={() => onOpenPanel('remains')}>
          {t('Залишки по партіям')}
        </Button>
      </PermissionGate>
      <PermissionGate permissionKey={PRODUCT_EDIT_PERMISSION}>
        <Button size="xs" variant="light" disabled={disabled} leftSection={<IconEdit size={15} />} onClick={() => onOpenPanel('edit')}>
          {t('Редагувати')}
        </Button>
      </PermissionGate>
      <PermissionGate permissionKey={PRODUCT_MOVEMENT_PERMISSION}>
        <Button size="xs" variant="light" disabled={disabled} leftSection={<IconArrowsExchange size={15} />} onClick={() => onOpenPanel('movement')}>
          {t('Рух товару')}
        </Button>
      </PermissionGate>
      <PermissionGate permissionKey={PRODUCT_WRITE_OFF_PERMISSION}>
        <Button size="xs" variant="light" disabled={disabled} leftSection={<IconClipboardList size={15} />} onClick={() => onOpenPanel('writeoff')}>
          {t('Правила списання')}
        </Button>
      </PermissionGate>
    </Group>
  )
}

function InfoBlock({
  label,
  value,
  wide,
}: {
  label: string
  value?: ReactNode
  wide?: boolean
}) {
  const { t } = useI18n()

  return (
    <Box className={`product-inline-info-block ${wide ? 'is-wide' : ''}`}>
      <Text c="dimmed" size="xs">{t(label)}</Text>
      <Text size="sm" fw={600}>{displayValue(typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? value : undefined)}</Text>
    </Box>
  )
}

function ProductInlineTabs({
  onProductChanged,
  onSelectRelatedProduct,
  product,
}: {
  onProductChanged: (product: Product | null) => void
  onSelectRelatedProduct: (product: Partial<Product>) => void
  product: Product
}) {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<'numbers' | 'analogues' | 'components' | 'income' | 'outcome'>('numbers')

  return (
    <div className="product-inline-tabs">
      <div className="pill-tabs" style={{ width: 'fit-content' }}>
        {([
          { value: 'numbers', label: t('Оригінальні номери') },
          { value: 'analogues', label: t('Аналоги') },
          { value: 'components', label: t('Комплектуючі') },
          { value: 'income', label: t('Прихід') },
          { value: 'outcome', label: t('Вихід') },
        ] as const).map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={`pill-tab${activeTab === tab.value ? ' is-active' : ''}`}
            aria-pressed={activeTab === tab.value}
            onClick={() => setActiveTab(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'numbers' && (
        <Box pt="sm">
          <ProductOriginalNumbersTab product={product} onProductChanged={onProductChanged} />
        </Box>
      )}
      {activeTab === 'analogues' && (
        <Box pt="sm">
          <ProductRelatedProductsTab
            emptyLabel={t('Аналогів не знайдено')}
            product={product}
            type="analogues"
            onProductChanged={onProductChanged}
            onSelectProduct={onSelectRelatedProduct}
          />
        </Box>
      )}
      {activeTab === 'components' && (
        <Box pt="sm">
          <ProductRelatedProductsTab
            emptyLabel={t('Комплектуючих не знайдено')}
            product={product}
            type="components"
            onProductChanged={onProductChanged}
            onSelectProduct={onSelectRelatedProduct}
          />
        </Box>
      )}
      {activeTab === 'income' && (
        <Box pt="sm">
          <ProductInlineMovementsTab direction="income" product={product} />
        </Box>
      )}
      {activeTab === 'outcome' && (
        <Box pt="sm">
          <ProductInlineMovementsTab direction="outcome" product={product} />
        </Box>
      )}
    </div>
  )
}

function ProductOriginalNumbersTab({
  onProductChanged,
  product,
}: {
  onProductChanged: (product: Product | null) => void
  product: Product
}) {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const productNetUid = product.NetUid?.trim() || ''
  const originalNumbers = getProductOriginalNumbers(product)
  const codeInputRef = useRef<HTMLInputElement>(null)
  const [selectedNetUid, setSelectedNetUid] = useState<string | null>(null)
  const selectedItem = originalNumbers.find((item) => getProductOriginalNumberIdentity(item) === selectedNetUid) || null
  const [codeDraft, setCodeDraft] = useState('')
  const [isMainDraft, setMainDraft] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setSaving] = useState(false)
  const normalizedCode = codeDraft.trim()
  const selectedCode = selectedItem ? getOriginalNumberText(selectedItem) : ''
  const isDuplicate = Boolean(normalizedCode)
    && originalNumbers.some((item) => (
      getOriginalNumberText(item).toLowerCase() === normalizedCode.toLowerCase()
      && getProductOriginalNumberIdentity(item) !== selectedNetUid
    ))
  const canSave = Boolean(productNetUid && normalizedCode && !isDuplicate && !isSaving)
  const canEditOriginalNumbers = hasPermission(PRODUCT_EDIT_PERMISSION)

  function selectOriginalNumber(item: ProductOriginalNumber) {
    setSelectedNetUid(getProductOriginalNumberIdentity(item))
    setCodeDraft(getOriginalNumberText(item))
    setMainDraft(Boolean(item.IsMainOriginalNumber))
    setError(null)
  }

  function resetForm() {
    setSelectedNetUid(null)
    setCodeDraft('')
    setMainDraft(false)
    setError(null)
  }

  function focusCodeInput() {
    window.setTimeout(() => codeInputRef.current?.focus(), 0)
  }

  function startNewOriginalNumber() {
    if (!canEditOriginalNumbers || isSaving) {
      return
    }

    resetForm()
    focusCodeInput()
  }

  function editSelectedOriginalNumber() {
    if (!canEditOriginalNumbers || !selectedItem || isSaving) {
      return
    }

    selectOriginalNumber(selectedItem)
    focusCodeInput()
  }

  function handleOriginalNumbersKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!canEditOriginalNumbers || isEditableKeyboardTarget(event.target)) {
      return
    }

    if (event.key === 'Insert') {
      event.preventDefault()
      startNewOriginalNumber()
    }

    if (event.key === 'F2') {
      event.preventDefault()
      editSelectedOriginalNumber()
    }

    if (event.key === 'Delete' && selectedItem) {
      event.preventDefault()
      void removeOriginalNumber(selectedItem)
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      resetForm()
    }
  }

  async function saveOriginalNumber() {
    if (!canSave) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      const nextNumbers = selectedItem
        ? await updateProductOriginalNumber(productNetUid, {
            ...(selectedItem.OriginalNumber || {}),
            MainNumber: normalizedCode,
            Number: normalizedCode,
          }, isMainDraft)
        : await createProductOriginalNumber(productNetUid, normalizedCode, isMainDraft)

      applyOriginalNumbersResponse(product, nextNumbers, onProductChanged)
      notifications.show({
        color: 'green',
        message: selectedItem ? t('Оригінальний номер оновлено') : t('Оригінальний номер додано'),
      })
      resetForm()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти оригінальний номер'))
    } finally {
      setSaving(false)
    }
  }

  async function makeMainOriginalNumber(item: ProductOriginalNumber) {
    const originalNumber = item.OriginalNumber

    if (!productNetUid || !originalNumber?.NetUid || isSaving) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      const nextNumbers = await updateProductOriginalNumber(productNetUid, originalNumber, true)

      applyOriginalNumbersResponse(product, nextNumbers, onProductChanged)
      notifications.show({ color: 'green', message: t('Основний оригінальний номер оновлено') })
      resetForm()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося оновити основний номер'))
    } finally {
      setSaving(false)
    }
  }

  async function removeOriginalNumber(item: ProductOriginalNumber) {
    const originalNumberNetUid = item.OriginalNumber?.NetUid?.trim()

    if (!productNetUid || !originalNumberNetUid || item.IsMainOriginalNumber || isSaving) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      const nextNumbers = await deleteProductOriginalNumber(productNetUid, originalNumberNetUid)

      applyOriginalNumbersResponse(product, nextNumbers, onProductChanged)
      notifications.show({ color: 'green', message: t('Оригінальний номер видалено') })
      resetForm()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося видалити оригінальний номер'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Stack gap="sm" tabIndex={0} onKeyDown={handleOriginalNumbersKeyDown}>
      {error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {error}
        </Alert>
      )}

      <Group justify="flex-end">
        <ProductUploadDocumentButton
          product={product}
          type="originalNumbers"
          onProductChanged={onProductChanged}
        />
      </Group>

      <PermissionGate permissionKey={PRODUCT_EDIT_PERMISSION}>
        <Group align="end" gap="sm" wrap="wrap">
          <TextInput
            ref={codeInputRef}
            label={t('Оригінальний номер')}
            value={codeDraft}
            error={isDuplicate ? t('Такий оригінальний номер вже існує') : undefined}
            style={{ flex: '1 1 260px' }}
            onChange={(event) => setCodeDraft(event.currentTarget.value)}
          />
          <Checkbox
            checked={isMainDraft}
            label={t('Основний')}
            pb={8}
            onChange={(event) => setMainDraft(event.currentTarget.checked)}
          />
          <Button
            disabled={!canSave}
            leftSection={selectedItem ? <IconDeviceFloppy size={16} /> : <IconPlus size={16} />}
            loading={isSaving}
            onClick={saveOriginalNumber}
          >
            {selectedItem ? t('Зберегти') : t('Додати')}
          </Button>
          {selectedItem ? (
            <Button color="gray" disabled={isSaving} variant="light" onClick={resetForm}>
              {t('Скинути')}
            </Button>
          ) : null}
        </Group>
      </PermissionGate>

      {selectedCode ? (
        <Text c="dimmed" size="xs">
          {t('Вибрано')}: {selectedCode}
        </Text>
      ) : null}

      {originalNumbers.length > 0 ? (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="xs">
          {originalNumbers.map((item) => {
            const itemKey = getProductOriginalNumberIdentity(item)
            const isSelected = itemKey === selectedNetUid

            return (
              <Card
                withBorder
                radius="sm"
                padding="xs"
                className={`product-original-number-card ${isSelected ? 'is-selected' : ''}`}
                key={itemKey}
                onClick={() => selectOriginalNumber(item)}
              >
                <Group justify="space-between" gap="xs" wrap="nowrap">
                  <Text fw={650} size="sm" lineClamp={1}>
                    {displayValue(getOriginalNumberText(item))}
                  </Text>
                  {item.IsMainOriginalNumber ? <Badge size="xs" color="green" variant="light">{t('Основний')}</Badge> : null}
                </Group>
                <PermissionGate permissionKey={PRODUCT_EDIT_PERMISSION}>
                  <Group gap={6} mt="xs">
                    <Tooltip label={t('Зробити основним')}>
                      <ActionIcon
                        aria-label={t('Зробити основним')}
                        color="yellow"
                        disabled={Boolean(item.IsMainOriginalNumber) || isSaving}
                        size="sm"
                        variant="light"
                        onClick={(event) => {
                          event.stopPropagation()
                          void makeMainOriginalNumber(item)
                        }}
                      >
                        <IconStar size={15} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label={t('Видалити')}>
                      <ActionIcon
                        aria-label={t('Видалити')}
                        color="red"
                        disabled={Boolean(item.IsMainOriginalNumber) || isSaving}
                        size="sm"
                        variant="light"
                        onClick={(event) => {
                          event.stopPropagation()
                          void removeOriginalNumber(item)
                        }}
                      >
                        <IconTrash size={15} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </PermissionGate>
              </Card>
            )
          })}
        </SimpleGrid>
      ) : (
        <Text c="dimmed" size="sm">{t('Номерів не знайдено')}</Text>
      )}
    </Stack>
  )
}

function ProductRelatedProductsTab({
  emptyLabel,
  onProductChanged,
  onSelectProduct,
  product,
  type,
}: {
  emptyLabel: string
  onProductChanged: (product: Product | null) => void
  onSelectProduct: (product: Partial<Product>) => void
  product: Product
  type: 'analogues' | 'components'
}) {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const productNetUid = product.NetUid?.trim() || ''
  const [removeIndirectAnalogues, setRemoveIndirectAnalogues] = useState(false)
  const [removingNetUid, setRemovingNetUid] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const rows = type === 'analogues' ? getAnalogueRows(product) : getComponentRows(product)
  const canEditRelatedProducts = hasPermission(PRODUCT_EDIT_PERMISSION)

  async function removeRelatedProduct(row: RelatedProductRow) {
    const relatedNetUid = row.product.NetUid?.trim()

    if (!canEditRelatedProducts || !productNetUid || !relatedNetUid || removingNetUid) {
      return
    }

    const confirmed = window.confirm(t('Видалити повʼязаний товар?'))

    if (!confirmed) {
      return
    }

    setRemovingNetUid(relatedNetUid)
    setError(null)

    try {
      if (type === 'analogues') {
        await removeProductAnalogue({
          analogueNetId: relatedNetUid,
          baseProductNetId: productNetUid,
          removeIndirectAnalogues,
        })
      } else {
        await removeProductComponent({
          baseProductNetId: productNetUid,
          componentNetId: relatedNetUid,
          isProductSet: row.isProductSet,
        })
      }

      notifications.show({ color: 'green', message: t('Повʼязаний товар видалено') })
      onProductChanged(null)
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : t('Не вдалося видалити повʼязаний товар'))
    } finally {
      setRemovingNetUid(null)
    }
  }

  return (
    <Stack gap="sm">
      {error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {error}
        </Alert>
      )}

      {type === 'analogues' ? (
        <Group justify="space-between" gap="sm" wrap="wrap">
          <PermissionGate permissionKey={PRODUCT_EDIT_PERMISSION}>
            <Checkbox
              checked={removeIndirectAnalogues}
              label={t('Видалити непрямі аналоги')}
              onChange={(event) => setRemoveIndirectAnalogues(event.currentTarget.checked)}
            />
          </PermissionGate>
          <ProductUploadDocumentButton
            product={product}
            type="analogues"
            onProductChanged={onProductChanged}
          />
        </Group>
      ) : (
        <Group justify="flex-end">
          <ProductUploadDocumentButton
            product={product}
            type="components"
            onProductChanged={onProductChanged}
          />
        </Group>
      )}

      {rows.length === 0 ? (
        <Text c="dimmed" size="sm">{emptyLabel}</Text>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="xs">
          {rows.map((row) => {
            const rowKey = getRelatedProductKey(row.source)
            const isRemoving = removingNetUid === row.product.NetUid

            return (
              <Card withBorder radius="sm" padding="xs" key={rowKey}>
                <Group justify="space-between" gap="xs" wrap="nowrap">
                  <button
                    type="button"
                    className="product-related-open-button"
                    disabled={!row.product.NetUid}
                    onClick={() => onSelectProduct(row.product)}
                  >
                    <Group gap={6} wrap="nowrap" align="center">
                      {type === 'components' ? (
                        row.isProductSet
                          ? <IconBox size={15} stroke={1.6} />
                          : <IconSettings size={15} stroke={1.6} />
                      ) : null}
                      <Text fw={650} size="sm" lineClamp={1} c={getRelatedProductRowColor(row.product)}>{displayValue(row.product.VendorCode || row.product.NetUid)}</Text>
                    </Group>
                    <Text c="dimmed" size="xs" lineClamp={2}>{displayValue(row.product.NameUA || row.product.Name)}</Text>
                  </button>
                  <PermissionGate permissionKey={PRODUCT_EDIT_PERMISSION}>
                    <Tooltip label={t('Видалити')}>
                      <ActionIcon
                        aria-label={t('Видалити')}
                        color="red"
                        loading={isRemoving}
                        size="sm"
                        variant="light"
                        onClick={() => void removeRelatedProduct(row)}
                      >
                        <IconTrash size={15} />
                      </ActionIcon>
                    </Tooltip>
                  </PermissionGate>
                </Group>
                <SimpleGrid cols={2} spacing={6} mt="xs">
                  <InfoBlock label="Оригінальний номер" value={row.product.MainOriginalNumber} />
                  <InfoBlock label="Пакування" value={row.product.PackingStandard} />
                  <InfoBlock label="Склад Укр." value={formatAmount(getRelatedProductAvailableQty(row.product, type))} />
                  {type === 'components' ? (
                    <>
                      <InfoBlock label="Кількість" value={displayValue(row.quantity)} />
                      <InfoBlock label="Одиниця" value={row.product.MeasureUnit?.Name} />
                    </>
                  ) : null}
                </SimpleGrid>
              </Card>
            )
          })}
        </SimpleGrid>
      )}
    </Stack>
  )
}

type ProductUploadDocumentForm = {
  article: string
  file: File | null
  from: number
  isCleanBeforeLoading: boolean
  quantity: number
  to: number
  vendorCode: string
}

function ProductUploadDocumentToolbar({
  onUploadSuccess,
  product,
}: {
  onUploadSuccess: () => void
  product: Product | null
}) {
  const { t } = useI18n()
  const [uploadType, setUploadType] = useState<ProductRelatedUploadType | null>(null)
  const [productUploadOpened, setProductUploadOpened] = useState(false)
  const [storageUploadOpened, setStorageUploadOpened] = useState(false)

  return (
    <>
      <PermissionGate permissionKey={PRODUCT_UPLOAD_DOCUMENT_PERMISSION}>
        <Menu position="bottom-start" shadow="md" width={260} withinPortal>
          <Menu.Target>
            <Button size="xs" variant="default" leftSection={<ExcelIcon size={18} />}>
              {t('Завантажити')}
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>{t('Асортимент')}</Menu.Label>
            <Menu.Item leftSection={<IconUpload size={15} />} onClick={() => setProductUploadOpened(true)}>
              {t('Товари')}
            </Menu.Item>
            <Menu.Divider />
            <Menu.Label>{t('Повʼязані товари')}</Menu.Label>
            <Menu.Item leftSection={<IconUpload size={15} />} onClick={() => setUploadType('analogues')}>
              {t('Аналоги')}
            </Menu.Item>
            <Menu.Item leftSection={<IconUpload size={15} />} onClick={() => setUploadType('components')}>
              {t('Комплектуючі')}
            </Menu.Item>
            <Menu.Item leftSection={<IconUpload size={15} />} onClick={() => setUploadType('originalNumbers')}>
              {t('Оригінальні номери')}
            </Menu.Item>
            <Menu.Divider />
            <Menu.Label>{t('Розміщення')}</Menu.Label>
            <Menu.Item leftSection={<IconUpload size={15} />} onClick={() => setStorageUploadOpened(true)}>
              {t('Місце зберігання')}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </PermissionGate>

      {productUploadOpened ? (
        <ProductFileUploadModal
          opened
          onClose={() => setProductUploadOpened(false)}
          onUploadSuccess={onUploadSuccess}
        />
      ) : null}

      {storageUploadOpened ? (
        <ProductPlacementStorageUploadModal
          opened
          onClose={() => setStorageUploadOpened(false)}
          onUploadSuccess={onUploadSuccess}
        />
      ) : null}

      {uploadType ? (
        <ProductUploadDocumentModal
          key={`${uploadType}-${product?.VendorCode || ''}`}
          opened
          product={product}
          type={uploadType}
          onClose={() => setUploadType(null)}
          onUploadSuccess={onUploadSuccess}
        />
      ) : null}
    </>
  )
}

function ProductPlacementStorageUploadModal({
  onClose,
  onUploadSuccess,
  opened,
}: {
  onClose: () => void
  onUploadSuccess: () => void
  opened: boolean
}) {
  const { t } = useI18n()
  const [storages, setStorages] = useState<Storage[]>([])
  const [storagesError, setStoragesError] = useState<string | null>(null)
  const [isLoadingStorages, setLoadingStorages] = useState(true)
  const [storageId, setStorageId] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [startRow, setStartRow] = useState(1)
  const [endRow, setEndRow] = useState(0)
  const [columnVendorCode, setColumnVendorCode] = useState(1)
  const [columnQty, setColumnQty] = useState(2)
  const [columnPlacement, setColumnPlacement] = useState(3)
  const [notPassedRows, setNotPassedRows] = useState<ProductPlacementStorage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isUploading, setUploading] = useState(false)
  const [isSavingReturn, setSavingReturn] = useState(false)
  const canUpload = Boolean(file && storageId && startRow > 0 && endRow > 0 && !isUploading)

  useEffect(() => {
    let cancelled = false

    async function loadStorages() {
      setLoadingStorages(true)
      setStoragesError(null)

      try {
        const nextStorages = await getNonDefectiveStorages()

        if (!cancelled) {
          setStorages(nextStorages)
          setStorageId((current) => current || (nextStorages[0]?.Id ? String(nextStorages[0].Id) : null))
        }
      } catch (loadError) {
        if (!cancelled) {
          setStoragesError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити склади'))
        }
      } finally {
        if (!cancelled) {
          setLoadingStorages(false)
        }
      }
    }

    void loadStorages()

    return () => {
      cancelled = true
    }
  }, [t])

  const storageOptions = storages.reduce<Array<{ label: string; value: string }>>((options, storage) => {
    const value = storage.Id ? String(storage.Id) : ''

    if (value) {
      options.push({ label: displayValue(storage.Name), value })
    }

    return options
  }, [])

  async function uploadFile() {
    if (!file || !storageId) {
      return
    }

    setUploading(true)
    setError(null)

    try {
      const returnedRows = await uploadProductPlacementStorageFile(Number(storageId), {
        ColumnPlacement: columnPlacement,
        ColumnQty: columnQty,
        ColumnVendorCode: columnVendorCode,
        EndRow: endRow,
        StartRow: startRow,
      }, file)

      setNotPassedRows(returnedRows)
      onUploadSuccess()

      if (returnedRows.length === 0) {
        notifications.show({ color: 'green', message: t('Розміщення завантажено') })
        onClose()
      } else {
        notifications.show({ color: 'yellow', message: t('Деякі позиції потребують виправлення') })
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : t('Не вдалося завантажити файл розміщення'))
    } finally {
      setUploading(false)
    }
  }

  function updateNotPassedRow(index: number, field: 'Placement' | 'Qty', value: string) {
    setNotPassedRows((currentRows) => currentRows.map((row, rowIndex) => (
      rowIndex === index
        ? { ...row, [field]: field === 'Qty' ? Number(value) || 0 : value }
        : row
    )))
  }

  async function saveNotPassedRows() {
    if (notPassedRows.length === 0 || !storageId) {
      return
    }

    setSavingReturn(true)
    setError(null)

    try {
      const stillFailing = await uploadProductPlacementStorageReturn(Number(storageId), notPassedRows)

      onUploadSuccess()

      if (stillFailing.length === 0) {
        notifications.show({ color: 'green', message: t('Виправлені розміщення збережено') })
        onClose()
      } else {
        setNotPassedRows(stillFailing)
        notifications.show({ color: 'yellow', message: t('Деякі позиції потребують виправлення') })
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти виправлені розміщення'))
    } finally {
      setSavingReturn(false)
    }
  }

  return (
    <AppModal centered opened={opened} size="min(960px, 96vw)" title={t('Завантаження місць зберігання')} onClose={onClose}>
      <Stack gap="md">
        {(error || storagesError) ? (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">{error || storagesError}</Alert>
        ) : null}

        {notPassedRows.length === 0 ? (
          <>
            <Select
              data={storageOptions}
              disabled={isLoadingStorages || storageOptions.length === 0}
              label={t('Склад')}
              placeholder={isLoadingStorages ? t('Завантаження') : t('Оберіть склад')}
              value={storageId}
              onChange={(value) => setStorageId(value)}
            />
            <FileInput
              clearable
              accept=".xls,.xlsx,.csv"
              label={t('Файл')}
              placeholder={t('Оберіть файл')}
              value={file}
              onChange={setFile}
            />
            <SimpleGrid cols={{ base: 2, sm: 5 }} spacing="sm">
              <NumberInput label={t('Початковий рядок')} min={1} value={startRow} onChange={(value) => setStartRow(Number(value) || 0)} />
              <NumberInput label={t('Кінцевий рядок')} min={0} value={endRow} onChange={(value) => setEndRow(Number(value) || 0)} />
              <NumberInput label={t('Колонка коду')} min={1} value={columnVendorCode} onChange={(value) => setColumnVendorCode(Number(value) || 0)} />
              <NumberInput label={t('Колонка кількості')} min={1} value={columnQty} onChange={(value) => setColumnQty(Number(value) || 0)} />
              <NumberInput label={t('Колонка місця')} min={1} value={columnPlacement} onChange={(value) => setColumnPlacement(Number(value) || 0)} />
            </SimpleGrid>
            <Group justify="flex-end">
              <Button disabled={!canUpload} leftSection={<IconUpload size={16} />} loading={isUploading} onClick={() => void uploadFile()}>
                {t('Завантажити')}
              </Button>
            </Group>
          </>
        ) : (
          <>
            <Text fw={600} size="sm">{t('Не пройшли позиції')}</Text>
            <ScrollArea mah={420}>
              <Table withTableBorder miw={760}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('Назва')}</Table.Th>
                    <Table.Th>{t('Код')}</Table.Th>
                    <Table.Th>{t('Місце')}</Table.Th>
                    <Table.Th ta="right">{t('Кількість')}</Table.Th>
                    <Table.Th>{t('Помилка')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {notPassedRows.map((row, index) => (
                    <Table.Tr key={`${row.NetUid || row.VendorCode || index}`}>
                      <Table.Td>{displayValue(row.Product?.NameUA || row.Product?.Name)}</Table.Td>
                      <Table.Td>{displayValue(row.VendorCode)}</Table.Td>
                      <Table.Td>
                        <TextInput size="xs" value={row.Placement || ''} onChange={(event) => updateNotPassedRow(index, 'Placement', event.currentTarget.value)} />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput hideControls size="xs" min={0} value={row.Qty || 0} onChange={(value) => updateNotPassedRow(index, 'Qty', String(value ?? 0))} />
                      </Table.Td>
                      <Table.Td><Text c="red.7" size="xs">{displayValue(row.ErrorMessage)}</Text></Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
            <Group justify="flex-end">
              <Button color="gray" variant="light" disabled={isSavingReturn} onClick={onClose}>
                {t('Закрити')}
              </Button>
              <Button leftSection={<IconDeviceFloppy size={16} />} loading={isSavingReturn} onClick={() => void saveNotPassedRows()}>
                {t('Зберегти')}
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </AppModal>
  )
}

function ProductFileUploadModal({
  onClose,
  onUploadSuccess,
  opened,
}: {
  onClose: () => void
  onUploadSuccess: () => void
  opened: boolean
}) {
  const { t } = useI18n()
  const [form, setForm] = useState<ProductFileUploadForm>(() => createProductFileUploadForm())
  const [pricingState, setPricingState] = useState<{ data: Pricing[]; error: string | null; isLoading: boolean }>({
    data: [],
    error: null,
    isLoading: true,
  })
  const [error, setError] = useState<string | null>(null)
  const [isUploading, setUploading] = useState(false)
  const canSubmit = Boolean(form.files.length > 0 && form.startRow > 0 && form.endRow > 0 && form.vendorCode > 0 && !isUploading)
  const pricingOptions = pricingState.data.reduce<Array<{ label: string; value: string }>>((options, pricing) => {
    const value = String(pricing.Id || '')

    if (value) {
      options.push({
        label: displayValue(pricing.Name),
        value,
      })
    }

    return options
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadPricings() {
      try {
        const nextPricings = await getProductUploadPricings()

        if (!cancelled) {
          setPricingState({ data: nextPricings, error: null, isLoading: false })
        }
      } catch (loadError) {
        if (!cancelled) {
          setPricingState({
            data: [],
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити типи цін'),
            isLoading: false,
          })
        }
      }
    }

    void loadPricings()

    return () => {
      cancelled = true
    }
  }, [t])

  function closeModal() {
    if (isUploading) {
      return
    }

    onClose()
  }

  function setField<K extends keyof ProductFileUploadForm>(field: K, value: ProductFileUploadForm[K]) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  function setColumnField(field: keyof ProductFileUploadColumnForm, value: number | string) {
    setField(field, readProductUploadNumber(value) as ProductFileUploadForm[typeof field])
  }

  function addPriceRow() {
    setForm((currentForm) => ({
      ...currentForm,
      prices: [
        ...currentForm.prices,
        {
          columnNumber: 0,
          key: `price-${Date.now()}-${currentForm.prices.length}`,
          pricingId: pricingOptions[0]?.value || '',
        },
      ],
    }))
  }

  function updatePriceRow(key: string, patch: Partial<ProductFileUploadPriceRow>) {
    setForm((currentForm) => ({
      ...currentForm,
      prices: currentForm.prices.map((priceRow) => (
        priceRow.key === key ? { ...priceRow, ...patch } : priceRow
      )),
    }))
  }

  function removePriceRow(key: string) {
    setForm((currentForm) => ({
      ...currentForm,
      prices: currentForm.prices.filter((priceRow) => priceRow.key !== key),
    }))
  }

  async function submitUpload() {
    if (!canSubmit) {
      setError(t('Виберіть файл і заповніть обовʼязкові колонки'))
      return
    }

    if (form.prices.some((priceRow) => !priceRow.pricingId || priceRow.columnNumber <= 0)) {
      setError(t('Заповніть тип ціни і колонку для кожної ціни'))
      return
    }

    setUploading(true)
    setError(null)

    try {
      await uploadProductsFromFile(buildProductFileUploadConfiguration(form), form.files)
      notifications.show({ color: 'green', message: t('Файл товарів завантажено') })
      onClose()
      onUploadSuccess()
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : t('Не вдалося завантажити файл товарів'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <AppModal centered opened={opened} size="min(960px, 96vw)" title={t('Завантаження товарів')} onClose={closeModal}>
      <Stack gap="sm">
        {(error || pricingState.error) ? (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error || pricingState.error}
          </Alert>
        ) : null}

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <Select
            allowDeselect={false}
            data={productFileUploadModeOptions.map((option) => ({ ...option, label: t(option.label) }))}
            label={t('Операція')}
            value={String(form.mode)}
            onChange={(value) => setField('mode', readProductUploadNumber(value || 0) as ProductFileUploadMode)}
          />
          <FileInput
            clearable
            multiple
            label={t('Файл')}
            placeholder={t('Оберіть файл')}
            value={form.files}
            onChange={(nextFiles) => setField('files', Array.isArray(nextFiles) ? nextFiles : [])}
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="sm">
          {productFileUploadFieldLabels.map((item) => (
            <NumberInput
              key={item.field}
              label={t(item.label)}
              min={0}
              required={item.required}
              value={form[item.field]}
              onChange={(value) => setColumnField(item.field, value)}
            />
          ))}
        </SimpleGrid>

        <Divider />

        <Group justify="space-between">
          <Text fw={700}>{t('Ціни')}</Text>
          <Button
            disabled={pricingState.isLoading || pricingOptions.length === 0}
            leftSection={<IconPlus size={16} />}
            size="xs"
            variant="light"
            onClick={addPriceRow}
          >
            {t('Додати ціну')}
          </Button>
        </Group>

        {pricingState.isLoading ? (
          <Group justify="center" py="sm">
            <Loader size="sm" />
          </Group>
        ) : form.prices.length > 0 ? (
          <Stack gap="xs">
            {form.prices.map((priceRow) => (
              <Group key={priceRow.key} gap="xs" wrap="nowrap" align="flex-end">
                <Select
                  allowDeselect={false}
                  data={pricingOptions}
                  label={t('Тип ціни')}
                  style={{ flex: '1 1 240px' }}
                  value={priceRow.pricingId}
                  onChange={(value) => updatePriceRow(priceRow.key, { pricingId: value || '' })}
                />
                <NumberInput
                  label={t('Колонка')}
                  min={0}
                  style={{ flex: '0 0 130px' }}
                  value={priceRow.columnNumber}
                  onChange={(value) => updatePriceRow(priceRow.key, { columnNumber: readProductUploadNumber(value) })}
                />
                <Tooltip label={t('Видалити')}>
                  <ActionIcon aria-label={t('Видалити')} color="red" variant="light" onClick={() => removePriceRow(priceRow.key)}>
                    <IconTrash size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            ))}
          </Stack>
        ) : (
          <Text c="dimmed" size="sm">{t('Ціни не додані')}</Text>
        )}

        <Group justify="flex-end">
          <Button color="gray" disabled={isUploading} variant="light" onClick={closeModal}>
            {t('Скасувати')}
          </Button>
          <Button leftSection={<IconUpload size={16} />} loading={isUploading} disabled={!canSubmit} onClick={() => void submitUpload()}>
            {t('Завантажити')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

function ProductUploadDocumentButton({
  onProductChanged,
  product,
  type,
}: {
  onProductChanged: (product: Product | null) => void
  product: Product
  type: ProductRelatedUploadType
}) {
  const { t } = useI18n()
  const [opened, setOpened] = useState(false)
  const labels = productUploadDocumentLabels[type]

  function openModal() {
    setOpened(true)
  }

  function closeModal() {
    setOpened(false)
  }

  return (
    <>
      <PermissionGate permissionKey={PRODUCT_UPLOAD_DOCUMENT_PERMISSION}>
        <Button size="xs" variant="light" leftSection={<IconUpload size={16} />} onClick={openModal}>
          {t(labels.button)}
        </Button>
      </PermissionGate>

      {opened ? (
        <ProductUploadDocumentModal
          key={`${type}-${product.VendorCode || ''}`}
          opened
          product={product}
          type={type}
          onClose={closeModal}
          onUploadSuccess={() => onProductChanged(null)}
        />
      ) : null}
    </>
  )
}

function ProductUploadDocumentModal({
  onClose,
  onUploadSuccess,
  opened,
  product,
  type,
}: {
  onClose: () => void
  onUploadSuccess: () => void
  opened: boolean
  product?: Product | null
  type: ProductRelatedUploadType
}) {
  const { t } = useI18n()
  const [form, setForm] = useState<ProductUploadDocumentForm>(() => createProductUploadDocumentForm(product))
  const [error, setError] = useState<string | null>(null)
  const [isUploading, setUploading] = useState(false)
  const labels = productUploadDocumentLabels[type]
  const canSubmit = Boolean(form.file && form.vendorCode.trim() && !isUploading)

  function closeModal() {
    if (isUploading) {
      return
    }

    onClose()
    setError(null)
  }

  function setField<K extends keyof ProductUploadDocumentForm>(field: K, value: ProductUploadDocumentForm[K]) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  async function submitUpload() {
    if (!form.file || !form.vendorCode.trim()) {
      setError(t('Заповніть артикул товару і виберіть файл'))
      return
    }

    setUploading(true)
    setError(null)

    try {
      await uploadProductRelatedDocument(type, buildProductUploadDocumentPayload(type, form), form.file)
      notifications.show({ color: 'green', message: t('Файл завантажено') })
      onClose()
      onUploadSuccess()
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : t('Не вдалося завантажити файл'))
    } finally {
      setUploading(false)
    }
  }

  function handleUploadKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeModal()
      return
    }

    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && canSubmit) {
      event.preventDefault()
      void submitUpload()
    }
  }

  return (
    <AppModal centered opened={opened} title={t(labels.title)} onClose={closeModal}>
      <Stack gap="sm" onKeyDown={handleUploadKeyDown}>
        {error ? (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        ) : null}

        <FileInput
          clearable
          label={t('Файл')}
          placeholder={t('Оберіть файл')}
          value={form.file}
          onChange={(nextFile) => setField('file', nextFile)}
        />

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <TextInput
            label={t('Артикул товару')}
            value={form.vendorCode}
            onChange={(event) => setField('vendorCode', event.currentTarget.value)}
          />
          <TextInput
            label={t(labels.articleLabel)}
            value={form.article}
            onChange={(event) => setField('article', event.currentTarget.value)}
          />
          <NumberInput
            label={t('З')}
            value={form.from}
            onChange={(value) => setField('from', readProductUploadNumber(value))}
          />
          <NumberInput
            label={t('По')}
            value={form.to}
            onChange={(value) => setField('to', readProductUploadNumber(value))}
          />
          {type === 'components' ? (
            <NumberInput
              label={t('Кількість')}
              min={0}
              value={form.quantity}
              onChange={(value) => setField('quantity', readProductUploadNumber(value))}
            />
          ) : null}
        </SimpleGrid>

        {type === 'originalNumbers' ? (
          <Checkbox
            checked={form.isCleanBeforeLoading}
            label={t('Очистити перед завантаженням')}
            onChange={(event) => setField('isCleanBeforeLoading', event.currentTarget.checked)}
          />
        ) : null}

        <Group justify="flex-end">
          <Button color="gray" disabled={isUploading} variant="light" onClick={closeModal}>
            {t('Скасувати')}
          </Button>
          <Button leftSection={<IconUpload size={16} />} loading={isUploading} disabled={!canSubmit} onClick={() => void submitUpload()}>
            {t('Завантажити')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

function createProductUploadDocumentForm(product?: Product | null): ProductUploadDocumentForm {
  return {
    article: '',
    file: null,
    from: 0,
    isCleanBeforeLoading: false,
    quantity: 0,
    to: 0,
    vendorCode: product?.VendorCode || '',
  }
}

function createProductFileUploadForm(): ProductFileUploadForm {
  return {
    descriptionRU: 0,
    descriptionUA: 0,
    endRow: 0,
    files: [],
    isForSale: 0,
    isForWeb: 0,
    mainOriginalNumber: 0,
    measureUnit: 0,
    mode: 0,
    nameRU: 0,
    nameUA: 0,
    newVendorCode: 0,
    orderStandard: 0,
    packingStandard: 0,
    prices: [],
    productGroup: 0,
    size: 0,
    startRow: 0,
    top: 0,
    ucgfea: 0,
    vendorCode: 0,
    volume: 0,
    weight: 0,
  }
}

function buildProductFileUploadConfiguration(form: ProductFileUploadForm): ProductFileUploadConfiguration {
  const priceConfigurations = form.prices.reduce<ProductFileUploadConfiguration['PriceConfigurations']>((items, priceRow) => {
    if (priceRow.pricingId && priceRow.columnNumber > 0) {
      items.push({
        ColumnNumber: priceRow.columnNumber,
        PricingId: Number(priceRow.pricingId),
      })
    }

    return items
  }, [])

  return {
    DescriptionPL: 0,
    DescriptionRU: form.descriptionRU,
    DescriptionUA: form.descriptionUA,
    EndRow: form.endRow,
    IsForSale: form.isForSale,
    IsForWeb: form.isForWeb,
    MainOriginalNumber: form.mainOriginalNumber,
    MeasureUnit: form.measureUnit,
    Mode: form.mode,
    NamePL: 0,
    NameRU: form.nameRU,
    NameUA: form.nameUA,
    NewVendorCode: form.newVendorCode,
    OrderStandard: form.orderStandard,
    PackingStandard: form.packingStandard,
    PriceConfigurations: priceConfigurations,
    ProductGroup: form.productGroup,
    Size: form.size,
    StartRow: form.startRow,
    Top: form.top,
    UCGFEA: form.ucgfea,
    VendorCode: form.vendorCode,
    Volume: form.volume,
    Weight: form.weight,
    WithDescriptionPL: false,
    WithDescriptionRU: form.descriptionRU !== 0,
    WithDescriptionUA: form.descriptionUA !== 0,
    WithIsForSale: form.isForSale !== 0,
    WithIsForWeb: form.isForWeb !== 0,
    WithMainOriginalNumber: form.mainOriginalNumber !== 0,
    WithMeasureUnit: form.measureUnit !== 0,
    WithNamePL: false,
    WithNameRU: form.nameRU !== 0,
    WithNameUA: form.nameUA !== 0,
    WithNewVendorCode: form.newVendorCode !== 0,
    WithOrderStandard: form.orderStandard !== 0,
    WithPackingStandard: form.packingStandard !== 0,
    WithPrices: priceConfigurations.length > 0,
    WithProductGroup: form.productGroup !== 0,
    WithSize: form.size !== 0,
    WithTop: form.top !== 0,
    WithUCGFEA: form.ucgfea !== 0,
    WithVolume: form.volume !== 0,
    WithWeight: form.weight !== 0,
  }
}

function buildProductUploadDocumentPayload(
  type: ProductRelatedUploadType,
  form: ProductUploadDocumentForm,
): ProductUploadDocumentPayload {
  const basePayload: ProductUploadDocumentPayload = {
    from: form.from,
    to: form.to,
    vendorCode: form.vendorCode.trim(),
  }
  const article = form.article.trim()

  switch (type) {
    case 'analogues':
      return {
        ...basePayload,
        analogueVendorCode: article,
      }
    case 'components':
      return {
        ...basePayload,
        componentVendorCode: article,
        qty: form.quantity,
      }
    case 'originalNumbers':
      return {
        ...basePayload,
        isCleanBeforeLoading: form.isCleanBeforeLoading,
        originalNumber: article,
      }
  }
}

function readProductUploadNumber(value: number | string): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  const parsedValue = Number(value)

  return Number.isFinite(parsedValue) ? parsedValue : 0
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  const tagName = target.tagName.toLowerCase()

  return target.isContentEditable || tagName === 'button' || tagName === 'input' || tagName === 'select' || tagName === 'textarea'
}

function ProductInlineMovementsTab({
  direction,
  product,
}: {
  direction: InlineMovementDirection
  product: Product
}) {
  const { t } = useI18n()
  const productNetUid = product.NetUid?.trim()
  const [dateFrom, setDateFrom] = useState(getTodayDate)
  const [dateTo, setDateTo] = useState(getTodayDate)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const [state, dispatch] = useReducer(inlineMovementReducer, {
    document: null,
    error: null,
    exportError: null,
    isExporting: false,
    isLoading: Boolean(productNetUid),
    rows: [],
  })
  const labels = inlineMovementLabels[direction]

  useEffect(() => {
    if (!productNetUid) {
      return
    }

    let cancelled = false
    const netUid = productNetUid

    async function loadRows() {
      dispatch({ type: 'loading' })

      try {
        const params = {
          from: dateFrom,
          productNetId: netUid,
          to: dateTo,
        }
        const nextRows = direction === 'income'
          ? await getProductIncomeMovements(params)
          : await getProductOutcomeMovements(params)

        if (!cancelled) {
          dispatch({
            rows: nextRows,
            type: 'success',
          })
        }
      } catch (loadError) {
        if (!cancelled) {
          dispatch({
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити рух товару'),
            type: 'error',
          })
        }
      }
    }

    void loadRows()

    return () => {
      cancelled = true
    }
  }, [dateFrom, dateTo, direction, productNetUid, reloadKey, t])

  async function exportRows() {
    if (!productNetUid || state.isExporting) {
      return
    }

    dispatch({ type: 'export-loading' })

    try {
      const params = {
        from: dateFrom,
        productNetId: productNetUid,
        to: dateTo,
      }
      const document = direction === 'income'
        ? await exportProductIncomeMovementsDocument(params)
        : await exportProductOutcomeMovementsDocument(params)

      dispatch({ document, type: 'export-success' })
    } catch (exportError) {
      dispatch({
        error: exportError instanceof Error ? exportError.message : t('Не вдалося сформувати документ'),
        type: 'export-error',
      })
    }
  }

  return (
    <Stack gap="sm">
      <Group align="end" gap="sm" wrap="wrap">
        <TextInput label={t('З')} type="date" value={dateFrom} onChange={(event) => setDateFrom(event.currentTarget.value)} />
        <TextInput label={t('По')} type="date" value={dateTo} onChange={(event) => setDateTo(event.currentTarget.value)} />
        <Button leftSection={<IconRefresh size={16} />} loading={state.isLoading} variant="light" onClick={() => reload()}>
          {t('Оновити')}
        </Button>
        <Button
          disabled={!productNetUid}
          leftSection={<IconDownload size={16} />}
          loading={state.isExporting}
          variant="light"
          onClick={() => void exportRows()}
        >
          {t('Завантажити')}
        </Button>
      </Group>

      {!productNetUid ? (
        <Alert color="yellow" icon={<IconAlertCircle size={18} />} variant="light">
          {t('У товару немає NetUid для завантаження руху товару')}
        </Alert>
      ) : state.error ? (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {state.error}
        </Alert>
      ) : state.exportError ? (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {state.exportError}
        </Alert>
      ) : state.isLoading ? (
        <Group justify="center" py="md">
          <Loader size="sm" />
          <Text c="dimmed" size="sm">{t(labels.loading)}</Text>
        </Group>
      ) : state.rows.length === 0 ? (
        <Text c="dimmed" size="sm">{t(labels.empty)}</Text>
      ) : direction === 'income' ? (
        <ProductIncomeMovementsTable rows={state.rows as ProductIncomeMovement[]} />
      ) : (
        <ProductOutcomeMovementsTable rows={state.rows as ProductOutcomeMovement[]} />
      )}

      <ProductMovementDownloadModal
        document={state.document}
        title={labels.exportTitle}
        onClose={() => dispatch({ type: 'export-clear' })}
      />
    </Stack>
  )
}

function ProductIncomeMovementsTable({ rows }: { rows: ProductIncomeMovement[] }) {
  const { t } = useI18n()

  const columns = useMemo<DataTableColumn<ProductIncomeMovement>[]>(() => [
    { id: 'storage', header: t('Склад'), accessor: (row) => row.StorageName, cell: (row) => displayValue(row.StorageName) },
    { id: 'supplier', header: t('Постачальник'), accessor: (row) => row.SupplierName, cell: (row) => displayValue(row.SupplierName) },
    { id: 'organization', header: t('Організація'), accessor: (row) => row.OrganizationName, cell: (row) => displayValue(row.OrganizationName) },
    { id: 'incomeDate', header: t('Дата приходу'), accessor: (row) => row.IncomeToStorageDate, cell: (row) => formatInlineDateTime(row.IncomeToStorageDate) },
    { id: 'incomeNumber', header: t('Номер приходу'), accessor: (row) => row.IncomeToStorageNumber, cell: (row) => displayValue(row.IncomeToStorageNumber) },
    { id: 'invoice', header: t('Інвойс'), accessor: (row) => row.IncomeInvoiceNumber, cell: (row) => displayValue(row.IncomeInvoiceNumber) },
    { id: 'invoiceDate', header: t('Дата інвойсу'), accessor: (row) => row.IncomeInvoiceDate, cell: (row) => formatInlineDateTime(row.IncomeInvoiceDate) },
    { id: 'currency', header: t('Валюта'), accessor: (row) => row.Currency, cell: (row) => displayValue(row.Currency) },
    { id: 'exchangeRate', header: t('Курс'), align: 'right', accessor: (row) => row.ExchangeRate, cell: (row) => formatAmount(row.ExchangeRate) },
    { id: 'unitPriceLocal', header: t('Ціна UAH'), align: 'right', accessor: (row) => row.UnitPriceLocal, cell: (row) => formatPrice(row.UnitPriceLocal) },
    { id: 'netPrice', header: t('Net'), align: 'right', accessor: (row) => row.NetPrice, cell: (row) => formatPrice(row.NetPrice) },
    { id: 'totalNetPrice', header: t('Total Net'), align: 'right', accessor: (row) => row.TotalNetPrice, cell: (row) => formatPrice(row.TotalNetPrice) },
    { id: 'grossPrice', header: t('Gross'), align: 'right', accessor: (row) => row.GrossPrice, cell: (row) => formatPrice(row.GrossPrice) },
    { id: 'accountingGrossPrice', header: t('Бух. Gross'), align: 'right', accessor: (row) => row.AccountingGrossPrice, cell: (row) => formatPrice(row.AccountingGrossPrice) },
    { id: 'managementEurUnitPrice', header: t('Упр. EUR'), align: 'right', accessor: (row) => row.ManagementEurUnitPrice, cell: (row) => formatPrice(row.ManagementEurUnitPrice) },
    { id: 'accountingEurUnitPrice', header: t('Бух. EUR'), align: 'right', accessor: (row) => row.AccountingEurUnitPrice, cell: (row) => formatPrice(row.AccountingEurUnitPrice) },
    { id: 'weight', header: t('Вага'), align: 'right', accessor: (row) => row.Weight, cell: (row) => formatAmount(row.Weight) },
    { id: 'incomeQty', header: t('Прихід'), align: 'right', accessor: (row) => row.IncomeQty, cell: (row) => formatAmount(row.IncomeQty) },
    { id: 'remainingQty', header: t('Залишок'), align: 'right', accessor: (row) => row.RemainingQty, cell: (row) => formatAmount(row.RemainingQty) },
    { id: 'fromInvoiceNumber', header: t('З інвойсу'), accessor: (row) => row.FromInvoiceNumber, cell: (row) => displayValue(row.FromInvoiceNumber) },
    { id: 'fromInvoiceDate', header: t('Дата з інвойсу'), accessor: (row) => row.FromInvoiceDate, cell: (row) => formatInlineDateTime(row.FromInvoiceDate) },
    { id: 'returnPrice', header: t('Ціна повернення'), align: 'right', accessor: (row) => row.ReturnPrice, cell: (row) => formatPrice(row.ReturnPrice) },
    { id: 'priceDifference', header: t('Різниця'), align: 'right', accessor: (row) => row.PriceDifference, cell: (row) => formatPrice(row.PriceDifference) },
  ], [t])

  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(row, index) => getIncomeMovementRowKey(row, index)}
      maxHeight="calc(100vh - 320px)"
      minWidth={1960}
      tableId="product-inline-income-movements"
    />
  )
}

function ProductOutcomeMovementsTable({ rows }: { rows: ProductOutcomeMovement[] }) {
  const { t } = useI18n()

  const columns = useMemo<DataTableColumn<ProductOutcomeMovement>[]>(() => {
    const editedCell = (row: ProductOutcomeMovement, value: ReactNode): ReactNode =>
      row.HasUpdateDataCarrier ? <span className="product-inline-table-cell-edited">{value}</span> : value

    return [
      { id: 'date', header: t('Дата'), accessor: (row) => row.FromDate, cell: (row) => editedCell(row, formatInlineDateTime(row.FromDate)) },
      { id: 'documentType', header: t('Тип документа'), accessor: (row) => row.DocumentTypeName, cell: (row) => editedCell(row, displayValue(row.DocumentTypeName)) },
      { id: 'storage', header: t('Склад'), accessor: (row) => row.StorageName, cell: (row) => displayValue(row.StorageName) },
      { id: 'organization', header: t('Організація'), accessor: (row) => row.OrganizationName, cell: (row) => displayValue(row.OrganizationName) },
      { id: 'number', header: t('Номер'), accessor: (row) => row.DocumentNumber, cell: (row) => editedCell(row, displayValue(row.DocumentNumber)) },
      { id: 'client', header: t('Клієнт'), accessor: (row) => row.ClientName, cell: (row) => displayValue(row.ClientName) },
      { id: 'responsible', header: t('Відповідальний'), accessor: (row) => row.ResponsibleName, cell: (row) => displayValue(row.ResponsibleName) },
      { id: 'price', header: t('Ціна'), align: 'right', accessor: (row) => row.Price, cell: (row) => formatPrice(row.Price) },
      { id: 'qty', header: t('Кількість'), align: 'right', accessor: (row) => row.Qty, cell: (row) => formatAmount(row.Qty) },
    ]
  }, [t])

  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(row, index) => getOutcomeMovementRowKey(row, index)}
      maxHeight="calc(100vh - 320px)"
      minWidth={1280}
      rowClassName={(row) => (row.HasUpdateDataCarrier ? 'product-inline-table-row-edited' : undefined)}
      tableId="product-inline-outcome-movements"
    />
  )
}

function ProductMovementDownloadModal({
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
    <AppModal centered opened={Boolean(document)} title={t(title)} onClose={onClose}>
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

function inlineMovementReducer(state: InlineMovementState, action: InlineMovementAction): InlineMovementState {
  switch (action.type) {
    case 'export-clear':
      return {
        ...state,
        document: null,
      }
    case 'export-error':
      return {
        ...state,
        exportError: action.error,
        isExporting: false,
      }
    case 'export-loading':
      return {
        ...state,
        exportError: null,
        isExporting: true,
      }
    case 'export-success':
      return {
        ...state,
        document: action.document,
        exportError: null,
        isExporting: false,
      }
    case 'error':
      return {
        document: state.document,
        error: action.error,
        exportError: state.exportError,
        isExporting: state.isExporting,
        isLoading: false,
        rows: [],
      }
    case 'loading':
      return {
        ...state,
        error: null,
        exportError: null,
        isLoading: true,
      }
    case 'success':
      return {
        document: state.document,
        error: null,
        exportError: null,
        isExporting: false,
        isLoading: false,
        rows: action.rows,
      }
  }
}


function applyOriginalNumbersResponse(
  product: Product,
  nextNumbers: ProductOriginalNumber[],
  onProductChanged: (product: Product | null) => void,
) {
  if (nextNumbers.length === 0) {
    onProductChanged(null)
    return
  }

  onProductChanged({
    ...product,
    MainOriginalNumber: getMainOriginalNumberFromList(nextNumbers) || product.MainOriginalNumber,
    ProductOriginalNumbers: nextNumbers,
  })
}

function getMainOriginalNumberFromList(items: ProductOriginalNumber[]): string {
  const mainOriginalNumber = items.find((item) => item.IsMainOriginalNumber)?.OriginalNumber
    || items[0]?.OriginalNumber

  return mainOriginalNumber?.MainNumber?.trim() || mainOriginalNumber?.Number?.trim() || ''
}

function getProductOriginalNumberIdentity(item: ProductOriginalNumber): string {
  return String(item.NetUid || item.OriginalNumber?.NetUid || item.OriginalNumber?.MainNumber || item.OriginalNumber?.Number || 'original-number')
}

function getOriginalNumberText(item: ProductOriginalNumber): string {
  return item.OriginalNumber?.MainNumber?.trim() || item.OriginalNumber?.Number?.trim() || ''
}

function getProductRowKey(product: Product): string {
  return getProductIdentity(product)
}

function getProductIdentity(product: Product): string {
  return String(product.NetUid || product.Id || product.VendorCode || product.Name || 'product')
}


function getProductRowToneClass(product: Product): string {
  const top = product.Top?.trim().toLowerCase()

  if (top === 'x9' || top === 'х9') {
    return 'is-critical'
  }

  if (product.IsForSale) {
    return 'is-sale'
  }

  if (product.IsForZeroSale) {
    return 'is-zero-sale'
  }

  return ''
}


function copyToClipboard(value: string) {
  if (!value || !navigator.clipboard) {
    return
  }

  void navigator.clipboard.writeText(value)
}

function getTodayDate(): string {
  const now = new Date()
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)

  return localDate.toISOString().slice(0, 10)
}

function toNumber(value?: number | null): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function formatInlineDateTime(value?: Date | string | null): string {
  if (!value) {
    return '-'
  }

  const date = value instanceof Date ? value : new Date(value)

  return Number.isNaN(date.getTime()) ? '-' : dateTimeFormatter.format(date)
}

function getIncomeMovementRowKey(row: ProductIncomeMovement, index: number): string {
  return String(
    row.NetUid
      || row.Id
      || `${row.IncomeToStorageNumber || row.IncomeInvoiceNumber || 'income'}-${row.IncomeToStorageDate || row.IncomeInvoiceDate || index}`,
  )
}

function getOutcomeMovementRowKey(row: ProductOutcomeMovement, index: number): string {
  return String(row.NetUid || row.Id || `${row.DocumentNumber || 'outcome'}-${row.FromDate || index}`)
}

function getRelatedProductKey(item: unknown): string {
  const product = readRelatedProduct(item)

  return String(product?.NetUid || product?.Id || product?.VendorCode || product?.Name || 'related-product')
}

function readRelatedProduct(item: unknown): Partial<Product> | null {
  if (!item || typeof item !== 'object') {
    return null
  }

  const record = item as Record<string, unknown>
  const nestedProduct = record.Product || record.AnalogueProduct || record.ComponentProduct || record.BaseProduct || record.RelatedProduct

  if (nestedProduct && typeof nestedProduct === 'object') {
    return nestedProduct as Partial<Product>
  }

  return record as Partial<Product>
}

function getAnalogueRows(product: Product): RelatedProductRow[] {
  const rows = [...(product.AnalogueProducts || []), ...(product.BaseAnalogueProducts || [])]

  return rows.reduce<RelatedProductRow[]>((result, item) => {
    const relatedProduct = readRelatedProductByKeys(item, ['AnalogueProduct', 'Product', 'RelatedProduct'])

    if (relatedProduct) {
      result.push({
        isProductSet: false,
        product: relatedProduct,
        source: item,
      })
    }

    return result
  }, [])
}

function getComponentRows(product: Product): RelatedProductRow[] {
  const components = (product.ComponentProducts || []).reduce<RelatedProductRow[]>((result, item) => {
    const relatedProduct = readRelatedProductByKeys(item, ['ComponentProduct', 'Product', 'RelatedProduct'])

    if (relatedProduct) {
      result.push({
        isProductSet: false,
        product: relatedProduct,
        quantity: readRelatedQuantity(item),
        source: item,
      })
    }

    return result
  }, [])
  const sets = (product.BaseSetProducts || []).reduce<RelatedProductRow[]>((result, item) => {
    const relatedProduct = readRelatedProductByKeys(item, ['BaseProduct', 'Product', 'RelatedProduct'])

    if (relatedProduct) {
      result.push({
        isProductSet: true,
        product: relatedProduct,
        quantity: readRelatedQuantity(item),
        source: item,
      })
    }

    return result
  }, [])

  return [...components, ...sets]
}

function readRelatedProductByKeys(item: unknown, keys: string[]): Partial<Product> | null {
  if (!item || typeof item !== 'object') {
    return null
  }

  const record = item as Record<string, unknown>

  for (const key of keys) {
    const value = record[key]

    if (value && typeof value === 'object') {
      return value as Partial<Product>
    }
  }

  return record as Partial<Product>
}

function readRelatedQuantity(item: unknown): number | string | undefined {
  if (!item || typeof item !== 'object') {
    return undefined
  }

  const record = item as Record<string, unknown>
  const value = record.SetComponentsQty || record.Quantity || record.Qty

  return typeof value === 'number' || typeof value === 'string' ? value : undefined
}

function getRelatedProductAvailableQty(product: Partial<Product>, type: 'analogues' | 'components'): number {
  const values = type === 'analogues'
    ? [product.AvailableQtyUk, product.AvailableQtyUkVAT, product.AvailableDefectiveQtyUk]
    : [product.AvailableQtyUk, product.AvailableQtyUkVAT]

  return values.reduce<number>(
    (total, value) => total + toNumber(value),
    0,
  )
}
