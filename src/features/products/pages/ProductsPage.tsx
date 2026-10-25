import { useSingleFlight } from '../../../shared/hooks/useSingleFlight'
import { useBusyState } from '../../../shared/hooks/useBusyState'
import { ToolbarDateRangeFilter } from '../../../shared/ui/ToolbarDateRangeFilter'
import { ProductSourceHistoryRefresh } from '../../../shared/ui/product-movement-history/ProductSourceHistoryRefresh'
import { withProductSourceHistoryColumns } from '../../../shared/ui/product-movement-history/productSourceHistory'
import { TableChip, type TableChipTone } from '../../../shared/ui/TableChip'
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
  Menu,
  NumberInput,
  ScrollArea,
  SegmentedControl,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { PdfIcon } from '../../../shared/ui/PdfIcon'
import { ArrowDownLeft, ArrowUpRight, Hash, Layers, ArrowLeftRight, Box as BoxIcon, ChevronDown, CircleAlert, ClipboardList, Copy, FileText, History, Image as ImageIcon, Package, Plus, RefreshCw, Save, Settings, Sparkles, SquarePen, Trash2, TriangleAlert, Upload } from 'lucide-react'
import { lazy, Suspense, type KeyboardEvent, type ReactNode, useCallback, useEffect, useEffectEvent, useMemo, useReducer, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { TableRowAction } from '../../../shared/ui/table-row-action'
import { DocumentExportModal } from '../../../shared/ui/document-export-modal/DocumentExportModal'
import { translate } from '../../../shared/i18n/translate'
import { realtimeEvents, useRealtimeEvent } from '../../../shared/realtime/events'
import {
  createProductOriginalNumber,
  deleteProductOriginalNumber,
  exportProductIncomeMovementsDocument,
  exportProductOutcomeMovementsDocument,
  getNonDefectiveStorages,
  getProductByNetId,
  getProductIncomeMovements,
  getProductOutcomeMovements,
  getProductSiblingCounts,
  getProductSiblings,
  getProductUploadPricings,
  getProducts,
  removeProductAnalogue,
  removeProductComponent,
  updateProductOriginalNumber,
  uploadProductsFromFile,
  uploadProductPlacementStorageFile,
  uploadProductPlacementStorageReturn,
  uploadProductRelatedDocument,
} from '../api/productsApi'
import { AppModal, AppModalFooter } from '../../../shared/ui/AppModal'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { toProxiedAssetUrl } from '../../../shared/url/proxiedAssetUrl'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { PermissionGate } from '../../auth/components/PermissionGate'
import { useAuth } from '../../auth/useAuth'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import type {
  Product,
  ProductFileUploadMode,
  ProductIncomeMovement,
  ProductMovementExportDocument,
  ProductOriginalNumber,
  ProductOutcomeMovement,
  ProductPlacementStorage,
  ProductRelatedUploadType,
  ProductReservation,
  ProductSearchMode,
  ProductSiblingCard,
  ProductSortMode,
  ProductUploadDocumentPayload,
  Pricing,
  Storage,
} from '../types'
import {
  displayValue,
  formatAmount,
  formatExchangeRate,
  formatPrice,
  getProductCode,
  getProductGroupNames,
  getProductMainImage,
  getProductMainOriginalNumber,
  getProductOriginalNumbers,
  getProductTitle,
  getRelatedProductRowColor,
  isCriticalProductTop,
  isProductRealtimePayloadForProduct,
  splitProductSearchResults,
} from '../utils'
import { formatProductMovementUnitPrice } from '../../../shared/ui/product-movement-history/productMovementFormatters'
import {
  getDuplicateProductUploadPricingIds,
  hasDuplicateProductUploadPricings,
  isDuplicateProductUploadPricingId,
} from '../productPricing'
import {
  buildProductFileUploadConfiguration,
  createProductFileUploadForm,
  type ProductFileUploadColumnForm,
  type ProductFileUploadForm,
  type ProductFileUploadPriceRow,
} from '../productFileUpload'
import { ShopImageGallery } from '../components/ShopImageGallery'
import { useProductDetailData } from '../useProductDetailData'
import { ProductPriceSourcePanel } from '../components/ProductPriceSourcePanel'
import { getProductAnalyticsId } from '../components/ProductAnalyticsPanel'
import {
  ProductSiblingCardsNotice,
  ProductSiblingCountMarker,
  ProductSiblingScopeControl,
} from '../components/ProductSiblingCards'
import { createProductSiblingCardColumn } from '../components/productSiblingCardColumn'
import {
  getProductSiblingCardsTotals,
  getProductSiblingRowKey,
  hasProductSiblingCards,
  type ProductSiblingScope,
} from '../productSiblings'
import {
  ProductActionDrawer,
  ProductImageViewerModal,
  ProductStockSummary,
  type ProductDetailPanel,
} from './ProductDetailPage'
import {
  PRODUCT_ANALYTICS_PERMISSION,
  PRODUCT_BALANCES_PERMISSION,
  PRODUCT_EDIT_PERMISSION,
  PRODUCT_MOVEMENT_EXPORT_PERMISSION,
  PRODUCT_MOVEMENT_PERMISSION,
  PRODUCT_STORAGE_HISTORY_PERMISSION,
  PRODUCT_WRITE_OFF_PERMISSION,
} from '../permissions'
import './products.css'
import './product-import-modals.css'
import '../../../shared/ui/selection-surface.css'

const InformationalMovementPanel = lazy(() =>
  import('../../../shared/ui/product-movement-history/ProductMovementHistoryDrawers').then((module) => ({
    default: module.InformationalMovementPanel,
  })),
)

const PAGE_SIZE = 20
const VIRTUAL_PAGE_SIZE = 10
// The server-driven menu links the «Весь асортимент» tab to /products?netId=assortment.
// "assortment" is a tab sentinel, NOT a product NetUid, so it must not be treated as a
// product deep-link (which would fail with «Товар не знайдено»).
const ROUTE_ASSORTMENT_SENTINEL = 'assortment'
const SEARCH_DEBOUNCE_MS = 250
const DETAIL_LOAD_DEBOUNCE_MS = 250
const DEFAULT_SEARCH_MODE: ProductSearchMode = '5'
const DEFAULT_SORT_MODE: ProductSortMode = '2'
const noProductSiblingCards: ProductSiblingCard[] = []

const SEARCH_MODE_OPTION_VALUES: ProductSearchMode[] = ['0', '1', '2', '3', '4', '5']
const SORT_MODE_OPTION_VALUES: ProductSortMode[] = ['0', '1', '2']
const SEARCH_MODE_LABELS: Record<ProductSearchMode, string> = {
  '0': 'Код виробника',
  '1': 'Оригінальний / кросс номер',
  '2': 'Розмір',
  '3': 'Назва',
  '4': 'Опис',
  '5': 'Всі',
}
const SORT_MODE_LABELS: Record<ProductSortMode, string> = {
  '0': 'Топові',
  '1': 'Код виробника',
  '2': 'Назва',
}
const PRODUCT_UPLOAD_DOCUMENT_PERMISSION = PermissionKeys.ProductsAssortment.Document.Upload
const inlineMovementLabels = {
  income: {
    empty: 'Приходів не знайдено',
    exportTitle: 'Документ приходу',
    loading: 'Завантаження приходів',
  },
  outcome: {
    empty: 'Розходів не знайдено',
    exportTitle: 'Документ розходу',
    loading: 'Завантаження розходів',
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

type CarouselMode = 'search' | 'selection'
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
type ProductSiblingCardsState = {
  cards: ProductSiblingCard[]
  productNetId: string
}
type ProductPlacementStorageCorrectionState = {
  rows: ProductPlacementStorage[]
  storageId: string | null
}
type ProductPlacementStorageCorrectionStateUpdater = (
  value:
    | ProductPlacementStorageCorrectionState
    | ((state: ProductPlacementStorageCorrectionState) => ProductPlacementStorageCorrectionState),
) => void

export function ProductsPage() {
  return (
    <PermissionGate permissionKey={PermissionKeys.ProductsAssortment.Page.View} fallback={<ProductsPermissionDeniedAlert />}>
      <ProductsPageContent />
    </PermissionGate>
  )
}

function ProductsPermissionDeniedAlert() {
  const { t } = useI18n()

  return (
    <Alert color="red" icon={<CircleAlert size={18} />} title={t('Доступ заборонено')} variant="light">
      {t('У вашої ролі немає права переглядати весь асортимент.')}
    </Alert>
  )
}

function ProductsPageContent() {
  const { t } = useI18n()
  const [urlSearchParams, setUrlSearchParams] = useSearchParams()
  const rawRouteProductNetId = urlSearchParams.get('netId')?.trim() || ''
  // Ignore the «Весь асортимент» tab sentinel so the page opens in its normal search-ready
  // state instead of trying to load a product named "assortment".
  const routeProductNetId = rawRouteProductNetId === ROUTE_ASSORTMENT_SENTINEL ? '' : rawRouteProductNetId
  const [topProducts, setTopProducts] = useValueState<Product[]>([])
  const [bottomProducts, setBottomProducts] = useValueState<Product[]>([])
  const [routeLoadedProduct, setRouteLoadedProduct] = useState<Product | undefined>(undefined)
  const [selectedProduct, setSelectedProduct] = useValueState<Product | null>(null)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(false)
  const [hasRequestedProducts, setHasRequestedProducts] = useValueState(false)
  const [isVirtualLoad, setVirtualLoad] = useValueState(false)
  const [loadedProductsCount, setLoadedProductsCount] = useValueState(0)
  const [carouselMode, setCarouselMode] = useValueState<CarouselMode>('search')
  const [searchDraft, setSearchDraft] = useValueState('')
  const [searchValue, setSearchValue] = useValueState('')
  const [searchMode, setSearchMode] = useValueState<ProductSearchMode>(DEFAULT_SEARCH_MODE)
  const [sortMode, setSortMode] = useValueState<ProductSortMode>(DEFAULT_SORT_MODE)
  const [activePanel, setActivePanel] = useValueState<ProductDetailPanel | null>(null)
  const [informationalDataOpened, setInformationalDataOpened] = useState(false)
  const [siblingCardsState, setSiblingCardsState] = useState<ProductSiblingCardsState>({ cards: noProductSiblingCards, productNetId: '' })
  const [siblingCounts, setSiblingCounts] = useState<Record<string, number>>({})
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const [detailReloadKey, bumpDetailReloadKey] = useReducer((key: number) => key + 1, 0)
  const searchRequestRef = useRef(0)
  const routeProductRequestRef = useRef(0)
  const hasRouteSeededProductsRef = useRef(false)
  const selectedProductNetUid = selectedProduct?.NetUid?.trim() || ''
  const detailState = useProductDetailData(selectedProductNetUid || undefined, DETAIL_LOAD_DEBOUNCE_MS,
    routeLoadedProduct?.NetUid === selectedProductNetUid ? routeLoadedProduct : undefined)
  const refreshDetail = detailState.reload
  const reloadProductDetail = useCallback(() => {
    bumpDetailReloadKey()
    return refreshDetail()
  }, [refreshDetail])
  const productForView = detailState.product || selectedProduct
  const siblingCards = siblingCardsState.productNetId && siblingCardsState.productNetId === selectedProductNetUid
    ? siblingCardsState.cards
    : noProductSiblingCards

  // Retire the one-time route snapshot before rendering a different selection.
  if (routeLoadedProduct && routeLoadedProduct.NetUid !== selectedProductNetUid) setRouteLoadedProduct(undefined)

  const clearRouteProductParam = useCallback(() => {
    routeProductRequestRef.current += 1

    if (!routeProductNetId) {
      return
    }

    setUrlSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams)

      nextParams.delete('netId')

      return nextParams
    }, { replace: true })
  }, [routeProductNetId, setUrlSearchParams])

  const openProductCard = useCallback((productNetId: string) => {
    const nextProductNetId = productNetId.trim()

    if (!nextProductNetId) {
      return
    }

    setUrlSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams)

      nextParams.set('netId', nextProductNetId)

      return nextParams
    })
  }, [setUrlSearchParams])

  const loadSiblingCounts = useCallback((products: Product[]) => {
    const productNetIds = products.map((product) => product.NetUid?.trim() || '').filter(Boolean)
    const productKeys = productNetIds.map(getSiblingCountKey)

    if (productNetIds.length === 0) {
      return
    }

    getProductSiblingCounts(productNetIds)
      .then((counts) => {
        const countsByKey = new Map(counts.map((count) => [getSiblingCountKey(count.ProductNetId), count.SiblingCount]))

        setSiblingCounts((currentCounts) => {
          const nextCounts = { ...currentCounts }

          productKeys.forEach((productKey) => {
            nextCounts[productKey] = countsByKey.get(productKey) ?? 0
          })

          return nextCounts
        })
      })
      .catch(() => {
        setSiblingCounts((currentCounts) => {
          const nextCounts = { ...currentCounts }

          productKeys.forEach((productKey) => {
            delete nextCounts[productKey]
          })

          return nextCounts
        })
      })
  }, [])

  const applySearchResults = useCallback(
    (nextProducts: Product[]) => {
      setActivePanel(null)
      hasRouteSeededProductsRef.current = false

      if (nextProducts.length === 0) {
        setTopProducts([])
        setBottomProducts([])
        setSelectedProduct(null)
        setCarouselMode('search')
        setLoadedProductsCount(0)
        return
      }

      setLoadedProductsCount(nextProducts.length)

      if (nextProducts.length === 1) {
        const nextProduct = nextProducts[0]

        setTopProducts([])
        setBottomProducts(getNextSearchedProducts(nextProduct))
        setSelectedProduct(nextProduct)
        setCarouselMode('selection')
        return
      }

      const nextRails = splitProductSearchResults(nextProducts)

      setTopProducts(nextRails.topProducts)
      setBottomProducts(nextRails.bottomProducts)
      setSelectedProduct(null)
      setCarouselMode('search')
    },
    [
      setActivePanel,
      setBottomProducts,
      setCarouselMode,
      setLoadedProductsCount,
      setSelectedProduct,
      setTopProducts,
    ],
  )

  const loadProducts = useCallback(
    async ({
      append,
      limit,
      offset,
      searchMode: nextSearchMode,
      sortMode: nextSortMode,
      value,
    }: {
      append: boolean
      limit: number
      offset: number
      searchMode: ProductSearchMode
      sortMode: ProductSortMode
      value: string
    }) => {
      const requestId = ++searchRequestRef.current

      setLoading(true)
      setError(null)

      try {
        if (requestId !== searchRequestRef.current) {
          return
        }

        const nextProducts = await getProducts({
          limit,
          offset,
          searchMode: nextSearchMode,
          sortMode: nextSortMode,
          value,
        })

        if (requestId === searchRequestRef.current) {
          if (append) {
            setBottomProducts((currentProducts) => [...currentProducts, ...nextProducts])
            setLoadedProductsCount((currentCount) => currentCount + nextProducts.length)
            setVirtualLoad(false)
          } else {
            applySearchResults(nextProducts)
          }

          loadSiblingCounts(nextProducts)
        }
      } catch (loadError) {
        if (requestId === searchRequestRef.current) {
          setTopProducts([])
          setBottomProducts([])
          setSelectedProduct(null)
          setCarouselMode('search')
          setLoadedProductsCount(0)
          hasRouteSeededProductsRef.current = false
          setVirtualLoad(false)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити товари'))
        }
      } finally {
        if (requestId === searchRequestRef.current) {
          setLoading(false)
        }
      }
    },
    [
      applySearchResults,
      loadSiblingCounts,
      setBottomProducts,
      setCarouselMode,
      setError,
      setLoadedProductsCount,
      setLoading,
      setSelectedProduct,
      setTopProducts,
      setVirtualLoad,
      t,
    ],
  )

  useEffect(() => {
    if (!hasRequestedProducts) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void loadProducts({
        append: false,
        limit: PAGE_SIZE,
        offset: 0,
        searchMode,
        sortMode,
        value: searchValue,
      })
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timeoutId)
      // Retire the previous query immediately, before the next debounce starts.
      // Its single-result response must not replace the focused search input.
      searchRequestRef.current += 1
    }
  }, [hasRequestedProducts, loadProducts, reloadKey, searchValue, searchMode, sortMode])

  const routeLoadError = useEffectEvent((error: unknown) => error instanceof Error ? error.message : t('Не вдалося завантажити товар'))

  useEffect(() => {
    if (!routeProductNetId) {
      return
    }

    const requestId = ++routeProductRequestRef.current
    const controller = new AbortController()

    searchRequestRef.current += 1
    setLoading(true)
    setVirtualLoad(false)
    setError(null)

    async function loadRouteProduct() {
      if (requestId !== routeProductRequestRef.current) {
        return
      }

      try {
        const nextProduct = await getProductByNetId(routeProductNetId, controller.signal)

        if (requestId === routeProductRequestRef.current && !controller.signal.aborted) {
          setVirtualLoad(false)

          if (!nextProduct) {
            setTopProducts([])
            setBottomProducts([])
            setSelectedProduct(null)
            setActivePanel(null)
            setCarouselMode('search')
            setLoadedProductsCount(0)
            hasRouteSeededProductsRef.current = false
            setHasRequestedProducts(false)
            setSearchDraft('')
            setSearchValue('')
            // Unknown/invalid netId (e.g. ?netId=assortment) is not an error — just show the
            // empty "pick a product" state instead of a red "Товар не знайдено" alert.
            setError(null)
          } else {
            const nextSearchedProducts = getNextSearchedProducts(nextProduct)

            setTopProducts([])
            setBottomProducts(nextSearchedProducts)
            setLoadedProductsCount(1 + nextSearchedProducts.length)
            hasRouteSeededProductsRef.current = nextSearchedProducts.length > 0
            setRouteLoadedProduct(nextProduct)
            setSelectedProduct(nextProduct)
            setActivePanel(null)
            setCarouselMode('selection')
            setHasRequestedProducts(false)
            setSearchDraft('')
            setSearchValue('')
            setError(null)
            loadSiblingCounts(nextSearchedProducts)
          }
        }
      } catch (loadError) {
        if (requestId === routeProductRequestRef.current && !controller.signal.aborted) {
          setTopProducts([])
          setBottomProducts([])
          setSelectedProduct(null)
          setActivePanel(null)
          setCarouselMode('search')
          setLoadedProductsCount(0)
          hasRouteSeededProductsRef.current = false
          setHasRequestedProducts(false)
          setSearchDraft('')
          setSearchValue('')
          setError(routeLoadError(loadError))
        }
      } finally {
        if (requestId === routeProductRequestRef.current && !controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadRouteProduct()
    return () => controller.abort()
  }, [
    loadSiblingCounts,
    routeProductNetId,
    setActivePanel,
    setBottomProducts,
    setCarouselMode,
    setError,
    setHasRequestedProducts,
    setLoadedProductsCount,
    setLoading,
    setSearchDraft,
    setSearchValue,
    setSelectedProduct,
    setTopProducts,
    setVirtualLoad,
  ])

  useEffect(() => {
    if (!selectedProductNetUid) {
      return
    }

    const productNetId = selectedProductNetUid
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => {
      getProductSiblings(productNetId, controller.signal)
        .then((group) => {
          if (!controller.signal.aborted) setSiblingCardsState({ cards: group.Cards, productNetId })
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setSiblingCardsState({ cards: noProductSiblingCards, productNetId })
          }
        })
    }, DETAIL_LOAD_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [detailReloadKey, selectedProductNetUid])

  function updateSearchDraft(nextValue: string) {
    clearRouteProductParam()
    hasRouteSeededProductsRef.current = false
    setSearchDraft(nextValue)
    setSearchValue(nextValue.trim())
    setHasRequestedProducts(true)
    setCarouselMode('search')
    setSelectedProduct(null)
    setActivePanel(null)
  }

  function commitSearch() {
    clearRouteProductParam()
    hasRouteSeededProductsRef.current = false
    setSearchValue(searchDraft.trim())
    setHasRequestedProducts(true)
    reload()
  }

  function resetSearch() {
    clearRouteProductParam()
    searchRequestRef.current += 1
    setTopProducts([])
    setBottomProducts([])
    setSelectedProduct(null)
    setError(null)
    setLoading(false)
    setVirtualLoad(false)
    hasRouteSeededProductsRef.current = false
    setLoadedProductsCount(0)
    setHasRequestedProducts(false)
    setCarouselMode('search')
    setSearchDraft('')
    setSearchValue('')
    setActivePanel(null)
  }

  function loadMoreProducts() {
    if ((!hasRequestedProducts && !hasRouteSeededProductsRef.current) || isLoading || isVirtualLoad) {
      return
    }

    setVirtualLoad(true)
    void loadProducts({
      append: true,
      limit: VIRTUAL_PAGE_SIZE,
      offset: loadedProductsCount,
      searchMode,
      sortMode,
      value: searchValue,
    })
  }

  function selectProduct(product: Product) {
    clearRouteProductParam()
    const productId = getProductIdentity(product)

    setTopProducts((currentProducts) => currentProducts.filter((item) => getProductIdentity(item) !== productId))
    setBottomProducts((currentProducts) => currentProducts.filter((item) => getProductIdentity(item) !== productId))
    setSelectedProduct(product)
    setActivePanel(null)
    setCarouselMode('selection')
    setSearchDraft('')
  }

  function selectRelatedProduct(product: Partial<Product>) {
    clearRouteProductParam()
    const netUid = product.NetUid?.trim()

    if (!netUid) {
      notifications.show({ color: 'yellow', message: t('Не вдалося відкрити повʼязаний товар') })
      return
    }

    const nextProduct = { ...product, NetUid: netUid } as Product

    hasRouteSeededProductsRef.current = false
    setTopProducts([])
    setBottomProducts(getNextSearchedProducts(nextProduct))
    setLoadedProductsCount(1)
    setSelectedProduct(nextProduct)
    setActivePanel(null)
    setCarouselMode('selection')
    setSearchDraft('')
  }

  function selectPreviousProduct() {
    clearRouteProductParam()
    const nextProduct = topProducts[topProducts.length - 1]

    if (!nextProduct) {
      return
    }

    if (selectedProduct) {
      setBottomProducts((currentProducts) => [selectedProduct, ...currentProducts])
    }

    setTopProducts((currentProducts) => currentProducts.slice(0, -1))
    setSelectedProduct(nextProduct)
    setActivePanel(null)
    setCarouselMode('selection')
    setSearchDraft('')
  }

  function selectNextProduct() {
    clearRouteProductParam()
    const nextProduct = bottomProducts[0]

    if (!nextProduct) {
      return
    }

    if (selectedProduct) {
      setTopProducts((currentProducts) => [...currentProducts, selectedProduct])
    }

    setBottomProducts((currentProducts) => currentProducts.slice(1))
    setSelectedProduct(nextProduct)
    setActivePanel(null)
    setCarouselMode('selection')
    setSearchDraft('')

    if (bottomProducts.length === 1) {
      loadMoreProducts()
    }
  }

  function returnToSearchMode() {
    // Esc returns to a clean, ready search row — reuse the proven reset path so the search and
    // the product-detail loading stay consistent (a partial reset left the next selection's
    // detail fetch stuck loading).
    resetSearch()
  }

  function handleCarouselKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // ↑/↓ and Esc are handled by the single global key listener below so they work regardless of
    // focus and never double-fire when the search input unmounts on the first product select.
    if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
      event.preventDefault()
      commitSearch()
    }
  }

  // Arrow ↑/↓ switch the selected product with priority over the page scroll — even when the
  // carousel itself isn't focused. The carousel column has its own handler, so skip it there
  // (no double-fire) and skip real text fields/selects so arrows still move the caret/options.
  const selectPreviousProductRef = useRef(selectPreviousProduct)
  const selectNextProductRef = useRef(selectNextProduct)
  const returnToSearchModeRef = useRef(returnToSearchMode)
  const carouselModeRef = useRef(carouselMode)

  useEffect(() => {
    selectPreviousProductRef.current = selectPreviousProduct
    selectNextProductRef.current = selectNextProduct
    returnToSearchModeRef.current = returnToSearchMode
    carouselModeRef.current = carouselMode
  })

  useEffect(() => {
    const handleGlobalProductKeys = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown' && event.key !== 'Escape') {
        return
      }

      // Decide from the key's ORIGIN (event.target), not document.activeElement, so text controls
      // outside the product search keep their native keyboard behavior.
      const origin = event.target instanceof HTMLElement ? event.target : null
      const isSearchInput = origin ? Boolean(origin.closest('.product-assortment-search-input')) : false

      // Let text fields and Select dropdowns keep arrows/Esc for caret/options — except the carousel
      // search input, which navigates the product drum.
      if (!isSearchInput && isTextLikeKeyboardTarget(origin)) {
        return
      }

      if (event.key === 'Escape') {
        // In search mode, Escape inside the drum search should keep focus. The field unmounts
        // after a product is selected, so this branch never blocks the selection-mode reset.
        if (isSearchInput) {
          event.preventDefault()
          return
        }

        // Esc returns to the search row — only from selection mode, and never while a modal/drawer
        // is open (there Esc must close the dialog instead).
        if (carouselModeRef.current !== 'selection') {
          return
        }

        if (document.querySelector('[role="dialog"]')) {
          return
        }

        event.preventDefault()
        returnToSearchModeRef.current()
        return
      }

      event.preventDefault()

      if (event.key === 'ArrowUp') {
        selectPreviousProductRef.current()
      } else {
        selectNextProductRef.current()
      }
    }

    document.addEventListener('keydown', handleGlobalProductKeys)

    return () => document.removeEventListener('keydown', handleGlobalProductKeys)
  }, [])

  function handleProductSaved(nextProduct: Product | null) {
    if (nextProduct) {
      if (detailState.setProduct(nextProduct)) setSelectedProduct(nextProduct)
      return
    }

    reloadProductDetail()
  }

  function handleAssortmentUploadSuccess() {
    hasRouteSeededProductsRef.current = false
    setHasRequestedProducts(true)
    reload()

    if (selectedProductNetUid) {
      reloadProductDetail()
    }
  }

  const handleRealtimeProductUpdate = useCallback((payload: unknown) => {
    if (isProductRealtimePayloadForProduct(payload, productForView || selectedProduct)) {
      reloadProductDetail()
    }
  }, [productForView, reloadProductDetail, selectedProduct])

  useRealtimeEvent(realtimeEvents.productReservationUpdated, handleRealtimeProductUpdate)

  return (
    <Stack gap={6} className="products-page">
      {error && (
        <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
          {error}
        </Alert>
      )}

      <Box className="product-assortment-shell console-table-shell" onKeyDown={handleCarouselKeyDown}>
        <ProductAssortmentFilterBar
          isLoading={isLoading || detailState.isLoading}
          searchMode={searchMode}
          sortMode={sortMode}
          onRefresh={selectedProductNetUid ? reloadProductDetail : commitSearch}
          onOpenInformationalData={() => setInformationalDataOpened(true)}
          onSearchModeChange={setSearchMode}
          onSortModeChange={setSortMode}
          productActions={productForView ? (
            <ProductInlineActions
              analyticsDisabled={getProductAnalyticsId(productForView) === null}
              disabled={detailState.isLoading}
              onOpenPanel={setActivePanel}
            />
          ) : null}
        />

        <Box className="product-assortment-workspace console-table-body">
          <ProductAssortmentCarousel
            bottomProducts={bottomProducts}
            isLoading={isLoading}
            isSelectionMode={carouselMode === 'selection'}
            isVirtualLoad={isVirtualLoad}
            searchDraft={searchDraft}
            selectedProduct={selectedProduct}
            siblingCounts={siblingCounts}
            topProducts={topProducts}
            onSearchDraftChange={updateSearchDraft}
            onSelectProduct={selectProduct}
            onUploadSuccess={handleAssortmentUploadSuccess}
          />

          <ProductInlineView
            detailError={detailState.error}
            isLoading={detailState.isLoading && !detailState.product}
            product={productForView}
            reservation={detailState.reservation}
            reservationError={detailState.reservationError}
            reservationLoading={detailState.reservationLoading}
            onRetryReservation={detailState.retryReservation}
            onOpenPanel={setActivePanel}
            onProductChanged={handleProductSaved}
            priceRefreshKey={detailReloadKey}
            onSelectRelatedProduct={selectRelatedProduct}
            siblingCards={siblingCards}
            onOpenProductCard={openProductCard}
          />
        </Box>
      </Box>

      {productForView && (
        <ProductActionDrawer
          activePanel={activePanel}
          product={productForView}
          siblingCards={siblingCards}
          onClose={() => setActivePanel(null)}
          onProductSaved={handleProductSaved}
          onReload={reloadProductDetail}
        />
      )}
      <AppDrawer
        opened={informationalDataOpened}
        position="right"
        size="min(1480px, 98vw)"
        title={t('Контроль складських даних')}
        onClose={() => setInformationalDataOpened(false)}
      >
        {informationalDataOpened ? (
          <Suspense fallback={<Loader size="sm" />}>
            <PermissionGate permissionKey={PRODUCT_MOVEMENT_PERMISSION}>
              <InformationalMovementPanel
                active
                allowAllProducts
                product={selectedProduct || undefined}
                requestPath="/consignments/info/assortment/movement/informational/filtered"
              />
            </PermissionGate>
          </Suspense>
        ) : null}
      </AppDrawer>
    </Stack>
  )
}

