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
import { ArrowLeftRight, Box as BoxIcon, ChevronDown, CircleAlert, ClipboardList, FileDown, FileText, History, Image as ImageIcon, Package, Plus, RefreshCw, RotateCcw, Save, Settings, Sparkles, SquarePen, Star, Trash2, Upload } from 'lucide-react'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { type KeyboardEvent, type ReactNode, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { translate } from '../../../shared/i18n/translate'
import { getDocumentHref } from '../../../shared/url/getDocumentHref'
import {
  closePendingExportDocumentWindow,
  openExportDocumentInWindow,
  openPendingExportDocumentWindow,
} from '../../../shared/documents/openExportDocument'
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
  getProductReservationByNetId,
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
import { AppModal } from '../../../shared/ui/AppModal'
import { toProxiedAssetUrl } from '../../../shared/url/proxiedAssetUrl'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { PermissionGate } from '../../auth/components/PermissionGate'
import { useAuth } from '../../auth/useAuth'
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
  ProductSortMode,
  ProductUploadDocumentPayload,
  Pricing,
  Storage,
} from '../types'
import {
  displayValue,
  formatAmount,
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
import { ProductPriceSourcePanel } from '../components/ProductPriceSourcePanel'
import { getProductAnalyticsId } from '../components/ProductAnalyticsPanel'
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
const PRODUCT_UPLOAD_DOCUMENT_PERMISSION = 'Product_Entire_Assortment_Product_Upload_Document_Btn_PKEY'
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
type InlineDetailState = {
  error: string | null
  isLoading: boolean
  product: Product | null
  reservation: ProductReservation
  reservationError: string | null
}
type InlineMovementAction =
  | { type: 'export-clear' }
  | { type: 'export-error'; error: string }
  | { type: 'export-loading' }
  | { type: 'export-opened' }
  | { type: 'export-success'; document: ProductMovementExportDocument }
  | { type: 'error'; error: string }
  | { type: 'loading' }
  | { type: 'success'; rows: InlineMovementRow[] }
type InlineDetailAction =
  | { type: 'clear' }
  | { type: 'error'; error: string; product: Product | null }
  | { type: 'loading' }
  | { type: 'saved'; product: Product }
  | { type: 'success'; product: Product | null; reservation: ProductReservation; reservationError: string | null }
type RelatedProductRow = {
  isProductSet: boolean
  product: Partial<Product>
  quantity?: number | string
  source: unknown
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
  const { t } = useI18n()
  const [urlSearchParams, setUrlSearchParams] = useSearchParams()
  const rawRouteProductNetId = urlSearchParams.get('netId')?.trim() || ''
  // Ignore the «Весь асортимент» tab sentinel so the page opens in its normal search-ready
  // state instead of trying to load a product named "assortment".
  const routeProductNetId = rawRouteProductNetId === ROUTE_ASSORTMENT_SENTINEL ? '' : rawRouteProductNetId
  const [topProducts, setTopProducts] = useValueState<Product[]>([])
  const [bottomProducts, setBottomProducts] = useValueState<Product[]>([])
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
  const [detailState, dispatchDetail] = useReducer(inlineDetailReducer, {
    error: null,
    isLoading: false,
    product: null,
    reservation: {},
    reservationError: null,
  })
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const [detailReloadKey, reloadProductDetail] = useReducer((key: number) => key + 1, 0)
  const searchRequestRef = useRef(0)
  const detailRequestRef = useRef(0)
  const routeProductRequestRef = useRef(0)
  const hasRouteSeededProductsRef = useRef(false)
  const selectedProductNetUid = selectedProduct?.NetUid?.trim() || ''
  const productForView = detailState.product || selectedProduct

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

  const applySearchResults = useCallback(
    (nextProducts: Product[]) => {
      setActivePanel(null)
      dispatchDetail({ type: 'clear' })
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
        }
      } catch (loadError) {
        if (requestId === searchRequestRef.current) {
          setTopProducts([])
          setBottomProducts([])
          setSelectedProduct(null)
          dispatchDetail({ type: 'clear' })
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
    }
  }, [hasRequestedProducts, loadProducts, reloadKey, searchValue, searchMode, sortMode])

  useEffect(() => {
    if (!routeProductNetId) {
      return
    }

    const requestId = ++routeProductRequestRef.current

    searchRequestRef.current += 1
    detailRequestRef.current += 1
    setLoading(true)
    setVirtualLoad(false)
    setError(null)

    async function loadRouteProduct() {
      if (requestId !== routeProductRequestRef.current) {
        return
      }

      try {
        const nextProduct = await getProductByNetId(routeProductNetId)

        if (requestId === routeProductRequestRef.current) {
          setVirtualLoad(false)

          if (!nextProduct) {
            setTopProducts([])
            setBottomProducts([])
            setSelectedProduct(null)
            dispatchDetail({ type: 'clear' })
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
            setSelectedProduct(nextProduct)
            dispatchDetail({ type: 'clear' })
            setActivePanel(null)
            setCarouselMode('selection')
            setHasRequestedProducts(false)
            setSearchDraft('')
            setSearchValue('')
            setError(null)
          }
        }
      } catch (loadError) {
        if (requestId === routeProductRequestRef.current) {
          setTopProducts([])
          setBottomProducts([])
          setSelectedProduct(null)
          dispatchDetail({ type: 'clear' })
          setActivePanel(null)
          setCarouselMode('search')
          setLoadedProductsCount(0)
          hasRouteSeededProductsRef.current = false
          setHasRequestedProducts(false)
          setSearchDraft('')
          setSearchValue('')
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити товар'))
        }
      } finally {
        if (requestId === routeProductRequestRef.current) {
          setLoading(false)
        }
      }
    }

    void loadRouteProduct()
  }, [
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
    t,
  ])

  useEffect(() => {
    // Invalidate any in-flight load FIRST so clearing the selection (emptying the drum) discards a
    // late response instead of loading a product card that is no longer needed.
    const requestId = ++detailRequestRef.current

    if (!selectedProductNetUid) {
      return
    }

    dispatchDetail({ type: 'loading' })

    // Abort the in-flight detail + reservation requests when the selection changes or is cleared —
    // the legacy carousel does this via RxJS switchMap. Without it, stale requests keep running on
    // the (slow) server and pile up, which is what made the card loading "hang".
    const controller = new AbortController()

    async function loadProductDetails() {
      try {
        const [nextProduct, nextReservationResult] = await Promise.all([
          getProductByNetId(selectedProductNetUid, controller.signal),
          getProductReservationByNetId(selectedProductNetUid, controller.signal)
            .then((value) => ({ error: null, value }))
            .catch((reservationLoadError: unknown) => ({
              error: reservationLoadError instanceof Error ? reservationLoadError.message : t('Не вдалося завантажити резерви товару'),
              value: {},
            })),
        ])

        if (requestId === detailRequestRef.current) {
          dispatchDetail({
            product: nextProduct || selectedProduct,
            reservation: nextReservationResult.value,
            reservationError: nextReservationResult.error,
            type: 'success',
          })
        }
      } catch (loadError) {
        if (controller.signal.aborted) {
          return
        }

        if (requestId === detailRequestRef.current) {
          dispatchDetail({
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити товар'),
            product: selectedProduct,
            type: 'error',
          })
        }
      }
    }

    // Debounce the actual fetch so rapid drum navigation doesn't queue a request per product:
    // each new selection clears the pending one and only the product you stop on is loaded.
    const timeoutId = window.setTimeout(() => {
      void loadProductDetails()
    }, DETAIL_LOAD_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [
    detailReloadKey,
    selectedProduct,
    selectedProductNetUid,
    t,
  ])

  function updateSearchDraft(nextValue: string) {
    clearRouteProductParam()
    hasRouteSeededProductsRef.current = false
    setSearchDraft(nextValue)
    setSearchValue(nextValue.trim())
    setHasRequestedProducts(true)
    setCarouselMode('search')
    setSelectedProduct(null)
    dispatchDetail({ type: 'clear' })
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
    dispatchDetail({ type: 'clear' })
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
    dispatchDetail({ type: 'loading' })
    setSelectedProduct(product)
    // The loading state retains the previous detail to preserve page height; ProductInlineView
    // makes that stale content inert until the newly selected product arrives.
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
    dispatchDetail({ type: 'loading' })
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
    dispatchDetail({ type: 'loading' })
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
    dispatchDetail({ type: 'loading' })
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
      dispatchDetail({ product: nextProduct, type: 'saved' })
      setSelectedProduct(nextProduct)
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
          isLoading={isLoading}
          searchMode={searchMode}
          sortMode={sortMode}
          onRefresh={commitSearch}
          onReset={resetSearch}
          onSearchModeChange={setSearchMode}
          onSortModeChange={setSortMode}
        />

        <Box className="product-assortment-workspace console-table-body">
          <ProductAssortmentCarousel
            bottomProducts={bottomProducts}
            isLoading={isLoading}
            isSelectionMode={carouselMode === 'selection'}
            isVirtualLoad={isVirtualLoad}
            searchDraft={searchDraft}
            selectedProduct={selectedProduct}
            topProducts={topProducts}
            onSearchDraftChange={updateSearchDraft}
            onSelectProduct={selectProduct}
            onUploadSuccess={handleAssortmentUploadSuccess}
          />

          <ProductInlineView
            detailError={detailState.error}
            isLoading={detailState.isLoading}
            product={productForView}
            reservation={detailState.reservation}
            reservationError={detailState.reservationError}
            onOpenPanel={setActivePanel}
            onProductChanged={handleProductSaved}
            onReload={reloadProductDetail}
            onSelectRelatedProduct={selectRelatedProduct}
          />
        </Box>
      </Box>

      {productForView && (
        <ProductActionDrawer
          activePanel={activePanel}
          product={productForView}
          onClose={() => setActivePanel(null)}
          onProductSaved={handleProductSaved}
          onReload={reloadProductDetail}
        />
      )}
    </Stack>
  )
}

function ProductAssortmentFilterBar({
  isLoading,
  onRefresh,
  onReset,
  onSearchModeChange,
  onSortModeChange,
  searchMode,
  sortMode,
}: {
  isLoading: boolean
  onRefresh: () => void
  onReset: () => void
  onSearchModeChange: (mode: ProductSearchMode) => void
  onSortModeChange: (mode: ProductSortMode) => void
  searchMode: ProductSearchMode
  sortMode: ProductSortMode
}) {
  const { t } = useI18n()

  return (
    <Box className="app-filter-bar product-assortment-filter-scroll">
      <Group align="end" gap={10} wrap="nowrap" className="product-assortment-filter-row">
        <Select
          aria-label={t('Поле пошуку')}
          allowDeselect={false}
          className="product-assortment-filter-select"
          classNames={{ option: 'product-assortment-filter-option' }}
          data={SEARCH_MODE_OPTION_VALUES.map((value) => ({ label: t(SEARCH_MODE_LABELS[value]), value }))}
          label={t('Місце вводу для пошуку')}
          value={searchMode}
          onChange={(value) => onSearchModeChange((value as ProductSearchMode) || DEFAULT_SEARCH_MODE)}
        />
        <Select
          aria-label={t('Сортування')}
          allowDeselect={false}
          className="product-assortment-filter-select"
          classNames={{ option: 'product-assortment-filter-option' }}
          data={SORT_MODE_OPTION_VALUES.map((value) => ({ label: t(SORT_MODE_LABELS[value]), value }))}
          label={t('Сортувати За')}
          value={sortMode}
          onChange={(value) => onSortModeChange((value as ProductSortMode) || DEFAULT_SORT_MODE)}
        />
        <div className="app-filter-actions">
          <Tooltip label={t('Скинути')}>
            <ActionIcon aria-label={t('Скинути')} color="gray" size={34} variant="light" onClick={onReset}>
              <RotateCcw size={17} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t('Оновити')}>
            <ActionIcon aria-label={t('Оновити')} color="gray" loading={isLoading} size={34} variant="light" onClick={onRefresh}>
              <RefreshCw size={17} />
            </ActionIcon>
          </Tooltip>
        </div>
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
              onSelect={onSelectProduct}
            />
          ))
        )}
      </Box>

      <Box className="product-assortment-drum">
        {isSelectionMode && selectedProduct ? (
          <button
            type="button"
            aria-label={`${t('Скопіювати код')}: ${getProductCode(selectedProduct)}`}
            className={`product-assortment-selected ${getProductRowToneClass(selectedProduct)}`}
            title={t('Скопіювати код')}
            onClick={() => copyToClipboard(getProductCode(selectedProduct))}
          >
            <span className="product-assortment-selected-code">{getProductCode(selectedProduct)}</span>
            <span className="product-assortment-selected-name">{getProductTitle(selectedProduct)}</span>
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
      <span className="product-carousel-row-status" aria-hidden="true">
        <span className="product-carousel-row-dot" />
      </span>
      <span className="product-carousel-row-body">
        <span className="product-carousel-row-code">{getProductCode(product)}</span>
        <span className="product-carousel-row-name">{getProductTitle(product)}</span>
      </span>
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
          <Text component="span" fw={800} className="product-inline-code">{getProductCode(product)}</Text>
          <Tooltip label={getProductTitle(product)} multiline maw={420} withinPortal>
            <Text component="span" fw={650} truncate className="product-inline-name">{getProductTitle(product)}</Text>
          </Tooltip>
        </Box>
        <Group gap="xs" justify="flex-end" wrap="nowrap" className="product-inline-title-actions">
          <ProductInlineActions
            analyticsDisabled={getProductAnalyticsId(product) === null}
            disabled={isLoading}
            onOpenPanel={onOpenPanel}
          />
          <Tooltip label={t('Оновити')}>
            <ActionIcon aria-label={t('Оновити')} color="gray" loading={isLoading} variant="light" onClick={onReload}>
              <RefreshCw size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

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
          <InfoBlock danger={isCriticalProductTop(product.Top)} label="Top" value={product.Top} />
          <InfoBlock mono label="Вага" value={formatAmount(product.Weight)} />
          <InfoBlock label="Розмір" value={product.Size} />
          <InfoBlock mono label="Об'єм" value={product.Volume} />
          <InfoBlock mono label="Норма пакування" value={product.OrderStandard} />
          <InfoBlock mono label="Пакування" value={product.PackingStandard} />
          <InfoBlock mono label="Оригінальний номер" value={getProductMainOriginalNumber(product)} />
          <InfoBlock label="Синоніми UA" value={product.SynonymsUA} />
          <InfoBlock label="Група товару" value={getProductGroupNames(product)} />
          <InfoBlock label="Одиниця" value={product.MeasureUnit?.Name} />
        </Box>

        <Box className="product-inline-prices">
          <ProductPriceSourcePanel effectivePrices={prices} productNetId={product.NetUid} />
          <Divider my={8} />
          <Group gap="xs">
            <Badge className={`app-role-pill ${product.IsForZeroSale ? 'is-green' : 'is-gray'}`} variant="light">{t('Нульовий продаж')}</Badge>
            <Badge className={`app-role-pill ${product.IsForSale ? 'is-green' : 'is-gray'}`} variant="light">{t('Продаж')}</Badge>
            <Badge className={`app-role-pill ${product.IsForWeb ? 'is-green' : 'is-gray'}`} variant="light">{t('Сайт')}</Badge>
          </Group>
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
      <Button
        aria-label={t('AI-аналітика товару')}
        disabled={disabled || analyticsDisabled}
        h={38}
        leftSection={<Sparkles fill="currentColor" size={16} strokeWidth={0} />}
        px="sm"
        size="xs"
        variant="filled"
        onClick={() => onOpenPanel('analytics')}
      >
        {t('AI-аналітика')}
      </Button>
      <Tooltip label={t('Історія місця зберігання')}>
        <ActionIcon aria-label={t('Історія місця зберігання')} color="gray" size={38} variant="light" disabled={disabled} onClick={() => onOpenPanel('storage-history')}>
          <History size={18} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label={t('Специфікація')}>
        <ActionIcon aria-label={t('Специфікація')} color="gray" size={38} variant="light" disabled={disabled} onClick={() => onOpenPanel('specification')}>
          <FileText size={18} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label={t('Зображення')}>
        <ActionIcon aria-label={t('Зображення')} color="gray" size={38} variant="light" disabled={disabled} onClick={() => onOpenPanel('images')}>
          <ImageIcon size={18} />
        </ActionIcon>
      </Tooltip>
      <PermissionGate permissionKey={PRODUCT_BALANCES_PERMISSION}>
        <Tooltip label={t('Залишки по партіям')}>
          <ActionIcon aria-label={t('Залишки по партіям')} color="gray" size={38} variant="light" disabled={disabled} onClick={() => onOpenPanel('remains')}>
            <Package size={18} />
          </ActionIcon>
        </Tooltip>
      </PermissionGate>
      <PermissionGate permissionKey={PRODUCT_EDIT_PERMISSION}>
        <Tooltip label={t('Редагувати')}>
          <ActionIcon aria-label={t('Редагувати')} color="gray" size={38} variant="light" disabled={disabled} onClick={() => onOpenPanel('edit')}>
            <SquarePen size={18} />
          </ActionIcon>
        </Tooltip>
      </PermissionGate>
      <PermissionGate permissionKey={PRODUCT_MOVEMENT_PERMISSION}>
        <Tooltip label={t('Рух товару')}>
          <ActionIcon aria-label={t('Рух товару')} color="gray" size={38} variant="light" disabled={disabled} onClick={() => onOpenPanel('movement')}>
            <ArrowLeftRight size={18} />
          </ActionIcon>
        </Tooltip>
      </PermissionGate>
      <PermissionGate permissionKey={PRODUCT_WRITE_OFF_PERMISSION}>
        <Tooltip label={t('Правила списання')}>
          <ActionIcon aria-label={t('Правила списання')} color="gray" size={38} variant="light" disabled={disabled} onClick={() => onOpenPanel('writeoff')}>
            <ClipboardList size={18} />
          </ActionIcon>
        </Tooltip>
      </PermissionGate>
    </Group>
  )
}

