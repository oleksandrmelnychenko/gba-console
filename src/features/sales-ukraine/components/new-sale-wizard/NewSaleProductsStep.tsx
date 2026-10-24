import { Alert, Box, Button, Group, Select, Stack, Text } from '@mantine/core'
import { useUncontrolled } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { FileSignature, Hash, Search, Sparkles, Trash2 } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { PermissionKeys } from '../../../../shared/auth/permissionKeys'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { realtimeEvents, useRealtimeEvent } from '../../../../shared/realtime/events'
import { AppDrawer } from '../../../../shared/ui/AppDrawer'
import { AppModal } from '../../../../shared/ui/AppModal'
import { TableChip } from '../../../../shared/ui/TableChip'
import { toProxiedAssetUrl } from '../../../../shared/url/proxiedAssetUrl'
import { useAuth } from '../../../auth/useAuth'
import type { Client } from '../../../clients/types'
import { updateProduct } from '../../../products/api/productsApi'
import { ProductCardModal } from '../../../products/components/ProductCardModal'
import type { Product } from '../../../products/types'
import { getProductMainImage, getProductShopImageUrl, getRelatedProductRowColor } from '../../../products/utils'
import { ProductInterestModal } from '../../../sales-preorders'
import { getSaleLocalCurrencyCode, isNonVatEurSale } from '../../saleMoney'
import { getSaleLifecycleTypeKey } from '../../saleStatus'
import type { SalesUkraineOrderItem, SalesUkraineSale } from '../../types'
import { SaleEditDrawer } from '../SaleEditDrawer'
import { ChangeQtyModal } from './ChangeQtyModal'
import { EditShoppingCartOverlay } from './EditShoppingCartOverlay'
import { FutureReservationModal } from './FutureReservationModal'
import { ProductFullDetailPanel, type WizardDetailChip, type WizardDetailRow } from './ProductFullDetailPanel'
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
import { WizardRelatedProductsFrame } from './WizardRelatedProductsFrame'
import type {
  WizardAvailabilityRow,
  WizardCalculatedProductPricing,
  WizardProductReservation,
  WizardTotalProductAvailabilities,
} from './newSaleWizardApi'
import { useWizardCartOperations } from './useWizardCartOperations'
import { useWizardProductAnalogues } from './useWizardProductAnalogues'
import { useWizardProductData } from './useWizardProductData'
import { PRODUCT_SEARCH_MIN_QUERY_LENGTH, useWizardProductSearch } from './useWizardProductSearch'
import {
  WIZARD_PRODUCT_KEYBOARD_STATES,
  getPreviousProductKeyboardState,
  isEditableTarget,
  setWizardKeyboardState,
  toWizardHotkey,
  useWizardKeyHandler,
  useWizardKeyboard,
  type WizardKeyEvent,
  type WizardProductKeyboardState,
} from './wizardKeyboard'
import type { ExactWizardProductSearchMatch } from './wizardProductSearchSelection'
import {
  getWizardAvailabilityChipCount,
  getWizardAvailabilityRows,
  getWizardDetailedSellableQty,
  type WizardAvailabilityKey,
} from './wizardSaleAvailability'
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
const amountFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
const qtyFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3 })

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

const MAIN_CHIP_DEFS = [
  { index: 0, key: 'InAccount', label: 'В рахунках' },
  { index: 1, key: 'StorageUkrVat', label: 'Склади Україна (ПДВ)' },
  { index: 2, key: 'StorageUkrNotVat', label: 'Склади Україна' },
  { index: 6, key: 'AvailableQtyUkReSale', label: 'Перепродаж' },
  { index: 3, key: 'StoragePl', label: 'Склади Польща' },
  { index: 4, key: 'OnWayToPl', label: 'До Польщі' },
  { index: 5, key: 'OnWayToUkr', label: 'До України' },
] as const

