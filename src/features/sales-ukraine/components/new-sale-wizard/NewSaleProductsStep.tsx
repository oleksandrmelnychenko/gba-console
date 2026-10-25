import { Alert, Box, Button, Group, Select, Stack, Text } from '@mantine/core'
import { useUncontrolled } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { Search, Sparkles } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { PermissionKeys } from '../../../../shared/auth/permissionKeys'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { realtimeEvents, useRealtimeEvent } from '../../../../shared/realtime/events'
import { AppDrawer } from '../../../../shared/ui/AppDrawer'
import { TableChip } from '../../../../shared/ui/TableChip'
import { toProxiedAssetUrl } from '../../../../shared/url/proxiedAssetUrl'
import { useAuth } from '../../../auth/useAuth'
import type { Client } from '../../../clients/types'
import { ProductCardModal } from '../../../products/components/ProductCardModal'
import type { Product } from '../../../products/types'
import { getProductMainImage, getProductShopImageUrl, getRelatedProductRowColor } from '../../../products/utils'
import { ProductInterestModal } from '../../../sales-preorders'
import { getSaleLocalCurrencyCode, isNonVatEurSale } from '../../saleMoney'
import { getSaleLifecycleTypeKey } from '../../saleStatus'
import type { SalesUkraineOrderItem, SalesUkraineSale } from '../../types'
import { SaleEditDrawer } from '../SaleEditDrawer'
import { CartRowActionsModal } from './CartRowActionsModal'
import { ChangeQtyModal } from './ChangeQtyModal'
import { EditShoppingCartOverlay } from './EditShoppingCartOverlay'
import { FutureReservationModal } from './FutureReservationModal'
import { WizardProductDetailsPanel } from './WizardProductDetailsPanel'
import { WIZARD_PRODUCT_AVAILABILITY_CHIPS, getDefaultWizardProductChipIndex, getWizardProductChipRows } from './wizardProductAvailabilityModel'
import { ProductImageViewModal } from './ProductImageViewModal'
import { ProductSummaryCard } from './ProductSummaryCard'
import { ShiftOrderItemModal } from './ShiftOrderItemModal'
import { WizardCartSheet } from './WizardCartSheet'
import { WizardClientHeroHeader } from './WizardClientHeroHeader'
import { WizardConfirmModal } from './WizardConfirmModal'
import { WizardCrossSellModal } from './WizardCrossSellModal'
import { WizardProductCarousel } from './WizardProductCarousel'
import { WizardProductSummarySkeleton, WizardRelatedProductsSkeleton } from './WizardProductSkeletons'
import { WizardRelatedProductRows } from './WizardRelatedProductRows'
import { WizardRelatedProductMetrics } from './WizardRelatedProductMetrics'
import { WizardRelatedProductsFrame } from './WizardRelatedProductsFrame'
import type {
  WizardCalculatedProductPricing,
  WizardProductReservation,
} from './newSaleWizardApi'
import { useWizardCartOperations } from './useWizardCartOperations'
import { useWizardProductKeyboard } from './useWizardProductKeyboard'
import { useWizardProductAnalogues } from './useWizardProductAnalogues'
import { useWizardProductData } from './useWizardProductData'
import { useWizardProductDescription } from './useWizardProductDescription'
import { PRODUCT_SEARCH_MIN_QUERY_LENGTH, useWizardProductSearch } from './useWizardProductSearch'
import {
  WIZARD_PRODUCT_KEYBOARD_STATES,
  getPreviousProductKeyboardState,
  getWizardKeyboardState,
  setWizardKeyboardState,
  useWizardKeyboard,
  type WizardProductKeyboardState,
} from './wizardKeyboard'
import type { ExactWizardProductSearchMatch } from './wizardProductSearchSelection'
import { getWizardDetailedSellableQty } from './wizardSaleAvailability'
import {
  getComponentCarouselEntries,
  getWizardProductNumber,
  getWizardSellableQty,
  getWizardStorageQty,
  patchWizardProductAvailability,
  type WizardCarouselEntry,
  type WizardProductAvailability,
  type WizardSaleProduct,
} from './wizardSaleProduct'

const CHANGE_PRODUCT_DESCRIPTION_PERMISSION = PermissionKeys.SalesUkraine.Sale.EditProductComment
const CREATE_PREORDER_PERMISSION = PermissionKeys.SalesUkraineInterest.Preorder.Create
const CREATE_FUTURE_RESERVATION_PERMISSION = PermissionKeys.SalesUkraine.Sale.CreateFutureReservation

const SEARCH_MODE_OPTIONS = [
  { label: 'Всі', value: '5' },
  { label: 'Код виробника', value: '0' },
  { label: 'Оригінальний/Кросс номер', value: '1' },
  { label: 'Розмір', value: '2' },
  { label: 'Назва', value: '3' },
  { label: 'Опис', value: '4' },
]

const SORT_MODE_OPTIONS = [
  { label: 'Назва товару', value: '2' },
  { label: 'Топ', value: '0' },
  { label: 'Код Виробника', value: '1' },
]

type ActiveProductSource = 'main' | 'analogue' | 'component'