function ProductAssortmentFilterBar({
  isLoading,
  onOpenInformationalData,
  onRefresh,
  onSearchModeChange,
  onSortModeChange,
  productActions,
  searchMode,
  sortMode,
}: {
  isLoading: boolean
  onOpenInformationalData: () => void
  onRefresh: () => void
  onSearchModeChange: (mode: ProductSearchMode) => void
  onSortModeChange: (mode: ProductSortMode) => void
  productActions: ReactNode
  searchMode: ProductSearchMode
  sortMode: ProductSortMode
}) {
  const { t } = useI18n()

  return (
    <Box className="app-filter-bar product-assortment-filter-scroll">
      <Group align="end" gap={10} wrap="nowrap" className="app-filter-fields product-assortment-filter-row">
        <Select
          aria-label={t('Поле пошуку')}
          allowDeselect={false}
          className="product-assortment-filter-select"
          classNames={{ dropdown: 'product-assortment-filter-dropdown', option: 'product-assortment-filter-option' }}
          comboboxProps={{ width: 'max-content', position: 'bottom-start' }}
          data={SEARCH_MODE_OPTION_VALUES.map((value) => ({ label: t(SEARCH_MODE_LABELS[value]), value }))}
          label={t('Поле пошуку')}
          value={searchMode}
          onChange={(value) => onSearchModeChange((value as ProductSearchMode) || DEFAULT_SEARCH_MODE)}
        />
        <Select
          aria-label={t('Сортування')}
          allowDeselect={false}
          className="product-assortment-filter-select"
          classNames={{ dropdown: 'product-assortment-filter-dropdown', option: 'product-assortment-filter-option' }}
          comboboxProps={{ width: 'max-content', position: 'bottom-start' }}
          data={SORT_MODE_OPTION_VALUES.map((value) => ({ label: t(SORT_MODE_LABELS[value]), value }))}
          label={t('Сортування')}
          value={sortMode}
          onChange={(value) => onSortModeChange((value as ProductSortMode) || DEFAULT_SORT_MODE)}
        />
        <div className="app-filter-actions">
          <PermissionGate permissionKey={PRODUCT_MOVEMENT_PERMISSION}>
            <Button aria-label={t('Контроль складських даних')} variant="default" size="sm" leftSection={<TriangleAlert size={16} />} onClick={onOpenInformationalData}>
              {t('Контроль даних')}
            </Button>
          </PermissionGate>

          <Button aria-label={t('Оновити')} variant="default" size="sm" leftSection={<RefreshCw size={16} />} loading={isLoading} onClick={onRefresh}>
            {t('Оновити')}
          </Button>
        </div>
        <div className="product-assortment-primary-actions">{productActions}</div>
      </Group>
    </Box>
  )
}