function InfoBlock({
  danger,
  label,
  mono,
  value,
  wide,
}: {
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
      <Text c="dimmed" size="xs">{t(label)}</Text>
      {isPrimitive ? (
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
}: {
  onProductChanged: (product: Product | null) => void
  onSelectRelatedProduct: (product: Partial<Product>) => void
  product: Product
}) {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<ProductInlineTab>('numbers')

  return (
    <div className="product-inline-tabs">
      <div className="pill-tabs">
        {([
          { value: 'numbers', label: t('Оригінальні номери') },
          { value: 'analogues', label: t('Аналоги') },
          { value: 'components', label: t('Комплектуючі') },
          { value: 'income', label: t('Прихід') },
          { value: 'outcome', label: t('Розхід') },
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

  const numberColumns: DataTableColumn<ProductOriginalNumber>[] = [
    {
      id: 'number',
      header: t('Оригінальний номер'),
      minWidth: 200,
      accessor: (item) => getOriginalNumberText(item),
      cell: (item) => (
        <Text size="sm" fw={650}>
          {displayValue(getOriginalNumberText(item))}
        </Text>
      ),
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
          <Group gap={6} justify="flex-end" wrap="nowrap">
            <Tooltip label={t('Зробити основним')}>
              <ActionIcon
                aria-label={t('Зробити основним')}
                color="gray"
                disabled={Boolean(item.IsMainOriginalNumber) || isSaving}
                size="sm"
                variant="subtle"
                onClick={(event) => {
                  event.stopPropagation()
                  void makeMainOriginalNumber(item)
                }}
              >
                <Star size={15} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Видалити')}>
              <ActionIcon
                aria-label={t('Видалити')}
                color="gray"
                disabled={Boolean(item.IsMainOriginalNumber) || isSaving}
                size="sm"
                variant="subtle"
                onClick={(event) => {
                  event.stopPropagation()
                  void removeOriginalNumber(item)
                }}
              >
                <Trash2 size={15} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </PermissionGate>
      ),
    },
  ]

  return (
    <Stack gap="sm" tabIndex={0} onKeyDown={handleOriginalNumbersKeyDown}>
      {error && (
        <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
          {error}
        </Alert>
      )}

      <div className="product-original-number-toolbar">
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
        showLayoutControls={false}
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

  const relatedColumns: DataTableColumn<RelatedProductRow>[] = [
    {
      id: 'code',
      header: t('Код'),
      minWidth: 150,
      accessor: (row) => row.product.VendorCode || row.product.NetUid,
      cell: (row) => (
        <Group gap={6} wrap="nowrap" align="center">
          {type === 'components' ? (
            row.isProductSet ? (
              <BoxIcon size={15} className="product_page_iconBox" />
            ) : (
              <Settings size={15} />
            )
          ) : null}
          <Text fw={650} size="sm" lineClamp={1} c={getRelatedProductRowColor(row.product)}>
            {displayValue(row.product.VendorCode || row.product.NetUid)}
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
          <Tooltip label={t('Видалити')}>
            <ActionIcon
              aria-label={t('Видалити')}
              color="gray"
              loading={removingNetUid === row.product.NetUid}
              size="sm"
              variant="subtle"
              onClick={(event) => {
                event.stopPropagation()
                void removeRelatedProduct(row)
              }}
            >
              <Trash2 size={15} />
            </ActionIcon>
          </Tooltip>
        </PermissionGate>
      ),
    },
  ]

  return (
    <Stack gap="sm">
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
        showLayoutControls={false}
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
        <Menu position="bottom-start" shadow="md" width={260} withinPortal>
          <Menu.Target>
            <Button fullWidth variant="default" size="xs" leftSection={<ExcelIcon size={16} />} rightSection={<ChevronDown size={14} />}>
              {t('Завантаження')}
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>{t('Асортимент')}</Menu.Label>
            <Menu.Item leftSection={<Upload size={15} />} onClick={() => setProductUploadOpened(true)}>
              {t('Товари')}
            </Menu.Item>
            <Menu.Divider />
            <Menu.Label>{t('Повʼязані товари')}</Menu.Label>
            <Menu.Item leftSection={<Upload size={15} />} onClick={() => setUploadType('analogues')}>
              {t('Аналоги')}
            </Menu.Item>
            <Menu.Item leftSection={<Upload size={15} />} onClick={() => setUploadType('components')}>
              {t('Комплектуючі')}
            </Menu.Item>
            <Menu.Item leftSection={<Upload size={15} />} onClick={() => setUploadType('originalNumbers')}>
              {t('Оригінальні номери')}
            </Menu.Item>
            <Menu.Divider />
            <Menu.Label>{t('Розміщення')}</Menu.Label>
            <Menu.Item leftSection={<Upload size={15} />} onClick={() => setStorageUploadOpened(true)}>
              <Group gap="xs" justify="space-between" wrap="nowrap">
                <Text size="sm">{t('Місце зберігання')}</Text>
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
  const [isUploading, setUploading] = useState(false)
  const [isSavingReturn, setSavingReturn] = useState(false)
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

    setSavingReturn(true)
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
    <AppModal centered opened={opened} size="min(960px, 96vw)" title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Завантаження місць зберігання')}</span>} onClose={closeModal}>
      <Stack gap="md">
        {(error || storagesError) ? (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">{error || storagesError}</Alert>
        ) : null}

        {notPassedRows.length === 0 ? (
          <>
            <Card className="app-section-card" withBorder radius="md" padding="md">
              <Stack gap="md">
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
              <Stack gap="md">
                <Text className="app-section-title" fw={600} size="sm">{t('Колонки та рядки')}</Text>
                <SimpleGrid cols={{ base: 2, sm: 5 }} spacing="sm" style={{ alignItems: 'end' }}>
                  <NumberInput label={t('Початковий рядок')} min={1} value={startRow} onChange={(value) => setStartRow(Number(value) || 0)} />
                  <NumberInput label={t('Кінцевий рядок')} min={0} value={endRow} onChange={(value) => setEndRow(Number(value) || 0)} />
                  <NumberInput label={t('Колонка коду')} min={1} value={columnVendorCode} onChange={(value) => setColumnVendorCode(Number(value) || 0)} />
                  <NumberInput label={t('Колонка кількості')} min={1} value={columnQty} onChange={(value) => setColumnQty(Number(value) || 0)} />
                  <NumberInput label={t('Колонка місця')} min={1} value={columnPlacement} onChange={(value) => setColumnPlacement(Number(value) || 0)} />
                </SimpleGrid>
              </Stack>
            </Card>
            <Group justify="flex-end">
              <Button color={CREATE_ACTION_COLOR} disabled={!canUpload} leftSection={<Upload size={16} />} loading={isUploading} styles={{ label: { fontFamily: 'var(--font-mono)', letterSpacing: 0 } }} onClick={() => void uploadFile()}>
                {t('Завантажити')}
              </Button>
            </Group>
          </>
        ) : (
          <>
            <Card className="app-section-card" withBorder radius="md" padding="md">
              <Stack gap="md">
                <Text className="app-section-title" fw={600} size="sm">{t('Не пройшли позиції')}</Text>
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
              </Stack>
            </Card>
            <Group justify="flex-end">
              <Button color="gray" variant="light" disabled={isSavingReturn} styles={{ label: { fontFamily: 'var(--font-mono)', letterSpacing: 0 } }} onClick={closeModal}>
                {t('Закрити')}
              </Button>
              <Button color={CREATE_ACTION_COLOR} leftSection={<Save size={16} />} loading={isSavingReturn} styles={{ label: { fontFamily: 'var(--font-mono)', letterSpacing: 0 } }} onClick={() => void saveNotPassedRows()}>
                {t('Зберегти')}
              </Button>
            </Group>
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
  const [isUploading, setUploading] = useState(false)
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

    setUploading(true)
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
      <Stack gap="md">
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
          <Stack gap="md">
            <Text className="app-section-title" fw={600} size="sm">{t('Файл і операція')}</Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm" style={{ alignItems: 'end' }}>
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
          <Stack gap="md">
            <Text className="app-section-title" fw={600} size="sm">{t('Колонки')}</Text>
            <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="sm" style={{ alignItems: 'end' }}>
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
          </Stack>
        </Card>

        <Card className="app-section-card" withBorder radius="md" padding="md">
          <Stack gap="md">
            <Group justify="space-between">
              <Text className="app-section-title" fw={600} size="sm">{t('Ціни')}</Text>
              <Button
                disabled={pricingState.isLoading || pricingOptions.length === 0}
                leftSection={<Plus size={16} />}
                size="xs"
                styles={{ label: { fontFamily: 'var(--font-mono)', letterSpacing: 0 } }}
                variant="outline"
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
                    <Group key={priceRow.key} gap="xs" wrap="nowrap" align="flex-end">
                      <Select
                        allowDeselect={false}
                        data={pricingOptions}
                        error={isDuplicatePricing ? t('Дубль типу ціни') : undefined}
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
                          <Trash2 size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  )
                })}
              </Stack>
            ) : (
              <Text c="dimmed" size="sm">{t('Ціни не додані')}</Text>
            )}

            {hasPriceRows ? (
              <Box component="fieldset" m={0} p={0} style={{ border: 0, minWidth: 0 }}>
                <Text component="legend" fw={500} mb={6} size="sm">
                  {t('Джерело цін')} <Text component="span" c="red">*</Text>
                </Text>
                <SegmentedControl
                  fullWidth
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

        <Group justify="flex-end">
          <Button color="gray" disabled={isUploading} styles={{ label: { fontFamily: 'var(--font-mono)', letterSpacing: 0 } }} variant="light" onClick={closeModal}>
            {t('Скасувати')}
          </Button>
          <Button color={CREATE_ACTION_COLOR} leftSection={<Upload size={16} />} loading={isUploading} disabled={!canSubmit} styles={{ label: { fontFamily: 'var(--font-mono)', letterSpacing: 0 } }} onClick={() => void submitUpload()}>
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
    <AppModal centered opened={opened} title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t(labels.title)}</span>} onClose={closeModal}>
      <Stack gap="md" onKeyDown={handleUploadKeyDown}>
        {error ? (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        ) : null}

        <Card className="app-section-card" withBorder radius="md" padding="md">
          <Stack gap="md">
            <Text className="app-section-title" fw={600} size="sm">{t('Дані завантаження')}</Text>

            <FileInput
              clearable
              label={t('Файл')}
              placeholder={t('Оберіть файл')}
              value={form.file}
              onChange={(nextFile) => setField('file', nextFile)}
            />

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm" style={{ alignItems: 'end' }}>
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
          </Stack>
        </Card>

        <Group justify="flex-end">
          <Button color="gray" disabled={isUploading} styles={{ label: { fontFamily: 'var(--font-mono)', letterSpacing: 0 } }} variant="light" onClick={closeModal}>
            {t('Скасувати')}
          </Button>
          <Button color={CREATE_ACTION_COLOR} leftSection={<Upload size={16} />} loading={isUploading} disabled={!canSubmit} styles={{ label: { fontFamily: 'var(--font-mono)', letterSpacing: 0 } }} onClick={() => void submitUpload()}>
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

function ProductInlineMovementsTab({
  direction,
  product,
}: {
  direction: InlineMovementDirection
  product: Product
}) {
  const { t } = useI18n()
  const productNetUid = product.NetUid?.trim()
  // Both directions default to the last 30 days — outcome (sales) previously defaulted to
  // today-only, so the tab was almost always empty out of the box (no sales today).
  const [dateFrom, setDateFrom] = useState(() => getDateDaysAgo(30))
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

    const pendingWindow = openPendingExportDocumentWindow(t('Друк PDF'))

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

      if (document.PdfDocumentURL && openExportDocumentInWindow(pendingWindow, document.PdfDocumentURL)) {
        dispatch({ type: 'export-opened' })
        return
      }

      closePendingExportDocumentWindow(pendingWindow)
      dispatch({ document, type: 'export-success' })
    } catch (exportError) {
      closePendingExportDocumentWindow(pendingWindow)
      dispatch({
        error: exportError instanceof Error ? exportError.message : t('Не вдалося сформувати документ'),
        type: 'export-error',
      })
    }
  }

  return (
    <Stack gap="sm">
      <Group className="product-movement-toolbar" align="end" gap="sm" wrap="wrap">
        <TextInput className="product-movement-toolbar__control" label={t('З')} type="date" value={dateFrom} onChange={(event) => setDateFrom(event.currentTarget.value)} />
        <TextInput className="product-movement-toolbar__control" label={t('По')} type="date" value={dateTo} onChange={(event) => setDateTo(event.currentTarget.value)} />
        <Button className="product-movement-toolbar__button" color={CREATE_ACTION_COLOR} leftSection={<RefreshCw size={16} />} loading={state.isLoading} variant="outline" onClick={() => reload()}>
          {t('Оновити')}
        </Button>
        <Button
          className="product-movement-toolbar__button"
          color={CREATE_ACTION_COLOR}
          disabled={!productNetUid}
          leftSection={<FileDown size={16} />}
          loading={state.isExporting}
          variant="outline"
          onClick={() => void exportRows()}
        >
          {t('Друк PDF')}
        </Button>
      </Group>

      {!productNetUid ? (
        <Alert color="yellow" icon={<CircleAlert size={18} />} variant="light">
          {t('У товару немає NetUid для завантаження руху товару')}
        </Alert>
      ) : state.error ? (
        <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
          {state.error}
        </Alert>
      ) : state.exportError ? (
        <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
          {state.exportError}
        </Alert>
      ) : state.isLoading ? (
        <Stack gap={10} py={4}>
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton height={26} key={index} radius="sm" />
          ))}
        </Stack>
      ) : direction === 'income' ? (
        <ProductIncomeMovementsGrid emptyText={t(labels.empty)} isLoading={false} rows={state.rows as ProductIncomeMovement[]} />
      ) : (
        <ProductOutcomeMovementsGrid emptyText={t(labels.empty)} isLoading={false} rows={state.rows as ProductOutcomeMovement[]} />
      )}

      <ProductMovementDownloadModal
        document={state.document}
        title={t('Друк PDF')}
        onClose={() => dispatch({ type: 'export-clear' })}
      />
    </Stack>
  )
}