export function NewSaleProductsStep({
  agreementNetId,
  cartOpened,
  client,
  clientNetId,
  headerClose,
  headerTools,
  permissionFlow = 'create',
  sale,
  onBusyChange,
  onCartChanged,
  onCartOpenedChange,
  onPendingMutationChange,
  onRequestClose,
  onRestoreSplitItems,
}: {
  agreementNetId: string | null
  cartOpened?: boolean
  client?: Client | null
  clientNetId: string | null
  headerClose?: ReactNode
  headerTools?: ReactNode
  permissionFlow?: 'create' | 'edit'
  onBusyChange?: (busy: boolean) => void
  onCartChanged: () => SalesUkraineSale | null | void | Promise<SalesUkraineSale | null | void>
  onCartOpenedChange?: (opened: boolean) => void
  onPendingMutationChange?: (pending: boolean) => void
  onRequestClose?: () => void
  onRestoreSplitItems?: () => Promise<boolean>
  sale: SalesUkraineSale | null
}) {
  const { t } = useI18n()
  const [cartSheetOpen, setCartSheetOpen] = useUncontrolled({
    value: cartOpened,
    finalValue: false,
    onChange: onCartOpenedChange,
  })
  const { hasPermission } = useAuth()
  const canCreatePreorder = hasPermission(CREATE_PREORDER_PERMISSION)
  const canCreateFutureReservation = hasPermission(CREATE_FUTURE_RESERVATION_PERMISSION)
  const keyboard = useWizardKeyboard(1)

  const [crossSellProduct, setCrossSellProduct] = useState<WizardSaleProduct | null>(null)
  const [mainIndex, setMainIndex] = useState(0)
  const [active, setActive] = useState<{ product: WizardSaleProduct; source: ActiveProductSource } | null>(null)
  const [analogueIndex, setAnalogueIndex] = useState<number | null>(null)
  const [componentParent, setComponentParent] = useState<WizardSaleProduct | null>(null)
  const [componentIndex, setComponentIndex] = useState<number | null>(null)
  const [detail, setDetail] = useState<{ chipIndex: number | null; rowIndex: number | null; rowsOpen?: boolean } | null>(null)
  const [interestProduct, setInterestProduct] = useState<WizardSaleProduct | null>(null)
  const [futureProduct, setFutureProduct] = useState<WizardSaleProduct | null>(null)
  const [imagePreview, setImagePreview] = useState<{ url: string; fallbackUrl: string; name: string } | null>(null)
  const [productCardNetId, setProductCardNetId] = useState<string | null>(null)

  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const cartNetIdRef = useRef<string | undefined>(undefined)
  const onCartChangedRef = useRef(onCartChanged)

  const isVatSale = Boolean(sale?.IsVatSale)
  const activeProduct = active?.product ?? null
  const kbState = isProductKeyboardState(keyboard.state) ? keyboard.state : 'ProductSearch'
  const detailKeyboardState = kbState === 'EditProductDescription' ? getPreviousProductKeyboardState() : kbState
  const isActiveProductFullDetail =
    (active?.source === 'main' && detailKeyboardState === 'FullDetail') ||
    (active?.source === 'analogue' && detailKeyboardState === 'AnalogueFullDetail') ||
    (active?.source === 'component' && detailKeyboardState === 'ComponentFullDetail')
  const {
    dataRevision,
    getProductDetailSnapshot,
    invalidateProductData,
    productPricing,
    resetProductDetails,
    retryProductDetails,
  } = useWizardProductData({
    agreementNetId,
    productNetUid: activeProduct?.NetUid,
    saleNetUid: sale?.NetUid,
    detailsOpened: isActiveProductFullDetail,
    isVatSale,
  })
  const resetAnalogueFocus = useCallback(() => setAnalogueIndex(null), [])
  const { analogueState, analogueScopeKey, patchAnalogues, resetAnalogues, restoreCachedAnalogues } = useWizardProductAnalogues({
    agreementNetId,
    saleNetUid: sale?.NetUid,
    isVatSale,
    dataRevision,
    productNetUid: activeProduct?.NetUid,
    hasAnalogue: Boolean(activeProduct?.HasAnalogue),
    isAnalogueSource: active?.source === 'analogue',
    onResetFocus: resetAnalogueFocus,
  })
  const clearProductPricingCache = useCallback(() => {
    invalidateProductData()
    resetAnalogues()
  }, [invalidateProductData, resetAnalogues])

  const descriptionEditor = useWizardProductDescription({
    product: activeProduct,
    source: active?.source,
    onSaved: applyProductPatch,
    onBegin: () => keyboard.setState('EditProductDescription'),
    onFinish: () => {
      if (getWizardKeyboardState(1) === 'EditProductDescription') keyboard.restorePreviousProductState()
    },
  })
  const resetDescription = descriptionEditor.reset

  const resetDetail = useCallback(() => {
    setDetail(null)
    resetDescription()
  }, [resetDescription])

  const clearActiveProductData = useCallback(() => {
    setActive(null)
    resetProductDetails()
    resetAnalogues()
    setAnalogueIndex(null)
    setComponentParent(null)
    setComponentIndex(null)
    resetDetail()
  }, [resetDetail, resetProductDetails, resetAnalogues])

  const handleSearchResults = useCallback((match: ExactWizardProductSearchMatch | null) => {
    clearActiveProductData()
    setMainIndex(match?.index ?? 0)

    if (match) {
      setActive({ product: match.product, source: 'main' })
      setComponentParent(match.product)
      setWizardKeyboardState('ProductSelection')
    }
  }, [clearActiveProductData])

  const {
    cancelPendingSearch,
    clearSearch,
    handleQueryChange,
    handleSearchSettingsChange,
    isLoadingRecommendations,
    isSearching,
    loadClientRecommendations: loadRecommendations,
    loadMoreResults,
    query,
    results,
    retryProductSearch,
    searchError,
    searchMode,
    setResults,
    setSearchError,
    sortMode,
  } = useWizardProductSearch({
    agreementNetId,
    clientNetId,
    onResetSelection: clearActiveProductData,
    onResults: handleSearchResults,
  })

  const {
    acceptQtyModal,
    applyShift,
    busy,
    cancelQtyModal,
    confirmRemoveSelected,
    currentReconciliationError,
    editCart,
    editSelectedCartRow,
    exitEditCart,
    moveCartSelection,
    onEditOrderItem,
    openEditCart,
    orderItems,
    pendingMutationError,
    prepareAddToCart,
    qtyModal,
    removeConfirmOpen,
    confirmRemoveRow,
    removeRowItem,
    retryCartReconciliation,
    retryPendingCartMutation,
    setRemoveConfirmOpen,
    setRemoveRowItem,
    setShiftRow,
    shiftRow,
    toggleSplitMode,
  } = useWizardCartOperations({
    agreementNetId,
    sale,
    activeProductNetUid: activeProduct?.NetUid,
    hasSearchResults: results.length > 0,
    canCreateFutureReservation,
    keyboard,
    onBusyChange,
    onPendingMutationChange,
    onCartChanged,
    onRestoreSplitItems,
    cancelPendingSearch,
    clearProductPricingCache,
    clearSelection,
    focusSearchInput,
    onFutureReservation: setFutureProduct,
    onProductAvailabilityChanged: applyVisibleProductAvailability,
    onProductAvailabilityFailure: handleVisibleProductAvailabilityFailure,
  })
  const excludedCrossSellProductNetUids = useMemo(() => {
    const netUids = new Set<string>()

    for (const item of orderItems) {
      if (item.Product?.NetUid) {
        netUids.add(item.Product.NetUid)
      }
    }

    return netUids
  }, [orderItems])

  // Stable cart-grid handlers: the grid is React.memo'd, so its callback props
  // must keep identity across renders. onEditOrderItem is a plain body function
  // capturing fresh state each render — route the call through a ref.
  const onEditOrderItemRef = useRef<(item: SalesUkraineOrderItem) => Promise<void>>(async () => {})

  // Keep the latest cart controller callback without changing the grid handler.
  useEffect(() => {
    onEditOrderItemRef.current = onEditOrderItem
  })

  // Row click opens the §7.1 row-actions chooser (change qty / remove) instead
  // of jumping straight into the qty editor.
  const [cartActionItem, setCartActionItem] = useState<SalesUkraineOrderItem | null>(null)
  const [isActEditOpen, setActEditOpen] = useState(false)
  const handleCartRowClick = useCallback((item: SalesUkraineOrderItem) => {
    setCartActionItem(item)
  }, [setCartActionItem])
  const handleCartRowRemove = useCallback((item: SalesUkraineOrderItem) => setRemoveRowItem(item), [setRemoveRowItem])
  const handleCartCrossSell = useCallback((item: SalesUkraineOrderItem) => {
    const product = item.Product as WizardSaleProduct | undefined

    if (product?.NetUid) {
      setCrossSellProduct(product)
    }
  }, [setCrossSellProduct])
  const isSaleLifecycleNew = getSaleLifecycleTypeKey(sale?.BaseLifeCycleStatus?.SaleLifeCycleType) === '0'
  const useEurToUah = isNonVatEurSale(sale)
  const localCurrencyCode = getSaleLocalCurrencyCode(sale)
  const totalVat = getWizardProductNumber(sale?.Order?.TotalVat) ?? 0

  const componentEntries = useMemo(
    () => sortComponentCarouselEntries(getComponentCarouselEntries(componentParent), isVatSale),
    [componentParent, isVatSale],
  )
  const mainProduct = results[mainIndex] ?? null
  const focusedAnalogue = analogueIndex !== null ? analogueState.items[analogueIndex] ?? null : null
  const focusedComponent = componentIndex !== null ? componentEntries.entries[componentIndex]?.product ?? null : null

  useEffect(() => {
    setWizardKeyboardState('ProductSearch')

    return () => {
      setWizardKeyboardState('ProductSearch')
    }
  }, [])

  useEffect(() => {
    cartNetIdRef.current = sale?.NetUid
    onCartChangedRef.current = onCartChanged
  })

  const handleRealtimeSale = useCallback(
    (payload: unknown) => {
      const netId = resolveSaleNetId(payload)

      if (netId && netId === cartNetIdRef.current) {
        clearProductPricingCache()
        void onCartChangedRef.current()
      }
    },
    [clearProductPricingCache],
  )

  const handleReservationSignal = useCallback(() => {
    clearProductPricingCache()
  }, [clearProductPricingCache])

  useRealtimeEvent(realtimeEvents.saleUpdated, handleRealtimeSale)
  useRealtimeEvent(realtimeEvents.saleAdded, handleRealtimeSale)
  useRealtimeEvent(realtimeEvents.productReservationUpdated, handleReservationSignal)

  const getDisplayedAvailableQty = useCallback(
    (product: WizardSaleProduct) => {
      const snapshot = getProductDetailSnapshot(product)

      // Sellable (storage + reSale), not storage-only: the storage-only variant
      // dropped Перепродаж to 0 in the header while the list still counted it,
      // so the same product read two different quantities (bug #4).
      return getWizardDetailedSellableQty(product, isVatSale, snapshot?.availabilities)
    },
    [getProductDetailSnapshot, isVatSale],
  )

  const getProductMeta = useCallback(
    (product: WizardSaleProduct) => {
      const pricing = product.NetUid ? productPricing.get(product.NetUid) : undefined
      const available = getDisplayedAvailableQty(product)
      const price =
        pricing?.currentPrice ?? getReservationPrice(pricing?.reservation) ?? product.CurrentPrice
      const reSaleAvailable = isVatSale ? undefined : getWizardProductNumber(product.AvailableQtyUkReSale) ?? undefined
      const reSalePrice = isVatSale
        ? undefined
        : getWizardProductNumber(useEurToUah ? product.CurrentPriceReSaleEurToUah : product.CurrentPriceReSale) ?? undefined
      const reSaleCurrency = reSalePrice == null ? undefined : useEurToUah ? 'UAH' : 'EUR'

      if (available == null && price == null && reSaleAvailable == null) {
        return undefined
      }

      return { available, price, reSaleAvailable, reSaleCurrency, reSalePrice }
    },
    [getDisplayedAvailableQty, productPricing, isVatSale, useEurToUah],
  )

  function applyVisibleProductAvailability(productNetUid: string, availability: WizardProductAvailability) {
    const patchProduct = (product: WizardSaleProduct) =>
      patchWizardProductAvailability(product, productNetUid, availability)

    patchAnalogues(patchProduct)
    setResults((previous) => previous.map(patchProduct))
    setActive((previous) => (previous ? { ...previous, product: patchProduct(previous.product) } : previous))
    setComponentParent((previous) => (previous ? patchProduct(previous) : previous))
    setCrossSellProduct((previous) => (previous ? patchProduct(previous) : previous))
    setInterestProduct((previous) => (previous ? patchProduct(previous) : previous))
    setFutureProduct((previous) => (previous ? patchProduct(previous) : previous))
    invalidateProductData()
    setSearchError(null)
  }

  function handleVisibleProductAvailabilityFailure(message: string) {
    setResults([])
    clearActiveProductData()
    setSearchError(message)
    cancelPendingSearch()
    keyboard.setState('ProductSearch')
    focusSearchInput()
    notifications.show({ color: 'red', message })
  }

  function focusSearchInput() {
    if (!cartSheetOpen) searchInputRef.current?.focus({ preventScroll: true })
  }

  function focusMainProduct(product: WizardSaleProduct) {
    setActive({ product, source: 'main' })
    restoreCachedAnalogues(product)
    setComponentParent(product)
    setComponentIndex(null)
    setAnalogueIndex(null)
  }

  function focusMain(index: number, options?: { keepDetail?: boolean }) {
    const product = results[index]

    if (!product) {
      return
    }

    setMainIndex(index)
    focusMainProduct(product)

    if (options?.keepDetail) {
      setDetail((previous) => ({ chipIndex: previous?.chipIndex ?? null, rowIndex: null }))
    } else {
      resetDetail()
    }

    if (index >= results.length - 1) {
      void loadMoreResults()
    }
  }

  function focusAnalogue(index: number, options?: { keepDetail?: boolean }) {
    if (analogueState.scopeKey !== analogueScopeKey) return
    const product = analogueState.items[index]

    if (!product) {
      return
    }

    setAnalogueIndex(index)
    setActive({ product, source: 'analogue' })

    if (options?.keepDetail) {
      setDetail((previous) => ({ chipIndex: previous?.chipIndex ?? null, rowIndex: null }))
    } else {
      resetDetail()
    }
  }

  function focusComponent(index: number, options?: { keepDetail?: boolean }) {
    const entry = componentEntries.entries[index]

    if (!entry) {
      return
    }

    setComponentIndex(index)
    setActive({ product: entry.product, source: 'component' })
    restoreCachedAnalogues(entry.product)

    if (options?.keepDetail) {
      setDetail((previous) => ({ chipIndex: previous?.chipIndex ?? null, rowIndex: null }))
    } else {
      resetDetail()
    }
  }

  async function loadClientRecommendations() {
    if (await loadRecommendations()) {
      focusSearchInput()
    }
  }

  function openImage(product: WizardSaleProduct | null) {
    const imageUrl = product ? (getProductMainImage(product as Product)?.ImageUrl || product.Image || getProductShopImageUrl(product)) : null

    if (!imageUrl) {
      return
    }

    setImagePreview({
      url: toProxiedAssetUrl(imageUrl) || imageUrl,
      fallbackUrl: getProductShopImageUrl(product),
      name: product?.NameUA || product?.Name || t('Без назви'),
    })
    keyboard.setState('ViewImage')
  }

  function closeImage() {
    setImagePreview(null)
    keyboard.restorePreviousProductState()
  }

  function openInterest(product: WizardSaleProduct | null) {
    if (!canCreatePreorder || !product?.NetUid || !agreementNetId) {
      return
    }

    setInterestProduct(product)
    keyboard.setState('Interest')
  }

  function closeInterest() {
    setInterestProduct(null)
    keyboard.restorePreviousProductState()
  }

  function applyProductPatch(updated: WizardSaleProduct) {
    patchAnalogues((item) => item.NetUid === updated.NetUid ? { ...item, Description: updated.Description } : item)
    setActive((previous) => previous && previous.product.NetUid === updated.NetUid
      ? { ...previous, product: { ...previous.product, Description: updated.Description } } : previous)
    setResults((previous) => previous.map((item) => (item.NetUid === updated.NetUid ? { ...item, Description: updated.Description } : item)))
  }

  function clearSelection() {
    clearSearch()
    keyboard.setState('ProductSearch')
    focusSearchInput()
  }

  function spaceFromMain() {
    const product = mainProduct

    if (!product) {
      return
    }

    if (product.HasAnalogue && analogueState.items.length > 0 && analogueState.parentNetUid === product.NetUid) {
      resetDetail()
      keyboard.setState('AnalogueSelection')
      focusAnalogue(0)

      return
    }

    if (product.HasComponent || componentEntries.entries.length > 0) {
      resetDetail()
      keyboard.setState('ComponentSelection')
      focusComponent(0)
    }
  }

  function openMainFullDetail(): boolean {
    const product = active?.source === 'main' && activeProduct ? activeProduct : mainProduct

    if (!product) {
      return false
    }

    const productIndex = results.findIndex((item) => {
      if (product.NetUid && item.NetUid) {
        return item.NetUid === product.NetUid
      }

      return item === product
    })

    if (productIndex >= 0) {
      setMainIndex(productIndex)
    }

    focusMainProduct(product)
    setDetail({ chipIndex: getDefaultWizardProductChipIndex(isVatSale), rowIndex: null })
    keyboard.setState('FullDetail')

    return true
  }

  function closeProductDetails() {
    resetDetail()
    keyboard.setState(active?.source === 'analogue' ? 'AnalogueSelection' : active?.source === 'component' ? 'ComponentSelection' : 'ProductSelection')
  }

  function escapeFromAnalogues() {
    resetDetail()
    setAnalogueIndex(null)

    if (componentEntries.entries.length > 0) {
      if (componentIndex !== null) {
        const entry = componentEntries.entries[componentIndex]

        if (entry) {
          setActive({ product: entry.product, source: 'component' })
        }
      }

      keyboard.setState('ComponentSelection')

      return
    }

    if (mainProduct) {
      setActive({ product: mainProduct, source: 'main' })
    }

    keyboard.setState('ProductSelection')
  }

  function cycleChips(direction: 1 | -1, chipCount: number) {
    setDetail((previous) => {
      if (!previous) {
        return previous
      }

      const current = previous.chipIndex
      const next = current === null ? (direction === -1 ? 0 : chipCount - 1) : (current + direction + chipCount) % chipCount

      return { chipIndex: next, rowIndex: null }
    })
  }

  function navigateChipRows(direction: 1 | -1, rowCount: number) {
    if (rowCount === 0) {
      return
    }

    setDetail((previous) => {
      if (!previous) {
        return previous
      }

      const current = previous.rowIndex
      const next = current === null ? (direction === 1 ? 0 : rowCount - 1) : (current + direction + rowCount) % rowCount

      return { ...previous, rowIndex: next }
    })
  }

  const { handleProductDetailsKeyDown } = useWizardProductKeyboard({
    containerRef, searchInputRef,
    blockingOverlay: Boolean(qtyModal || shiftRow || futureProduct || removeConfirmOpen || removeRowItem || cartActionItem || isActEditOpen),
    cartSheetOpen, crossSellOpen: Boolean(crossSellProduct), productCardOpen: Boolean(productCardNetId),
    setCartSheetOpen, closeProductDetails,
    navigation: {
      state: kbState,
      isMainActive: active?.source === 'main',
      main: { count: results.length, index: mainIndex, product: activeProduct, focus: focusMain },
      analogue: { count: analogueState.items.length, index: analogueIndex, product: focusedAnalogue,
        parentNetUid: analogueState.parentNetUid, focus: focusAnalogue, escape: escapeFromAnalogues },
      component: { count: componentEntries.entries.length, index: componentIndex, product: focusedComponent, focus: focusComponent },
      details: {
        chipIndex: detail?.chipIndex ?? null, rowIndex: detail?.rowIndex ?? null, chipCount: WIZARD_PRODUCT_AVAILABILITY_CHIPS.length,
        rowsFor: (product) => detail?.chipIndex != null
          ? getWizardProductChipRows(getProductDetailSnapshot(product)?.availabilities, detail.chipIndex) : [],
        cycle: cycleChips, navigate: navigateChipRows, reset: resetDetail, select: setDetail, shift: setShiftRow,
      },
      cart: { hasSelection: Boolean(editCart?.selected), open: openEditCart, move: moveCartSelection,
        edit: editSelectedCartRow, toggleSplit: toggleSplitMode, remove: () => setRemoveConfirmOpen(true), exit: exitEditCart },
      actions: {
        setState: keyboard.setState, add: prepareAddToCart, openMainDetail: openMainFullDetail, openMainRelated: spaceFromMain,
        clearSelection, openImage, openInterest, closeImage, closeInterest, toggleDescription: descriptionEditor.toggle,
        requestClose: onRequestClose,
        returnToMain: () => {
          resetDetail()
          if (mainProduct) setActive({ product: mainProduct, source: 'main' })
          keyboard.setState('ProductSelection')
        },
      },
    },
  })

  // Overlay states must not change the layout underneath them. In particular,
  // Ctrl+B used to remove `is-search-centered` while the interest modal was
  // opening, which made the left product carousel jump below its filter block.
  const visualProductState = kbState === 'ViewImage' || kbState === 'Interest' || kbState === 'EditProductDescription'
    ? getPreviousProductKeyboardState()
    : kbState
  const mainStatesActive = visualProductState === 'ProductSearch' || visualProductState === 'ProductSelection' || visualProductState === 'FullDetail'
  const analogueStatesActive = visualProductState === 'AnalogueSelection' || visualProductState === 'AnalogueFullDetail'
  const componentStatesActive = visualProductState === 'ComponentSelection' || visualProductState === 'ComponentFullDetail'
  const keepMainPickerCentered = visualProductState === 'ProductSearch' || visualProductState === 'ProductSelection' || visualProductState === 'FullDetail'
  const componentProducts = useMemo(() => componentEntries.entries.map(entry => entry.product), [componentEntries])
  const setQtyByNetUid = useMemo(() => {
    const quantities = new Map<string, number>()
    componentEntries.entries.forEach(entry => {
      if (entry.product.NetUid && entry.setQty != null) quantities.set(entry.product.NetUid, entry.setQty)
    })
    return quantities
  }, [componentEntries])

  const detailPricingFor = (product: WizardSaleProduct | null): WizardCalculatedProductPricing | null => {
    const snapshot = product?.NetUid ? productPricing.get(product.NetUid) : undefined

    return snapshot?.calculatedPricings[0] ?? null
  }

  const canEditMainDescription = hasPermission(CHANGE_PRODUCT_DESCRIPTION_PERMISSION)

  const renderAnalogueMetrics = useCallback((product: WizardSaleProduct) => (
    <WizardRelatedProductMetrics product={product} isVatSale={isVatSale} localCurrencyCode={localCurrencyCode} />
  ), [isVatSale, localCurrencyCode])
  const renderComponentMetrics = useCallback((product: WizardSaleProduct) => (
    <WizardRelatedProductMetrics product={product} isVatSale={isVatSale} localCurrencyCode={localCurrencyCode}
      setQty={product.NetUid ? setQtyByNetUid.get(product.NetUid) : undefined} />
  ), [isVatSale, localCurrencyCode, setQtyByNetUid])

  // Keep the complete summary pinned; detailed sections live in a separate work window.
  const selectedMainProduct = mainProduct ? (active?.source === 'main' && activeProduct ? activeProduct : mainProduct) : null
  const isMainFullDetail = detailKeyboardState === 'FullDetail' && active?.source === 'main'
  const detailProduct = isMainFullDetail
    ? selectedMainProduct
    : detailKeyboardState === 'AnalogueFullDetail'
      ? focusedAnalogue
      : detailKeyboardState === 'ComponentFullDetail'
        ? focusedComponent
        : null
  const detailSource: ActiveProductSource = detailKeyboardState === 'AnalogueFullDetail' ? 'analogue'
    : detailKeyboardState === 'ComponentFullDetail' ? 'component' : 'main'
  const selectedDetailChipIndex = detail?.chipIndex ?? getDefaultWizardProductChipIndex(isVatSale)
  // The summary stays unchanged while stock selection, overlays or cart state move.
  // Stable callbacks still dispatch to the current product and keyboard state.
  const summaryActionsRef = useRef({ openMainFullDetail, openImage, selectedMainProduct, detailProduct })
  useLayoutEffect(() => {
    summaryActionsRef.current = { openMainFullDetail, openImage, selectedMainProduct, detailProduct }
  })
  const handleOpenSummaryDetails = useCallback(() => { summaryActionsRef.current.openMainFullDetail() }, [])
  const handleOpenSummaryImage = useCallback(() => {
    const actions = summaryActionsRef.current
    actions.openImage(actions.selectedMainProduct)
  }, [])
  const handleOpenDetailImage = useCallback(() => {
    const actions = summaryActionsRef.current
    actions.openImage(actions.detailProduct)
  }, [])
  const selectedMainProductSummary = selectedMainProduct ? (
    <ProductSummaryCard
      currentPriceEur={getWizardProductNumber(getProductMeta(selectedMainProduct)?.price)}
      detailsExpanded={isMainFullDetail}
      displayQty={getDisplayedAvailableQty(selectedMainProduct) ?? 0}
      localCurrencyCode={localCurrencyCode}
      pricing={detailPricingFor(selectedMainProduct)}
      product={selectedMainProduct}
      onOpenDetails={handleOpenSummaryDetails}
      onOpenImage={handleOpenSummaryImage}
    />
  ) : null
  const isSearchPristine = query.trim().length < PRODUCT_SEARCH_MIN_QUERY_LENGTH
  const showProductSearchEmpty = !searchError && !selectedMainProduct && orderItems.length === 0 && !isSearching && results.length === 0
  const productSearchEmptyTitle = isSearchPristine ? t('Пошук товару ще не виконаний') : t('Товарів не знайдено')
  const productSearchEmptyDescription = isSearchPristine
    ? t('Введіть мінімум 3 символи у пошуку, щоб побачити доступні товари.')
    : t('Змініть запит або поле пошуку, щоб знайти потрібний товар.')
  const isAnalogueLoading = isSearching || Boolean(
    activeProduct?.HasAnalogue
    && active?.source !== 'analogue'
    && (analogueState.parentNetUid !== activeProduct.NetUid || analogueState.scopeKey !== analogueScopeKey),
  )
  const isComponentLoading = isSearching
  const hasAnalogueRows = Boolean(selectedMainProduct && analogueState.scopeKey === analogueScopeKey && analogueState.items.length > 0 && (
    active?.source === 'analogue' || analogueState.parentNetUid === activeProduct?.NetUid
  ))
  const hasComponentRows = Boolean(selectedMainProduct && componentEntries.entries.length > 0)
  const analoguePanel = (
    <Stack className="new-sale-products-step__related-panel" gap={7}>
      <Group className="new-sale-products-step__related-head" justify="space-between" wrap="nowrap">
        <Text className="new-sale-products-step__related-title">{t('Аналоги')}</Text>
        <TableChip value={isAnalogueLoading ? '…' : hasAnalogueRows ? analogueState.items.length : 0} tone="neutral" />
      </Group>
      <Box aria-busy={isAnalogueLoading} className={`new-sale-products-step__related-scroll ${hasAnalogueRows || isAnalogueLoading ? '' : 'is-empty'}`}>
        {isAnalogueLoading ? <WizardRelatedProductsSkeleton /> : hasAnalogueRows ? (
          <WizardRelatedProductRows
            active={analogueStatesActive}
            focusedIndex={analogueIndex ?? -1}
            getItemColor={getRelatedProductRowColor}
            products={analogueState.items}
            renderExtra={renderAnalogueMetrics}
            onOpenCard={setProductCardNetId}
            onOpenImage={openImage}
            onProductInterest={canCreatePreorder && agreementNetId ? (product) => openInterest(product) : undefined}
            onPick={(index) => {
              focusAnalogue(index)

              if (!analogueStatesActive) {
                keyboard.setState('AnalogueSelection')
              }

              focusSearchInput()
            }}
          />
        ) : (
          <Box className="new-sale-products-step__related-empty">{t('Аналогів не знайдено')}</Box>
        )}
      </Box>
    </Stack>
  )
  const componentPanel = (
    <Stack className="new-sale-products-step__related-panel new-sale-products-step__component-panel" gap={7}>
      <Group className="new-sale-products-step__related-head" justify="space-between" wrap="nowrap">
        <Text className="new-sale-products-step__related-title">{t('Комплектуючі')}</Text>
        <TableChip value={isComponentLoading ? '…' : componentEntries.entries.length} tone="neutral" />
      </Group>
      <Box aria-busy={isComponentLoading} className={`new-sale-products-step__related-scroll ${hasComponentRows || isComponentLoading ? '' : 'is-empty'}`}>
        {isComponentLoading ? <WizardRelatedProductsSkeleton /> : hasComponentRows ? (
          <WizardRelatedProductRows
            active={componentStatesActive}
            focusedIndex={componentIndex ?? -1}
            getItemColor={getRelatedProductRowColor}
            products={componentProducts}
            renderExtra={renderComponentMetrics}
            onOpenCard={setProductCardNetId}
            onOpenImage={openImage}
            onProductInterest={canCreatePreorder && agreementNetId ? (product) => openInterest(product) : undefined}
            onPick={(index) => {
              focusComponent(index)

              if (!componentStatesActive) {
                keyboard.setState('ComponentSelection')
              }

              focusSearchInput()
            }}
          />
        ) : (
          <Box className="new-sale-products-step__related-empty">{t('Комплектуючих не знайдено')}</Box>
        )}
      </Box>
    </Stack>
  )
  const relatedGridPanel = (
    <WizardRelatedProductsFrame loading={isAnalogueLoading || isComponentLoading} scopeKey={analogueScopeKey}>
      {analoguePanel}
      {componentPanel}
    </WizardRelatedProductsFrame>
  )

  return (
    <Box ref={containerRef} className="new-sale-products-step">
      <WizardClientHeroHeader
        activeAgreementNetId={agreementNetId}
        client={client}
        clientNetId={clientNetId}
        headerClose={headerClose}
        headerTools={headerTools}
        permissionFlow={permissionFlow}
      />
      {pendingMutationError ? (
        <Alert color="orange" title={t('Результат операції потребує перевірки')}>
          <Group align="center" justify="space-between" wrap="nowrap">
            <Text size="sm">{pendingMutationError}</Text>
            <Button loading={busy} size="xs" variant="light" onClick={() => void retryPendingCartMutation()}>
              {t('Перевірити та повторити')}
            </Button>
          </Group>
        </Alert>
      ) : currentReconciliationError ? (
        <Alert color="orange" title={t('Кошик потребує оновлення')}>
          <Group align="center" justify="space-between" wrap="nowrap">
            <Text size="sm">{currentReconciliationError}</Text>
            <Button loading={busy} size="xs" variant="light" onClick={() => void retryCartReconciliation()}>
              {t('Повторити')}
            </Button>
          </Group>
        </Alert>
      ) : null}
      <Box className="new-sale-products-step__body">
        {/* LEFT: search controls + vertical product carousel (mirrors the client step layout) */}
        <Box className="new-sale-products-step__picker-rail">
          <Stack className="new-sale-products-step__search-controls" gap={8}>
            <Group align="flex-end" gap={8} grow wrap="nowrap">
              <Select
                allowDeselect={false}
                classNames={{
                  input: 'new-sale-products-step__search-select-input',
                  label: 'new-sale-products-step__search-select-label',
                  option: 'new-sale-products-step__search-select-option',
                }}
                data={SEARCH_MODE_OPTIONS.map((option) => ({ label: t(option.label), value: option.value }))}
                label={t('Шукати за')}
                value={searchMode}
                onChange={(value) => handleSearchSettingsChange(value, null)}
              />
              <Select
                allowDeselect={false}
                classNames={{
                  input: 'new-sale-products-step__search-select-input',
                  label: 'new-sale-products-step__search-select-label',
                  option: 'new-sale-products-step__search-select-option',
                }}
                data={SORT_MODE_OPTIONS.map((option) => ({ label: t(option.label), value: option.value }))}
                label={t('Сортування')}
                value={sortMode}
                onChange={(value) => handleSearchSettingsChange(null, value)}
              />
            </Group>
            <Button
              className="new-sale-products-step__recommendations-btn"
              disabled={!clientNetId}
              fullWidth
              leftSection={<Sparkles size={14} />}
              loading={isLoadingRecommendations}
              size="xs"
              variant="default"
              onClick={() => void loadClientRecommendations()}
            >
              {t('Рекомендації для клієнта')}
            </Button>
          </Stack>

          <Box
            className={`new-sale-products-step__picker-carousel ${keepMainPickerCentered ? 'is-search-centered' : ''} ${isSearchPristine && !selectedMainProduct && results.length === 0 ? 'is-empty' : ''}`}
          >
            <WizardProductCarousel
              active={mainStatesActive}
              focusedIndex={mainIndex}
              getItemColor={getRelatedProductRowColor}
              getItemQty={(product) => getWizardSellableQty(product, isVatSale)}
              // Keep the selected main product pinned on the left while drilling into its
              // analogues/components (active.source switches to 'analogue'/'component'); otherwise
              // the carousel reverts to the search list and the chosen product visually drops out.
              hasFocus={kbState !== 'ProductSearch' && Boolean(mainProduct)}
              isLoading={isSearching}
              products={results}
              searchInputRef={searchInputRef}
              searchMode={kbState === 'ProductSearch'}
              searchValue={query}
              searchContextKey={JSON.stringify([clientNetId, agreementNetId, sale?.NetUid])}
              onPick={(index) => {
                focusMain(index)

                if (kbState === 'ProductSearch') {
                  keyboard.setState('ProductSelection')
                }

                // Clicking a result row blurs the search input → keyboard events stop
                // bubbling to the wizard root, so Enter could no longer add to the cart. Restore it.
                focusSearchInput()
              }}
              onSearchChange={handleQueryChange}
            />
          </Box>

        </Box>

        {/* RIGHT: related products and the summary stay above the pinned cart */}
        <Box className="new-sale-products-step__workspace">
          <Box className="new-sale-products-step__main-column">
            {searchError && !isSearching && (
              <Alert color="red" title={t('Не вдалося виконати пошук товарів')} variant="light">
                <Group align="center" justify="space-between" wrap="nowrap">
                  <Text size="sm">{searchError}</Text>
                  <Button
                    color="red"
                    size="xs"
                    variant="light"
                    onClick={() => {
                      if (query.trim().length >= PRODUCT_SEARCH_MIN_QUERY_LENGTH) {
                        retryProductSearch()
                      } else {
                        void loadClientRecommendations()
                      }
                    }}
                  >
                    {t('Повторити')}
                  </Button>
                </Group>
              </Alert>
            )}
            {showProductSearchEmpty ? (
              <Stack align="center" className="new-sale-client-empty new-sale-products-step-empty" gap={10} justify="center">
                <span className="new-sale-client-empty__icon">
                  <Search size={30} strokeWidth={1.55} />
                </span>
                <Stack align="center" gap={3}>
                  <Text className="new-sale-client-empty__title">{productSearchEmptyTitle}</Text>
                  <Text className="new-sale-client-empty__description">
                    {productSearchEmptyDescription}
                  </Text>
                </Stack>
              </Stack>
            ) : (
              <>
                {relatedGridPanel}
                {(selectedMainProductSummary || isSearching) && (
                  <Box className="new-sale-products-step__selected-slot">
                    {isSearching ? <WizardProductSummarySkeleton /> : selectedMainProductSummary}
                  </Box>
                )}


              </>
            )}
          </Box>
          <WizardCartSheet
            busy={busy}
            items={orderItems}
            localCurrencyCode={localCurrencyCode}
            opened={cartSheetOpen}
            overlayActive={Boolean(cartActionItem || qtyModal || removeRowItem || removeConfirmOpen || isActEditOpen || crossSellProduct || shiftRow || futureProduct || productCardNetId || imagePreview)}
            totalVat={isVatSale ? totalVat : undefined}
            useEurToUah={useEurToUah}
            onClose={() => setCartSheetOpen(false)}
            onCrossSell={clientNetId ? handleCartCrossSell : undefined}
            onEditCart={openEditCart}
            onOpen={() => setCartSheetOpen(true)}
            onRemove={isSaleLifecycleNew ? handleCartRowRemove : undefined}
            onRowClick={handleCartRowClick}
          />
        </Box>
      </Box>

      <AppDrawer
        className="new-sale-product-details-drawer"
        closeButtonProps={{ 'aria-label': t('Закрити деталі товару') }}
        closeOnEscape={false}
        opened={Boolean(detailProduct)}
        size="standard"
        title={t('Деталі товару')}
        onClose={closeProductDetails}
        onKeyDown={handleProductDetailsKeyDown}
      >
        <Stack gap="md">
          {detailProduct && (
            <WizardProductDetailsPanel
              canEditDescription={detailSource !== 'main' || canEditMainDescription}
              currentPriceEur={detailSource === 'main' ? getWizardProductNumber(getProductMeta(detailProduct)?.price) : undefined}
              descriptionDraft={descriptionEditor.draft}
              descriptionError={descriptionEditor.error}
              isSavingDescription={descriptionEditor.isSaving}
              isEditingDescription={descriptionEditor.isEditing && active?.source === detailSource}
              isVatSale={isVatSale}
              localCurrencyCode={localCurrencyCode}
              clientAgreementNetId={agreementNetId}
              pricing={detailPricingFor(detailProduct)}
              product={detailProduct}
              snapshot={getProductDetailSnapshot(detailProduct)}
              selectedChipIndex={selectedDetailChipIndex}
              selectedRowIndex={detail?.rowIndex ?? null}
              onDescriptionDraftChange={descriptionEditor.changeDraft}
              onOpenImage={handleOpenDetailImage}
              onRetryDetails={retryProductDetails}
              onSelectChip={(chipIndex) => setDetail({ chipIndex, rowIndex: null })}
              onToggleDescription={descriptionEditor.toggle}
            />
          )}
        </Stack>
      </AppDrawer>

      <WizardCrossSellModal
        zIndex={cartSheetOpen ? 220 : undefined}
        agreementNetId={agreementNetId}
        clientNetId={clientNetId}
        excludeNetUids={excludedCrossSellProductNetUids}
        isVatSale={isVatSale}
        localCurrencyCode={localCurrencyCode}
        opened={crossSellProduct !== null}
        seedProduct={crossSellProduct}
        useEurToUah={useEurToUah}
        onClose={() => setCrossSellProduct(null)}
        onPick={(product) => {
          setCrossSellProduct(null)
          void prepareAddToCart(product)
        }}
      />

      {editCart && (
        <EditShoppingCartOverlay
          busy={busy}
          currentItems={orderItems}
          isSplit={editCart.isSplit}
          onClose={() => void exitEditCart()}
          selected={editCart.selected}
          splitItems={editCart.splitItems}
        />
      )}

      <CartRowActionsModal
        isInvoice={!isSaleLifecycleNew}
        item={cartActionItem}
        zIndex={cartSheetOpen ? 220 : undefined}
        onActEdit={() => {
          setCartActionItem(null)
          setActEditOpen(true)
        }}
        onChangeQty={(item) => {
          setCartActionItem(null)
          void onEditOrderItemRef.current(item)
        }}
        onClose={() => setCartActionItem(null)}
        onRemove={(item) => {
          setCartActionItem(null)
          handleCartRowRemove(item)
        }}
      />

      {/* «Накладна» is editable only through the edit act — the popup routes here. */}
      <SaleEditDrawer
        zIndex={cartSheetOpen ? 220 : undefined}
        sale={isActEditOpen ? sale : null}
        onClose={() => setActEditOpen(false)}
        onSaved={() => {
          setActEditOpen(false)
          void onCartChanged()
        }}
      />

      <ChangeQtyModal
        zIndex={cartSheetOpen ? 220 : undefined}
        availableQty={qtyModal?.available ?? 0}
        busy={busy}
        initialComment={qtyModal?.item.Comment ?? ''}
        initialQty={getWizardProductNumber(qtyModal?.item.Qty) ?? 0}
        opened={Boolean(qtyModal)}
        sessionKey={`${qtyModal?.kind}:${qtyModal?.item.NetUid ?? qtyModal?.item.Id}:${qtyModal?.item.Product?.NetUid}`}
        onAccept={acceptQtyModal}
        onCancel={cancelQtyModal}
      />

      <ShiftOrderItemModal
        zIndex={cartSheetOpen ? 220 : undefined}
        amount={getWizardProductNumber(shiftRow?.Amount) ?? 0}
        analyst={shiftRow?.OrderItem?.User?.LastName ?? ''}
        busy={busy}
        opened={Boolean(shiftRow)}
        sessionKey={`${shiftRow?.NetId}:${shiftRow?.OrderItem?.NetUid ?? shiftRow?.OrderItem?.Id}`}
        regionCode={shiftRow?.RegionCode ?? ''}
        sourceName={shiftRow?.Name ?? ''}
        onApply={applyShift}
        onCancel={() => {
          setShiftRow(null)
          focusSearchInput()
        }}
      />

      <ProductImageViewModal
        fallbackSrc={imagePreview?.fallbackUrl || undefined}
        imageName={imagePreview?.name}
        imageUrl={imagePreview?.url ?? null}
        onClose={closeImage}
        onEditCart={() => {
          closeImage()
          openEditCart()
        }}
      />

      <WizardConfirmModal
        zIndex={cartSheetOpen ? 220 : undefined}
        busy={busy}
        message={t('Видалити позицію з рахунку?')}
        opened={removeConfirmOpen}
        onCancel={() => setRemoveConfirmOpen(false)}
        onConfirm={confirmRemoveSelected}
      />

      <WizardConfirmModal
        zIndex={cartSheetOpen ? 220 : undefined}
        busy={busy}
        message={t('Видалити позицію з рахунку?')}
        opened={Boolean(removeRowItem)}
        sessionKey={String(removeRowItem?.NetUid ?? removeRowItem?.Id ?? '')}
        onCancel={() => {
          setRemoveRowItem(null)
          focusSearchInput()
        }}
        onConfirm={confirmRemoveRow}
      />

      <ProductCardModal productNetId={productCardNetId} onClose={() => setProductCardNetId(null)} />

      <ProductInterestModal
        clientAgreementNetId={agreementNetId ?? ''}
        opened={Boolean(canCreatePreorder && interestProduct?.NetUid && agreementNetId)}
        productNetId={interestProduct?.NetUid ?? ''}
        onClose={closeInterest}
        onCreated={closeInterest}
      />

      <FutureReservationModal
        clientNetId={clientNetId}
        product={canCreateFutureReservation ? futureProduct : null}
        onClose={() => {
          setFutureProduct(null)
          focusSearchInput()
        }}
        onReserved={() => {
          setFutureProduct(null)
          focusSearchInput()
          void onCartChanged()
        }}
      />
    </Box>
  )
}