function ProductAssortmentCarousel({
  bottomProducts,
  isLoading,
  isSelectionMode,
  isVirtualLoad,
  onSearchDraftChange,
  onSelectProduct,
  onUploadSuccess,
  searchDraft,
  selectedProduct,
  siblingCounts,
  topProducts,
}: {
  bottomProducts: Product[]
  isLoading: boolean
  isSelectionMode: boolean
  isVirtualLoad: boolean
  onSearchDraftChange: (value: string) => void
  onSelectProduct: (product: Product) => void
  onUploadSuccess: () => void
  searchDraft: string
  selectedProduct: Product | null
  siblingCounts: Record<string, number>
  topProducts: Product[]
}) {
  const { t } = useI18n()

  return (
    <Box className="product-assortment-column" role="region">
      <Box className="product-assortment-carousel-header">
        <ProductUploadDocumentToolbar product={selectedProduct} onUploadSuccess={onUploadSuccess} />
      </Box>

      <Box className={`product-assortment-carousel ${isSelectionMode ? 'is-selection-mode' : ''}`}>
      <Box className="product-assortment-rail product-assortment-rail-top">
        {isLoading && !isVirtualLoad ? (
          <Stack gap={12} justify="flex-end" h="100%" p="xs">
            {Array.from({ length: 6 }, (_, index) => (
              <Box key={index}>
                <Skeleton height={11} mb={6} radius="sm" width="45%" />
                <Skeleton height={10} radius="sm" width="75%" />
              </Box>
            ))}
          </Stack>
        ) : (
          topProducts.slice(-10).map((product) => (
            <ProductCarouselRow
              key={getProductRowKey(product)}
              product={product}
              siblingCount={siblingCounts[getSiblingCountKey(product.NetUid)]}
              onSelect={onSelectProduct}
            />
          ))
        )}
      </Box>

      <Box className="product-assortment-drum">
        {isSelectionMode && selectedProduct ? (
          <button
            type="button"
            aria-label={selectedProduct.VendorCode?.trim()
              ? `${t('Скопіювати код')}: ${getProductCode(selectedProduct)}`
              : `${getProductCode(selectedProduct)}: ${getProductTitle(selectedProduct)}`}
            className="product-assortment-selected app-selection-surface"
            data-selected="true"
            disabled={!selectedProduct.VendorCode?.trim()}
            title={selectedProduct.VendorCode?.trim() ? t('Скопіювати код') : undefined}
            onClick={() => {
              const vendorCode = selectedProduct.VendorCode?.trim()
              if (vendorCode) copyToClipboard(vendorCode)
            }}
          >
            <span className="app-selection-surface__marker" aria-hidden="true" />
            <BoxIcon className="product-carousel-product-icon" size={18} strokeWidth={1.7} aria-hidden="true" />
            <span className="product-carousel-row-body">
              <span className="product-assortment-selected-code" data-code-missing={!selectedProduct.VendorCode?.trim() || undefined}>
                <TableChip tone="product" value={getProductCode(selectedProduct)} />
                {isCriticalProductTop(selectedProduct.Top) && <TableChip tone="danger" value={selectedProduct.Top} />}
              </span>
              <span className="product-carousel-name-line">
                <span className="product-assortment-selected-name">{getProductTitle(selectedProduct)}</span>
              </span>
            </span>
          </button>
        ) : (
          <TextInput
            autoFocus
            aria-label={t('Введіть товар')}
            className="product-assortment-search-input"
            placeholder={t('Пошук товару')}
            size="md"
            value={searchDraft}
            onChange={(event) => onSearchDraftChange(event.currentTarget.value)}
          />
        )}
      </Box>

      <Box className="product-assortment-rail product-assortment-rail-bottom">
        {bottomProducts.slice(0, 10).map((product) => (
          <ProductCarouselRow
            key={getProductRowKey(product)}
            product={product}
            siblingCount={siblingCounts[getSiblingCountKey(product.NetUid)]}
            onSelect={onSelectProduct}
          />
        ))}
        {isVirtualLoad ? (
          <Box p="xs">
            <Skeleton height={11} mb={6} radius="sm" width="45%" />
            <Skeleton height={10} radius="sm" width="75%" />
          </Box>
        ) : null}
      </Box>
      </Box>
    </Box>
  )
}

function ProductCarouselRow({
  onSelect,
  product,
  siblingCount,
}: {
  onSelect: (product: Product) => void
  product: Product
  siblingCount?: number
}) {
  return (
    <button
      type="button"
      className="product-carousel-row app-selection-surface"
      onClick={() => onSelect(product)}
    >
      <BoxIcon className="product-carousel-product-icon" size={18} strokeWidth={1.7} aria-hidden="true" />
      <span className="product-carousel-row-body">
        <span className="product-carousel-row-code" data-code-missing={!product.VendorCode?.trim() || undefined}>
          <TableChip tone="product" value={getProductCode(product)} />
          {isCriticalProductTop(product.Top) && <TableChip tone="danger" value={product.Top} />}
        </span>
        <span className="product-carousel-name-line">
          <span className="product-carousel-row-name">{getProductTitle(product)}</span>
          <ProductSiblingCountMarker siblingCount={siblingCount} />
        </span>
      </span>
    </button>
  )
}