function ProductIncomeMovementsGrid({
  emptyText,
  isLoading,
  rows,
}: {
  emptyText: string
  isLoading: boolean
  rows: ProductIncomeMovement[]
}) {
  const { t } = useI18n()
  const columns = useMemo<DataTableColumn<ProductIncomeMovement>[]>(
    () => [
      {
        id: 'storage',
        header: t('Склад'),
        width: 110,
        accessor: (row) => row.StorageName,
        cell: (row) => renderMovementText(row.StorageName),
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
        cell: (row) => renderMovementText(row.OrganizationName),
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
        cell: (row) => renderMovementMono(row.IncomeToStorageNumber),
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
        cell: (row) => renderMovementAmount(row.ExchangeRate),
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
        header: t('Net'),
        width: 104,
        align: 'right',
        accessor: (row) => row.NetPrice,
        cell: (row) => renderMovementPrice(row.NetPrice),
      },
      {
        id: 'totalNetPrice',
        header: t('Total Net'),
        width: 118,
        align: 'right',
        accessor: (row) => row.TotalNetPrice,
        cell: (row) => renderMovementPrice(row.TotalNetPrice),
      },
      {
        id: 'grossPrice',
        header: t('Gross'),
        width: 112,
        align: 'right',
        accessor: (row) => row.GrossPrice,
        cell: (row) => renderMovementPrice(row.GrossPrice),
      },
      {
        id: 'accountingGrossPrice',
        header: t('Бух. Gross'),
        width: 124,
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
        cell: (row) => renderMovementPrice(row.ManagementEurUnitPrice),
      },
      {
        id: 'accountingEurUnitPrice',
        header: t('Бух. EUR'),
        width: 112,
        align: 'right',
        accessor: (row) => row.AccountingEurUnitPrice,
        cell: (row) => renderMovementPrice(row.AccountingEurUnitPrice),
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
        cell: (row) => renderMovementMono(row.FromInvoiceNumber),
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
    ],
    [t],
  )

  return (
    <DataTable
      columns={columns}
      data={rows}
      density="compact"
      emptyText={emptyText}
      getRowId={getIncomeMovementRowKey}
      isLoading={isLoading}
      layoutVersion="product-income-movements-1"
      maxHeight={360}
      minWidth={2500}
      showDensityToggle={false}
      showLayoutControls={false}
      tableId="product-income-movements"
    />
  )
}

function ProductOutcomeMovementsGrid({
  emptyText,
  isLoading,
  rows,
}: {
  emptyText: string
  isLoading: boolean
  rows: ProductOutcomeMovement[]
}) {
  const { t } = useI18n()
  const columns = useMemo<DataTableColumn<ProductOutcomeMovement>[]>(
    () => [
      {
        id: 'date',
        header: t('Дата'),
        width: 150,
        accessor: (row) => row.FromDate,
        cell: (row) => renderOutcomeMovementDate(row, t),
      },
      {
        id: 'documentType',
        header: t('Тип документа'),
        width: 150,
        accessor: (row) => row.DocumentTypeName,
        cell: (row) => renderMovementText(row.DocumentTypeName),
      },
      {
        id: 'storage',
        header: t('Склад'),
        width: 140,
        accessor: (row) => row.StorageName,
        cell: (row) => renderMovementText(row.StorageName),
      },
      {
        id: 'organization',
        header: t('Організація'),
        width: 160,
        accessor: (row) => row.OrganizationName,
        cell: (row) => renderMovementText(row.OrganizationName),
      },
      {
        id: 'documentNumber',
        header: t('Номер'),
        width: 140,
        accessor: (row) => row.DocumentNumber,
        cell: (row) => renderMovementMono(row.DocumentNumber),
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
        accessor: (row) => row.ResponsibleName,
        cell: (row) => renderMovementText(row.ResponsibleName),
      },
      {
        id: 'price',
        header: t('Ціна'),
        width: 110,
        align: 'right',
        accessor: (row) => row.Price,
        cell: (row) => renderMovementPrice(row.Price),
      },
      {
        id: 'qty',
        header: t('Кількість'),
        width: 110,
        align: 'right',
        accessor: (row) => row.Qty,
        cell: (row) => renderMovementAmount(row.Qty),
      },
    ],
    [t],
  )

  return (
    <DataTable
      columns={columns}
      data={rows}
      density="compact"
      emptyText={emptyText}
      fillAvailableWidth
      getRowId={getOutcomeMovementRowKey}
      isLoading={isLoading}
      layoutVersion="product-outcome-movements-1"
      maxHeight={360}
      minWidth={1300}
      showDensityToggle={false}
      showLayoutControls={false}
      tableId="product-outcome-movements"
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
    <AppModal centered opened={Boolean(document)} title={title} onClose={onClose}>
      <Stack gap="sm">
        {document?.DocumentURL || document?.PdfDocumentURL ? (
          <>
            {document.PdfDocumentURL ? (
              <Anchor href={getDocumentHref(document.PdfDocumentURL)} target="_blank" rel="noreferrer" className="document-link">
                <span className="document-link-badge document-link-badge-pdf">
                  <FileText size={22} strokeWidth={1.8} />
                </span>
                <span>{t('PDF документ')}</span>
              </Anchor>
            ) : null}
            {document.DocumentURL ? (
              <Anchor href={getDocumentHref(document.DocumentURL)} target="_blank" rel="noreferrer" className="document-link">
                <span className="document-link-badge document-link-badge-excel">
                  <ExcelIcon size={22} />
                </span>
                <span>{t('Excel документ')}</span>
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
    case 'export-opened':
      return {
        ...state,
        document: null,
        exportError: null,
        isExporting: false,
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

function inlineDetailReducer(state: InlineDetailState, action: InlineDetailAction): InlineDetailState {
  switch (action.type) {
    case 'clear':
      return {
        error: null,
        isLoading: false,
        product: null,
        reservation: {},
        reservationError: null,
      }
    case 'error':
      return {
        error: action.error,
        isLoading: false,
        product: action.product,
        reservation: {},
        reservationError: null,
      }
    case 'loading':
      return {
        ...state,
        error: null,
        isLoading: true,
        reservationError: null,
      }
    case 'saved':
      return {
        ...state,
        error: null,
        isLoading: false,
        product: action.product,
      }
    case 'success':
      return {
        error: null,
        isLoading: false,
        product: action.product,
        reservation: action.reservation,
        reservationError: action.reservationError,
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
  if (isCriticalProductTop(product.Top)) {
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

  return <span className="app-money" title={text}>{text}</span>
}

function renderMovementDate(value?: Date | string | null) {
  const text = formatInlineDateTime(value)

  return <span className="app-money" title={text}>{text}</span>
}

function renderMovementAmount(value?: number | null) {
  const text = typeof value === 'number' && Number.isFinite(value) ? formatAmount(value) : ''

  return <span className="app-money" title={text}>{text}</span>
}

function renderMovementPrice(value?: number | null) {
  const text = typeof value === 'number' && Number.isFinite(value) ? formatPrice(value) : ''

  return <span className="app-money" title={text}>{text}</span>
}

function renderMovementCurrency(value?: string | null) {
  const text = formatMovementCellValue(value)

  return text ? <Badge className="app-role-pill is-gray" variant="light">{text}</Badge> : null
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
