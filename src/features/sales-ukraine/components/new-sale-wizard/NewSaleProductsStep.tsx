import { Alert, Box, Button, Group, Select, Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { Box as BoxIcon, FileSignature, Hash, Search, Settings, Sparkles, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../../../auth/useAuth'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { AppModal } from '../../../../shared/ui/AppModal'
import { toProxiedAssetUrl } from '../../../../shared/url/proxiedAssetUrl'
import { realtimeEvents, useRealtimeEvent } from '../../../../shared/realtime/events'
import { getMostPurchasedProductsByClientId } from '../../../clients/api/clientRecommendationsApi'
import type { Client } from '../../../clients/types'
import { updateProduct } from '../../../products/api/productsApi'
import type { Product } from '../../../products/types'
import { getProductMainImage, getRelatedProductRowColor } from '../../../products/utils'
import { ProductCardModal } from '../../../products/components/ProductCardModal'
import { ProductInterestModal } from '../../../sales-preorders'
import {
  getSalesPendingMutationUserKey,
  loadSalesPendingMutation,
  markSalesPendingMutationCorrupt,
  markSalesPendingMutationSubmitted,
  markSalesPendingMutationUnknown,
  resolveSalesPendingMutation,
  subscribeSalesPendingMutations,
  synchronizeSalesPendingMutationUser,
  withSalesPendingMutationLock,
  type SalesPendingMutationLease,
  type SalesPendingMutationScope,
} from '../../pendingSalesMutationRegistry'
import { getSaleLocalCurrencyCode, isNonVatEurSale, roundMoney } from '../../saleMoney'
import { getSaleLifecycleTypeKey } from '../../saleStatus'
import type { SalesUkraineOrderItem, SalesUkraineSale, SalesUkraineUser } from '../../types'
import {
  attemptPersistentSalesCartMutation,
  createAddOrUpdateSalesCartMutation,
} from '../../usePersistentSalesCartMutation'
import { SaleEditDrawer } from '../SaleEditDrawer'
import { ChangeQtyModal } from './ChangeQtyModal'
import { EditShoppingCartOverlay, type WizardCartSelection } from './EditShoppingCartOverlay'
import { FutureReservationModal } from './FutureReservationModal'
import {
  getAllProductAvailabilities,
  getNearestSupplyOrder,
  getProductAnalogues,
  getProductAvailabilityBuckets,
  getProductCalculatedPricingsByAgreement,
  getProductCurrentPriceByAgreement,
  getProductReservationsByAgreement,
  searchSaleProductsWithAvailability,
  type WizardAvailabilityRow,
  type WizardCalculatedProductPricing,
  type WizardNearestSupplyOrder,
  type WizardProductReservation,
  type WizardTotalProductAvailabilities,
} from './newSaleWizardApi'
import {
  assertWizardSplitRecoveryOperationFence,
  clearWizardSplitOrderItems,
  commitWizardSplitExtraction,
  getWizardMergedSaleNetUid,
  getWizardSplitAgreementNetId,
  getWizardSplitOrderItems,
  getWizardSplitRecovery,
  hasWizardSplitRecoveryOperation,
  markWizardSplitExtractionSubmitted,
  markWizardSplitExtractionUnknown,
  setWizardSplitOrderItems,
  stageWizardSplitExtraction,
} from './newSaleWizardState'
import { ProductFullDetailPanel, type WizardDetailChip, type WizardDetailRow } from './ProductFullDetailPanel'
import { ProductImageViewModal } from './ProductImageViewModal'
import { ShiftOrderItemModal } from './ShiftOrderItemModal'
import { WizardConfirmModal } from './WizardConfirmModal'
import { WizardCrossSellModal } from './WizardCrossSellModal'
import { WizardProductCarousel } from './WizardProductCarousel'
import { WizardProductPriceStrip } from './WizardProductPriceStrip'
import { WizardRelatedProductRows } from './WizardRelatedProductRows'
import { WizardClientHeroHeader } from './WizardClientHeroHeader'
import {
  getWizardAvailabilityChipCount,
  getWizardAvailabilityRows,
  getWizardDetailedSellableQty,
  type WizardAvailabilityKey,
} from './wizardSaleAvailability'
import {
  getPreviousProductKeyboardState,
  getWizardKeyboardState,
  isEditableTarget,
  setWizardKeyboardState,
  toWizardHotkey,
  useWizardKeyboard,
  useWizardKeyHandler,
  WIZARD_PRODUCT_KEYBOARD_STATES,
  type WizardKeyEvent,
  type WizardProductKeyboardState,
} from './wizardKeyboard'
import {
  getComponentCarouselEntries,
  getWizardProductNumber,
  getWizardSellableQty,
  getWizardStorageQty,
  type WizardCarouselEntry,
  type WizardSaleProduct,
} from './wizardSaleProduct'
import {
  addWizardSplitOrderItem,
  clearWizardSplitRestoreTracking,
  ensureWizardSplitRestoreOperationNetUids,
  findRestorableWizardOrderItem,
  getWizardMutationContextKey,
  isWizardMutationContextCurrent,
  mapWizardSplitOrderItem,
  resizeWizardSplitOrderItem,
  restoreWizardSplitItemsSequentially,
  stageWizardSplitRestoreMutation,
  toWizardSplitMutationSnapshot,
  updateWizardSplitOrderItemQty,
  type WizardSplitOrderItem,
  type WizardSplitRecoverySource,
} from './wizardSplitSale'
import {
  createWizardOperationId,
  inspectWizardCartMutation,
  retryWizardMutation,
  type WizardCartMutationExpectation,
  type WizardMutationAttemptResult,
  type WizardMutationOperation,
} from './wizardMutationOperation'
import {
  createPersistedWizardCartMutation,
  executeWizardCartMutationRequest,
  isPersistedWizardCartMutation,
  type PersistedWizardCartMutation,
  type WizardCartLocalCommit,
  type WizardCartMutationRequest,
} from './wizardCartMutation'
import { WizardShoppingCartGrid } from './WizardShoppingCartGrid'

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'
const CHANGE_PRODUCT_DESCRIPTION_PERMISSION = 'Sales_Ukraine_all_Change_Products_Btn_PKEY'
const amountFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
const qtyFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3 })
const PRODUCT_SEARCH_MIN_QUERY_LENGTH = 3

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

type ProductPricingSnapshot = {
  calculatedPricings: WizardCalculatedProductPricing[]
  currentPrice: number | null
  reservation?: WizardProductReservation
}

type ProductDetailSnapshot = {
  availabilities: WizardTotalProductAvailabilities | null
  nearestOrder: WizardNearestSupplyOrder | null
  reservationRows: WizardProductReservation[]
}

type ProductDetailState = {
  agreementNetId: string | null
  saleNetId: string
  values: Map<string, ProductDetailSnapshot>
}

type ActiveProductSource = 'main' | 'analogue' | 'component'

type QtyModalState =
  | { available: number; item: SalesUkraineOrderItem; kind: 'add' }
  | { available: number; item: SalesUkraineOrderItem; kind: 'edit-current' }
  | { available: number; item: WizardSplitOrderItem; kind: 'edit-split' }

type EditCartState = {
  isSplit: boolean
  selected: WizardCartSelection | null
  splitItems: WizardSplitOrderItem[]
}

const EMPTY_PRODUCT_PRICING = new Map<string, ProductPricingSnapshot>()
const EMPTY_PRODUCT_DETAILS = new Map<string, ProductDetailSnapshot>()
const EMPTY_RESERVATIONS = new Map<string, WizardProductReservation>()

async function loadPricingSnapshot(productNetUid: string, clientAgreementNetId: string): Promise<ProductPricingSnapshot | null> {
  try {
    const [currentPrice, calculatedPricings] = await Promise.all([
      getProductCurrentPriceByAgreement(productNetUid, clientAgreementNetId),
      getProductCalculatedPricingsByAgreement(productNetUid, clientAgreementNetId),
    ])

    return { calculatedPricings, currentPrice }
  } catch {
    return null
  }
}

type PendingCartMutation = WizardMutationOperation<SalesUkraineSale> & PersistedWizardCartMutation & {
  localCommitted: boolean
}

function toPersistedCartMutation(operation: PendingCartMutation): PersistedWizardCartMutation {
  return {
    context: operation.context,
    expectation: operation.expectation,
    fallbackMessage: operation.fallbackMessage,
    localCommit: operation.localCommit,
    operationId: operation.operationId,
    request: operation.request,
  }
}