function ProductInlineView({
  detailError,
  isLoading,
  onOpenPanel,
  onOpenProductCard,
  onProductChanged,
  priceRefreshKey,
  onSelectRelatedProduct,
  product,
  reservation,
  reservationError,
  reservationLoading,
  onRetryReservation,
  siblingCards,
}: {
  detailError: string | null
  isLoading: boolean
  onOpenPanel: (panel: ProductDetailPanel) => void
  onOpenProductCard: (productNetId: string) => void
  onProductChanged: (product: Product | null) => void
  priceRefreshKey: number
  onSelectRelatedProduct: (product: Partial<Product>) => void
  product: Product | null
  reservation: ProductReservation
  reservationError: string | null
  reservationLoading: boolean
  onRetryReservation: () => Promise<void>
  siblingCards: ProductSiblingCard[]
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

  if (isLoading) {
    return <ProductInlineViewSkeleton />
  }

  const mainImage = getProductMainImage(product)
  const productImages = product.ProductImages?.filter((image) => image.ImageUrl && !image.Deleted) || []
  const prices = product.CalculatedPrices || []

  return (
    <Box className="product-inline-view">
      <Box className="product-inline-content">
      <Group align="flex-start" justify="space-between" gap="sm" wrap="nowrap" className="product-inline-title">
        <Box className="product-inline-title-text">
          <Text component="span" fw={800} className="product-inline-code" data-code-missing={!product.VendorCode?.trim() || undefined}>
            {getProductCode(product)}
          </Text>
          <Tooltip label={getProductTitle(product)} multiline maw={420} withinPortal>
            <Text component="span" fw={650} truncate className="product-inline-name">{getProductTitle(product)}</Text>
          </Tooltip>
          <Tooltip label={t('Скопіювати артикул і назву')} withinPortal>
            <ActionIcon
              aria-label={t('Скопіювати артикул і назву')}
              color="gray"
              size={32}
              variant="subtle"
              style={{ flexShrink: 0, alignSelf: 'center' }}
              onClick={() => copyToClipboard([product.VendorCode?.trim(), getProductTitle(product)].filter(Boolean).join(' '))}
            >
              <Copy size={16} aria-hidden="true" />
            </ActionIcon>
          </Tooltip>
        </Box>

      </Group>

      <ProductSiblingCardsNotice cards={siblingCards} currentProductNetId={product.NetUid} onSelectCard={onOpenProductCard} />

      {detailError && (
        <Alert color="yellow" icon={<CircleAlert size={18} />} variant="light">
          {detailError}
        </Alert>
      )}

      <Box className="product-inline-main">
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
              <Package size={42} strokeWidth={1.5} />
            )}
          </Box>
          {productImages.length > 1 ? (
            <Group gap={6} className="product-inline-thumbs">
              {productImages.slice(0, 8).map((image, index) => (
                <button
                  type="button"
                  className="product-inline-thumb"
                  key={`${image.NetUid || image.ImageUrl || index}`}
                  onClick={() => setPreviewImageUrl(toProxiedAssetUrl(image.ImageUrl) || null)}
                >
                  <Image src={toProxiedAssetUrl(image.ImageUrl)} alt={image.FileName || getProductTitle(product)} fit="cover" h="100%" w="100%" />
                </button>
              ))}
            </Group>
          ) : null}
          <ShopImageGallery vendorCode={product.VendorCode} onImageClick={setPreviewImageUrl} />
        </Box>

        <Box className="product-inline-description">
          <InfoBlock label="Опис" value={product.DescriptionUA || product.Description} wide />
          <InfoBlock label="Нотатки" value={product.NotesUA || product.Notes} wide />
          <InfoBlock chip={isCriticalProductTop(product.Top) ? 'danger' : undefined} label="Top" value={product.Top} />
          <InfoBlock mono label="Вага" value={formatAmount(product.Weight)} />
          <InfoBlock chip="warning" chipEmpty label="Розмір" value={product.Size} />
          <InfoBlock mono label="Об'єм" value={product.Volume} />
          <InfoBlock mono label="Норма пакування" value={product.OrderStandard} />
          <InfoBlock mono label="Пакування" value={product.PackingStandard} />
          <InfoBlock chip="warning" mono label="Оригінальний номер" value={getProductMainOriginalNumber(product)} />
          <InfoBlock label="Синоніми UA" value={product.SynonymsUA} />
          <InfoBlock chip="product" label="Група товару" value={getProductGroupNames(product)} />
          <InfoBlock chip="neutral" label="Одиниця" value={product.MeasureUnit?.Name} />
        </Box>

        <Box className="product-inline-prices">
          <ProductPriceSourcePanel key={product.NetUid} effectivePrices={prices} productNetId={product.NetUid} refreshKey={priceRefreshKey} />
          <Group gap="xs" mt={8}>
            <Badge className={`app-role-pill ${product.IsForZeroSale ? 'is-green' : 'is-gray'}`} variant="light">{t('Нульовий продаж')}</Badge>
            <Badge className={`app-role-pill ${product.IsForSale ? 'is-green' : 'is-gray'}`} variant="light">{t('Продаж')}</Badge>
            <Badge className={`app-role-pill ${product.IsForWeb ? 'is-green' : 'is-gray'}`} variant="light">{t('Сайт')}</Badge>
          </Group>
        </Box>
      </Box>

      <Box className="product-inline-stock-bar">
        <ProductStockSummary
          combinedStockQty={hasProductSiblingCards(siblingCards) ? getProductSiblingCardsTotals(siblingCards).stockQty : undefined}
          product={product}
          reservation={reservation}
          reservationError={reservationError}
          reservationLoading={reservationLoading}
          onRetryReservation={onRetryReservation}
          onProductSaved={onProductChanged}
        />
      </Box>

      <ProductInlineTabs product={product} siblingCards={siblingCards} onProductChanged={onProductChanged} onSelectRelatedProduct={onSelectRelatedProduct} />
      <ProductImageViewerModal
        imageUrl={previewImageUrl}
        title={getProductTitle(product)}
        onClose={() => setPreviewImageUrl(null)}
      />
      </Box>
    </Box>
  )
}

/* Shimmer placeholder mirroring the inline-view layout (title / image / info grid /
   prices / stock bar / tabs) — shown while the product detail loads instead of
   "Завантаження…" texts, so the panel keeps its shape and nothing jumps. */
function ProductInlineViewSkeleton() {
  return (
    <Box aria-busy className="product-inline-view">
      <Group align="flex-start" justify="space-between" gap="sm" wrap="nowrap" className="product-inline-title">
        <Group gap={10} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <Skeleton height={24} radius="sm" width={130} />
          <Skeleton height={20} radius="sm" width="min(340px, 40%)" />
        </Group>
        <Group gap="xs" wrap="nowrap">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton height={38} key={index} radius="sm" width={38} />
          ))}
        </Group>
      </Group>

      <Box className="product-inline-main">
        <Box className="product-inline-info">
          <Skeleton height={190} radius="md" />
        </Box>
        <Box className="product-inline-description">
          {Array.from({ length: 12 }, (_, index) => (
            <Box className="product-inline-info-block" key={index}>
              <Skeleton height={10} mb={8} radius="sm" width="55%" />
              <Skeleton height={14} radius="sm" width="80%" />
            </Box>
          ))}
        </Box>
        <Box className="product-inline-prices">
          <Stack gap={10}>
            {Array.from({ length: 9 }, (_, index) => (
              <Group gap="sm" key={index} wrap="nowrap">
                <Skeleton height={14} radius="sm" style={{ flex: 1 }} />
                <Skeleton height={14} radius="sm" width={80} />
                <Skeleton height={14} radius="sm" width={80} />
              </Group>
            ))}
          </Stack>
        </Box>
      </Box>

      <Box className="product-inline-stock-bar">
        <Group gap="xl" wrap="nowrap">
          {Array.from({ length: 5 }, (_, index) => (
            <Box key={index}>
              <Skeleton height={22} mb={8} radius="sm" width={64} />
              <Skeleton height={10} radius="sm" width={96} />
            </Box>
          ))}
        </Group>
      </Box>

      <Group gap="xs" mt="md">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton height={30} key={index} radius="xl" width={index === 0 ? 150 : 110} />
        ))}
      </Group>
      <Skeleton height={200} mt="sm" radius="md" />
    </Box>
  )
}

function ProductInlineActions({
  analyticsDisabled,
  disabled,
  onOpenPanel,
}: {
  analyticsDisabled: boolean
  disabled: boolean
  onOpenPanel: (panel: ProductDetailPanel) => void
}) {
  const { t } = useI18n()

  return (
    <Group gap="xs" justify="flex-end" wrap="nowrap" className="product-inline-actions">
      <PermissionGate permissionKey={PRODUCT_ANALYTICS_PERMISSION}>
        <Button
          aria-label={t('AI-аналітика товару')}
          disabled={disabled || analyticsDisabled}
          leftSection={<Sparkles fill="currentColor" size={16} strokeWidth={0} />}
          px="sm"
          size="xs"
          variant="filled"
          onClick={() => onOpenPanel('analytics')}
        >
          {t('AI-аналітика')}
        </Button>
      </PermissionGate>
      <PermissionGate permissionKey={PRODUCT_EDIT_PERMISSION}>
        <Button aria-label={t('Редагувати')} variant="default" size="sm" leftSection={<SquarePen size={16} />} disabled={disabled} onClick={() => onOpenPanel('edit')}>
          {t('Редагувати')}
        </Button>
      </PermissionGate>
      <Menu position="bottom-end" withinPortal>
        <Menu.Target>
          <Button variant="default" size="sm" rightSection={<ChevronDown size={16} />} disabled={disabled}>{t('Ще')}</Button>
        </Menu.Target>
        <Menu.Dropdown>
          <PermissionGate permissionKey={PRODUCT_STORAGE_HISTORY_PERMISSION}>
            <Menu.Item leftSection={<History size={16} />} onClick={() => onOpenPanel('storage-history')}>{t('Історія місця зберігання')}</Menu.Item>
          </PermissionGate>
          <Menu.Item leftSection={<FileText size={16} />} onClick={() => onOpenPanel('specification')}>{t('Специфікація')}</Menu.Item>
          <Menu.Item leftSection={<ImageIcon size={16} />} onClick={() => onOpenPanel('images')}>{t('Зображення')}</Menu.Item>
          <PermissionGate permissionKey={PRODUCT_BALANCES_PERMISSION}>
            <Menu.Item leftSection={<Package size={16} />} onClick={() => onOpenPanel('remains')}>{t('Залишки по партіям')}</Menu.Item>
          </PermissionGate>
          <PermissionGate permissionKey={PRODUCT_MOVEMENT_PERMISSION}>
            <Menu.Item leftSection={<ArrowLeftRight size={16} />} onClick={() => onOpenPanel('movement')}>{t('Рух товару')}</Menu.Item>
          </PermissionGate>
          <PermissionGate permissionKey={PRODUCT_WRITE_OFF_PERMISSION}>
            <Menu.Item leftSection={<ClipboardList size={16} />} onClick={() => onOpenPanel('writeoff')}>{t('Правила списання')}</Menu.Item>
          </PermissionGate>
        </Menu.Dropdown>
      </Menu>
    </Group>
  )
}

function InfoBlock({
  chip,
  chipEmpty,
  danger,
  label,
  mono,
  value,
  wide,
}: {
  chip?: TableChipTone
  chipEmpty?: boolean
  danger?: boolean
  label: string
  mono?: boolean
  value?: ReactNode
  wide?: boolean
}) {
  const { t } = useI18n()

  const isPrimitive = typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'

  return (
    <Box className={`product-inline-info-block ${wide ? 'is-wide' : ''}`}>
      <Text c="gray.8" size="xs">{t(label)}</Text>
      {chip && (chipEmpty || ((typeof value === 'string' || typeof value === 'number') && String(value).trim())) ? (
        <TableChip tone={chip} showEmpty={chipEmpty} value={typeof value === 'string' || typeof value === 'number' ? value : null} />
      ) : isPrimitive ? (
        <Text className={mono ? 'app-money' : undefined} c={danger ? 'red.7' : undefined} size="sm" fw={600}>{displayValue(value as boolean | number | string)}</Text>
      ) : (
        <Text c={danger ? 'red.7' : undefined} size="sm" fw={600} component="div">{value ?? '-'}</Text>
      )}
    </Box>
  )
}