function isProductKeyboardState(state: string): state is WizardProductKeyboardState {
  return (WIZARD_PRODUCT_KEYBOARD_STATES as readonly string[]).includes(state)
}

function resolveSaleNetId(payload: unknown): string | undefined {
  let value = payload

  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return undefined
    }
  }

  if (!value || typeof value !== 'object') {
    return undefined
  }

  const record = value as Record<string, unknown>
  const sale = (record.Sale && typeof record.Sale === 'object' ? record.Sale : record) as Record<string, unknown>
  const netId = sale.NetUid

  return typeof netId === 'string' ? netId : undefined
}

function getReservationPrice(reservation?: WizardProductReservation): number | undefined {
  return reservation?.Price ?? reservation?.PricePerItem
}

function getAvailabilitySortKey(product: WizardSaleProduct, isVatSale: boolean): number {
  return getWizardStorageQty(product, isVatSale) ?? 0
}

function sortComponentCarouselEntries(
  source: { entries: WizardCarouselEntry[]; isBaseSet: boolean },
  isVatSale: boolean,
): { entries: WizardCarouselEntry[]; isBaseSet: boolean } {
  if (source.entries.length <= 1) {
    return source
  }

  const byAvailabilityAsc = (a: WizardCarouselEntry, b: WizardCarouselEntry) =>
    getAvailabilitySortKey(a.product, isVatSale) - getAvailabilitySortKey(b.product, isVatSale)
  const items = [...source.entries]
  const top = items.splice(0, Math.ceil(items.length / 2)).sort(byAvailabilityAsc)
  const bottom = items.sort(byAvailabilityAsc)

  return { ...source, entries: [...top, ...bottom] }
}