const MAIN_CHIP_INDEX_STORAGE_UKR_VAT = 1
const MAIN_CHIP_INDEX_STORAGE_UKR_NOT_VAT = 2

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
  const [editingDescription, setEditingDescription] = useState(false)
  // The description draft lives in a ref (the TextInput inside
  // ProductFullDetailPanel keeps its own local state): typing must not re-render
  // this 2600-line step. The ref is read on save (panel toggle or keyboard F2).
  const descriptionDraftRef = useRef('')
  const [descriptionDraftSnapshot, setDescriptionDraftSnapshot] = useState('')
  const handleDescriptionDraftChange = useCallback((value: string) => {
    descriptionDraftRef.current = value
  }, [])
  const [productCardNetId, setProductCardNetId] = useState<string | null>(null)

  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const handleProductKeyRef = useRef<(event: WizardKeyEvent) => boolean>(() => false)
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

  const resetDetail = useCallback(() => {
    setDetail(null)
    setEditingDescription(false)
  }, [])

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
    removeItem,
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

  async function toggleDescriptionEdit() {
    const product = activeProduct

    if (!product) {
      return
    }

    if (!editingDescription) {
      const nextDescriptionDraft = product.Description ?? ''
      descriptionDraftRef.current = nextDescriptionDraft
      setDescriptionDraftSnapshot(nextDescriptionDraft)
      setEditingDescription(true)
      keyboard.setState('EditProductDescription')

      return
    }

    setEditingDescription(false)
    keyboard.restorePreviousProductState()
    const updated: WizardSaleProduct = { ...product, Description: descriptionDraftRef.current }
    setDescriptionDraftSnapshot(updated.Description ?? '')
    applyProductPatch(updated)

    try {
      await updateProduct(updated as Product, active?.source === 'main')
    } catch {
      notifications.show({ color: 'red', message: t('Не вдалося зберегти товар') })
    }
  }

  function applyProductPatch(updated: WizardSaleProduct) {
    patchAnalogues((item) => item.NetUid === updated.NetUid ? { ...item, Description: updated.Description } : item)
    setActive((previous) => (previous ? { ...previous, product: updated } : previous))
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
    setDetail({ chipIndex: getDefaultMainDetailChipIndex(), rowIndex: null })
    keyboard.setState('FullDetail')

    return true
  }

  function closeProductDetails() {
    resetDetail()
    keyboard.setState(active?.source === 'analogue' ? 'AnalogueSelection' : active?.source === 'component' ? 'ComponentSelection' : 'ProductSelection')
  }

  function handleProductDetailsKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    // Portaled child dialogs own their keyboard events; do not close this sheet
    // when Escape is used in a nested window.
    if (!event.currentTarget.contains(event.target as Node)) {
      return
    }
    event.stopPropagation()
    if (event.defaultPrevented || event.nativeEvent.isComposing) {
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      closeProductDetails()
      return
    }
    // Native buttons and description inputs must not trigger the wizard's
    // Enter-to-add shortcut. Explicit Ctrl shortcuts still work in the sheet.
    if (isEditableTarget(event.target) && !event.ctrlKey && event.key !== 'F2') {
      return
    }
    if (isInteractiveTarget(event.target) && !event.ctrlKey && (event.key === 'Enter' || event.key === ' ')) {
      return
    }
    const hotkey = toWizardHotkey(event)
    if (hotkey && handleProductKey({ hotkey, inEditable: isEditableTarget(event.target), nativeEvent: event })) {
      event.preventDefault()
    }
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

  function getMainChips(availabilities: WizardTotalProductAvailabilities | null | undefined): WizardDetailChip[] {
    return MAIN_CHIP_DEFS.map((def) => ({
      count: getMainChipCount(availabilities, def.key, def.index),
      key: def.key,
      name: t(def.label),
    }))
  }

  function getMainChipCount(
    availabilities: WizardTotalProductAvailabilities | null | undefined,
    key: WizardAvailabilityKey,
    index: number,
  ): number {
    return getWizardAvailabilityChipCount(availabilities, key, index)
  }

  function getMainChipRows(
    availabilities: WizardTotalProductAvailabilities | null | undefined,
    chipIndex: number,
  ): WizardAvailabilityRow[] {
    if (!availabilities) {
      return []
    }

    const key = MAIN_CHIP_DEFS[chipIndex]?.key

    if (!key) {
      return []
    }

    return getWizardAvailabilityRows(availabilities, key)
  }

  function getMainDetailRows(
    availabilities: WizardTotalProductAvailabilities | null | undefined,
    chipIndex: number | null,
  ): WizardDetailRow[] {
    if (chipIndex == null) {
      return []
    }

    return getMainChipRows(availabilities, chipIndex).map((row) => ({
      amount: getWizardProductNumber(row.Amount) ?? 0,
      analyst: row.OrderItem?.User?.LastName ?? '',
      key: String(row.NetId || row.OrderItem?.NetUid || row.OrderItem?.Id || `${row.Name || ''}|${row.RegionCode || ''}`),
      name: row.Name ?? '',
      regionCode: row.RegionCode ?? '',
    }))
  }

  function getDefaultMainDetailChipIndex(): number {
    return isVatSale ? MAIN_CHIP_INDEX_STORAGE_UKR_VAT : MAIN_CHIP_INDEX_STORAGE_UKR_NOT_VAT
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

  function handleSearchKeys(event: WizardKeyEvent): boolean {
    const { hotkey } = event

    if (hotkey === 'ArrowDown' || hotkey === 'ArrowUp') {
      if (results.length === 0) {
        return true
      }

      // Enter selection at the split centre (the first item just below the search
      // input) rather than index 0 — otherwise the carousel's top half (slice
      // before the focused index) would be empty and the upper list «пропадав».
      // ArrowDown lands on the first item below the input; ArrowUp on the last
      // item above it, keeping the barabanchik populated on both sides.
      const splitCentre = Math.floor(results.length / 2)
      const target = hotkey === 'ArrowDown' ? splitCentre : Math.max(splitCentre - 1, 0)

      focusMain(Math.min(target, results.length - 1))
      keyboard.setState('ProductSelection')

      return true
    }

    if (hotkey === 'Enter') {
      if (active?.source === 'main' && activeProduct) {
        void prepareAddToCart(activeProduct)

        return true
      }

      return false
    }

    if (hotkey === 'F2') {
      openEditCart()

      return true
    }

    if (hotkey === 'CtrlEnter') {
      openMainFullDetail()

      return true
    }

    if (hotkey === 'Escape') {
      onRequestClose?.()

      return true
    }

    return false
  }

  function handleSelectionKeys(event: WizardKeyEvent): boolean {
    const { hotkey } = event

    switch (hotkey) {
      case 'ArrowDown':
        focusMain(Math.min(mainIndex + 1, results.length - 1))

        return true
      case 'ArrowUp':
        focusMain(Math.max(mainIndex - 1, 0))

        return true
      case 'Enter':
        void prepareAddToCart(activeProduct)

        return true
      case 'CtrlEnter':
        openMainFullDetail()

        return true
      case 'CtrlI':
        openImage(activeProduct)

        return true
      case 'CtrlB':
        openInterest(activeProduct)

        return true
      case 'Space':
        spaceFromMain()

        return true
      case 'Escape':
        clearSelection()

        return true
      case 'F2':
        openEditCart()

        return true
      default:
        return false
    }
  }

  function handleFullDetailKeys(event: WizardKeyEvent): boolean {
    const { hotkey } = event
    const snapshot = getProductDetailSnapshot(activeProduct)
    const rows = detail?.chipIndex != null ? getMainChipRows(snapshot?.availabilities, detail.chipIndex) : []
    const isInvoiceRows = detail?.chipIndex === 0

    switch (hotkey) {
      case 'ArrowLeft':
        cycleChips(-1, MAIN_CHIP_DEFS.length)

        return true
      case 'ArrowRight':
        cycleChips(1, MAIN_CHIP_DEFS.length)

        return true
      case 'ArrowDown':
      case 'ArrowUp': {
        const direction = hotkey === 'ArrowDown' ? 1 : -1

        if (isInvoiceRows && rows.length > 0) {
          navigateChipRows(direction, rows.length)
        } else {
          focusMain(direction === 1 ? Math.min(mainIndex + 1, results.length - 1) : Math.max(mainIndex - 1, 0), { keepDetail: true })
        }

        return true
      }
      case 'Enter':
        void prepareAddToCart(activeProduct)

        return true
      case 'Ctrl':
        if (isInvoiceRows && detail?.rowIndex != null && rows[detail.rowIndex]) {
          setShiftRow(rows[detail.rowIndex] ?? null)
        }

        return true
      case 'CtrlEnter':
        return true
      case 'CtrlI':
        openImage(activeProduct)

        return true
      case 'CtrlB':
        openInterest(activeProduct)

        return true
      case 'Space':
        spaceFromMain()

        return true
      case 'Escape':
        resetDetail()
        keyboard.setState('ProductSelection')

        return true
      case 'F2':
        openEditCart()

        return true
      default:
        return false
    }
  }

  function handleAnalogueSelectionKeys(event: WizardKeyEvent): boolean {
    const { hotkey } = event
    const items = analogueState.items

    switch (hotkey) {
      case 'ArrowDown':
        focusAnalogue(analogueIndex === null ? 0 : Math.min(analogueIndex + 1, items.length - 1))

        return true
      case 'ArrowUp':
        focusAnalogue(analogueIndex === null ? 0 : Math.max(analogueIndex - 1, 0))

        return true
      case 'Space':
        if (analogueIndex === null && items.length > 0) {
          focusAnalogue(0)
        }

        return true
      case 'Enter':
        if (focusedAnalogue) {
          void prepareAddToCart(focusedAnalogue)
        }

        return true
      case 'CtrlEnter':
        setDetail({ chipIndex: null, rowIndex: null })
        keyboard.setState('AnalogueFullDetail')

        return true
      case 'CtrlI':
        return true
      case 'CtrlB':
        return true
      case 'Escape':
        escapeFromAnalogues()

        return true
      case 'F2':
        openEditCart()

        return true
      default:
        return false
    }
  }

  function handleAnalogueFullDetailKeys(event: WizardKeyEvent): boolean {
    const { hotkey } = event
    const snapshot = getProductDetailSnapshot(focusedAnalogue)
    const rows = detail?.chipIndex != null ? getMainChipRows(snapshot?.availabilities, detail.chipIndex) : []

    switch (hotkey) {
      case 'ArrowLeft':
        cycleChips(-1, MAIN_CHIP_DEFS.length)

        return true
      case 'ArrowRight':
        cycleChips(1, MAIN_CHIP_DEFS.length)

        return true
      case 'ArrowDown':
      case 'ArrowUp': {
        const direction = hotkey === 'ArrowDown' ? 1 : -1

        if (rows.length > 0) {
          navigateChipRows(direction, rows.length)
        } else if (analogueIndex !== null) {
          focusAnalogue(
            direction === 1 ? Math.min(analogueIndex + 1, analogueState.items.length - 1) : Math.max(analogueIndex - 1, 0),
            { keepDetail: true },
          )
        }

        return true
      }
      case 'Enter':
        if (focusedAnalogue) {
          void prepareAddToCart(focusedAnalogue)
        }

        return true
      case 'Ctrl':
        return true
      case 'CtrlEnter':
        return true
      case 'Space':
        return true
      case 'CtrlI':
        openImage(focusedAnalogue)

        return true
      case 'CtrlB':
        openInterest(focusedAnalogue)

        return true
      case 'Escape':
        if (detail?.chipIndex != null) {
          setDetail({ chipIndex: null, rowIndex: null })
        } else {
          resetDetail()
          keyboard.setState('AnalogueSelection')
        }

        return true
      case 'F2':
        openEditCart()

        return true
      default:
        return false
    }
  }

  function handleComponentSelectionKeys(event: WizardKeyEvent): boolean {
    const { hotkey } = event
    const entries = componentEntries.entries

    switch (hotkey) {
      case 'ArrowDown':
        focusComponent(componentIndex === null ? 0 : Math.min(componentIndex + 1, entries.length - 1))

        return true
      case 'ArrowUp':
        focusComponent(componentIndex === null ? 0 : Math.max(componentIndex - 1, 0))

        return true
      case 'Space':
        if (componentIndex === null && entries.length > 0) {
          focusComponent(0)
        } else if (
          focusedComponent &&
          focusedComponent.HasAnalogue &&
          analogueState.parentNetUid === focusedComponent.NetUid &&
          analogueState.items.length > 0
        ) {
          keyboard.setState('AnalogueSelection')
          focusAnalogue(0)
        }

        return true
      case 'Enter':
        if (focusedComponent) {
          void prepareAddToCart(focusedComponent)
        }

        return true
      case 'CtrlEnter':
        if (focusedComponent) {
          setDetail({ chipIndex: null, rowIndex: null })
          keyboard.setState('ComponentFullDetail')
        }

        return true
      case 'CtrlI':
        return true
      case 'CtrlB':
        return true
      case 'Escape':
        resetDetail()

        if (mainProduct) {
          setActive({ product: mainProduct, source: 'main' })
        }

        keyboard.setState('ProductSelection')

        return true
      case 'F2':
        openEditCart()

        return true
      default:
        return false
    }
  }

  function handleComponentFullDetailKeys(event: WizardKeyEvent): boolean {
    const { hotkey } = event
    const snapshot = getProductDetailSnapshot(focusedComponent)
    const rows = detail?.chipIndex != null ? getMainChipRows(snapshot?.availabilities, detail.chipIndex) : []
    const entries = componentEntries.entries

    switch (hotkey) {
      case 'ArrowLeft':
        cycleChips(-1, MAIN_CHIP_DEFS.length)

        return true
      case 'ArrowRight':
        cycleChips(1, MAIN_CHIP_DEFS.length)

        return true
      case 'ArrowDown':
      case 'ArrowUp': {
        const direction = hotkey === 'ArrowDown' ? 1 : -1

        if (rows.length > 0) {
          navigateChipRows(direction, rows.length)
        } else if (componentIndex !== null) {
          focusComponent(direction === 1 ? Math.min(componentIndex + 1, entries.length - 1) : Math.max(componentIndex - 1, 0), {
            keepDetail: true,
          })
        }

        return true
      }
      case 'Enter':
        if (focusedComponent) {
          void prepareAddToCart(focusedComponent)
        }

        return true
      case 'Ctrl':
        return true
      case 'CtrlEnter':
        return true
      case 'Space':
        if (
          focusedComponent?.HasAnalogue &&
          analogueState.parentNetUid === focusedComponent.NetUid &&
          analogueState.items.length > 0
        ) {
          resetDetail()
          keyboard.setState('AnalogueSelection')
          focusAnalogue(0)
        }

        return true
      case 'CtrlI':
        openImage(focusedComponent)

        return true
      case 'CtrlB':
        openInterest(focusedComponent)

        return true
      case 'Escape':
        if (detail?.chipIndex != null) {
          setDetail({ chipIndex: null, rowIndex: null })
        } else {
          resetDetail()
          keyboard.setState('ComponentSelection')
        }

        return true
      case 'F2':
        openEditCart()

        return true
      default:
        return false
    }
  }

  function handleEditCartKeys(event: WizardKeyEvent): boolean {
    const { hotkey } = event

    switch (hotkey) {
      case 'ArrowDown':
        moveCartSelection(1)

        return true
      case 'ArrowUp':
        moveCartSelection(-1)

        return true
      case 'Enter':
        void editSelectedCartRow()

        return true
      case 'Space':
        toggleSplitMode()

        return true
      case 'Delete':
        if (editCart?.selected) {
          setRemoveConfirmOpen(true)
        }

        return true
      case 'Escape':
        void exitEditCart()

        return true
      case 'CtrlEnter':
        return true
      default:
        return false
    }
  }

  function handleModalStateKeys(event: WizardKeyEvent): boolean {
    const { hotkey } = event

    if (hotkey === 'Escape') {
      if (kbState === 'ViewImage') {
        closeImage()
      } else {
        closeInterest()
      }

      return true
    }

    if (hotkey === 'F2') {
      if (kbState === 'ViewImage') {
        closeImage()
      } else {
        closeInterest()
      }

      openEditCart()

      return true
    }

    return hotkey === 'ArrowDown' || hotkey === 'ArrowUp' || hotkey === 'ArrowLeft' || hotkey === 'ArrowRight' || hotkey === 'Space' || hotkey === 'Enter' || hotkey === 'CtrlEnter'
  }

  function handleEditDescriptionKeys(event: WizardKeyEvent): boolean {
    const { hotkey } = event

    if (hotkey === 'Enter') {
      void prepareAddToCart(activeProduct)

      return true
    }

    if (hotkey === 'F2') {
      void toggleDescriptionEdit()
      openEditCart()

      return true
    }

    return false
  }

  function handleProductKey(event: WizardKeyEvent): boolean {
    if (event.hotkey === 'F3' && event.nativeEvent.repeat) return true
    if (qtyModal || shiftRow || futureProduct || removeConfirmOpen || removeRowItem || cartActionItem || isActEditOpen) {
      return false
    }

    // The cart sheet owns its controls; do not dispatch product shortcuts beneath it.
    if (cartSheetOpen) {
      const target = event.nativeEvent.target
      // A nested modal may close in Mantine's window capture handler before
      // this handler runs. Its Escape must not also close the underlying sheet.
      if (target instanceof Element && target.closest('.mantine-Modal-content, .mantine-Drawer-content:not(.wizard-cart-sheet)')) {
        return true
      }
      if (crossSellProduct) return false
      if (event.hotkey === 'F2') {
        setCartSheetOpen(false)
        openEditCart()
      } else if (event.hotkey === 'Escape' || event.hotkey === 'F3') {
        setCartSheetOpen(false)
      }
      return true
    }

    if (event.hotkey === 'F3') {
      if (productCardNetId || crossSellProduct) return false
      if (['ProductSearch', 'ProductSelection', 'AnalogueSelection', 'ComponentSelection'].includes(kbState)) {
        setCartSheetOpen(true)
        return true
      }
      return false
    }

    switch (kbState) {
      case 'ProductSearch':
        return handleSearchKeys(event)
      case 'ProductSelection':
        return handleSelectionKeys(event)
      case 'FullDetail':
        return handleFullDetailKeys(event)
      case 'AnalogueSelection':
        return handleAnalogueSelectionKeys(event)
      case 'AnalogueFullDetail':
        return handleAnalogueFullDetailKeys(event)
      case 'ComponentSelection':
        return handleComponentSelectionKeys(event)
      case 'ComponentFullDetail':
        return handleComponentFullDetailKeys(event)
      case 'EditShoppingCart':
        return handleEditCartKeys(event)
      case 'EditProductDescription':
        return handleEditDescriptionKeys(event)
      case 'ViewImage':
      case 'Interest':
        return handleModalStateKeys(event)
      default:
        return false
    }
  }

  // Primary path: the wizard root onKeyDown dispatches here while focus is inside the step.
  useWizardKeyHandler(handleProductKey)

  // Max-priority fallback so adding via Enter/arrows and the Esc exit-confirm keep working
  // even after a click moved focus onto a non-interactive area (<body>), where the root
  // onKeyDown can no longer fire. Skips when focus is inside the step (root path handles it)
  // or on a real control (let that control handle its own keys) to avoid double dispatch.
  useEffect(() => {
    handleProductKeyRef.current = handleProductKey
  })

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      const target = event.target

      if (
        containerRef.current?.contains(target as Node) ||
        isInteractiveTarget(target) ||
        (target instanceof Element && target.closest('.new-sale-product-details-drawer, .new-sale-product-image-modal, .wizard-cart-sheet, [data-wizard-keyboard-help]'))
      ) {
        return
      }

      const hotkey = toWizardHotkey(event)

      if (!hotkey) {
        return
      }

      if (handleProductKeyRef.current({ hotkey, inEditable: isEditableTarget(target), nativeEvent: event })) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    document.addEventListener('keydown', listener, true)

    return () => document.removeEventListener('keydown', listener, true)
  }, [])

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
  const setQtyByNetUid = new Map<string, number>()

  componentEntries.entries.forEach((entry) => {
    if (entry.product.NetUid && entry.setQty != null) {
      setQtyByNetUid.set(entry.product.NetUid, entry.setQty)
    }
  })

  const detailPricingFor = (product: WizardSaleProduct | null): WizardCalculatedProductPricing | null => {
    const snapshot = product?.NetUid ? productPricing.get(product.NetUid) : undefined

    return snapshot?.calculatedPricings[0] ?? null
  }

  const canEditMainDescription = hasPermission(CHANGE_PRODUCT_DESCRIPTION_PERMISSION)

  function renderPriceExtra(product: WizardSaleProduct, setQty?: number) {
    const localPrice = getWizardProductNumber(product.CurrentPriceEurToUah) ?? getWizardProductNumber(product.CurrentLocalPrice) ?? 0

    return (
      <Box className="new-sale-related-row__metrics">
        <Box className="new-sale-related-row__metric">
          <Text className="new-sale-related-row__metric-label">{t('Доступно')}</Text>
          {/* Search-payload sellable qty (stable across focus) so the number does
              not jump when switching between analogues as the detailed snapshot
              loads for the focused row (bug #17). */}
          <TableChip value={`${qtyFormatter.format(getWizardSellableQty(product, isVatSale) ?? 0)} ${product.MeasureUnit?.Name ?? ''}`} />
          {setQty != null && (
            <Text className="new-sale-related-row__set-qty">{t('У комплекті')}: {qtyFormatter.format(setQty)}</Text>
          )}
        </Box>
        <Box className="new-sale-related-row__metric">
          <TableChip tone="source" value="EUR" />
          <Text className="new-sale-related-row__amount app-money">{amountFormatter.format(getWizardProductNumber(product.CurrentPrice) ?? 0)}</Text>
        </Box>
        <Box className="new-sale-related-row__metric">
          <TableChip tone="source" value={localCurrencyCode} />
          <Text className="new-sale-related-row__amount app-money">{amountFormatter.format(localPrice)}</Text>
        </Box>
      </Box>
    )
  }

  // Keep the complete summary pinned; detailed sections live in a separate work window.
  const selectedMainProduct = mainProduct ? (active?.source === 'main' && activeProduct ? activeProduct : mainProduct) : null
  const selectedMainSnapshot = getProductDetailSnapshot(selectedMainProduct)
  const isMainFullDetail = detailKeyboardState === 'FullDetail' && active?.source === 'main'
  const detailProduct = isMainFullDetail
    ? selectedMainProduct
    : detailKeyboardState === 'AnalogueFullDetail'
      ? focusedAnalogue
      : detailKeyboardState === 'ComponentFullDetail'
        ? focusedComponent
        : null
  const selectedMainChipIndex =
    selectedMainProduct && isMainFullDetail && detail?.chipIndex != null
      ? detail.chipIndex
      : selectedMainProduct && isMainFullDetail
        ? getDefaultMainDetailChipIndex()
        : null
  const focusedAnalogueSnapshot = getProductDetailSnapshot(focusedAnalogue)
  const focusedComponentSnapshot = getProductDetailSnapshot(focusedComponent)
  const focusedAnalogueChipIndex = focusedAnalogue ? (detail?.chipIndex ?? getDefaultMainDetailChipIndex()) : null
  const focusedComponentChipIndex = focusedComponent ? (detail?.chipIndex ?? getDefaultMainDetailChipIndex()) : null
  // Build chips/rows only while the detail window is open, not on search keystrokes.
  const selectedMainProductPanel =
    selectedMainProduct && isMainFullDetail ? (
      <ProductFullDetailPanel
        canEditDescription={canEditMainDescription && active?.source === 'main'}
        chips={getMainChips(selectedMainSnapshot?.availabilities)}
        currentPriceEur={getWizardProductNumber(getProductMeta(selectedMainProduct)?.price)}
        descriptionDraft={descriptionDraftSnapshot}
        displayQty={getDisplayedAvailableQty(selectedMainProduct) ?? 0}
        detailsError={selectedMainSnapshot?.detailsError}
        isFullDetail={isMainFullDetail}
        isEditingDescription={editingDescription && active?.source === 'main'}
        isLoadingDetails={!selectedMainSnapshot?.detailsLoaded}
        isVatSale={isVatSale}
        localCurrencyCode={localCurrencyCode}
        clientAgreementNetId={agreementNetId}
        nearestSupplyOrder={selectedMainSnapshot?.nearestOrder}
        pricing={detailPricingFor(selectedMainProduct)}
        product={selectedMainProduct}
        rows={getMainDetailRows(selectedMainSnapshot?.availabilities, selectedMainChipIndex)}
        selectedChipIndex={selectedMainChipIndex}
        selectedRowIndex={active?.source === 'main' ? (detail?.rowIndex ?? null) : null}
        showRowDetails={selectedMainChipIndex === 0}
        onDescriptionDraftChange={handleDescriptionDraftChange}
        onOpenImage={() => openImage(selectedMainProduct)}
        onSelectChip={(chipIndex) => {
          setDetail({ chipIndex, rowIndex: null })

          if (!isMainFullDetail) {
            keyboard.setState('FullDetail')
          }
        }}
        onRetryDetails={retryProductDetails}
        onToggleDescription={() => void toggleDescriptionEdit()}
      />
    ) : null
  const selectedMainProductSummary = selectedMainProduct ? (
    <ProductSummaryCard
      currentPriceEur={getWizardProductNumber(getProductMeta(selectedMainProduct)?.price)}
      detailsExpanded={isMainFullDetail}
      displayQty={getDisplayedAvailableQty(selectedMainProduct) ?? 0}
      localCurrencyCode={localCurrencyCode}
      pricing={detailPricingFor(selectedMainProduct)}
      product={selectedMainProduct}
      onOpenDetails={() => { openMainFullDetail() }}
      onOpenImage={() => openImage(selectedMainProduct)}
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
            getItemColor={(product) => getRelatedProductRowColor(product)}
            products={analogueState.items}
            renderExtra={(product) => renderPriceExtra(product)}
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
            getItemColor={(product) => getRelatedProductRowColor(product)}
            products={componentEntries.entries.map((entry) => entry.product)}
            renderExtra={(product) => renderPriceExtra(product, product.NetUid ? setQtyByNetUid.get(product.NetUid) : undefined)}
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
              getItemColor={(product) => getRelatedProductRowColor(product)}
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
          {selectedMainProductPanel}

          {detailKeyboardState === 'AnalogueFullDetail' && focusedAnalogue && (
            <ProductFullDetailPanel
              canEditDescription
              chips={getMainChips(focusedAnalogueSnapshot?.availabilities)}
              descriptionDraft={descriptionDraftSnapshot}
              displayQty={getDisplayedAvailableQty(focusedAnalogue) ?? 0}
              detailsError={focusedAnalogueSnapshot?.detailsError}
              isFullDetail
              isEditingDescription={editingDescription && active?.source === 'analogue'}
              isLoadingDetails={!focusedAnalogueSnapshot?.detailsLoaded}
              isVatSale={isVatSale}
              localCurrencyCode={localCurrencyCode}
              clientAgreementNetId={agreementNetId}
              nearestSupplyOrder={focusedAnalogueSnapshot?.nearestOrder}
              pricing={detailPricingFor(focusedAnalogue)}
              product={focusedAnalogue}
              rows={getMainDetailRows(focusedAnalogueSnapshot?.availabilities, focusedAnalogueChipIndex)}
              selectedChipIndex={focusedAnalogueChipIndex}
              selectedRowIndex={detail?.rowIndex ?? null}
              showRowDetails={focusedAnalogueChipIndex === 0}
              onDescriptionDraftChange={handleDescriptionDraftChange}
              onOpenImage={() => openImage(focusedAnalogue)}
              onRetryDetails={retryProductDetails}
              onSelectChip={(chipIndex) => setDetail({ chipIndex, rowIndex: null })}
              onToggleDescription={() => void toggleDescriptionEdit()}
            />
          )}

          {detailKeyboardState === 'ComponentFullDetail' && focusedComponent && (
            <ProductFullDetailPanel
              canEditDescription
              chips={getMainChips(focusedComponentSnapshot?.availabilities)}
              descriptionDraft={descriptionDraftSnapshot}
              displayQty={getDisplayedAvailableQty(focusedComponent) ?? 0}
              detailsError={focusedComponentSnapshot?.detailsError}
              isFullDetail
              isEditingDescription={editingDescription && active?.source === 'component'}
              isLoadingDetails={!focusedComponentSnapshot?.detailsLoaded}
              isVatSale={isVatSale}
              localCurrencyCode={localCurrencyCode}
              clientAgreementNetId={agreementNetId}
              nearestSupplyOrder={focusedComponentSnapshot?.nearestOrder}
              pricing={detailPricingFor(focusedComponent)}
              product={focusedComponent}
              rows={getMainDetailRows(focusedComponentSnapshot?.availabilities, focusedComponentChipIndex)}
              selectedChipIndex={focusedComponentChipIndex}
              selectedRowIndex={detail?.rowIndex ?? null}
              showRowDetails={focusedComponentChipIndex === 0}
              onDescriptionDraftChange={handleDescriptionDraftChange}
              onOpenImage={() => openImage(focusedComponent)}
              onRetryDetails={retryProductDetails}
              onSelectChip={(chipIndex) => setDetail({ chipIndex, rowIndex: null })}
              onToggleDescription={() => void toggleDescriptionEdit()}
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
        onAccept={(qty, comment) => void acceptQtyModal(qty, comment)}
        onCancel={cancelQtyModal}
      />

      <ShiftOrderItemModal
        amount={getWizardProductNumber(shiftRow?.Amount) ?? 0}
        analyst={shiftRow?.OrderItem?.User?.LastName ?? ''}
        busy={busy}
        opened={Boolean(shiftRow)}
        regionCode={shiftRow?.RegionCode ?? ''}
        sourceName={shiftRow?.Name ?? ''}
        onApply={(qty) => void applyShift(qty)}
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
        onConfirm={() => void confirmRemoveSelected()}
      />

      <WizardConfirmModal
        zIndex={cartSheetOpen ? 220 : undefined}
        busy={busy}
        message={t('Видалити позицію з рахунку?')}
        opened={Boolean(removeRowItem)}
        onCancel={() => {
          setRemoveRowItem(null)
          focusSearchInput()
        }}
        onConfirm={() => {
          const item = removeRowItem
          setRemoveRowItem(null)

          if (item) {
            void removeItem(item)
          }
        }}
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

// True when focus sits on a real control (button / link / input / etc.) so the focus-independent
// fallback listener can leave that control's own keyboard handling alone. Note: NOT [tabindex] —
// Mantine's modal wrapper is a tabindex=-1 focus-trap div, not a real control, and focus often
// lands there after navigating to this step; treating it as interactive would swallow Escape.
function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest('a, button, input, select, textarea, [role="button"]'))
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

/* Row-actions popup per docs/ui-patterns.md §7.1 for a cart row: mono title
   (code — name), subtle buttons with the icon in an outlined circle. */
function CartRowActionsModal({
  isInvoice,
  item,
  onActEdit,
  onChangeQty,
  onClose,
  onRemove,
  zIndex,
}: {
  isInvoice: boolean
  item: SalesUkraineOrderItem | null
  onActEdit: () => void
  onChangeQty: (item: SalesUkraineOrderItem) => void
  onClose: () => void
  onRemove: (item: SalesUkraineOrderItem) => void
  zIndex?: number
}) {
  const { t } = useI18n()
  const code = item?.Product?.VendorCode || item?.Product?.Articul || ''
  const name = item?.Product?.NameUA || item?.Product?.Name || ''

  return (
    <AppModal
      centered
      zIndex={zIndex}
      opened={Boolean(item)}
      size={496}
      title={
        <span style={{ fontFamily: 'var(--font-mono)' }}>
          {[code, name].filter(Boolean).join(' — ') || t('Виберіть опцію')}
        </span>
      }
      onClose={onClose}
    >
      {item && (
        <Stack className="app-modal-actions" gap="xs">
          {isInvoice ? (
            /* Invoice rows are edited only through the edit act. */
            <Button
              fullWidth
              justify="flex-start"
              color="dark"
              size="md"
              leftSection={
                <span className="app-action-icon">
                  <FileSignature size={20} color="var(--mantine-color-gray-7)" />
                </span>
              }
              variant="subtle"
              onClick={onActEdit}
            >
              {t('Акт редагування накладної')}
            </Button>
          ) : (
            <>
              <Button
                fullWidth
                justify="flex-start"
                color="dark"
                size="md"
                leftSection={
                  <span className="app-action-icon">
                    <Hash size={20} color="var(--mantine-color-gray-7)" />
                  </span>
                }
                variant="subtle"
                onClick={() => onChangeQty(item)}
              >
                {t('Змінити кількість')}
              </Button>
              <Button
                fullWidth
                justify="flex-start"
                color="dark"
                size="md"
                leftSection={
                  <span className="app-action-icon">
                    <Trash2 size={20} color="var(--mantine-color-gray-7)" />
                  </span>
                }
                variant="subtle"
                onClick={() => onRemove(item)}
              >
                {t('Видалити')}
              </Button>
            </>
          )}
        </Stack>
      )}
    </AppModal>
  )
}