export function NewSaleProductsStep({
  agreementNetId,
  client,
  clientNetId,
  headerClose,
  headerTools,
  sale,
  onBusyChange,
  onCartChanged,
  onRequestClose,
  onRestoreSplitItems,
}: {
  agreementNetId: string | null
  client?: Client | null
  clientNetId: string | null
  headerClose?: ReactNode
  headerTools?: ReactNode
  onBusyChange?: (busy: boolean) => void
  onCartChanged: () => SalesUkraineSale | null | void | Promise<SalesUkraineSale | null | void>
  onRequestClose?: () => void
  onRestoreSplitItems?: () => Promise<boolean>
  sale: SalesUkraineSale | null
}) {
  const { t } = useI18n()
  const { hasPermission, session, user } = useAuth()
  const keyboard = useWizardKeyboard(1)

  const [searchMode, setSearchMode] = useState('5')
  const [sortMode, setSortMode] = useState('2')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<WizardSaleProduct[]>([])
  const [isSearching, setSearching] = useState(false)
  const [isLoadingRecommendations, setLoadingRecommendations] = useState(false)
  const [crossSellProduct, setCrossSellProduct] = useState<WizardSaleProduct | null>(null)
  const [mainIndex, setMainIndex] = useState(0)
  const [active, setActive] = useState<{ product: WizardSaleProduct; source: ActiveProductSource } | null>(null)
  const [analogueState, setAnalogueState] = useState<{ items: WizardSaleProduct[]; parentNetUid: string | null }>({
    items: [],
    parentNetUid: null,
  })
  const [analogueIndex, setAnalogueIndex] = useState<number | null>(null)
  const [componentParent, setComponentParent] = useState<WizardSaleProduct | null>(null)
  const [componentIndex, setComponentIndex] = useState<number | null>(null)
  const [detail, setDetail] = useState<{ chipIndex: number | null; rowIndex: number | null; rowsOpen?: boolean } | null>(null)
  const [productDetailState, setProductDetailState] = useState<ProductDetailState>({
    agreementNetId: null,
    saleNetId: EMPTY_GUID,
    values: EMPTY_PRODUCT_DETAILS,
  })
  const [editCart, setEditCart] = useState<EditCartState | null>(null)
  const [qtyModal, setQtyModal] = useState<QtyModalState | null>(null)
  const [shiftRow, setShiftRow] = useState<WizardAvailabilityRow | null>(null)
  const [interestProduct, setInterestProduct] = useState<WizardSaleProduct | null>(null)
  const [futureProduct, setFutureProduct] = useState<WizardSaleProduct | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false)
  const [removeRowItem, setRemoveRowItem] = useState<SalesUkraineOrderItem | null>(null)
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
  const [busy, setBusy] = useState(false)
  const [reconciliationError, setReconciliationError] = useState<string | null>(null)
  const [pendingMutationError, setPendingMutationError] = useState<string | null>(null)
  const [mutationStorageRevision, setMutationStorageRevision] = useState(0)
  const [refreshTick, setRefreshTick] = useState(0)

  const busyRef = useRef(false)
  const mountedRef = useRef(false)
  const mutationContextRef = useRef('')
  const activeMutationContextRef = useRef<string | null>(null)
  const reconciliationErrorRef = useRef<string | null>(null)
  const reconciliationContextRef = useRef<string | null>(null)
  const pendingMutationRef = useRef<PendingCartMutation | null>(null)
  const forceSearchRef = useRef(false)
  const virtualLoadingRef = useRef(false)
  const virtualExhaustedRef = useRef(false)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const handleProductKeyRef = useRef<(event: WizardKeyEvent) => boolean>(() => false)
  const cartNetIdRef = useRef<string | undefined>(undefined)
  const onCartChangedRef = useRef(onCartChanged)
  const pricingCacheGenerationRef = useRef(0)

  const mutationContextKey = getWizardMutationContextKey(agreementNetId, sale?.NetUid)
  const pendingMutationUserKey = getSalesPendingMutationUserKey(session)
  const getPendingCartMutationScope = useCallback((context: string): SalesPendingMutationScope | null => (
    pendingMutationUserKey && context && context !== ':'
      ? { context, kind: 'cart', userKey: pendingMutationUserKey }
      : null
  ), [pendingMutationUserKey])

  const getSplitRecoverySource = useCallback((
    targetAgreementNetId: string | null = agreementNetId,
    targetSaleNetUid: string | null | undefined = sale?.NetUid,
  ): WizardSplitRecoverySource => {
    const existing = getWizardSplitRecovery()

    if (
      existing &&
      existing.agreementNetId === targetAgreementNetId?.trim().toLowerCase() &&
      existing.saleNetUid === targetSaleNetUid?.trim().toLowerCase() &&
      existing.userKey === pendingMutationUserKey
    ) {
      return {
        agreementNetId: existing.agreementNetId,
        origin: existing.origin,
        saleNetUid: existing.saleNetUid,
        userKey: existing.userKey,
      }
    }

    if (!targetAgreementNetId || !targetSaleNetUid || targetSaleNetUid === EMPTY_GUID || !pendingMutationUserKey) {
      throw new Error(t('Неможливо безпечно зберегти розділення без поточного рахунку та користувача'))
    }

    return {
      agreementNetId: targetAgreementNetId,
      origin: getWizardMergedSaleNetUid()?.trim().toLowerCase() === targetSaleNetUid.trim().toLowerCase()
        ? 'merged'
        : 'ordinary',
      saleNetUid: targetSaleNetUid,
      userKey: pendingMutationUserKey,
    }
  }, [agreementNetId, pendingMutationUserKey, sale?.NetUid, t])

  const persistSplitItems = useCallback((
    items: WizardSplitOrderItem[],
    targetAgreementNetId: string | null = agreementNetId,
  ) => {
    if (items.length === 0) {
      setWizardSplitOrderItems([], null)

      return
    }

    setWizardSplitOrderItems(items, targetAgreementNetId, getSplitRecoverySource(targetAgreementNetId))
  }, [agreementNetId, getSplitRecoverySource])

  const [reservationsState, setReservationsState] = useState<{
    agreementNetId: string | null
    values: Map<string, WizardProductReservation>
  }>({ agreementNetId: null, values: EMPTY_RESERVATIONS })
  const [productPricingState, setProductPricingState] = useState<{
    agreementNetId: string | null
    values: Map<string, ProductPricingSnapshot>
  }>({ agreementNetId: null, values: EMPTY_PRODUCT_PRICING })

  // Memoized: the sort clones + Date.parses per comparison; unmemoized it also
  // returned a fresh array identity every render, invalidating the cart grid's
  // column defs and TanStack row model on every search keystroke.
  const orderItems = useMemo(() => getOrderItemsNewestFirst(sale), [sale])

  // Stable cart-grid handlers: the grid is React.memo'd, so its callback props
  // must keep identity across renders. onEditOrderItem is a plain body function
  // capturing fresh state each render — route the call through a ref.
  const onEditOrderItemRef = useRef<(item: SalesUkraineOrderItem) => Promise<void>>(async () => {})

  // (onEditOrderItem is a hoisted function declaration below — this captures the
  // current-render closure, refreshed every render.)
  useEffect(() => {
    onEditOrderItemRef.current = onEditOrderItem
  })

  // Row click opens the §7.1 row-actions chooser (change qty / remove) instead
  // of jumping straight into the qty editor.
  const [cartActionItem, setCartActionItem] = useState<SalesUkraineOrderItem | null>(null)
  const [isActEditOpen, setActEditOpen] = useState(false)
  const handleCartRowClick = useCallback((item: SalesUkraineOrderItem) => {
    setCartActionItem(item)
  }, [])
  const handleCartRowRemove = useCallback((item: SalesUkraineOrderItem) => setRemoveRowItem(item), [])
  const handleCartCrossSell = useCallback((item: SalesUkraineOrderItem) => {
    const product = item.Product as WizardSaleProduct | undefined

    if (product?.NetUid) {
      setCrossSellProduct(product)
    }
  }, [])
  const isVatSale = Boolean(sale?.IsVatSale)
  const isSaleLifecycleNew = getSaleLifecycleTypeKey(sale?.BaseLifeCycleStatus?.SaleLifeCycleType) === '0'
  const currentReconciliationError = reconciliationContextRef.current === mutationContextKey ? reconciliationError : null
  const useEurToUah = isNonVatEurSale(sale)
  const localCurrencyCode = getSaleLocalCurrencyCode(sale)
  const totalVat = getWizardProductNumber(sale?.Order?.TotalVat) ?? 0
  const productPricing = productPricingState.agreementNetId === agreementNetId ? productPricingState.values : EMPTY_PRODUCT_PRICING
  const reservations = reservationsState.agreementNetId === agreementNetId ? reservationsState.values : EMPTY_RESERVATIONS

  const componentEntries = useMemo(
    () => sortComponentCarouselEntries(getComponentCarouselEntries(componentParent), isVatSale),
    [componentParent, isVatSale],
  )
  const activeProduct = active?.product ?? null
  const mainProduct = results[mainIndex] ?? null
  const focusedAnalogue = analogueIndex !== null ? analogueState.items[analogueIndex] ?? null : null
  const focusedComponent = componentIndex !== null ? componentEntries.entries[componentIndex]?.product ?? null : null
  const kbState = isProductKeyboardState(keyboard.state) ? keyboard.state : 'ProductSearch'

  useLayoutEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
      onBusyChange?.(false)
    }
  }, [onBusyChange])

  useEffect(() => subscribeSalesPendingMutations(({ external }) => {
    if (external) {
      setMutationStorageRevision((revision) => revision + 1)
    }
  }), [])

  useLayoutEffect(() => {
    let cancelled = false
    mutationContextRef.current = mutationContextKey
    const scope = getPendingCartMutationScope(mutationContextKey)

    try {
      synchronizeSalesPendingMutationUser(pendingMutationUserKey)
      const stored = scope
        ? loadSalesPendingMutation<PersistedWizardCartMutation>(scope)
        : null

      if (stored) {
        if (
          !stored.resumable ||
          !isPersistedWizardCartMutation(stored.payload) ||
          stored.payload.operationId !== stored.operationId ||
          stored.payload.context !== mutationContextKey
        ) {
          markSalesPendingMutationCorrupt(
            scope as SalesPendingMutationScope,
            stored.operationId,
            'Persisted wizard cart payload does not match its durable scope',
          )
        }

        const operation = hydrateCartMutation(stored.payload)
        pendingMutationRef.current = operation
        const localCommit = operation.localCommit

        if (
          localCommit.kind === 'replace-split-items' &&
          localCommit.failureSplitItems &&
          !hasWizardSplitRecoveryOperation(operation.operationId)
        ) {
          persistSplitItems(localCommit.failureSplitItems, localCommit.agreementNetId)
        }

        onBusyChange?.(true)
        queueMicrotask(() => {
          if (!cancelled && mountedRef.current && mutationContextRef.current === mutationContextKey) {
            setPendingMutationError(t('Операція не була підтверджена. Перевірте результат і повторіть з тим самим ключем'))
          }
        })

        return () => {
          cancelled = true
        }
      }
    } catch (storageError) {
      pendingMutationRef.current = null
      onBusyChange?.(true)
      queueMicrotask(() => {
        if (!cancelled && mountedRef.current && mutationContextRef.current === mutationContextKey) {
          setPendingMutationError(getRequestErrorMessage(
            storageError,
            t('Журнал операції недоступний; нові зміни заблоковано'),
          ))
        }
      })

      return () => {
        cancelled = true
      }
    }

    pendingMutationRef.current = null

    onBusyChange?.(false)
    queueMicrotask(() => {
      if (!cancelled && mountedRef.current && mutationContextRef.current === mutationContextKey) {
        setPendingMutationError(null)
      }
    })

    return () => {
      cancelled = true
    }
  }, [getPendingCartMutationScope, mutationContextKey, mutationStorageRevision, onBusyChange, pendingMutationUserKey, persistSplitItems, t])

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

  const clearProductPricingCache = useCallback(() => {
    pricingCacheGenerationRef.current += 1
    setReservationsState((previous) => ({ agreementNetId: previous.agreementNetId, values: EMPTY_RESERVATIONS }))
    setProductPricingState((previous) => ({ agreementNetId: previous.agreementNetId, values: EMPTY_PRODUCT_PRICING }))
    setProductDetailState((previous) => ({ ...previous, values: EMPTY_PRODUCT_DETAILS }))
  }, [])

  const resetDetail = useCallback(() => {
    setDetail(null)
    setEditingDescription(false)
  }, [])

  const clearActiveProductData = useCallback(() => {
    setActive(null)
    setProductDetailState({ agreementNetId: null, saleNetId: EMPTY_GUID, values: EMPTY_PRODUCT_DETAILS })
    setAnalogueState({ items: [], parentNetUid: null })
    setAnalogueIndex(null)
    setComponentParent(null)
    setComponentIndex(null)
    resetDetail()
  }, [resetDetail])

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

  useEffect(() => {
    const value = query.trim()

    if (value.length < PRODUCT_SEARCH_MIN_QUERY_LENGTH || !agreementNetId) {
      return
    }

    const forced = forceSearchRef.current
    forceSearchRef.current = false

    if (!forced && getWizardKeyboardState(1) !== 'ProductSearch') {
      return
    }

    const searchAgreementNetId = agreementNetId
    let cancelled = false
    const handle = setTimeout(async () => {
      try {
        const next = await searchSaleProductsWithAvailability(value, searchAgreementNetId, {
          limit: 20,
          mode: searchMode,
          offset: 0,
          sortMode,
        })

        if (cancelled) {
          return
        }

        virtualExhaustedRef.current = false

        setResults(next.length === 1 && next[0] ? [next[0], ...(next[0].NextSearchedProducts ?? [])] : next)
        setMainIndex(0)
        clearActiveProductData()
      } catch {
        if (!cancelled) {
          setResults([])
        }
      } finally {
        if (!cancelled) {
          setSearching(false)
        }
      }
    }, 360)

    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [query, agreementNetId, searchMode, sortMode, clearActiveProductData])

  function storePricingSnapshot(
    productNetUid: string,
    clientAgreementNetId: string,
    snapshot: ProductPricingSnapshot,
    productReservations: WizardProductReservation[],
  ) {
    const reservation =
      productReservations.find((item) => item.ProductNetUid === productNetUid) ??
      (productReservations.length === 1 ? productReservations[0] : undefined)
    const stored: ProductPricingSnapshot = { ...snapshot }

    if (reservation) {
      stored.reservation = reservation
    }

    setProductPricingState((previous) => {
      const next = new Map(previous.agreementNetId === clientAgreementNetId ? previous.values : EMPTY_PRODUCT_PRICING)
      next.set(productNetUid, stored)

      return { agreementNetId: clientAgreementNetId, values: next }
    })

    if (reservation) {
      setReservationsState((previous) => {
        const next = new Map(previous.agreementNetId === clientAgreementNetId ? previous.values : EMPTY_RESERVATIONS)
        next.set(productNetUid, { ...reservation, ProductNetUid: reservation.ProductNetUid || productNetUid })

        return { agreementNetId: clientAgreementNetId, values: next }
      })
    }
  }

  useEffect(() => {
    const netUid = activeProduct?.NetUid
    const source = active?.source

    if (!netUid || !agreementNetId) {
      return
    }

    const requestAgreementNetId = agreementNetId
    const requestProduct = activeProduct
    const saleNetId = sale?.NetUid || EMPTY_GUID
    let cancelled = false
    const handle = setTimeout(() => {
      void (async () => {
        const [pricing, nearest, totals, productReservations, analogues] = await Promise.all([
          loadPricingSnapshot(netUid, requestAgreementNetId),
          getNearestSupplyOrder(netUid).catch(() => null),
          getAllProductAvailabilities(netUid, requestAgreementNetId, saleNetId).catch(() => null),
          getProductReservationsByAgreement(requestAgreementNetId, netUid).catch(() => [] as WizardProductReservation[]),
          source !== 'analogue' && requestProduct?.HasAnalogue
            ? getProductAnalogues(netUid, requestAgreementNetId).catch(() => [] as WizardSaleProduct[])
            : Promise.resolve<WizardSaleProduct[] | null>(null),
        ])

        if (cancelled) {
          return
        }

        setProductDetailState((previous) => {
          const next = new Map(
            previous.agreementNetId === requestAgreementNetId && previous.saleNetId === saleNetId
              ? previous.values
              : EMPTY_PRODUCT_DETAILS,
          )
          next.set(netUid, {
            availabilities: totals,
            nearestOrder: nearest,
            reservationRows: productReservations,
          })

          return { agreementNetId: requestAgreementNetId, saleNetId, values: next }
        })

        if (pricing) {
          storePricingSnapshot(netUid, requestAgreementNetId, pricing, productReservations)
        }

        if (source !== 'analogue') {
          if (analogues) {
            const filtered = analogues
              .filter((item) => (item.ProductAvailabilities?.length ?? 0) > 0)
              .sort((a, b) => getAvailabilitySortKey(b, isVatSale) - getAvailabilitySortKey(a, isVatSale))
            setAnalogueState({ items: filtered, parentNetUid: netUid })
          } else {
            setAnalogueState({ items: [], parentNetUid: null })
          }

          setAnalogueIndex(null)
        }
      })()
    }, 240)

    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [activeProduct, active?.source, agreementNetId, isVatSale, refreshTick, sale?.NetUid])

  const getProductDetailSnapshot = useCallback(
    (product: WizardSaleProduct | null): ProductDetailSnapshot | null => {
      if (!product?.NetUid || !agreementNetId) {
        return null
      }

      const saleNetId = sale?.NetUid || EMPTY_GUID

      if (productDetailState.agreementNetId !== agreementNetId || productDetailState.saleNetId !== saleNetId) {
        return null
      }

      return productDetailState.values.get(product.NetUid) ?? null
    },
    [agreementNetId, productDetailState, sale?.NetUid],
  )

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
      const reservation = product.NetUid ? reservations.get(product.NetUid) : undefined
      const pricing = product.NetUid ? productPricing.get(product.NetUid) : undefined
      const available = getDisplayedAvailableQty(product)
      const price =
        pricing?.currentPrice ?? getReservationPrice(pricing?.reservation) ?? getReservationPrice(reservation) ?? product.CurrentPrice
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
    [getDisplayedAvailableQty, productPricing, reservations, isVatSale, useEurToUah],
  )

  function beginBusy(options?: { allowPendingMutation?: boolean }): string | null {
    if (busyRef.current) {
      return null
    }

    if (
      !options?.allowPendingMutation &&
      pendingMutationRef.current?.context === mutationContextRef.current
    ) {
      notifications.show({
        color: 'orange',
        message: t('Спочатку перевірте незавершену операцію'),
      })

      return null
    }

    if (
      reconciliationErrorRef.current &&
      reconciliationContextRef.current === mutationContextRef.current
    ) {
      notifications.show({
        color: 'orange',
        message: t('Спочатку повторіть завантаження кошика'),
      })

      return null
    }

    const context = mutationContextRef.current
    busyRef.current = true
    activeMutationContextRef.current = context
    onBusyChange?.(true)
    setBusy(true)

    return context
  }

  function endBusy(context: string) {
    if (activeMutationContextRef.current !== context) {
      return
    }

    activeMutationContextRef.current = null
    busyRef.current = false

    if (mountedRef.current) {
      setBusy(false)
    }

    onBusyChange?.(pendingMutationRef.current?.context === context)
  }

  function isCurrentMutationContext(context: string): boolean {
    return isWizardMutationContextCurrent(context, mutationContextRef.current, mountedRef.current)
  }

  function hydrateCartMutation(
    persisted: PersistedWizardCartMutation,
    beforeMutate?: () => void,
  ): PendingCartMutation {
    return {
      ...persisted,
      inspect: (snapshot) => inspectWizardCartMutation(
        snapshot,
        persisted.operationId,
        persisted.expectation,
      ),
      localCommitted: false,
      mutate: (operationId) => {
        beforeMutate?.()
        return executeWizardCartMutationRequest(persisted.request, operationId)
      },
    }
  }

  function persistPendingCartMutation(operation: PendingCartMutation) {
    const scope = getPendingCartMutationScope(operation.context)

    if (!scope) {
      throw new Error(t('Неможливо безпечно зберегти операцію без авторизованого користувача'))
    }

    pendingMutationRef.current = operation
  }

  async function reconcileCartAfterMutation(context: string): Promise<boolean> {
    try {
      const freshSale = await onCartChanged()

      if (!isCurrentMutationContext(context)) {
        return false
      }

      if (!freshSale) {
        throw new Error(t('Сервер не повернув оновлений кошик'))
      }

      reconciliationErrorRef.current = null
      reconciliationContextRef.current = null
      setReconciliationError(null)

      return true
    } catch (reconcileError) {
      if (!isCurrentMutationContext(context)) {
        return false
      }

      const message = getRequestErrorMessage(reconcileError, t('Не вдалося оновити кошик після збереження'))
      reconciliationErrorRef.current = message
      reconciliationContextRef.current = context
      setReconciliationError(message)
      notifications.show({
        autoClose: false,
        color: 'orange',
        message: `${t('Зміни збережено, але кошик не оновлено')}: ${message}`,
      })

      return false
    }
  }

  async function getFreshCartForOperation(): Promise<SalesUkraineSale> {
    const freshSale = await onCartChanged()

    if (!freshSale) {
      throw new Error(t('Сервер не повернув оновлений кошик'))
    }

    return freshSale
  }

  function finishCartMutation(operation: PendingCartMutation) {
    if (operation.localCommitted) {
      return
    }

    if (operation.localCommit.kind === 'replace-split-items') {
      const localCommit = operation.localCommit

      if (isCurrentMutationContext(operation.context)) {
        persistSplitItems(localCommit.splitItems, localCommit.agreementNetId)
        setEditCart((previous) => previous
          ? {
              ...previous,
              ...(localCommit.isSplit === undefined ? {} : { isSplit: localCommit.isSplit }),
              ...(localCommit.selected === undefined ? {} : { selected: localCommit.selected }),
              splitItems: localCommit.splitItems,
            }
          : previous)
      }
    }

    operation.localCommitted = true
  }

  function clearPendingCartMutation(operation: PendingCartMutation) {
    if (pendingMutationRef.current !== operation) {
      return
    }

    pendingMutationRef.current = null

    if (mountedRef.current) {
      setPendingMutationError(null)
    }
  }

  function retainPendingCartMutation(
    operation: PendingCartMutation,
    result: Extract<WizardMutationAttemptResult<SalesUkraineSale>, { status: 'pending-retry' }>,
  ) {
    pendingMutationRef.current = operation
    const mutationMessage = getRequestErrorMessage(result.mutationError, operation.fallbackMessage)
    const reconciliationMessage = result.reconciliationError
      ? getRequestErrorMessage(result.reconciliationError, t('Не вдалося перевірити кошик'))
      : null
    setPendingMutationError(
      reconciliationMessage
        ? `${mutationMessage}. ${t('Перевірка кошика')}: ${reconciliationMessage}`
        : mutationMessage,
    )
    onBusyChange?.(true)
  }

  async function handleCartMutationResult(
    operation: PendingCartMutation,
    context: string,
    lease: SalesPendingMutationLease<PersistedWizardCartMutation>,
    result: WizardMutationAttemptResult<SalesUkraineSale>,
  ): Promise<boolean> {
    if (result.status === 'pending-retry' || result.status === 'definitive-failure') {
      markSalesPendingMutationUnknown(lease)
      markWizardSplitExtractionUnknown(lease.operationId)

      if (isCurrentMutationContext(context)) {
        if (result.status === 'pending-retry') {
          retainPendingCartMutation(operation, result)
        } else {
          pendingMutationRef.current = operation
          setPendingMutationError(getRequestErrorMessage(result.mutationError, operation.fallbackMessage))
          onBusyChange?.(true)
        }
      }

      return false
    }

    // Keep both journals conservative until the split extraction is durable.
    // If committing either record fails, recovery must still see an unknown
    // submitted operation instead of a cleared cart journal and hidden items.
    markSalesPendingMutationUnknown(lease)
    markWizardSplitExtractionUnknown(lease.operationId)
    commitWizardSplitExtraction(lease.operationId)
    resolveSalesPendingMutation(lease, 'committed')

    if (!isCurrentMutationContext(context)) {
      return false
    }

    finishCartMutation(operation)
    clearPendingCartMutation(operation)

    if (result.status === 'acknowledged') {
      await reconcileCartAfterMutation(context)
    } else {
      reconciliationErrorRef.current = null
      reconciliationContextRef.current = null
      setReconciliationError(null)
    }

    return true
  }

  async function runCartMutation(
    context: string,
    operation: PendingCartMutation,
    retry = false,
  ): Promise<boolean> {
    const scope = getPendingCartMutationScope(operation.context)

    if (!scope) {
      throw new Error(t('Неможливо безпечно зберегти операцію без авторизованого користувача'))
    }

    const persisted = toPersistedCartMutation(operation)

    return withSalesPendingMutationLock(scope, operation.operationId, persisted, async (lease) => {
      if (!isPersistedWizardCartMutation(lease.entry.payload)) {
        markSalesPendingMutationCorrupt(scope, lease.operationId, 'Durable wizard cart payload failed schema validation')
      }

      assertWizardSplitRecoveryOperationFence(lease.operationId)

      let submitted = lease.entry.phase !== 'prepared'
      const durableOperation = hydrateCartMutation(
        lease.entry.payload,
        () => {
          if (markWizardSplitExtractionSubmitted(lease.operationId)) {
            submitted = true
          }

          markSalesPendingMutationSubmitted(lease)
          submitted = true
        },
      )
      pendingMutationRef.current = durableOperation

      try {
        const result = retry
          ? await retryWizardMutation(durableOperation, getFreshCartForOperation)
          : await attemptPersistentSalesCartMutation(durableOperation, getFreshCartForOperation)

        return await handleCartMutationResult(durableOperation, context, lease, result)
      } catch (error) {
        if (submitted) {
          try {
            markWizardSplitExtractionUnknown(lease.operationId)
          } finally {
            markSalesPendingMutationUnknown(lease)
          }
        }

        throw error
      }
    })
  }

  function createCartMutation(
    context: string,
    options: {
      expectation: WizardCartMutationExpectation
      fallbackMessage: string
      localCommit?: WizardCartLocalCommit
      operationId?: string
      request: WizardCartMutationRequest
    },
  ): PendingCartMutation {
    const operationId = options.operationId ?? createWizardOperationId()

    const persisted = createPersistedWizardCartMutation({
      context,
      expectation: options.expectation,
      fallbackMessage: options.fallbackMessage,
      localCommit: options.localCommit ?? { kind: 'none' },
      operationId,
      request: options.request,
    })

    return hydrateCartMutation(persisted)
  }

  async function retryPendingCartMutation() {
    const operation = pendingMutationRef.current

    if (!operation || operation.context !== mutationContextRef.current) {
      return
    }

    const context = beginBusy({ allowPendingMutation: true })

    if (!context) {
      return
    }

    try {
      const completed = await runCartMutation(context, operation, true)

      if (completed && isCurrentMutationContext(context)) {
        clearProductPricingCache()
        notifications.show({ color: 'green', message: t('Операцію підтверджено, кошик оновлено') })
      }
    } catch (mutationError) {
      if (isCurrentMutationContext(context)) {
        setPendingMutationError(getRequestErrorMessage(mutationError, operation.fallbackMessage))
        notifications.show({ color: 'red', message: getRequestErrorMessage(mutationError, operation.fallbackMessage) })
      }
    } finally {
      endBusy(context)
    }
  }

  async function retryCartReconciliation() {
    if (busyRef.current) {
      return
    }

    const context = mutationContextRef.current
    busyRef.current = true
    activeMutationContextRef.current = context
    onBusyChange?.(true)
    setBusy(true)

    try {
      const freshSale = await onCartChanged()

      if (!isCurrentMutationContext(context)) {
        return
      }

      if (!freshSale) {
        throw new Error(t('Сервер не повернув оновлений кошик'))
      }

      reconciliationErrorRef.current = null
      reconciliationContextRef.current = null
      setReconciliationError(null)
      notifications.show({ color: 'green', message: t('Кошик оновлено') })
    } catch (reconcileError) {
      if (isCurrentMutationContext(context)) {
        const message = getRequestErrorMessage(reconcileError, t('Не вдалося оновити кошик'))
        reconciliationErrorRef.current = message
        reconciliationContextRef.current = context
        setReconciliationError(message)
        notifications.show({ color: 'red', message })
      }
    } finally {
      endBusy(context)
    }
  }

  function focusSearchInput() {
    searchInputRef.current?.focus()
  }

  function focusMainProduct(product: WizardSaleProduct) {
    setActive({ product, source: 'main' })
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

    if (options?.keepDetail) {
      setDetail((previous) => ({ chipIndex: previous?.chipIndex ?? null, rowIndex: null }))
    } else {
      resetDetail()
    }
  }

  async function loadMoreResults() {
    const value = query.trim()

    if (virtualLoadingRef.current || virtualExhaustedRef.current || value.length < PRODUCT_SEARCH_MIN_QUERY_LENGTH || !agreementNetId) {
      return
    }

    virtualLoadingRef.current = true

    try {
      const next = await searchSaleProductsWithAvailability(value, agreementNetId, {
        limit: 10,
        mode: searchMode,
        offset: results.length,
        sortMode,
      })

      if (next.length === 0) {
        virtualExhaustedRef.current = true
      } else {
        setResults((previous) => [...previous, ...next.filter((item) => !previous.some((existing) => existing.NetUid === item.NetUid))])
      }
    } catch {
      virtualExhaustedRef.current = true
    } finally {
      virtualLoadingRef.current = false
    }
  }

  function handleQueryChange(value: string) {
    if (getWizardKeyboardState(1) !== 'ProductSearch') {
      return
    }

    setQuery(value)

    if (value.trim().length < PRODUCT_SEARCH_MIN_QUERY_LENGTH) {
      setResults([])
      setSearching(false)
      clearActiveProductData()
    } else if (agreementNetId) {
      setSearching(true)
    }
  }

  function handleSearchSettingsChange(nextMode: string | null, nextSort: string | null) {
    if (nextMode) {
      setSearchMode(nextMode)
    }

    if (nextSort) {
      setSortMode(nextSort)
    }

    setResults([])
    clearActiveProductData()

    if (query.trim().length >= PRODUCT_SEARCH_MIN_QUERY_LENGTH) {
      forceSearchRef.current = true
      setSearching(true)
    }
  }

  async function loadClientRecommendations() {
    if (!clientNetId || isLoadingRecommendations) {
      return
    }

    setLoadingRecommendations(true)
    setSearching(true)

    try {
      const recommended = (await getMostPurchasedProductsByClientId(clientNetId, false, {
        clientAgreementNetId: agreementNetId ?? undefined,
      })) as unknown as WizardSaleProduct[]

      setQuery('')
      setResults(recommended)
      setMainIndex(0)
      clearActiveProductData()
      keyboard.setState('ProductSearch')
      focusSearchInput()

      if (recommended.length === 0) {
        notifications.show({ color: 'orange', message: t('Рекомендацій для клієнта не знайдено') })
      }
    } catch {
      notifications.show({ color: 'red', message: t('Не вдалося завантажити рекомендації') })
    } finally {
      setSearching(false)
      setLoadingRecommendations(false)
    }
  }

  function canChangePrintedSale(): boolean {
    if (sale?.IsPrinted) {
      const approved = (sale.HistoryInvoiceEdit ?? []).some((entry) => Boolean((entry as { ApproveUpdate?: boolean }).ApproveUpdate))

      if (!approved) {
        notifications.show({ color: 'red', message: t('Зміни заборонені') })

        return false
      }
    }

    return true
  }

  async function prepareAddToCart(product: WizardSaleProduct | null) {
    if (!product?.NetUid) {
      return
    }

    if (!canChangePrintedSale()) {
      return
    }

    if (!agreementNetId || !sale?.NetUid) {
      notifications.show({ color: 'orange', message: t('Сесія поточного клієнта була видалена відкриттям іншої вкладки') })

      return
    }

    const sellable = getWizardSellableQty(product, isVatSale)

    if (typeof sellable === 'number' && sellable === 0) {
      setFutureProduct(product)

      return
    }

    const context = beginBusy()

    if (!context) {
      return
    }

    try {
      const buckets = await getProductAvailabilityBuckets(product.NetUid, agreementNetId)
      const available = isVatSale
        ? buckets?.AvailableQtyUkVAT ?? 0
        : (buckets?.AvailableQtyUk ?? 0) + (buckets?.AvailableQtyUkReSale ?? 0)
      const item: SalesUkraineOrderItem = {
        Deleted: false,
        Id: 0,
        NetUid: EMPTY_GUID,
        Product: product,
        Qty: 0,
      }

      if (isCurrentMutationContext(context)) {
        setQtyModal({ available, item, kind: 'add' })
      }
    } catch (loadError) {
      if (isCurrentMutationContext(context)) {
        notifications.show({ color: 'red', message: getRequestErrorMessage(loadError, t('Не вдалося додати товар')) })
      }
    } finally {
      endBusy(context)
    }
  }

  function resetSearchAfterAdd(product: WizardSaleProduct | undefined) {
    const state = getWizardKeyboardState(1)

    if (state === 'ProductSearch' || state === 'ProductSelection') {
      const hasFollowUps = Boolean(product && (product.HasAnalogue || product.HasComponent))

      if (!hasFollowUps) {
        setQuery('')
        setActive(null)
        resetDetail()
        keyboard.setState('ProductSearch')
      }
    }

    focusSearchInput()
  }

  async function acceptQtyModal(qty: number, comment: string) {
    const modal = qtyModal

    if (!modal) {
      return
    }

    const context = beginBusy()

    if (!context) {
      return
    }

    setQtyModal(null)

    try {
      if (modal.kind === 'add') {
        if (!agreementNetId || !sale?.NetUid) {
          return
        }

        const requestItem = { ...modal.item, Comment: comment, Qty: qty }
        const mutation = createAddOrUpdateSalesCartMutation({
          clientAgreementNetId: agreementNetId,
          orderItem: requestItem,
          orderItems,
          saleNetId: sale.NetUid,
        })
        const completed = await runCartMutation(
          context,
          createCartMutation(context, {
            expectation: mutation.expectation,
            fallbackMessage: t('Не вдалося додати товар'),
            request: mutation.request,
          }),
        )

        if (completed && isCurrentMutationContext(context)) {
          resetSearchAfterAdd(modal.item.Product as WizardSaleProduct | undefined)
        }
      } else if (modal.kind === 'edit-current') {
        if (editCart?.isSplit) {
          const ordered = getWizardProductNumber(modal.item.Qty) ?? 0
          const rest = ordered - qty

          if (rest < 0) {
            return
          }

          if (rest === 0 && (!modal.item.NetUid || modal.item.NetUid === EMPTY_GUID)) {
            throw new Error('Cannot split an order item without a persisted uid')
          }

          const product = modal.item.Product as WizardSaleProduct | undefined

          if (!product) {
            throw new Error('Cannot split an order item without a product')
          }

          const splitItems = addToSplitItems(
            editCart.splitItems,
            { ...modal.item, Product: product },
            qty,
            comment,
            user as unknown as SalesUkraineUser,
            agreementNetId,
          )

          const expectation: WizardCartMutationExpectation = rest > 0
            ? {
                afterQty: rest,
                beforeQty: ordered,
                kind: 'row-quantity',
                rowNetUid: modal.item.NetUid ?? '',
              }
            : {
                beforeQty: ordered,
                kind: 'row-deleted',
                rowNetUid: modal.item.NetUid ?? '',
              }
          const operation = createCartMutation(context, {
            localCommit: {
              agreementNetId,
              failureSplitItems: editCart.splitItems,
              kind: 'replace-split-items',
              splitItems,
            },
            expectation,
            fallbackMessage: t('Не вдалося розділити позицію'),
            request: rest > 0
              ? { kind: 'update', orderItem: { ...modal.item, Qty: rest } }
              : {
                  kind: 'delete',
                  orderItemNetId: modal.item.NetUid as string,
                },
          })

          stageWizardSplitExtraction({
            fallbackItems: editCart.splitItems,
            items: splitItems,
            mutation: toWizardSplitMutationSnapshot(operation),
            source: getSplitRecoverySource(),
          })

          await runCartMutation(context, operation)
        } else {
          await runCartMutation(
            context,
            createCartMutation(context, {
              expectation: {
                afterQty: qty,
                beforeQty: getWizardProductNumber(modal.item.Qty) ?? 0,
                kind: 'row-quantity',
                rowNetUid: modal.item.NetUid ?? '',
              },
              fallbackMessage: t('Не вдалося оновити кількість'),
              request: {
                kind: 'update',
                orderItem: { ...modal.item, Comment: comment, Qty: qty },
              },
            }),
          )
        }
      } else {
        if (!editCart) {
          throw new Error('Cannot restore a split item outside cart edit mode')
        }

        const splitIndex = editCart.splitItems.indexOf(modal.item)
        const trackedSplitItems = ensureWizardSplitRestoreOperationNetUids(editCart.splitItems)
        const trackedItem = trackedSplitItems[splitIndex]

        if (!trackedItem?.RestoreOperationNetUid) {
          throw new Error('Cannot create a stable restore operation')
        }

        const rest = trackedItem.Qty - qty

        if (rest < 0) {
          return
        }

        const existing = findRestorableWizardOrderItem(orderItems, trackedItem)
        const saleNetUid = sale?.NetUid
        const existingQty = getWizardProductNumber(existing?.Qty) ?? 0

        if (!existing && (!agreementNetId || !saleNetUid)) {
          throw new Error('Cannot restore a split item without a current sale')
        }

        const splitItems = clearWizardSplitRestoreTracking(
          updateWizardSplitOrderItemQty(trackedSplitItems, trackedItem, rest),
          trackedItem.RestoreOperationNetUid,
        )
        const operation = createCartMutation(context, {
          localCommit: {
            agreementNetId,
            failureSplitItems: clearWizardSplitRestoreTracking(
              trackedSplitItems,
              trackedItem.RestoreOperationNetUid,
            ),
            isSplit: splitItems.length > 0,
            kind: 'replace-split-items',
            splitItems,
          },
          expectation: existing?.NetUid
            ? {
                afterQty: existingQty + qty,
                beforeQty: existingQty,
                kind: 'row-quantity',
                rowNetUid: existing.NetUid,
              }
            : { kind: 'operation-marker' },
          fallbackMessage: t('Не вдалося відновити позицію'),
          operationId: trackedItem.RestoreOperationNetUid,
          request: existing
            ? { kind: 'update', orderItem: { ...existing, Qty: existingQty + qty } }
            : {
                clientAgreementNetId: agreementNetId as string,
                kind: 'add',
                orderItem: mapWizardSplitOrderItem(resizeWizardSplitOrderItem(trackedItem, qty)),
                saleNetId: saleNetUid as string,
              },
        })
        const stagedSplitItems = stageWizardSplitRestoreMutation(
          trackedSplitItems,
          splitIndex,
          toWizardSplitMutationSnapshot(operation),
        )

        persistSplitItems(stagedSplitItems, agreementNetId)
        setEditCart((previous) => (previous ? { ...previous, splitItems: stagedSplitItems } : previous))
        await runCartMutation(context, operation)
      }

      if (isCurrentMutationContext(context)) {
        clearProductPricingCache()
      }
    } catch (mutationError) {
      if (isCurrentMutationContext(context)) {
        notifications.show({ color: 'red', message: getRequestErrorMessage(mutationError, t('Не вдалося оновити кількість')) })
      }
    } finally {
      endBusy(context)
    }
  }

  function cancelQtyModal() {
    setQtyModal(null)
    keyboard.consumeNextEscape()
    focusSearchInput()
  }

  async function removeItem(item: SalesUkraineOrderItem) {
    if (!item.NetUid) {
      return
    }

    const context = beginBusy()

    if (!context) {
      return
    }

    try {
      const completed = await runCartMutation(
        context,
        createCartMutation(context, {
          expectation: {
            beforeQty: getWizardProductNumber(item.Qty) ?? 0,
            kind: 'row-deleted',
            rowNetUid: item.NetUid,
          },
          fallbackMessage: t('Не вдалося видалити товар'),
          request: { kind: 'delete', orderItemNetId: item.NetUid },
        }),
      )

      if (completed && isCurrentMutationContext(context)) {
        clearProductPricingCache()
      }
    } catch (mutationError) {
      if (isCurrentMutationContext(context)) {
        notifications.show({ color: 'red', message: getRequestErrorMessage(mutationError, t('Не вдалося видалити товар')) })
      }
    } finally {
      endBusy(context)
    }
  }

  async function onEditOrderItem(item: SalesUkraineOrderItem) {
    if (!isSaleLifecycleNew) {
      if (sale?.IsPrinted) {
        const approved = (sale.HistoryInvoiceEdit ?? []).some((entry) => Boolean((entry as { ApproveUpdate?: boolean }).ApproveUpdate))

        if (!approved) {
          notifications.show({ color: 'red', message: t('Зміни заборонені') })

          return
        }
      } else {
        // Was a silent return — from the row-actions popup that read as "nothing works".
        notifications.show({ color: 'red', message: t('Неможливо редагувати накладну') })

        return
      }
    }

    if (!item.Product?.NetUid || !agreementNetId) {
      return
    }

    const context = beginBusy()

    if (!context) {
      return
    }

    try {
      const buckets = await getProductAvailabilityBuckets(item.Product.NetUid, agreementNetId)
      const available = isVatSale
        ? buckets?.AvailableQtyUkVAT ?? 0
        : (buckets?.AvailableQtyUk ?? 0) + (buckets?.AvailableQtyUkReSale ?? 0)

      if (isCurrentMutationContext(context)) {
        setQtyModal({ available: (getWizardProductNumber(item.Qty) ?? 0) + available, item, kind: 'edit-current' })
      }
    } catch {
      if (isCurrentMutationContext(context)) {
        setQtyModal({ available: getWizardProductNumber(item.Qty) ?? 0, item, kind: 'edit-current' })
      }
    } finally {
      endBusy(context)
    }
  }

  function openEditCart() {
    if (orderItems.length === 0) {
      notifications.show({ color: 'orange', message: t('Немає позицій для редагування') })

      return
    }

    if (!sale?.NetUid) {
      notifications.show({ color: 'orange', message: t('Завантаження рахунку') })

      return
    }

    if (getSaleLifecycleTypeKey(sale.BaseLifeCycleStatus?.SaleLifeCycleType) !== '0') {
      notifications.show({ color: 'red', message: t('Неможливо редагувати накладну') })

      return
    }

    const splitItems = getWizardSplitOrderItems()
    setEditCart({ isSplit: splitItems.length > 0, selected: { index: 0, list: 'current' }, splitItems })
    keyboard.setState('EditShoppingCart')
  }

  function closeEditCartAfterRestoration() {
    clearWizardSplitOrderItems()
    setEditCart(null)

    const previousState = getPreviousProductKeyboardState()

    if (previousState === 'ProductSearch' || previousState === 'ProductSelection') {
      setQuery('')
      resetDetail()
      keyboard.setState('ProductSearch')
      focusSearchInput()
    } else {
      keyboard.restorePreviousProductState()
    }
  }

  async function exitEditCart() {
    const cart = editCart

    if (!cart) {
      return
    }

    if (cart.splitItems.length > 0 && onRestoreSplitItems) {
      const context = beginBusy()

      if (!context) {
        return
      }

      try {
        if (!(await onRestoreSplitItems()) || !isCurrentMutationContext(context)) {
          return
        }

        clearProductPricingCache()
        closeEditCartAfterRestoration()
      } catch (restoreError) {
        if (isCurrentMutationContext(context)) {
          notifications.show({
            color: 'red',
            message: getRequestErrorMessage(restoreError, t('Не вдалося відновити всі позиції')),
          })
        }
      } finally {
        endBusy(context)
      }

      return
    }

    if (cart.splitItems.length > 0) {
      if (!agreementNetId || !sale?.NetUid) {
        notifications.show({ color: 'red', message: t('Не вдалося відновити позиції без поточного рахунку') })

        return
      }

      const currentAgreementNetId = agreementNetId
      const saleNetUid = sale.NetUid
      const trackedSplitItems = ensureWizardSplitRestoreOperationNetUids(cart.splitItems)

      persistSplitItems(trackedSplitItems, currentAgreementNetId)
      setEditCart((previous) => (previous ? { ...previous, splitItems: trackedSplitItems } : previous))

      const context = beginBusy()

      if (!context) {
        return
      }

      const restoredQtyByOrderItem = new Map<string, number>()
      const restoreOperations = new Map<string, PendingCartMutation>()

      try {
        const result = await restoreWizardSplitItemsSequentially(
          trackedSplitItems,
          async (item, index, operationId, isRetry) => {
            const existing = findRestorableWizardOrderItem(orderItems, item)
            const existingQty = getWizardProductNumber(existing?.Qty) ?? 0
            const restoredQty = existing?.NetUid
              ? restoredQtyByOrderItem.get(existing.NetUid) ?? 0
              : 0
            const remainingAfterCommit = trackedSplitItems.slice(index + 1)
            const operation = createCartMutation(context, {
              expectation: existing?.NetUid
                ? {
                    afterQty: existingQty + restoredQty + item.Qty,
                    beforeQty: existingQty + restoredQty,
                    kind: 'row-quantity',
                    rowNetUid: existing.NetUid,
                  }
                : { kind: 'operation-marker' },
              fallbackMessage: t('Не вдалося відновити всі позиції'),
              localCommit: {
                agreementNetId: currentAgreementNetId,
                failureSplitItems: clearWizardSplitRestoreTracking(
                  trackedSplitItems.slice(index),
                  operationId,
                ),
                isSplit: remainingAfterCommit.length > 0,
                kind: 'replace-split-items',
                selected: remainingAfterCommit.length > 0
                  ? { index: 0, list: 'split' }
                  : orderItems.length > 0
                    ? { index: 0, list: 'current' }
                    : null,
                splitItems: remainingAfterCommit,
              },
              operationId,
              request: existing
                ? {
                    kind: 'update',
                    orderItem: { ...existing, Qty: existingQty + restoredQty + item.Qty },
                  }
                : {
                    clientAgreementNetId: currentAgreementNetId,
                    kind: 'add',
                    orderItem: mapWizardSplitOrderItem(item),
                    saleNetId: saleNetUid,
                  },
            })
            restoreOperations.set(operationId, operation)
            const stagedItem = stageWizardSplitRestoreMutation(
              [item],
              0,
              toWizardSplitMutationSnapshot(operation),
            )[0] as WizardSplitOrderItem
            Object.assign(item, stagedItem)
            trackedSplitItems[index] = item
            persistSplitItems(trackedSplitItems.slice(index), currentAgreementNetId)
            persistPendingCartMutation(operation)
            const completed = await runCartMutation(context, operation, isRetry)

            if (!completed) {
              throw new Error(t('Операція відновлення не підтверджена; повторіть звірку тим самим ключем'))
            }

            if (existing?.NetUid) {
              restoredQtyByOrderItem.set(existing.NetUid, restoredQty + item.Qty)
            }
          },
          ({ remaining }) => {
            if (isCurrentMutationContext(context)) {
              persistSplitItems(remaining, currentAgreementNetId)
              setEditCart((previous) =>
                previous
                  ? {
                      ...previous,
                      isSplit: remaining.length > 0,
                      selected: remaining.length > 0
                        ? { index: 0, list: 'split' }
                        : orderItems.length > 0
                          ? { index: 0, list: 'current' }
                          : null,
                      splitItems: remaining,
                    }
                  : previous,
              )
            }
          },
          async (item, _index, operationId, error) => {
            const operation = restoreOperations.get(operationId)

            if (!operation) {
              return 'pending'
            }

            const completed = await runCartMutation(context, operation, true)

            if (completed) {
              const existing = findRestorableWizardOrderItem(orderItems, item)

              if (existing?.NetUid) {
                restoredQtyByOrderItem.set(
                  existing.NetUid,
                  (restoredQtyByOrderItem.get(existing.NetUid) ?? 0) + item.Qty,
                )
              }

              return 'committed'
            }

            setPendingMutationError(getRequestErrorMessage(error, operation.fallbackMessage))

            return 'pending'
          },
          ({ remaining }) => {
            if (isCurrentMutationContext(context)) {
              persistSplitItems(remaining, currentAgreementNetId)
              setEditCart((previous) => (previous ? { ...previous, splitItems: remaining } : previous))
            }
          },
        )

        if ((result.committed.length > 0 || result.error) && isCurrentMutationContext(context)) {
          clearProductPricingCache()
        }

        if (result.error) {
          if (isCurrentMutationContext(context)) {
            persistSplitItems(result.remaining, currentAgreementNetId)
            setEditCart((previous) => previous
              ? {
                  ...previous,
                  isSplit: result.remaining.length > 0,
                  selected: result.remaining.length > 0 ? { index: 0, list: 'split' } : null,
                  splitItems: result.remaining,
                }
              : previous)
            notifications.show({
              color: 'red',
              message: getRequestErrorMessage(result.error, t('Не вдалося відновити всі позиції')),
            })
          }

          return
        }
      } catch (mutationError) {
        if (isCurrentMutationContext(context)) {
          notifications.show({ color: 'red', message: getRequestErrorMessage(mutationError, t('Не вдалося оновити кількість')) })
        }

        return
      } finally {
        endBusy(context)
      }

      if (!isCurrentMutationContext(context)) {
        return
      }
    }

    closeEditCartAfterRestoration()
  }

  async function editSelectedCartRow() {
    const cart = editCart

    if (!cart?.selected) {
      return
    }

    if (!canChangePrintedSale()) {
      return
    }

    if (cart.selected.list === 'current') {
      const item = orderItems[cart.selected.index]

      if (item) {
        await onEditOrderItem(item)
      }
    } else {
      const item = cart.splitItems[cart.selected.index]

      if (item) {
        setQtyModal({ available: item.Qty, item, kind: 'edit-split' })
      }
    }
  }

  async function confirmRemoveSelected() {
    setRemoveConfirmOpen(false)
    const cart = editCart
    const selected = cart?.selected

    if (!cart || !selected) {
      return
    }

    const context = beginBusy()

    if (!context) {
      return
    }

    try {
      if (selected.list === 'current') {
        const item = orderItems[selected.index]

        if (item) {
          const product = item.Product as WizardSaleProduct | undefined
          const splitItems = cart.isSplit && product
            ? addToSplitItems(
                cart.splitItems,
                { ...item, Product: product },
                getWizardProductNumber(item.Qty) ?? 0,
                item.Comment,
                user as unknown as SalesUkraineUser,
                agreementNetId,
              )
            : null

          if (!item.NetUid || item.NetUid === EMPTY_GUID) {
            throw new Error('Cannot remove an order item without a persisted uid')
          }
          const itemNetUid = item.NetUid
          const operation = createCartMutation(context, {
            expectation: {
              beforeQty: getWizardProductNumber(item.Qty) ?? 0,
              kind: 'row-deleted',
              rowNetUid: itemNetUid,
            },
            fallbackMessage: t('Не вдалося видалити товар'),
            localCommit: splitItems
              ? {
                  agreementNetId,
                  failureSplitItems: cart.splitItems,
                  kind: 'replace-split-items',
                  selected: { index: Math.max(0, selected.index - 1), list: 'current' },
                  splitItems,
                }
              : { kind: 'none' },
            request: { kind: 'delete', orderItemNetId: itemNetUid },
          })

          if (splitItems) {
            stageWizardSplitExtraction({
              fallbackItems: cart.splitItems,
              items: splitItems,
              mutation: toWizardSplitMutationSnapshot(operation),
              source: getSplitRecoverySource(),
            })
          }

          await runCartMutation(context, operation)
        }
      } else {
        const item = cart.splitItems[selected.index]

        if (item) {
          const trackedSplitItems = ensureWizardSplitRestoreOperationNetUids(cart.splitItems)
          const trackedItem = trackedSplitItems[selected.index]

          if (!trackedItem?.RestoreOperationNetUid) {
            throw new Error('Cannot create a stable restore operation')
          }

          const existing = findRestorableWizardOrderItem(orderItems, trackedItem)
          const saleNetUid = sale?.NetUid
          const existingQty = getWizardProductNumber(existing?.Qty) ?? 0

          if (!existing && (!agreementNetId || !saleNetUid)) {
            throw new Error('Cannot restore a split item without a current sale')
          }

          const splitItems = trackedSplitItems.filter((_, index) => index !== selected.index)

          const operation = createCartMutation(context, {
            localCommit: {
              agreementNetId,
              failureSplitItems: clearWizardSplitRestoreTracking(
                trackedSplitItems,
                trackedItem.RestoreOperationNetUid,
              ),
              isSplit: splitItems.length > 0,
              kind: 'replace-split-items',
              selected: splitItems.length > 0
                ? { index: Math.max(0, selected.index - 1), list: 'split' }
                : null,
              splitItems,
            },
            expectation: existing?.NetUid
              ? {
                  afterQty: existingQty + trackedItem.Qty,
                  beforeQty: existingQty,
                  kind: 'row-quantity',
                  rowNetUid: existing.NetUid,
                }
              : { kind: 'operation-marker' },
            fallbackMessage: t('Не вдалося відновити позицію'),
            operationId: trackedItem.RestoreOperationNetUid,
            request: existing
              ? { kind: 'update', orderItem: { ...existing, Qty: existingQty + trackedItem.Qty } }
              : {
                  clientAgreementNetId: agreementNetId as string,
                  kind: 'add',
                  orderItem: mapWizardSplitOrderItem(trackedItem),
                  saleNetId: saleNetUid as string,
                },
          })
          const stagedSplitItems = stageWizardSplitRestoreMutation(
            trackedSplitItems,
            selected.index,
            toWizardSplitMutationSnapshot(operation),
          )

          persistSplitItems(stagedSplitItems, agreementNetId)
          setEditCart((previous) => (previous ? { ...previous, splitItems: stagedSplitItems } : previous))
          await runCartMutation(context, operation)
        }
      }

      if (isCurrentMutationContext(context)) {
        clearProductPricingCache()
      }
    } catch (mutationError) {
      if (isCurrentMutationContext(context)) {
        notifications.show({ color: 'red', message: getRequestErrorMessage(mutationError, t('Не вдалося видалити товар')) })
      }
    } finally {
      endBusy(context)
    }
  }

  function moveCartSelection(direction: 1 | -1) {
    const items = orderItems

    setEditCart((previous) => {
      if (!previous) {
        return previous
      }

      const flat: WizardCartSelection[] = []

      for (let index = 0; index < items.length; index += 1) {
        flat.push({ index, list: 'current' })
      }

      if (previous.isSplit) {
        for (let index = 0; index < previous.splitItems.length; index += 1) {
          flat.push({ index, list: 'split' })
        }
      }

      if (flat.length === 0) {
        return { ...previous, selected: null }
      }

      const selected = previous.selected
      const currentIndex = selected ? flat.findIndex((entry) => entry.list === selected.list && entry.index === selected.index) : -1
      const nextIndex =
        currentIndex === -1
          ? direction === 1
            ? 0
            : flat.length - 1
          : direction === 1 && currentIndex === flat.length - 1 && previous.isSplit && previous.splitItems.length > 0
            ? items.length
            : (currentIndex + direction + flat.length) % flat.length

      return { ...previous, selected: flat[nextIndex] ?? null }
    })
  }

  function toggleSplitMode() {
    const items = orderItems

    setEditCart((previous) => {
      if (!previous) {
        return previous
      }

      const isSplit = !previous.isSplit
      let selected = previous.selected

      if (!isSplit && (!selected || selected.list === 'split')) {
        selected = items.length > 0 ? { index: 0, list: 'current' } : null
      }

      return { ...previous, isSplit, selected }
    })
  }

  async function applyShift(qty: number) {
    const row = shiftRow

    if (!row?.NetId || !row.OrderItem) {
      return
    }

    setShiftRow(null)

    const context = beginBusy()

    if (!context) {
      return
    }

    try {
      const saleToNetId = sale?.NetUid && sale.NetUid !== EMPTY_GUID ? sale.NetUid : agreementNetId || ''
      const completed = await runCartMutation(
        context,
        createCartMutation(context, {
          expectation: { kind: 'operation-marker' },
          fallbackMessage: t('Не вдалося перемістити'),
          request: {
            kind: 'shift',
            orderItem: { ...row.OrderItem, Qty: qty },
            saleFromNetId: row.NetId,
            saleToNetId,
          },
        }),
      )

      if (completed && isCurrentMutationContext(context)) {
        clearProductPricingCache()
        setRefreshTick((tick) => tick + 1)
        focusSearchInput()
      }
    } catch (mutationError) {
      if (isCurrentMutationContext(context)) {
        notifications.show({ color: 'red', message: getRequestErrorMessage(mutationError, t('Не вдалося перемістити')) })
      }
    } finally {
      endBusy(context)
    }
  }

  function openImage(product: WizardSaleProduct | null) {
    const imageUrl = product ? (getProductMainImage(product as Product)?.ImageUrl ?? product.Image) : null

    if (!imageUrl) {
      return
    }

    setImageUrl(toProxiedAssetUrl(imageUrl) || imageUrl)
    keyboard.setState('ViewImage')
  }

  function closeImage() {
    setImageUrl(null)
    keyboard.restorePreviousProductState()
  }

  function openInterest(product: WizardSaleProduct | null) {
    if (!product?.NetUid || !agreementNetId) {
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
    setActive((previous) => (previous ? { ...previous, product: updated } : previous))
    setResults((previous) => previous.map((item) => (item.NetUid === updated.NetUid ? { ...item, Description: updated.Description } : item)))
    setAnalogueState((previous) => ({
      ...previous,
      items: previous.items.map((item) => (item.NetUid === updated.NetUid ? { ...item, Description: updated.Description } : item)),
    }))
  }

  function clearSelection() {
    clearActiveProductData()
    setQuery('')
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
    if (qtyModal || shiftRow || futureProduct || removeConfirmOpen || removeRowItem || cartActionItem || isActEditOpen) {
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

      if (containerRef.current?.contains(target as Node) || isInteractiveTarget(target)) {
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

  const mainStatesActive = kbState === 'ProductSearch' || kbState === 'ProductSelection' || kbState === 'FullDetail'
  const analogueStatesActive = kbState === 'AnalogueSelection' || kbState === 'AnalogueFullDetail'
  const componentStatesActive = kbState === 'ComponentSelection' || kbState === 'ComponentFullDetail'
  const keepMainPickerCentered = kbState === 'ProductSearch' || kbState === 'ProductSelection' || kbState === 'FullDetail'
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
      <Group className="new-sale-related-row__metrics" gap={6} wrap="nowrap">
        {setQty != null && (
          <Text className="new-sale-related-row__metric is-muted">
            {t('К-сть')}: {qtyFormatter.format(setQty)}
          </Text>
        )}
        <Text className="new-sale-related-row__metric is-qty">
          {/* Search-payload sellable qty (stable across focus) so the number does
              not jump when switching between analogues as the detailed snapshot
              loads for the focused row (bug #17). */}
          {qtyFormatter.format(getWizardSellableQty(product, isVatSale) ?? 0)} {product.MeasureUnit?.Name ?? ''}
        </Text>
        <Text className="new-sale-related-row__metric">{amountFormatter.format(getWizardProductNumber(product.CurrentPrice) ?? 0)} EUR</Text>
        <Text className="new-sale-related-row__metric">{amountFormatter.format(localPrice)} {localCurrencyCode}</Text>
      </Group>
    )
  }

  // Keep the product summary visible, but reveal the old full-detail data only in Ctrl+Enter mode.
  const selectedMainProduct = mainProduct ? (active?.source === 'main' && activeProduct ? activeProduct : mainProduct) : null
  const selectedMainSnapshot = getProductDetailSnapshot(selectedMainProduct)
  const isMainFullDetail = kbState === 'FullDetail' && active?.source === 'main'
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
  // Built only in Ctrl+Enter full-detail mode — the render site (cart column)
  // shows it only then anyway, and building chips/rows for a hidden panel costs
  // real work on every keystroke.
  const selectedMainProductPanel =
    selectedMainProduct && isMainFullDetail ? (
      <ProductFullDetailPanel
        canEditDescription={canEditMainDescription && active?.source === 'main'}
        chips={getMainChips(selectedMainSnapshot?.availabilities)}
        descriptionDraft={descriptionDraftSnapshot}
        displayQty={getDisplayedAvailableQty(selectedMainProduct) ?? 0}
        isFullDetail={isMainFullDetail}
        isEditingDescription={editingDescription && active?.source === 'main'}
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
        onSelectChip={(chipIndex) => {
          setDetail({ chipIndex, rowIndex: null })

          if (!isMainFullDetail) {
            keyboard.setState('FullDetail')
          }
        }}
        onToggleDescription={() => void toggleDescriptionEdit()}
      />
    ) : null
  const selectedMainProductSummary = selectedMainProduct
    ? (() => {
        const meta = getProductMeta(selectedMainProduct)
        const pricing = detailPricingFor(selectedMainProduct)
        const localPrice = getWizardProductNumber(selectedMainProduct.CurrentPriceEurToUah) ?? getWizardProductNumber(selectedMainProduct.CurrentLocalPrice)
        const facts = [
          selectedMainProduct.MainOriginalNumber,
          selectedMainProduct.Top,
          selectedMainProduct.Size,
          selectedMainProduct.MeasureUnit?.Name,
        ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)

        return (
          <Box className="new-sale-products-step__selected-product-band">
            {facts.length > 0 && (
              <Box className="new-sale-products-step__selected-product-facts">
                {facts.map((fact) => (
                  <span key={fact}>{fact}</span>
                ))}
              </Box>
            )}

            <Group className="new-sale-products-step__selected-product-metrics" gap={7} wrap="nowrap">
              {meta?.available != null && (
                <span className={`new-sale-products-step__selected-product-metric ${meta.available > 0 ? 'is-good' : 'is-bad'}`}>
                  Дост.: {qtyFormatter.format(meta.available)} {selectedMainProduct.MeasureUnit?.Name ?? ''}
                </span>
              )}
              {meta?.price != null && (
                <span className="new-sale-products-step__selected-product-metric">
                  {amountFormatter.format(meta.price)} EUR
                </span>
              )}
              {localPrice != null && (
                <span className="new-sale-products-step__selected-product-metric is-muted">
                  {amountFormatter.format(localPrice)} {localCurrencyCode}
                </span>
              )}
            </Group>

            <Box className="new-sale-products-step__selected-product-prices">
              <WizardProductPriceStrip dense localCurrency={localCurrencyCode} pricing={pricing} product={selectedMainProduct} />
            </Box>
          </Box>
        )
      })()
    : null
  const isSearchPristine = query.trim().length < PRODUCT_SEARCH_MIN_QUERY_LENGTH
  const showProductSearchEmpty = !selectedMainProduct && orderItems.length === 0 && !isSearching && results.length === 0
  const productSearchEmptyTitle = isSearchPristine ? t('Пошук товару ще не виконаний') : t('Товарів не знайдено')
  const productSearchEmptyDescription = isSearchPristine
    ? t('Введіть мінімум 3 символи у пошуку, щоб побачити доступні товари.')
    : t('Змініть запит або поле пошуку, щоб знайти потрібний товар.')
  const hasAnalogueRows = Boolean(selectedMainProduct && analogueState.items.length > 0)
  const hasComponentRows = Boolean(selectedMainProduct && componentEntries.entries.length > 0)
  const analoguePanel = (
    <Stack className="new-sale-products-step__related-panel" gap={7}>
      <Group className="new-sale-products-step__related-head" justify="space-between" wrap="nowrap">
        <Text className="new-sale-products-step__related-title">{t('Аналоги')}</Text>
        <span>{analogueState.items.length}</span>
      </Group>
      <Box className={`new-sale-products-step__related-scroll ${hasAnalogueRows ? '' : 'is-empty'}`}>
        {hasAnalogueRows ? (
          <WizardRelatedProductRows
            active={analogueStatesActive}
            focusedIndex={analogueIndex ?? -1}
            getItemColor={(product) => getRelatedProductRowColor(product)}
            products={analogueState.items}
            renderExtra={(product) => renderPriceExtra(product)}
            onOpenCard={setProductCardNetId}
            onProductInterest={agreementNetId ? (product) => openInterest(product) : undefined}
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
        <span>{componentEntries.entries.length}</span>
      </Group>
      <Box className={`new-sale-products-step__related-scroll ${hasComponentRows ? '' : 'is-empty'}`}>
        {hasComponentRows ? (
          <WizardRelatedProductRows
            active={componentStatesActive}
            focusedIndex={componentIndex ?? -1}
            getItemColor={(product) => getRelatedProductRowColor(product)}
            products={componentEntries.entries.map((entry) => entry.product)}
            renderExtra={(product) => (
              <Group className="new-sale-related-row__component-extra" gap={6} wrap="nowrap">
                <Box className="new-sale-related-row__component-icon">
                  {componentEntries.isBaseSet ? <BoxIcon size={13} /> : <Settings size={13} />}
                </Box>
                {renderPriceExtra(product, product.NetUid ? setQtyByNetUid.get(product.NetUid) : undefined)}
              </Group>
            )}
            onOpenCard={setProductCardNetId}
            onProductInterest={agreementNetId ? (product) => openInterest(product) : undefined}
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
    <Box className="new-sale-products-step__related-grid">
      {analoguePanel}
      {componentPanel}
    </Box>
  )

  return (
    <Box ref={containerRef} className="new-sale-products-step">
      <WizardClientHeroHeader
        activeAgreementNetId={agreementNetId}
        client={client}
        clientNetId={clientNetId}
        headerClose={headerClose}
        headerTools={headerTools}
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
                label={t('Місце вводу для пошуку')}
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
                label={t('Сортувати За')}
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
              variant="light"
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

                // Clicking a row (a plain div) blurs the search input → keyboard events stop
                // bubbling to the wizard root, so Enter could no longer add to the cart. Restore it.
                focusSearchInput()
              }}
              onSearchChange={handleQueryChange}
            />
          </Box>

        </Box>

        {/* RIGHT: detail + analogues + components scroll above a pinned cart grid */}
        <Box className="new-sale-products-step__workspace">
          <Box className="new-sale-products-step__main-column">
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

                {selectedMainProductSummary && (
                  <Box className="new-sale-products-step__selected-slot">{selectedMainProductSummary}</Box>
                )}

                {(isMainFullDetail || kbState === 'AnalogueFullDetail' || kbState === 'ComponentFullDetail') && (
                  <Box className="new-sale-products-step__main-scroll">
                    <Stack gap="md">
              {isMainFullDetail && selectedMainProductPanel && <Box className="new-sale-products-step__product-slot">{selectedMainProductPanel}</Box>}

              {kbState === 'AnalogueFullDetail' && focusedAnalogue && (
                <ProductFullDetailPanel
                  canEditDescription
                  chips={getMainChips(focusedAnalogueSnapshot?.availabilities)}
                  descriptionDraft={descriptionDraftSnapshot}
                  displayQty={getDisplayedAvailableQty(focusedAnalogue) ?? 0}
                  isFullDetail
                  isEditingDescription={editingDescription && active?.source === 'analogue'}
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
                  onSelectChip={(chipIndex) => setDetail({ chipIndex, rowIndex: null })}
                  onToggleDescription={() => void toggleDescriptionEdit()}
                />
              )}

              {kbState === 'ComponentFullDetail' && focusedComponent && (
                <ProductFullDetailPanel
                  canEditDescription
                  chips={getMainChips(focusedComponentSnapshot?.availabilities)}
                  descriptionDraft={descriptionDraftSnapshot}
                  displayQty={getDisplayedAvailableQty(focusedComponent) ?? 0}
                  isFullDetail
                  isEditingDescription={editingDescription && active?.source === 'component'}
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
                  onSelectChip={(chipIndex) => setDetail({ chipIndex, rowIndex: null })}
                  onToggleDescription={() => void toggleDescriptionEdit()}
                />
              )}
                    </Stack>
                  </Box>
                )}

          {/* Pinned cart — stays put regardless of how many analogues/components are shown */}
          <Box className="new-sale-products-step__cart-slot">
<Stack gap={4} h="100%">
              <Text fw={600} size="sm">
                {t('Кошик')}
              </Text>
              <WizardShoppingCartGrid
                busy={busy}
                items={orderItems}
                localCurrencyCode={localCurrencyCode}
                useEurToUah={useEurToUah}
                onCrossSell={clientNetId ? handleCartCrossSell : undefined}
                onRemove={isSaleLifecycleNew ? handleCartRowRemove : undefined}
                onRowClick={handleCartRowClick}
              />
              {isVatSale && orderItems.length > 0 && (
                <Group justify="flex-end">
                  <Text size="sm">
                    {t('ПДВ')}:{' '}
                    <Text fw={600} span>
                      {amountFormatter.format(roundMoney(totalVat))}
                    </Text>
                  </Text>
                </Group>
              )}
            </Stack>
          </Box>
              </>
            )}
          </Box>
        </Box>
      </Box>

      <WizardCrossSellModal
        agreementNetId={agreementNetId}
        clientNetId={clientNetId}
        excludeNetUids={new Set(orderItems.map((item) => item.Product?.NetUid).filter(Boolean) as string[])}
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
        sale={isActEditOpen ? sale : null}
        onClose={() => setActEditOpen(false)}
        onSaved={() => {
          setActEditOpen(false)
          void onCartChanged()
        }}
      />

      <ChangeQtyModal
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

      <ProductImageViewModal imageUrl={imageUrl} onClose={closeImage} />

      <WizardConfirmModal
        busy={busy}
        message={t('Видалити позицію з рахунку?')}
        opened={removeConfirmOpen}
        onCancel={() => setRemoveConfirmOpen(false)}
        onConfirm={() => void confirmRemoveSelected()}
      />

      <WizardConfirmModal
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
        opened={Boolean(interestProduct?.NetUid && agreementNetId)}
        productNetId={interestProduct?.NetUid ?? ''}
        onClose={closeInterest}
        onCreated={closeInterest}
      />

      <FutureReservationModal
        clientNetId={clientNetId}
        product={futureProduct}
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

function getRequestErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback
}

// True when focus sits on a real control (button / link / input / etc.) so the focus-independent
// fallback listener can leave that control's own keyboard handling alone. Note: NOT [tabindex] —
// Mantine's modal wrapper is a tabindex=-1 focus-trap div, not a real control, and focus often
// lands there after navigating to this step; treating it as interactive would swallow Escape.
function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest('a, button, input, select, textarea, [role="button"]'))
}

function getOrderItemsNewestFirst(sale: SalesUkraineSale | null): SalesUkraineOrderItem[] {
  const items = Array.isArray(sale?.Order?.OrderItems) ? sale.Order.OrderItems : []

  // Parse each Created once (Date.parse per comparator call is O(n log n) parses).
  return items
    .map((item) => [getCreatedTime(item), item] as const)
    .sort((a, b) => b[0] - a[0])
    .map(([, item]) => item)
}

function getCreatedTime(item: SalesUkraineOrderItem): number {
  const created = item.Created

  if (created instanceof Date) {
    return created.getTime()
  }

  if (typeof created === 'string') {
    const parsed = Date.parse(created)

    return Number.isNaN(parsed) ? 0 : parsed
  }

  return 0
}

function addToSplitItems(
  items: WizardSplitOrderItem[],
  source: SalesUkraineOrderItem & { Product: WizardSaleProduct },
  qty: number,
  comment: string | undefined,
  user: SalesUkraineUser | undefined,
  agreementNetId: string | null,
): WizardSplitOrderItem[] {
  const base = items.length > 0 && getWizardSplitAgreementNetId() === agreementNetId ? items : []

  return addWizardSplitOrderItem(base, source, qty, comment, user)
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
}: {
  isInvoice: boolean
  item: SalesUkraineOrderItem | null
  onActEdit: () => void
  onChangeQty: (item: SalesUkraineOrderItem) => void
  onClose: () => void
  onRemove: (item: SalesUkraineOrderItem) => void
}) {
  const { t } = useI18n()
  const code = item?.Product?.VendorCode || item?.Product?.Articul || ''
  const name = item?.Product?.NameUA || item?.Product?.Name || ''

  return (
    <AppModal
      centered
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