function ProductInlineTabs({
  onProductChanged,
  onSelectRelatedProduct,
  product,
  siblingCards,
}: {
  onProductChanged: (product: Product | null) => void
  onSelectRelatedProduct: (product: Partial<Product>) => void
  product: Product
  siblingCards: ProductSiblingCard[]
}) {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const [activeTab, setActiveTab] = useState<ProductInlineTab>('numbers')
  const canViewMovement = hasPermission(PRODUCT_MOVEMENT_PERMISSION)

  return (
    <div className="product-inline-tabs">
      <div className="product-inline-tabs__tabs pill-tabs app-screen-tabs">
        {([
          { value: 'numbers', icon: Hash, label: t('Оригінальні номери') },
          { value: 'analogues', icon: ArrowLeftRight, label: t('Аналоги') },
          { value: 'components', icon: Layers, label: t('Комплектуючі') },
          ...(canViewMovement
            ? [
                { value: 'income', icon: ArrowDownLeft, label: t('Прихід') },
                { value: 'outcome', icon: ArrowUpRight, label: t('Розхід') },
              ] as const
            : []),
        ] as const).map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={`pill-tab app-screen-tab${activeTab === tab.value ? ' is-active' : ''}`}
            aria-pressed={activeTab === tab.value}
            onClick={() => setActiveTab(tab.value)}
          >
            <tab.icon size={16} strokeWidth={1.8} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="product-inline-tab-pane">
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
        {canViewMovement && activeTab === 'income' && (
          <Box pt={0}>
            <ProductInlineMovementsTab direction="income" product={product} siblingCards={siblingCards} />
          </Box>
        )}
        {canViewMovement && activeTab === 'outcome' && (
          <Box pt={0}>
            <ProductInlineMovementsTab direction="outcome" product={product} siblingCards={siblingCards} />
          </Box>
        )}
      </div>
    </div>
  )
}

type ProductInlineTab = 'numbers' | 'analogues' | 'components' | 'income' | 'outcome'

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
  const [isSaving, setSaving, tryStartSaving] = useBusyState()
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

    if (!tryStartSaving()) {
      return
    }
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

    if (!tryStartSaving()) {
      return
    }
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

    if (!tryStartSaving()) {
      return
    }
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

  const numberColumns: DataTableColumn<ProductOriginalNumber>[] = [
    {
      id: 'number',
      header: t('Оригінальний номер'),
      minWidth: 200,
      accessor: (item) => getOriginalNumberText(item),
      cell: (item) => <TableChip tone="warning" value={displayValue(getOriginalNumberText(item))} />,
    },
    {
      id: 'main',
      header: t('Основний'),
      width: 120,
      minWidth: 96,
      align: 'center',
      enableSorting: false,
      cell: (item) =>
        item.IsMainOriginalNumber ? (
          <Badge className="app-role-pill is-green" size="xs" variant="light">
            {t('Основний')}
          </Badge>
        ) : null,
    },
    {
      id: 'actions',
      header: '',
      width: 96,
      minWidth: 80,
      align: 'right',
      enableSorting: false,
      enableHiding: false,
      enableResizing: false,
      cell: (item) => (
        <PermissionGate permissionKey={PRODUCT_EDIT_PERMISSION}>
          <Group gap={4} justify="flex-end" wrap="nowrap">
            <TableRowAction
              action="set-primary"
              disabled={Boolean(item.IsMainOriginalNumber) || isSaving}
              label={t('Зробити основним')}
              onClick={() => {
                void makeMainOriginalNumber(item)
              }}
            />
            <TableRowAction
              action="delete"
              disabled={Boolean(item.IsMainOriginalNumber) || isSaving}
              label={t('Видалити')}
              onClick={() => {
                void removeOriginalNumber(item)
              }}
            />
          </Group>
        </PermissionGate>
      ),
    },
  ]

  return (
    <Stack className="product-inline-table-frame" gap={0} tabIndex={0} onKeyDown={handleOriginalNumbersKeyDown}>
      {error && (
        <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
          {error}
        </Alert>
      )}

      <div className="app-filter-bar product-original-number-toolbar">
        <PermissionGate permissionKey={PRODUCT_EDIT_PERMISSION}>
          <Group className="product-original-number-form" align="end" gap="sm" wrap="nowrap">
            <TextInput
              ref={codeInputRef}
              className="product-original-number-input"
              label={t('Оригінальний номер')}
              value={codeDraft}
              error={isDuplicate ? t('Такий оригінальний номер вже існує') : undefined}
              onChange={(event) => setCodeDraft(event.currentTarget.value)}
            />
            <Checkbox
              checked={isMainDraft}
              className="product-original-number-main"
              label={t('Основний')}
              pb={8}
              onChange={(event) => setMainDraft(event.currentTarget.checked)}
            />
            <Button
              color={CREATE_ACTION_COLOR}
              disabled={!canSave}
              leftSection={selectedItem ? <Save size={16} /> : <Plus size={16} />}
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

        <div className="product-original-number-upload">
          <ProductUploadDocumentButton
            product={product}
            type="originalNumbers"
            onProductChanged={onProductChanged}
          />
        </div>
      </div>

      {selectedCode ? (
        <Text c="dimmed" size="xs">
          {t('Вибрано')}: {selectedCode}
        </Text>
      ) : null}

      <DataTable
        columns={numberColumns}
        data={originalNumbers}
        emptyText={t('Номерів не знайдено')}
        getRowId={(item, index) => getProductOriginalNumberIdentity(item) || String(index)}
        maxHeight="320px"
        minWidth={360}
        rowClassName={(item) =>
          getProductOriginalNumberIdentity(item) === selectedNetUid ? 'is-selected' : undefined
        }
        showDensityToggle={false}
        showLayoutControls
        showToolbar={false}
        tableId="product-original-numbers"
        onRowClick={selectOriginalNumber}
      />
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
  const runActionOnce = useSingleFlight()
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const productNetUid = product.NetUid?.trim() || ''
  const [removeIndirectAnalogues, setRemoveIndirectAnalogues] = useState(false)
  const [removingNetUid, setRemovingNetUid] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const rows = type === 'analogues' ? getAnalogueRows(product) : getComponentRows(product)
  const canEditRelatedProducts = hasPermission(PRODUCT_EDIT_PERMISSION)

  async function removeRelatedProduct(row: RelatedProductRow) {
    return runActionOnce('removeRelatedProduct', async () => {
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
    })
  }

  const relatedColumns: DataTableColumn<RelatedProductRow>[] = [
    {
      id: 'code',
      header: t('Код'),
      minWidth: 150,
      accessor: (row) => getProductCode(row.product),
      cell: (row) => (
        <Group gap={6} wrap="nowrap" align="center">
          {type === 'components' ? (
            row.isProductSet ? (
              <BoxIcon size={15} className="product_page_iconBox" />
            ) : (
              <Settings size={15} />
            )
          ) : null}
          <Text fw={650} size="sm" lineClamp={1} c={row.product.VendorCode?.trim() ? getRelatedProductRowColor(row.product) : 'dimmed'}>
            {getProductCode(row.product)}
          </Text>
        </Group>
      ),
    },
    {
      id: 'name',
      header: t('Назва'),
      minWidth: 220,
      accessor: (row) => row.product.NameUA || row.product.Name,
      cell: (row) => (
        <Text size="sm" lineClamp={2} c={getRelatedProductRowColor(row.product) ?? 'dimmed'}>
          {displayValue(row.product.NameUA || row.product.Name)}
        </Text>
      ),
    },
    {
      id: 'originalNumber',
      header: t('Оригінальний номер'),
      minWidth: 150,
      accessor: (row) => row.product.MainOriginalNumber,
      cell: (row) => (
        <Text size="sm" fw={600} c={getRelatedProductRowColor(row.product)}>
          {displayValue(row.product.MainOriginalNumber)}
        </Text>
      ),
    },
    {
      id: 'packing',
      header: t('Пакування'),
      width: 110,
      minWidth: 90,
      align: 'right',
      accessor: (row) => row.product.PackingStandard,
      cell: (row) => displayValue(row.product.PackingStandard),
    },
    {
      id: 'stockUk',
      header: t('Склад Укр.'),
      width: 110,
      minWidth: 90,
      align: 'right',
      accessor: (row) => getRelatedProductAvailableQty(row.product, type),
      cell: (row) => <span className="app-money">{formatAmount(getRelatedProductAvailableQty(row.product, type))}</span>,
    },
    ...(type === 'components'
      ? ([
          {
            id: 'quantity',
            header: t('Кількість'),
            width: 100,
            minWidth: 80,
            align: 'right',
            cell: (row) => displayValue(row.quantity),
          },
          {
            id: 'unit',
            header: t('Одиниця'),
            width: 110,
            minWidth: 90,
            cell: (row) => displayValue(row.product.MeasureUnit?.Name),
          },
        ] as DataTableColumn<RelatedProductRow>[])
      : []),
    {
      id: 'actions',
      header: '',
      width: 64,
      minWidth: 56,
      align: 'center',
      enableSorting: false,
      enableHiding: false,
      enableResizing: false,
      cell: (row) => (
        <PermissionGate permissionKey={PRODUCT_EDIT_PERMISSION}>
          <TableRowAction
            action="delete"
            label={t('Видалити')}
            loading={removingNetUid === row.product.NetUid}
            onClick={() => {
              void removeRelatedProduct(row)
            }}
          />
        </PermissionGate>
      ),
    },
  ]

  return (
    <Stack className="product-inline-table-frame product-related-table-frame" gap={0}>
      {error && (
        <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
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

      <DataTable
        columns={relatedColumns}
        data={rows}
        emptyText={emptyLabel}
        getRowId={(row, index) => getRelatedProductKey(row.source) || String(index)}
        maxHeight="calc(100vh - 360px)"
        minWidth={type === 'components' ? 880 : 720}
        showDensityToggle={false}
        showLayoutControls
        showToolbar={false}
        tableId={`product-related-${type}`}
        onRowClick={(row) => {
          if (row.product.NetUid) {
            onSelectProduct(row.product)
          }
        }}
      />
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
  const [storageCorrectionState, setStorageCorrectionState] = useState<ProductPlacementStorageCorrectionState>({
    rows: [],
    storageId: null,
  })
  const storageCorrectionRowsCount = storageCorrectionState.rows.length

  return (
    <>
      <PermissionGate permissionKey={PRODUCT_UPLOAD_DOCUMENT_PERMISSION}>
        <Menu position="bottom-start" shadow="md" width={240} withinPortal>
          <Menu.Target>
            <Button className="product-import-button" variant="default" size="xs" leftSection={<ExcelIcon size={18} />} rightSection={<ChevronDown size={13} />}>
              {t('Імпорт Excel')}
            </Button>
          </Menu.Target>
          <Menu.Dropdown className="product-import-menu">
            <Menu.Item leftSection={<Package size={16} strokeWidth={1.8} />} onClick={() => setProductUploadOpened(true)}>
              {t('Товари')}
            </Menu.Item>
            <Menu.Item leftSection={<ArrowLeftRight size={16} strokeWidth={1.8} />} onClick={() => setUploadType('analogues')}>
              {t('Аналоги')}
            </Menu.Item>
            <Menu.Item leftSection={<Layers size={16} strokeWidth={1.8} />} onClick={() => setUploadType('components')}>
              {t('Комплектуючі')}
            </Menu.Item>
            <Menu.Item leftSection={<Hash size={16} strokeWidth={1.8} />} onClick={() => setUploadType('originalNumbers')}>
              {t('Оригінальні номери')}
            </Menu.Item>
            <Menu.Item leftSection={<BoxIcon size={16} strokeWidth={1.8} />} onClick={() => setStorageUploadOpened(true)}>
              <Group gap="xs" justify="space-between" wrap="nowrap">
                <span>{t('Місце зберігання')}</span>
                {storageCorrectionRowsCount > 0 ? (
                  <Badge className="app-role-pill is-yellow" size="xs" variant="light">
                    {storageCorrectionRowsCount}
                  </Badge>
                ) : null}
              </Group>
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
          correctionState={storageCorrectionState}
          opened
          onCorrectionStateChange={setStorageCorrectionState}
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
  correctionState,
  onCorrectionStateChange,
  onClose,
  onUploadSuccess,
  opened,
}: {
  correctionState: ProductPlacementStorageCorrectionState
  onCorrectionStateChange: ProductPlacementStorageCorrectionStateUpdater
  onClose: () => void
  onUploadSuccess: () => void
  opened: boolean
}) {
  const { t } = useI18n()
  const [storages, setStorages] = useState<Storage[]>([])
  const [storagesError, setStoragesError] = useState<string | null>(null)
  const [isLoadingStorages, setLoadingStorages] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [startRow, setStartRow] = useState(1)
  const [endRow, setEndRow] = useState(0)
  const [columnVendorCode, setColumnVendorCode] = useState(1)
  const [columnQty, setColumnQty] = useState(2)
  const [columnPlacement, setColumnPlacement] = useState(3)
  const [error, setError] = useState<string | null>(null)
  const [isUploading, setUploading, tryStartUploading] = useBusyState()
  const [isSavingReturn, setSavingReturn, tryStartSavingReturn] = useBusyState()
  const { rows: notPassedRows, storageId } = correctionState
  const canUpload = Boolean(file && storageId && startRow > 0 && endRow > 0 && !isUploading && !isSavingReturn)

  useEffect(() => {
    let cancelled = false

    async function loadStorages() {
      setLoadingStorages(true)
      setStoragesError(null)

      try {
        const nextStorages = await getNonDefectiveStorages()

        if (!cancelled) {
          setStorages(nextStorages)
          if (nextStorages[0]?.Id) {
            onCorrectionStateChange((currentState) => (
              currentState.storageId ? currentState : { ...currentState, storageId: String(nextStorages[0].Id) }
            ))
          }
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
  }, [onCorrectionStateChange, t])

  const storageOptions = storages.reduce<Array<{ label: string; value: string }>>((options, storage) => {
    const value = storage.Id ? String(storage.Id) : ''

    if (value) {
      options.push({ label: displayValue(storage.Name), value })
    }

    return options
  }, [])

  function closeModal() {
    if (isUploading || isSavingReturn) {
      return
    }

    onClose()
  }

  function updateCorrectionState(patch: Partial<ProductPlacementStorageCorrectionState>) {
    onCorrectionStateChange((currentState) => ({
      ...currentState,
      ...patch,
    }))
  }

  async function uploadFile() {
    if (!file || !storageId) {
      return
    }

    if (!tryStartUploading()) {
      return
    }
    setError(null)

    try {
      const returnedRows = await uploadProductPlacementStorageFile(Number(storageId), {
        ColumnPlacement: columnPlacement,
        ColumnQty: columnQty,
        ColumnVendorCode: columnVendorCode,
        EndRow: endRow,
        StartRow: startRow,
      }, file)

      updateCorrectionState({ rows: returnedRows })
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
    onCorrectionStateChange((currentState) => ({
      ...currentState,
      rows: currentState.rows.map((row, rowIndex) => (
        rowIndex === index
          ? { ...row, [field]: field === 'Qty' ? Number(value) || 0 : value }
          : row
      )),
    }))
  }

  async function saveNotPassedRows() {
    if (notPassedRows.length === 0 || !storageId) {
      return
    }

    if (!tryStartSavingReturn()) {
      return
    }
    setError(null)

    try {
      const stillFailing = await uploadProductPlacementStorageReturn(Number(storageId), notPassedRows)

      onUploadSuccess()

      if (stillFailing.length === 0) {
        updateCorrectionState({ rows: [] })
        notifications.show({ color: 'green', message: t('Виправлені розміщення збережено') })
        onClose()
      } else {
        updateCorrectionState({ rows: stillFailing })
        notifications.show({ color: 'yellow', message: t('Деякі позиції потребують виправлення') })
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти виправлені розміщення'))
    } finally {
      setSavingReturn(false)
    }
  }

  return (
    <AppModal centered opened={opened} size={notPassedRows.length ? "min(1120px, 96vw)" : 760} title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Завантаження місць зберігання')}</span>} onClose={closeModal}>
      <Stack className="app-compact-form product-import-form" gap={10}>
        {(error || storagesError) ? (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">{error || storagesError}</Alert>
        ) : null}

        {notPassedRows.length === 0 ? (
          <>
            <Card className="app-section-card" withBorder radius="md" padding="md">
              <Stack gap={10}>
                <Text className="app-section-title" fw={600} size="sm">{t('Файл і склад')}</Text>
                <Select
                  data={storageOptions}
                  disabled={isLoadingStorages || storageOptions.length === 0}
                  label={t('Склад')}
                  placeholder={isLoadingStorages ? t('Завантаження') : t('Оберіть склад')}
                  value={storageId}
                  onChange={(value) => updateCorrectionState({ storageId: value })}
                />
                <FileInput
                  clearable
                  accept=".xls,.xlsx,.csv"
                  label={t('Файл')}
                  placeholder={t('Оберіть файл')}
                  value={file}
                  onChange={setFile}
                />
              </Stack>
            </Card>
            <Card className="app-section-card" withBorder radius="md" padding="md">
              <Stack gap={10}>
                <Text className="app-section-title" fw={600} size="sm">{t('Колонки та рядки')}</Text>
                <SimpleGrid cols={{ base: 2, sm: 3 }} spacing={10} style={{ alignItems: 'end' }}>
                  <NumberInput label={t('Початковий рядок')} min={1} value={startRow} onChange={(value) => setStartRow(Number(value) || 0)} />
                  <NumberInput label={t('Кінцевий рядок')} min={0} value={endRow} onChange={(value) => setEndRow(Number(value) || 0)} />
                  <NumberInput label={t('Колонка коду')} min={1} value={columnVendorCode} onChange={(value) => setColumnVendorCode(Number(value) || 0)} />
                  <NumberInput label={t('Колонка кількості')} min={1} value={columnQty} onChange={(value) => setColumnQty(Number(value) || 0)} />
                  <NumberInput label={t('Колонка місця')} min={1} value={columnPlacement} onChange={(value) => setColumnPlacement(Number(value) || 0)} />
                </SimpleGrid>
              </Stack>
            </Card>
            <AppModalFooter>
              <Button color={CREATE_ACTION_COLOR} disabled={!canUpload} leftSection={<Upload size={16} />} loading={isUploading} styles={{ label: { fontFamily: 'var(--font-mono)', letterSpacing: 0 } }} onClick={() => void uploadFile()}>
                {t('Завантажити')}
              </Button>
            </AppModalFooter>
          </>
        ) : (
          <>
            <Card className="app-section-card" withBorder radius="md" padding="md">
              <Stack gap={10}>
                <Group gap={8}>
                  <Text className="app-section-title" fw={600} size="sm">{t('Не пройшли позиції')}</Text>
                  <TableChip tone="danger" value={notPassedRows.length} />
                </Group>
                <ScrollArea mah={420}>
                  <Table className="app-static-table" withTableBorder miw={760}>
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
                      <Table.Td><TableChip tone="product" value={displayValue(row.VendorCode)} /></Table.Td>
                      <Table.Td>
                        <TextInput size="xs" value={row.Placement || ''} onChange={(event) => updateNotPassedRow(index, 'Placement', event.currentTarget.value)} />
                      </Table.Td>
                      <Table.Td className="app-table-number">
                        <NumberInput hideControls size="xs" min={0} value={row.Qty || 0} onChange={(value) => updateNotPassedRow(index, 'Qty', String(value ?? 0))} />
                      </Table.Td>
                      <Table.Td><Text c="red.7" size="xs">{displayValue(row.ErrorMessage)}</Text></Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
                </ScrollArea>
              </Stack>
            </Card>
            <AppModalFooter>
              <Button color="gray" variant="default" disabled={isSavingReturn} styles={{ label: { fontFamily: 'var(--font-mono)', letterSpacing: 0 } }} onClick={closeModal}>
                {t('Закрити')}
              </Button>
              <Button color={CREATE_ACTION_COLOR} leftSection={<Save size={16} />} loading={isSavingReturn} styles={{ label: { fontFamily: 'var(--font-mono)', letterSpacing: 0 } }} onClick={() => void saveNotPassedRows()}>
                {t('Зберегти')}
              </Button>
            </AppModalFooter>
          </>
        )}
      </Stack>
    </AppModal>
  )
}

export function ProductFileUploadModal({
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
  const [isUploading, setUploading, tryStartUploading] = useBusyState()
  const hasPriceRows = form.prices.length > 0
  const duplicatePricingIds = getDuplicateProductUploadPricingIds(form.prices)
  const hasDuplicatePricingRows = duplicatePricingIds.length > 0
  const canSubmit = Boolean(
    Boolean(form.file)
    && form.startRow > 0
    && form.endRow > 0
    && form.vendorCode > 0
    && !hasDuplicatePricingRows
    && (!hasPriceRows || form.priceSourceIsAmg !== null)
    && !isUploading,
  )
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
    setError(null)
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  function setColumnField(field: keyof ProductFileUploadColumnForm, value: number | string) {
    setError(null)
    setForm((currentForm) => ({
      ...currentForm,
      [field]: readProductUploadNumber(value),
    }))
  }

  function addPriceRow() {
    setError(null)
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
    setError(null)
    setForm((currentForm) => ({
      ...currentForm,
      prices: currentForm.prices.map((priceRow) => (
        priceRow.key === key ? { ...priceRow, ...patch } : priceRow
      )),
    }))
  }

  function removePriceRow(key: string) {
    setError(null)
    setForm((currentForm) => {
      const prices = currentForm.prices.filter((priceRow) => priceRow.key !== key)

      return {
        ...currentForm,
        priceSourceIsAmg: prices.length > 0 ? currentForm.priceSourceIsAmg : null,
        prices,
      }
    })
  }

  async function submitUpload() {
    if (hasDuplicateProductUploadPricings(form.prices)) {
      setError(t('Один тип ціни вибрано кілька разів'))
      return
    }

    if (hasPriceRows && form.priceSourceIsAmg === null) {
      setError(t('Оберіть джерело цін: Контех (Fenix) або AMG'))
      return
    }

    if (!canSubmit) {
      setError(t('Виберіть файл і заповніть обовʼязкові колонки'))
      return
    }

    if (!form.file) {
      setError(t('Виберіть файл'))
      return
    }

    if (form.prices.some((priceRow) => !priceRow.pricingId || priceRow.columnNumber <= 0)) {
      setError(t('Заповніть тип ціни і колонку для кожної ціни'))
      return
    }

    if (!tryStartUploading()) {
      return
    }
    setError(null)

    try {
      await uploadProductsFromFile(buildProductFileUploadConfiguration(form), form.file)
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
    <AppModal centered opened={opened} size="min(960px, 96vw)" title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Завантаження товарів')}</span>} onClose={closeModal}>
      <Stack className="app-compact-form product-import-form" gap={10}>
        {(error || pricingState.error) ? (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {error || pricingState.error}
          </Alert>
        ) : null}
        {!error && !pricingState.error && hasDuplicatePricingRows ? (
          <Alert color="yellow" icon={<CircleAlert size={18} />} variant="light">
            {t('Один тип ціни вибрано кілька разів. Приберіть дубль перед завантаженням.')}
          </Alert>
        ) : null}

        <Card className="app-section-card" withBorder radius="md" padding="md">
          <Stack gap={10}>
            <Text className="app-section-title" fw={600} size="sm">{t('Файл і операція')}</Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={10} style={{ alignItems: 'end' }}>
              <Select
                allowDeselect={false}
                data={productFileUploadModeOptions.map((option) => ({ ...option, label: t(option.label) }))}
                label={t('Операція')}
                value={String(form.mode)}
                onChange={(value) => setField('mode', readProductUploadNumber(value || 0) as ProductFileUploadMode)}
              />
              <FileInput
                clearable
                label={t('Файл')}
                placeholder={t('Оберіть файл')}
                value={form.file}
                onChange={(nextFile) => setField('file', nextFile)}
              />
            </SimpleGrid>
          </Stack>
        </Card>

        <Card className="app-section-card" withBorder radius="md" padding="md">
          <Stack gap={10}>
            <Text className="app-section-title" fw={600} size="sm">{t('Колонки')}</Text>
            <Box className="product-import-columns" style={{ alignItems: 'end' }}>
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
            </Box>
          </Stack>
        </Card>

        <Card className="app-section-card" withBorder radius="md" padding="md">
          <Stack gap={10}>
            <Group justify="space-between">
              <Group gap={8}>
                <Text className="app-section-title" fw={600} size="sm">{t('Ціни')}</Text>
                <TableChip value={form.prices.length} />
              </Group>
              <Button
                disabled={pricingState.isLoading || pricingOptions.length === 0}
                leftSection={<Plus size={16} />}
                size="xs"
                styles={{ label: { fontFamily: 'var(--font-mono)', letterSpacing: 0 } }}
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
                {form.prices.map((priceRow) => {
                  const isDuplicatePricing = isDuplicateProductUploadPricingId(form.prices, priceRow.pricingId)

                  return (
                    <Box key={priceRow.key} className="product-import-price-row">
                      <Select
                        allowDeselect={false}
                        data={pricingOptions}
                        error={isDuplicatePricing ? t('Дубль типу ціни') : undefined}
                        label={t('Тип ціни')}
                        value={priceRow.pricingId}
                        onChange={(value) => updatePriceRow(priceRow.key, { pricingId: value || '' })}
                      />
                      <NumberInput
                        label={t('Колонка')}
                        min={0}
                        value={priceRow.columnNumber}
                        onChange={(value) => updatePriceRow(priceRow.key, { columnNumber: readProductUploadNumber(value) })}
                      />
                      <Tooltip label={t('Видалити')}>
                        <ActionIcon aria-label={t('Видалити')} color="red" size={32} variant="light" onClick={() => removePriceRow(priceRow.key)}>
                          <Trash2 size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Box>
                  )
                })}
              </Stack>
            ) : (
              <Text c="dimmed" size="sm">{t('Ціни не додані')}</Text>
            )}

            {hasPriceRows ? (
              <Box component="fieldset" m={0} p={0} style={{ border: 0, minWidth: 0 }}>
                <Text component="legend" c="gray.9" fw={500} mb={4} size="xs">
                  {t('Джерело цін')} <Text component="span" c="red">*</Text>
                </Text>
                <SegmentedControl
                  className="product-import-price-source"
                  data={[
                    { label: t('Контех (Fenix)'), value: 'fenix' },
                    { label: 'AMG', value: 'amg' },
                  ]}
                  value={form.priceSourceIsAmg === null ? '' : form.priceSourceIsAmg ? 'amg' : 'fenix'}
                  onChange={(value) => setField('priceSourceIsAmg', value === 'amg')}
                />
                {form.priceSourceIsAmg === null ? (
                  <Text c="red" mt={4} size="xs">{t('Оберіть джерело цін перед завантаженням')}</Text>
                ) : null}
              </Box>
            ) : null}
          </Stack>
        </Card>

        <AppModalFooter>
          <Button color="gray" disabled={isUploading} styles={{ label: { fontFamily: 'var(--font-mono)', letterSpacing: 0 } }} variant="default" onClick={closeModal}>
            {t('Скасувати')}
          </Button>
          <Button color={CREATE_ACTION_COLOR} leftSection={<Upload size={16} />} loading={isUploading} disabled={!canSubmit} styles={{ label: { fontFamily: 'var(--font-mono)', letterSpacing: 0 } }} onClick={() => void submitUpload()}>
            {t('Завантажити')}
          </Button>
        </AppModalFooter>
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
        <Button size="xs" variant="outline" leftSection={<Upload size={16} />} onClick={openModal}>
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
  const [isUploading, setUploading, tryStartUploading] = useBusyState()
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

    if (!tryStartUploading()) {
      return
    }
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
    <AppModal centered opened={opened} title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t(labels.title)}</span>} onClose={closeModal}>
      <Stack className="app-compact-form product-import-form" gap={10} onKeyDown={handleUploadKeyDown}>
        {error ? (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        ) : null}

        <Card className="app-section-card" withBorder radius="md" padding="md">
          <Stack gap={10}>
            <Text className="app-section-title" fw={600} size="sm">{t('Дані завантаження')}</Text>

            <FileInput
              clearable
              label={t('Файл')}
              placeholder={t('Оберіть файл')}
              value={form.file}
              onChange={(nextFile) => setField('file', nextFile)}
            />

            <SimpleGrid cols={2} spacing={10} style={{ alignItems: 'end' }}>
              <TextInput
                label={t('Артикул товару')}
                className="product-import-code"
                value={form.vendorCode}
                onChange={(event) => setField('vendorCode', event.currentTarget.value)}
              />
              <TextInput
                label={t(labels.articleLabel)}
                className="product-import-code"
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
          </Stack>
        </Card>

        <AppModalFooter>
          <Button color="gray" disabled={isUploading} styles={{ label: { fontFamily: 'var(--font-mono)', letterSpacing: 0 } }} variant="default" onClick={closeModal}>
            {t('Скасувати')}
          </Button>
          <Button color={CREATE_ACTION_COLOR} leftSection={<Upload size={16} />} loading={isUploading} disabled={!canSubmit} styles={{ label: { fontFamily: 'var(--font-mono)', letterSpacing: 0 } }} onClick={() => void submitUpload()}>
            {t('Завантажити')}
          </Button>
        </AppModalFooter>
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

// Like isEditableKeyboardTarget but excludes buttons — used to let arrow keys move the caret/options
// inside real text fields and selects while still hijacking arrows everywhere else for product switching.
function isTextLikeKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  const tagName = target.tagName.toLowerCase()

  return target.isContentEditable || tagName === 'input' || tagName === 'select' || tagName === 'textarea'
}

function getMovementDateRangeError(from: string, to: string, t: (key: string) => string): string | null {
  if (!from || !to) return t('Вкажіть дату початку та дату завершення')
  if (from > to) return t('Дата початку не може бути пізнішою за дату завершення')
  return null
}

function ProductInlineMovementsTab({
  direction,
  product,
  siblingCards,
}: {
  direction: InlineMovementDirection
  product: Product
  siblingCards: ProductSiblingCard[]
}) {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)
  const productNetUid = product.NetUid?.trim()
  const [dateFrom, setDateFrom] = useState(() => direction === 'income' ? PRODUCT_INCOME_HISTORY_START : getDateDaysAgo(30))
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
  const [siblingScope, setSiblingScope] = useState<ProductSiblingScope>('card')
  const hasSiblings = hasProductSiblingCards(siblingCards)
  const includeSiblings = hasSiblings && siblingScope === 'all'
  const labels = inlineMovementLabels[direction]
  const canExportMovements = hasPermission(PRODUCT_MOVEMENT_EXPORT_PERMISSION)
  const filterError = getMovementDateRangeError(dateFrom, dateTo, t)
  const exportRequestRef = useRef(0)

  useEffect(() => {
    dispatch({ type: 'export-clear' })
    return () => { exportRequestRef.current += 1 }
  }, [dateFrom, dateTo, direction, includeSiblings, productNetUid])

  useEffect(() => {
    if (!productNetUid || filterError) {
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
          ...(includeSiblings ? { includeSiblings: true } : {}),
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
  }, [dateFrom, dateTo, direction, filterError, includeSiblings, productNetUid, reloadKey, t])

  async function exportRows() {
    if (!canExportMovements || !productNetUid || state.isExporting || includeSiblings || filterError) {
      return
    }

    const requestId = ++exportRequestRef.current
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

      if (requestId === exportRequestRef.current) dispatch({ document, type: 'export-success' })
    } catch (exportError) {
      if (requestId !== exportRequestRef.current) return
      dispatch({
        error: exportError instanceof Error ? exportError.message : t('Не вдалося сформувати документ'),
        type: 'export-error',
      })
    }
  }

  return (
    <Stack className="product-inline-movements product-inline-table-frame" gap={0}>
      <ProductSourceHistoryRefresh hideControls productNetId={productNetUid} includeSiblings={includeSiblings} onRefreshed={() => {
        exportRequestRef.current += 1
        dispatch({ type: 'export-clear' })
        reload()
      }} />
      <Group className="app-filter-bar product-movement-toolbar" align="end" gap={10} wrap="nowrap">
        <ToolbarDateRangeFilter from={dateFrom} to={dateTo} fromLabel={t('З')} toLabel={t('По')}
          min="1900-01-01" max="9999-12-30" required
          onChange={({ from, to }) => { setDateFrom(from); setDateTo(to) }} />
        {hasSiblings ? (
          <ProductSiblingScopeControl id={`product-inline-${direction}-sibling-scope`} value={siblingScope} onChange={setSiblingScope} />
        ) : null}
        <div className="app-filter-actions">
          <Button color="gray" variant="default" size="sm" disabled={!productNetUid || Boolean(filterError)}
            leftSection={<RefreshCw size={16} />} loading={state.isLoading && !filterError} onClick={() => reload()}>
            {t('Оновити')}
          </Button>
          <PermissionGate permissionKey={PRODUCT_MOVEMENT_EXPORT_PERMISSION}>
            <Button color="gray" variant="default" size="sm"
              className="product-movement-toolbar__button"
              disabled={!productNetUid || includeSiblings || Boolean(filterError)}
              leftSection={<PdfIcon size={20} />}
              loading={state.isExporting}
              onClick={() => void exportRows()}
            >
              {t('Друк PDF')}
            </Button>
          </PermissionGate>
        </div>
        <div ref={setTableToolbarSlot} className="app-filter-table-toolbar-slot" />
      </Group>

      <Stack className={`product-inline-movement-body${direction === 'outcome' ? ' is-outcome' : ''}`} gap="sm">
      {!productNetUid && (
        <Alert color="yellow" icon={<CircleAlert size={18} />} variant="light">
          {t('У товару немає NetUid для завантаження руху товару')}
        </Alert>
      )}
      {filterError && <Alert color="yellow" icon={<CircleAlert size={18} />} variant="light">{filterError}</Alert>}
      {!filterError && state.error && (
        <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
          <Stack gap="xs" align="flex-start">
            <span>{state.error}</span>
            <Button variant="default" size="xs" leftSection={<RefreshCw size={14} />} onClick={() => reload()}>
              {t('Спробувати ще раз')}
            </Button>
          </Stack>
        </Alert>
      )}
      {productNetUid && !filterError && (direction === 'income' ? (
        <ProductIncomeMovementsGrid toolbarPortalTarget={tableToolbarSlot} emptyText={state.error ? '' : t(labels.empty)} includeSiblings={includeSiblings} isLoading={state.isLoading} rows={state.rows as ProductIncomeMovement[]} />
      ) : (
        <ProductOutcomeMovementsGrid toolbarPortalTarget={tableToolbarSlot} emptyText={state.error ? '' : t(labels.empty)} includeSiblings={includeSiblings} isLoading={state.isLoading} rows={state.rows as ProductOutcomeMovement[]} />
      ))}

      <DocumentExportModal
        document={state.document}
        error={state.exportError}
        isLoading={state.isExporting}
        opened={state.isExporting || Boolean(state.document) || Boolean(state.exportError)}
        title={t('Друк PDF')}
        onClose={() => {
          exportRequestRef.current += 1
          dispatch({ type: 'export-clear' })
        }}
      />
      </Stack>
    </Stack>
  )
}

function ProductIncomeMovementsGrid({
  emptyText,
  includeSiblings,
  isLoading,
  rows,
  toolbarPortalTarget,
}: {
  toolbarPortalTarget?: Element | null
  emptyText: string
  includeSiblings: boolean
  isLoading: boolean
  rows: ProductIncomeMovement[]
}) {
  const { t } = useI18n()
  const cardColumns = useMemo<DataTableColumn<ProductIncomeMovement>[]>(
    () => withProductSourceHistoryColumns([
      {
        id: 'storage',
        header: t('Склад'),
        width: 110,
        accessor: (row) => row.StorageName,
        cell: (row) => <TableChip tone="storage" value={formatMovementCellValue(row.StorageName)} />,
      },
      {
        id: 'supplier',
        header: t('Постачальник'),
        width: 180,
        accessor: (row) => row.SupplierName,
        cell: (row) => renderMovementText(row.SupplierName),
      },
      {
        id: 'organization',
        header: t('Організація'),
        width: 150,
        accessor: (row) => row.OrganizationName,
        cell: (row) => <TableChip tone="product" value={row.OrganizationName} />,
      },
      {
        id: 'incomeDate',
        header: t('Дата приходу'),
        width: 150,
        accessor: (row) => row.IncomeToStorageDate,
        cell: (row) => renderMovementDate(row.IncomeToStorageDate),
      },
      {
        id: 'incomeNumber',
        header: t('Номер приходу'),
        width: 140,
        accessor: (row) => row.IncomeToStorageNumber,
        cell: (row) => row.ImportedSourceMetadataResolved === false && !formatMovementCellValue(row.IncomeToStorageNumber)
          ? renderMovementText(t('Дані AMG не визначені'))
          : <TableChip tone="document" value={formatMovementCellValue(row.IncomeToStorageNumber)} />,
      },
      {
        id: 'invoice',
        header: t('Інвойс'),
        width: 110,
        accessor: (row) => row.IncomeInvoiceNumber,
        cell: (row) => renderMovementMono(row.IncomeInvoiceNumber),
      },
      {
        id: 'invoiceDate',
        header: t('Дата інвойсу'),
        width: 150,
        accessor: (row) => row.IncomeInvoiceDate,
        cell: (row) => renderMovementDate(row.IncomeInvoiceDate),
      },
      {
        id: 'currency',
        header: t('Валюта'),
        width: 92,
        accessor: (row) => row.Currency,
        cell: (row) => renderMovementCurrency(row.Currency),
      },
      {
        id: 'exchangeRate',
        header: t('Курс'),
        width: 92,
        align: 'right',
        accessor: (row) => row.ExchangeRate,
        cell: (row) => row.ImportedSourceMetadataResolved === false
          ? renderMovementExchangeRate(undefined)
          : renderMovementExchangeRate(row.ExchangeRate),
      },
      {
        id: 'unitPriceLocal',
        header: t('Ціна (вал. угоди)'),
        width: 110,
        align: 'right',
        accessor: (row) => row.UnitPriceLocal,
        cell: (row) => renderMovementPrice(row.UnitPriceLocal),
      },
      {
        id: 'netPrice',
        header: t('Ціна нетто за одиницю, EUR'),
        width: 190,
        align: 'right',
        accessor: (row) => row.NetPrice,
        cell: (row) => renderMovementPrice(row.NetPrice),
      },
      {
        id: 'totalNetPrice',
        header: t('Сума нетто приходу, EUR'),
        width: 190,
        align: 'right',
        accessor: (row) => row.TotalNetPrice,
        cell: (row) => renderMovementPrice(row.TotalNetPrice),
      },
      {
        id: 'grossPrice',
        header: t('Управлінська собівартість приходу, EUR'),
        width: 240,
        align: 'right',
        accessor: (row) => row.GrossPrice,
        cell: (row) => renderMovementPrice(row.GrossPrice),
      },
      {
        id: 'accountingGrossPrice',
        header: t('Бухгалтерська собівартість приходу, EUR'),
        width: 250,
        align: 'right',
        accessor: (row) => row.AccountingGrossPrice,
        cell: (row) => renderMovementPrice(row.AccountingGrossPrice),
      },
      {
        id: 'managementEurUnitPrice',
        header: t('Упр. EUR'),
        width: 112,
        align: 'right',
        accessor: (row) => row.ManagementEurUnitPrice,
        cell: (row) => renderMovementUnitPrice(row.ManagementEurUnitPrice),
      },
      {
        id: 'accountingEurUnitPrice',
        header: t('Бух. EUR'),
        width: 112,
        align: 'right',
        accessor: (row) => row.AccountingEurUnitPrice,
        cell: (row) => renderMovementUnitPrice(row.AccountingEurUnitPrice),
      },
      {
        id: 'weight',
        header: t('Вага'),
        width: 100,
        align: 'right',
        accessor: (row) => row.Weight,
        cell: (row) => renderMovementAmount(row.Weight),
      },
      {
        id: 'incomeQty',
        header: t('Прихід'),
        width: 104,
        align: 'right',
        accessor: (row) => row.IncomeQty,
        cell: (row) => renderMovementAmount(row.IncomeQty),
      },
      {
        id: 'remainingQty',
        header: t('Залишок'),
        width: 104,
        align: 'right',
        accessor: (row) => row.RemainingQty,
        cell: (row) => renderMovementAmount(row.RemainingQty),
      },
      {
        id: 'fromInvoiceNumber',
        header: t('З інвойсу'),
        width: 120,
        accessor: (row) => row.FromInvoiceNumber,
        cell: (row) => <TableChip tone="document" value={formatMovementCellValue(row.FromInvoiceNumber)} />,
      },
      {
        id: 'fromInvoiceDate',
        header: t('Дата з інвойсу'),
        width: 150,
        accessor: (row) => row.FromInvoiceDate,
        cell: (row) => renderMovementDate(row.FromInvoiceDate),
      },
      {
        id: 'returnPrice',
        header: t('Ціна повернення'),
        width: 140,
        align: 'right',
        accessor: (row) => row.ReturnPrice,
        cell: (row) => renderMovementPrice(row.ReturnPrice),
      },
      {
        id: 'priceDifference',
        header: t('Різниця'),
        width: 110,
        align: 'right',
        accessor: (row) => row.PriceDifference,
        cell: (row) => renderMovementPrice(row.PriceDifference),
      },
    ], t),
    [t],
  )
  const columns = useMemo<DataTableColumn<ProductIncomeMovement>[]>(
    () => includeSiblings
      ? [createProductSiblingCardColumn<ProductIncomeMovement>(t('Картка')), ...cardColumns]
      : cardColumns,
    [cardColumns, includeSiblings, t],
  )

  return (
    <DataTable
      toolbarPortalTarget={toolbarPortalTarget}
      columns={columns}
      data={rows}
      density="normal"
      emptyText={emptyText}
      getRowId={getIncomeMovementGridRowId}
      isLoading={isLoading}
      layoutVersion="product-income-movements-1"
      maxHeight={360}
      minWidth={2500}
      showDensityToggle={false}
      showLayoutControls
      stickyHorizontalScrollbar
      tableId="product-income-movements"
    />
  )
}

function ProductOutcomeMovementsGrid({
  emptyText,
  includeSiblings,
  isLoading,
  rows,
  toolbarPortalTarget,
}: {
  toolbarPortalTarget?: Element | null
  emptyText: string
  includeSiblings: boolean
  isLoading: boolean
  rows: ProductOutcomeMovement[]
}) {
  const { t } = useI18n()
  const cardColumns = useMemo<DataTableColumn<ProductOutcomeMovement>[]>(
    () => withProductSourceHistoryColumns([
      {
        id: 'date',
        header: t('Дата'),
        width: 150,
        minWidth: 140,
        accessor: (row) => row.FromDate,
        cell: (row) => renderOutcomeMovementDate(row, t),
      },
      {
        id: 'documentType',
        header: t('Тип документа'),
        width: 150,
        minWidth: 140,
        accessor: (row) => row.DocumentTypeName,
        cell: (row) => renderMovementText(row.DocumentTypeName),
      },
      {
        id: 'storage',
        header: t('Склад'),
        width: 140,
        minWidth: 120,
        accessor: (row) => row.StorageName,
        cell: (row) => <TableChip tone="storage" value={formatMovementCellValue(row.StorageName)} />,
      },
      {
        id: 'organization',
        header: t('Організація'),
        width: 160,
        minWidth: 150,
        accessor: (row) => row.OrganizationName,
        cell: (row) => <TableChip tone="product" value={row.OrganizationName} />,
      },
      {
        id: 'documentNumber',
        header: t('Номер'),
        width: 140,
        minWidth: 140,
        accessor: (row) => row.DocumentNumber,
        cell: (row) => <TableChip tone="document" value={formatMovementCellValue(row.DocumentNumber)} />,
      },
      {
        id: 'client',
        header: t('Клієнт'),
        minWidth: 190,
        fill: true,
        accessor: (row) => row.ClientName,
        cell: (row) => renderMovementText(row.ClientName),
      },
      {
        id: 'responsible',
        header: t('Відповідальний'),
        width: 190,
        minWidth: 170,
        accessor: (row) => row.ResponsibleName,
        cell: (row) => <TableChip tone="warning" value={row.ResponsibleName} />,
      },
      {
        id: 'price',
        header: t('Ціна'),
        width: 110,
        minWidth: 100,
        align: 'right',
        accessor: (row) => row.Price,
        cell: (row) => renderMovementPrice(row.Price),
      },
      {
        id: 'qty',
        header: t('Кількість'),
        width: 110,
        minWidth: 110,
        align: 'right',
        accessor: (row) => row.Qty,
        cell: (row) => renderMovementAmount(row.Qty),
      },
    ], t),
    [t],
  )
  const columns = useMemo<DataTableColumn<ProductOutcomeMovement>[]>(
    () => includeSiblings
      ? [createProductSiblingCardColumn<ProductOutcomeMovement>(t('Картка')), ...cardColumns]
      : cardColumns,
    [cardColumns, includeSiblings, t],
  )

  return (
    <DataTable
      toolbarPortalTarget={toolbarPortalTarget}
      columns={columns}
      data={rows}
      density="normal"
      emptyText={emptyText}
      fillAvailableWidth
      getRowId={getOutcomeMovementGridRowId}
      isLoading={isLoading}
      layoutVersion="product-outcome-movements-1"
      maxHeight={360}
      minWidth={1900}
      showDensityToggle={false}
      showLayoutControls
      stickyHorizontalScrollbar
      tableId="product-outcome-movements"
    />
  )
}

function inlineMovementReducer(state: InlineMovementState, action: InlineMovementAction): InlineMovementState {
  switch (action.type) {
    case 'export-clear':
      return {
        ...state,
        isExporting: false,
        document: null,
        exportError: null,
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
        document: null,
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
        ...state,
        error: action.error,
        isLoading: false,
        rows: [],
      }
    case 'loading':
      return {
        ...state,
        error: null,
        isLoading: true,
      }
    case 'success':
      return {
        ...state,
        error: null,
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
  return item.OriginalNumber?.Number?.trim() || item.OriginalNumber?.MainNumber?.trim() || ''
}

function getProductRowKey(product: Product): string {
  return getProductIdentity(product)
}

function getProductIdentity(product: Product): string {
  return String(product.NetUid || product.Id || product.VendorCode || product.Name || 'product')
}

function getNextSearchedProducts(product: Product): Product[] {
  const nextProducts = (product as Product & { NextSearchedProducts?: Product[] }).NextSearchedProducts

  return Array.isArray(nextProducts) ? nextProducts : []
}

function copyToClipboard(value: string) {
  if (!value || !navigator.clipboard) {
    notifications.show({ color: 'red', message: translate('Не вдалося скопіювати') })

    return
  }

  void navigator.clipboard.writeText(value).then(
    () => notifications.show({ color: 'green', message: `${value} — ${translate('скопійовано')}` }),
    () => notifications.show({ color: 'red', message: translate('Не вдалося скопіювати') }),
  )
}

function getTodayDate(): string {
  const now = new Date()
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)

  return localDate.toISOString().slice(0, 10)
}

const PRODUCT_INCOME_HISTORY_START = '2000-01-01'

function getDateDaysAgo(days: number): string {
  const now = new Date()
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000 - days * 86_400_000)

  return localDate.toISOString().slice(0, 10)
}

function toNumber(value?: number | null): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function renderMovementText(value?: number | string | null) {
  const text = formatMovementCellValue(value)

  return <span className="product-movement-cell-text" title={text}>{text}</span>
}

function renderMovementMono(value?: number | string | null) {
  const text = formatMovementCellValue(value)

  return <TableChip tone="document" value={text} />
}

function renderMovementDate(value?: Date | string | null) {
  const text = formatInlineDateTime(value)

  return <span className="app-money" title={text}>{text}</span>
}

function renderMovementAmount(value?: number | null) {
  const text = typeof value === 'number' && Number.isFinite(value) ? formatAmount(value) : ''

  return <span className="app-money" title={text}>{text}</span>
}

function renderMovementExchangeRate(value?: number | null) {
  const text = typeof value === 'number' && Number.isFinite(value) ? formatExchangeRate(value) : ''

  return <span className="app-money" title={text}>{text}</span>
}

function renderMovementPrice(value?: number | null) {
  const text = typeof value === 'number' && Number.isFinite(value) ? formatPrice(value) : ''

  return <span className="app-money" title={text}>{text}</span>
}

function renderMovementUnitPrice(value?: number | null) {
  const text = typeof value === 'number' && Number.isFinite(value)
    ? formatProductMovementUnitPrice(value)
    : ''

  return <span className="app-money" title={text}>{text}</span>
}

function renderMovementCurrency(value?: string | null) {
  const text = formatMovementCellValue(value)

  return text ? <TableChip value={text} /> : null
}

function renderOutcomeMovementDate(row: ProductOutcomeMovement, t: (value: string) => string) {
  const text = formatInlineDateTime(row.FromDate)

  return (
    <span className="product-movement-date app-money" title={text}>
      {row.HasUpdateDataCarrier ? <span className="product-edited-dot" aria-hidden="true" title={t('Редаговано')} /> : null}
      {text}
    </span>
  )
}

function formatMovementCellValue(value?: number | string | null): string {
  if (value === null || value === undefined || value === '') {
    return ''
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : ''
  }

  return value.trim()
}

function formatInlineDateTime(value?: Date | string | null): string {
  if (!value) {
    return ''
  }

  const date = value instanceof Date ? value : new Date(value)

  return Number.isNaN(date.getTime()) ? '' : dateTimeFormatter.format(date)
}

function getIncomeMovementRowKey(row: ProductIncomeMovement, index: number): string {
  return String(
    row.SourceHistory?.RowKey
      || row.NetUid
      || row.Id
      || `${row.IncomeToStorageNumber || row.IncomeInvoiceNumber || 'income'}-${row.IncomeToStorageDate || row.IncomeInvoiceDate || ''}-${index}`,
  )
}

function getOutcomeMovementRowKey(row: ProductOutcomeMovement, index: number): string {
  return String(row.SourceHistory?.RowKey || row.NetUid || row.Id || `${row.DocumentNumber || 'outcome'}-${row.FromDate || ''}-${index}`)
}

function getIncomeMovementGridRowId(row: ProductIncomeMovement, index: number): string {
  return getProductSiblingRowKey(row.Card, getIncomeMovementRowKey(row, index))
}

function getOutcomeMovementGridRowId(row: ProductOutcomeMovement, index: number): string {
  return getProductSiblingRowKey(row.Card, getOutcomeMovementRowKey(row, index))
}

function getSiblingCountKey(productNetId?: string | null): string {
  return productNetId?.trim().toLowerCase() || ''
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
    if (isDeletedRecord(item)) {
      return result
    }

    const relatedProduct = readRelatedProductByKeys(item, ['AnalogueProduct', 'Product', 'RelatedProduct'])

    if (relatedProduct && !isDeletedRecord(relatedProduct)) {
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
    if (isDeletedRecord(item)) {
      return result
    }

    const relatedProduct = readRelatedProductByKeys(item, ['ComponentProduct', 'Product', 'RelatedProduct'])

    if (relatedProduct && !isDeletedRecord(relatedProduct)) {
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
    if (isDeletedRecord(item)) {
      return result
    }

    const relatedProduct = readRelatedProductByKeys(item, ['BaseProduct', 'Product', 'RelatedProduct'])

    if (relatedProduct && !isDeletedRecord(relatedProduct)) {
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

function isDeletedRecord(value: unknown): boolean {
  return Boolean(value && typeof value === 'object' && (value as { Deleted?: boolean }).Deleted === true)
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
