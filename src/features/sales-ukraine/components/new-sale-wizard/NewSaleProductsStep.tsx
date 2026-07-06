import { Box, Group, Select, Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconBox, IconSettings } from '@tabler/icons-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../../../auth/useAuth'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { toProxiedAssetUrl } from '../../../../shared/url/proxiedAssetUrl'
import { realtimeEvents, useRealtimeEvent } from '../../../../shared/realtime/events'
import type { Client } from '../../../clients/types'
import { updateProduct } from '../../../products/api/productsApi'
import type { Product } from '../../../products/types'
import { getRelatedProductRowColor } from '../../../products/utils'
import { ProductCardModal } from '../../../products/components/ProductCardModal'
import { ProductInterestModal } from '../../../sales-preorders'
import { addOrderItem, deleteOrderItem, updateOrderItem } from '../../api/salesUkraineApi'
import { getSaleLocalCurrencyCode, isNonVatEurSale, roundMoney } from '../../saleMoney'
import { getSaleLifecycleTypeKey } from '../../saleStatus'
import type { SalesUkraineOrderItem, SalesUkraineSale, SalesUkraineUser } from '../../types'
import { ChangeQtyModal } from './ChangeQtyModal'
import { EditShoppingCartOverlay, type WizardCartSelection, type WizardSplitOrderItem } from './EditShoppingCartOverlay'
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
  shiftOrderItemFromSale,
  type WizardAvailabilityRow,
  type WizardCalculatedProductPricing,
  type WizardNearestSupplyOrder,
  type WizardProductReservation,
  type WizardTotalProductAvailabilities,
} from './newSaleWizardApi'
import {
  clearWizardSplitOrderItems,
  getWizardSplitAgreementNetId,
  getWizardSplitOrderItems,
  isWizardMergedSaleMode,
  removeWizardMergedOrderItem,
  setWizardSplitOrderItems,
  upsertWizardMergedOrderItem,
} from './newSaleWizardState'
import { ProductFullDetailPanel, type WizardDetailChip, type WizardDetailRow } from './ProductFullDetailPanel'
import { ProductImageViewModal } from './ProductImageViewModal'
import { ShiftOrderItemModal } from './ShiftOrderItemModal'
import { WizardConfirmModal } from './WizardConfirmModal'
import { WizardProductCarousel } from './WizardProductCarousel'
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
import { WizardShoppingCartGrid } from './WizardShoppingCartGrid'

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'
const CHANGE_PRODUCT_DESCRIPTION_PERMISSION = 'Sales_Ukraine_all_Change_Products_Btn_PKEY'
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
}: {
  agreementNetId: string | null
  client?: Client | null
  clientNetId: string | null
  headerClose?: ReactNode
  headerTools?: ReactNode
  onBusyChange?: (busy: boolean) => void
  onCartChanged: () => void | Promise<void>
  onRequestClose?: () => void
  sale: SalesUkraineSale | null
}) {
  const { t } = useI18n()
  const { hasPermission, user } = useAuth()
  const keyboard = useWizardKeyboard(1)

  const [searchMode, setSearchMode] = useState('5')
  const [sortMode, setSortMode] = useState('2')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<WizardSaleProduct[]>([])
  const [isSearching, setSearching] = useState(false)
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
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false)
  const [editingDescription, setEditingDescription] = useState(false)
  const [descriptionDraft, setDescriptionDraft] = useState('')
  const [productCardNetId, setProductCardNetId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)

  const busyRef = useRef(false)
  const forceSearchRef = useRef(false)
  const virtualLoadingRef = useRef(false)
  const virtualExhaustedRef = useRef(false)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const handleProductKeyRef = useRef<(event: WizardKeyEvent) => boolean>(() => false)
  const cartNetIdRef = useRef<string | undefined>(undefined)
  const onCartChangedRef = useRef(onCartChanged)
  const pricingCacheGenerationRef = useRef(0)

  const [reservationsState, setReservationsState] = useState<{
    agreementNetId: string | null
    values: Map<string, WizardProductReservation>
  }>({ agreementNetId: null, values: EMPTY_RESERVATIONS })
  const [productPricingState, setProductPricingState] = useState<{
    agreementNetId: string | null
    values: Map<string, ProductPricingSnapshot>
  }>({ agreementNetId: null, values: EMPTY_PRODUCT_PRICING })

  const orderItems = getOrderItemsNewestFirst(sale)
  const isVatSale = Boolean(sale?.IsVatSale)
  const isSaleLifecycleNew = getSaleLifecycleTypeKey(sale?.BaseLifeCycleStatus?.SaleLifeCycleType) === '0'
  const useEurToUah = isNonVatEurSale(sale)
  const localCurrencyCode = getSaleLocalCurrencyCode(sale)
  const totalVat = getWizardProductNumber(sale?.Order?.TotalVat) ?? 0
  const productPricing = productPricingState.agreementNetId === agreementNetId ? productPricingState.values : EMPTY_PRODUCT_PRICING
  const reservations = reservationsState.agreementNetId === agreementNetId ? reservationsState.values : EMPTY_RESERVATIONS

  const componentEntries = sortComponentCarouselEntries(getComponentCarouselEntries(componentParent), isVatSale)
  const activeProduct = active?.product ?? null
  const mainProduct = results[mainIndex] ?? null
  const focusedAnalogue = analogueIndex !== null ? analogueState.items[analogueIndex] ?? null : null
  const focusedComponent = componentIndex !== null ? componentEntries.entries[componentIndex]?.product ?? null : null
  const kbState = isProductKeyboardState(keyboard.state) ? keyboard.state : 'ProductSearch'

  useEffect(() => {
    onBusyChange?.(busy)

    return () => {
      onBusyChange?.(false)
    }
  }, [busy, onBusyChange])

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

    if (value.length < 4 || !agreementNetId) {
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

        if (next.length === 1 && next[0]) {
          const single = next[0]
          setResults([single, ...(single.NextSearchedProducts ?? [])])
          setMainIndex(0)
          focusMainProduct(single)
          setWizardKeyboardState('ProductSelection')
        } else {
          setResults(next)
          setMainIndex(0)
          clearActiveProductData()
        }
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

  async function addOrderItemToSale(clientAgreementNetId: string, saleNetId: string, item: SalesUkraineOrderItem) {
    const created = await addOrderItem(clientAgreementNetId, saleNetId, item)

    if (isWizardMergedSaleMode()) {
      upsertWizardMergedOrderItem(created ?? item)
    }
  }

  async function updateOrderItemInSale(item: SalesUkraineOrderItem) {
    await updateOrderItem(item)

    if (isWizardMergedSaleMode()) {
      upsertWizardMergedOrderItem(item)
    }
  }

  async function deleteOrderItemFromSale(orderItemNetId: string) {
    await deleteOrderItem(orderItemNetId)

    if (isWizardMergedSaleMode()) {
      removeWizardMergedOrderItem(orderItemNetId)
    }
  }

  function beginBusy(): boolean {
    if (busyRef.current) {
      return false
    }

    busyRef.current = true
    setBusy(true)

    return true
  }

  function endBusy() {
    busyRef.current = false
    setBusy(false)
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

    if (virtualLoadingRef.current || virtualExhaustedRef.current || value.length < 4 || !agreementNetId) {
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

    if (value.trim().length < 4) {
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

    if (query.trim().length >= 4) {
      forceSearchRef.current = true
      setSearching(true)
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

    if (!beginBusy()) {
      return
    }

    try {
      const buckets = await getProductAvailabilityBuckets(product.NetUid, agreementNetId)
      const available = isVatSale
        ? buckets?.AvailableQtyUkVAT ?? 0
        : (buckets?.AvailableQtyUk ?? 0) + (buckets?.AvailableQtyUkReSale ?? 0)
      const existing = orderItems.find((item) => item.Product?.NetUid === product.NetUid)
      const item: SalesUkraineOrderItem = existing ?? { Deleted: false, Id: 0, NetUid: EMPTY_GUID, Product: product, Qty: 0 }

      setQtyModal({ available: (getWizardProductNumber(item.Qty) ?? 0) + available, item, kind: 'add' })
    } catch {
      notifications.show({ color: 'red', message: t('Не вдалося додати товар') })
    } finally {
      endBusy()
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

    setQtyModal(null)

    if (!beginBusy()) {
      return
    }

    try {
      if (modal.kind === 'add') {
        if (!agreementNetId || !sale?.NetUid) {
          return
        }

        await addOrderItemToSale(agreementNetId, sale.NetUid, { ...modal.item, Comment: comment, Qty: qty })
        await onCartChanged()
        resetSearchAfterAdd(modal.item.Product as WizardSaleProduct | undefined)
      } else if (modal.kind === 'edit-current') {
        if (editCart?.isSplit) {
          const ordered = getWizardProductNumber(modal.item.Qty) ?? 0
          const rest = ordered - qty

          if (rest < 0) {
            return
          }

          const product = modal.item.Product as WizardSaleProduct | undefined

          if (product) {
            const splitItems = addToSplitItems(
              editCart.splitItems,
              product,
              qty,
              comment || modal.item.Comment,
              user as unknown as SalesUkraineUser,
              agreementNetId,
            )
            setEditCart((previous) => (previous ? { ...previous, splitItems } : previous))
            setWizardSplitOrderItems(splitItems, agreementNetId)
          }

          if (rest > 0) {
            await updateOrderItemInSale({ ...modal.item, Qty: rest })
          } else if (modal.item.NetUid) {
            await deleteOrderItemFromSale(modal.item.NetUid)
          }

          await onCartChanged()
        } else {
          await updateOrderItemInSale({ ...modal.item, Comment: comment, Qty: qty })
          await onCartChanged()
        }
      } else {
        const rest = modal.item.Qty - qty

        if (rest < 0) {
          return
        }

        const existing = orderItems.find((item) => item.Product?.NetUid === modal.item.Product.NetUid)

        if (existing) {
          await updateOrderItemInSale({ ...existing, Qty: (getWizardProductNumber(existing.Qty) ?? 0) + qty })
        } else if (agreementNetId && sale?.NetUid) {
          await addOrderItemToSale(agreementNetId, sale.NetUid, {
            Comment: modal.item.Comment,
            Deleted: false,
            Id: 0,
            NetUid: EMPTY_GUID,
            Product: modal.item.Product,
            Qty: qty,
          })
        }

        if (editCart) {
          const splitItems = editCart.splitItems
            .map((item) => (item.Product.NetUid === modal.item.Product.NetUid ? rebuildSplitItem(item, rest) : item))
            .filter((item) => item.Qty > 0)

          setEditCart((previous) => (previous ? { ...previous, splitItems } : previous))
          setWizardSplitOrderItems(splitItems, agreementNetId)
        }

        await onCartChanged()
      }

      clearProductPricingCache()
    } catch {
      notifications.show({ color: 'red', message: t('Не вдалося оновити кількість') })
    } finally {
      endBusy()
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

    if (!beginBusy()) {
      return
    }

    try {
      await deleteOrderItemFromSale(item.NetUid)
      await onCartChanged()
      clearProductPricingCache()
    } catch {
      notifications.show({ color: 'red', message: t('Не вдалося видалити товар') })
    } finally {
      endBusy()
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
        return
      }
    }

    if (!item.Product?.NetUid || !agreementNetId) {
      return
    }

    if (!beginBusy()) {
      return
    }

    try {
      const buckets = await getProductAvailabilityBuckets(item.Product.NetUid, agreementNetId)
      const available = isVatSale
        ? buckets?.AvailableQtyUkVAT ?? 0
        : (buckets?.AvailableQtyUk ?? 0) + (buckets?.AvailableQtyUkReSale ?? 0)

      setQtyModal({ available: (getWizardProductNumber(item.Qty) ?? 0) + available, item, kind: 'edit-current' })
    } catch {
      setQtyModal({ available: getWizardProductNumber(item.Qty) ?? 0, item, kind: 'edit-current' })
    } finally {
      endBusy()
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

  async function exitEditCart() {
    const cart = editCart

    if (!cart) {
      return
    }

    if (cart.splitItems.length > 0 && agreementNetId && sale?.NetUid) {
      if (!beginBusy()) {
        return
      }

      try {
        for (const item of cart.splitItems) {
          const existing = orderItems.find((existingItem) => existingItem.Product?.NetUid === item.Product.NetUid)

          if (existing) {
            await updateOrderItemInSale({ ...existing, Qty: (getWizardProductNumber(existing.Qty) ?? 0) + item.Qty })
          } else {
            await addOrderItemToSale(agreementNetId, sale.NetUid, {
              Comment: item.Comment,
              Deleted: false,
              Id: 0,
              NetUid: EMPTY_GUID,
              Product: item.Product,
              Qty: item.Qty,
            })
          }
        }

        await onCartChanged()
        clearProductPricingCache()
      } catch {
        notifications.show({ color: 'red', message: t('Не вдалося оновити кількість') })
      } finally {
        endBusy()
      }
    }

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

    if (!beginBusy()) {
      return
    }

    try {
      if (selected.list === 'current') {
        const item = orderItems[selected.index]

        if (item) {
          const product = item.Product as WizardSaleProduct | undefined

          if (cart.isSplit && product) {
            const splitItems = addToSplitItems(
              cart.splitItems,
              product,
              getWizardProductNumber(item.Qty) ?? 0,
              item.Comment,
              user as unknown as SalesUkraineUser,
              agreementNetId,
            )
            setEditCart((previous) => (previous ? { ...previous, splitItems } : previous))
            setWizardSplitOrderItems(splitItems, agreementNetId)
          }

          if (item.NetUid) {
            await deleteOrderItemFromSale(item.NetUid)
          }

          await onCartChanged()
          setEditCart((previous) =>
            previous ? { ...previous, selected: { index: Math.max(0, selected.index - 1), list: 'current' } } : previous,
          )
        }
      } else {
        const item = cart.splitItems[selected.index]

        if (item) {
          const existing = orderItems.find((existingItem) => existingItem.Product?.NetUid === item.Product.NetUid)

          if (existing) {
            await updateOrderItemInSale({ ...existing, Qty: (getWizardProductNumber(existing.Qty) ?? 0) + item.Qty })
          } else if (agreementNetId && sale?.NetUid) {
            await addOrderItemToSale(agreementNetId, sale.NetUid, {
              Comment: item.Comment,
              Deleted: false,
              Id: 0,
              NetUid: EMPTY_GUID,
              Product: item.Product,
              Qty: item.Qty,
            })
          }

          const splitItems = cart.splitItems.filter((_, index) => index !== selected.index)
          setEditCart((previous) =>
            previous
              ? {
                  ...previous,
                  selected: splitItems.length > 0 ? { index: Math.max(0, selected.index - 1), list: 'split' } : null,
                  splitItems,
                }
              : previous,
          )
          setWizardSplitOrderItems(splitItems, agreementNetId)
          await onCartChanged()
        }
      }

      clearProductPricingCache()
    } catch {
      notifications.show({ color: 'red', message: t('Не вдалося видалити товар') })
    } finally {
      endBusy()
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

    if (!beginBusy()) {
      return
    }

    try {
      const saleToNetId = sale?.NetUid && sale.NetUid !== EMPTY_GUID ? sale.NetUid : agreementNetId || ''
      await shiftOrderItemFromSale(row.NetId, saleToNetId, { ...row.OrderItem, Qty: qty })
      await onCartChanged()
      clearProductPricingCache()
      setRefreshTick((tick) => tick + 1)
      focusSearchInput()
    } catch {
      notifications.show({ color: 'red', message: t('Не вдалося перемістити') })
    } finally {
      endBusy()
    }
  }

  function openImage(product: WizardSaleProduct | null) {
    if (!product?.Image) {
      return
    }

    setImageUrl(toProxiedAssetUrl(product.Image) || null)
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
      setDescriptionDraft(product.Description ?? '')
      setEditingDescription(true)
      keyboard.setState('EditProductDescription')

      return
    }

    setEditingDescription(false)
    keyboard.restorePreviousProductState()
    const updated: WizardSaleProduct = { ...product, Description: descriptionDraft }
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

      focusMain(Math.min(mainIndex, results.length - 1))
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

    if (hotkey === 'Escape') {
      setCloseConfirmOpen(true)

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
        if (mainProduct) {
          setDetail({ chipIndex: getDefaultMainDetailChipIndex(), rowIndex: null })
          keyboard.setState('FullDetail')
        }

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
        // Toggle the detail overlay shut and reset the keyboard state, otherwise it stays parked
        // in 'FullDetail' (where Ctrl(+Shift)+Enter is a no-op) and the shortcut can't reopen it.
        resetDetail()
        keyboard.setState('ProductSelection')

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
        // Toggle the analogue detail overlay shut and reset the keyboard state so the shortcut reopens.
        resetDetail()
        keyboard.setState('AnalogueSelection')

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
        // Toggle the component detail overlay shut and reset the keyboard state so the shortcut reopens.
        resetDetail()
        keyboard.setState('ComponentSelection')

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
    if (qtyModal || shiftRow || futureProduct || removeConfirmOpen || removeRowItem || closeConfirmOpen) {
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
        <Text className="new-sale-related-row__metric">{amountFormatter.format(getWizardProductNumber(product.CurrentPriceEurToUah) ?? 0)} UAH</Text>
      </Group>
    )
  }

  // Keep selected product details visible in the work area. Ctrl+Enter now only changes
  // keyboard navigation inside the same detail block.
  const selectedMainProduct = mainProduct ? (active?.source === 'main' && activeProduct ? activeProduct : mainProduct) : null
  const selectedMainSnapshot = getProductDetailSnapshot(selectedMainProduct)
  const selectedMainChipIndex =
    selectedMainProduct && active?.source === 'main' && detail?.chipIndex != null
      ? detail.chipIndex
      : selectedMainProduct
        ? getDefaultMainDetailChipIndex()
        : null
  const focusedAnalogueSnapshot = getProductDetailSnapshot(focusedAnalogue)
  const focusedComponentSnapshot = getProductDetailSnapshot(focusedComponent)
  const focusedAnalogueChipIndex = focusedAnalogue ? (detail?.chipIndex ?? getDefaultMainDetailChipIndex()) : null
  const focusedComponentChipIndex = focusedComponent ? (detail?.chipIndex ?? getDefaultMainDetailChipIndex()) : null
  const selectedMainProductPanel =
    selectedMainProduct ? (
      <ProductFullDetailPanel
        canEditDescription={canEditMainDescription && active?.source === 'main'}
        chips={getMainChips(selectedMainSnapshot?.availabilities)}
        descriptionDraft={descriptionDraft}
        displayQty={getDisplayedAvailableQty(selectedMainProduct) ?? 0}
        isEditingDescription={editingDescription && active?.source === 'main'}
        nearestSupplyOrder={selectedMainSnapshot?.nearestOrder}
        pricing={detailPricingFor(selectedMainProduct)}
        product={selectedMainProduct}
        rows={getMainDetailRows(selectedMainSnapshot?.availabilities, selectedMainChipIndex)}
        selectedChipIndex={selectedMainChipIndex}
        selectedRowIndex={active?.source === 'main' ? (detail?.rowIndex ?? null) : null}
        showRowDetails={selectedMainChipIndex === 0}
        onDescriptionDraftChange={setDescriptionDraft}
        onSelectChip={(chipIndex) => setDetail({ chipIndex, rowIndex: null })}
        onToggleDescription={() => void toggleDescriptionEdit()}
      />
    ) : null
  const analoguePanel = selectedMainProduct ? (
    <Stack className="new-sale-products-step__related-panel" gap={7}>
      <Group className="new-sale-products-step__related-head" justify="space-between" wrap="nowrap">
        <Text className="new-sale-products-step__related-title">{t('Аналоги')}</Text>
        <span>{analogueState.items.length}</span>
      </Group>
      <Box className="new-sale-products-step__related-scroll">
        {analogueState.items.length > 0 ? (
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
  ) : null
  const componentPanel = selectedMainProduct ? (
    <Stack className="new-sale-products-step__related-panel new-sale-products-step__component-panel" gap={7}>
      <Group className="new-sale-products-step__related-head" justify="space-between" wrap="nowrap">
        <Text className="new-sale-products-step__related-title">{t('Комплектуючі')}</Text>
        <span>{componentEntries.entries.length}</span>
      </Group>
      <Box className="new-sale-products-step__related-scroll">
        {componentEntries.entries.length > 0 ? (
          <WizardRelatedProductRows
            active={componentStatesActive}
            focusedIndex={componentIndex ?? -1}
            getItemColor={(product) => getRelatedProductRowColor(product)}
            products={componentEntries.entries.map((entry) => entry.product)}
            renderExtra={(product) => (
              <Group className="new-sale-related-row__component-extra" gap={6} wrap="nowrap">
                <Box className="new-sale-related-row__component-icon">
                  {componentEntries.isBaseSet ? <IconBox size={13} /> : <IconSettings size={13} />}
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
  ) : null
  const relatedColumnPanel = selectedMainProduct ? (
    <Stack className="new-sale-products-step__related-column" gap={10}>
      {analoguePanel}
      {componentPanel}
    </Stack>
  ) : null

  return (
    <Box ref={containerRef} className="new-sale-products-step">
      <WizardClientHeroHeader
        activeAgreementNetId={agreementNetId}
        client={client}
        clientNetId={clientNetId}
        headerClose={headerClose}
        headerTools={headerTools}
      />
      <Box className="new-sale-products-step__body">
        {/* LEFT: search controls + vertical product carousel (mirrors the client step layout) */}
        <Box className="new-sale-products-step__picker-rail">
          <Stack className="new-sale-products-step__search-controls" gap={8}>
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
          </Stack>

          <Box style={{ flex: 1, minHeight: 0 }}>
            <WizardProductCarousel
              active={mainStatesActive}
              emptyText={query.trim().length < 4 ? t('Введіть мінімум 4 символи') : t('Нічого не знайдено')}
              focusedIndex={mainIndex}
              getItemColor={(product) => getRelatedProductRowColor(product)}
              getMeta={getProductMeta}
              getPricing={detailPricingFor}
              // Keep the selected main product pinned on the left while drilling into its
              // analogues/components (active.source switches to 'analogue'/'component'); otherwise
              // the carousel reverts to the search list and the chosen product visually drops out.
              hasFocus={kbState !== 'ProductSearch' && Boolean(mainProduct)}
              isLoading={isSearching}
              products={results}
              searchInputRef={searchInputRef}
              searchMode={kbState === 'ProductSearch'}
              searchValue={query}
              onOpenCard={setProductCardNetId}
              onProductInterest={agreementNetId ? (product) => openInterest(product) : undefined}
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
          <Box className="new-sale-products-step__main-scroll">
            <Stack gap="md">
              {selectedMainProductPanel && <Box className="new-sale-products-step__product-slot">{selectedMainProductPanel}</Box>}

              {kbState === 'AnalogueFullDetail' && focusedAnalogue && (
                <ProductFullDetailPanel
                  canEditDescription
                  chips={getMainChips(focusedAnalogueSnapshot?.availabilities)}
                  descriptionDraft={descriptionDraft}
                  displayQty={getDisplayedAvailableQty(focusedAnalogue) ?? 0}
                  isEditingDescription={editingDescription && active?.source === 'analogue'}
                  nearestSupplyOrder={focusedAnalogueSnapshot?.nearestOrder}
                  pricing={detailPricingFor(focusedAnalogue)}
                  product={focusedAnalogue}
                  rows={getMainDetailRows(focusedAnalogueSnapshot?.availabilities, focusedAnalogueChipIndex)}
                  selectedChipIndex={focusedAnalogueChipIndex}
                  selectedRowIndex={detail?.rowIndex ?? null}
                  showRowDetails={focusedAnalogueChipIndex === 0}
                  onDescriptionDraftChange={setDescriptionDraft}
                  onSelectChip={(chipIndex) => setDetail({ chipIndex, rowIndex: null })}
                  onToggleDescription={() => void toggleDescriptionEdit()}
                />
              )}

              {kbState === 'ComponentFullDetail' && focusedComponent && (
                <ProductFullDetailPanel
                  canEditDescription
                  chips={getMainChips(focusedComponentSnapshot?.availabilities)}
                  descriptionDraft={descriptionDraft}
                  displayQty={getDisplayedAvailableQty(focusedComponent) ?? 0}
                  isEditingDescription={editingDescription && active?.source === 'component'}
                  nearestSupplyOrder={focusedComponentSnapshot?.nearestOrder}
                  pricing={detailPricingFor(focusedComponent)}
                  product={focusedComponent}
                  rows={getMainDetailRows(focusedComponentSnapshot?.availabilities, focusedComponentChipIndex)}
                  selectedChipIndex={focusedComponentChipIndex}
                  selectedRowIndex={detail?.rowIndex ?? null}
                  showRowDetails={focusedComponentChipIndex === 0}
                  onDescriptionDraftChange={setDescriptionDraft}
                  onSelectChip={(chipIndex) => setDetail({ chipIndex, rowIndex: null })}
                  onToggleDescription={() => void toggleDescriptionEdit()}
                />
              )}
            </Stack>
          </Box>

          {/* Pinned cart — stays put regardless of how many analogues/components are shown */}
          <Box className="new-sale-products-step__cart-slot">
            <Stack gap={4}>
              <Text fw={600} size="sm">
                {t('Кошик')}
              </Text>
              <WizardShoppingCartGrid
                busy={busy}
                items={orderItems}
                localCurrencyCode={localCurrencyCode}
                useEurToUah={useEurToUah}
                onRemove={isSaleLifecycleNew ? (item) => setRemoveRowItem(item) : undefined}
                onRowClick={(item) => void onEditOrderItem(item)}
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
          </Box>

          {relatedColumnPanel && <Box className="new-sale-products-step__related-slot">{relatedColumnPanel}</Box>}
        </Box>
      </Box>

      {editCart && (
        <EditShoppingCartOverlay
          currentItems={orderItems}
          isSplit={editCart.isSplit}
          selected={editCart.selected}
          splitItems={editCart.splitItems}
        />
      )}

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

      <WizardConfirmModal
        message={t('Закрити вікно?')}
        opened={closeConfirmOpen}
        onCancel={() => {
          setCloseConfirmOpen(false)
          keyboard.consumeNextEscape()
          focusSearchInput()
        }}
        onConfirm={() => {
          setCloseConfirmOpen(false)

          if (onRequestClose) {
            onRequestClose()
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

// True when focus sits on a real control (button / link / input / etc.) so the focus-independent
// fallback listener can leave that control's own keyboard handling alone. Note: NOT [tabindex] —
// Mantine's modal wrapper is a tabindex=-1 focus-trap div, not a real control, and focus often
// lands there after navigating to this step; treating it as interactive would swallow Escape.
function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest('a, button, input, select, textarea, [role="button"]'))
}

function getOrderItemsNewestFirst(sale: SalesUkraineSale | null): SalesUkraineOrderItem[] {
  const items = Array.isArray(sale?.Order?.OrderItems) ? sale.Order.OrderItems : []

  return [...items].sort((a, b) => getCreatedTime(b) - getCreatedTime(a))
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
  product: WizardSaleProduct,
  qty: number,
  comment: string | undefined,
  user: SalesUkraineUser | undefined,
  agreementNetId: string | null,
): WizardSplitOrderItem[] {
  const base = items.length > 0 && getWizardSplitAgreementNetId() === agreementNetId ? items : []
  const existingIndex = base.findIndex((item) => item.Product.NetUid === product.NetUid)

  if (existingIndex >= 0) {
    const existing = base[existingIndex] as WizardSplitOrderItem
    const next = [...base]
    next[existingIndex] = rebuildSplitItem(existing, existing.Qty + qty)

    return next
  }

  return [...base, buildSplitItem(product, qty, comment, user)]
}

function buildSplitItem(
  product: WizardSaleProduct,
  qty: number,
  comment: string | undefined,
  user: SalesUkraineUser | undefined,
): WizardSplitOrderItem {
  const price = getWizardProductNumber(product.CurrentPrice) ?? 0
  const localPrice = getWizardProductNumber(product.CurrentLocalPrice) ?? 0
  const eurToUahPrice = getWizardProductNumber(product.CurrentPriceEurToUah) ?? 0
  const item: WizardSplitOrderItem = {
    Comment: comment ?? '',
    Product: product,
    Qty: qty,
    TotalAmount: roundMoney(qty * price),
    TotalAmountEurToUah: roundMoney(qty * eurToUahPrice),
    TotalAmountLocal: roundMoney(qty * localPrice),
  }

  if (user) {
    item.User = user
  }

  return item
}

function rebuildSplitItem(item: WizardSplitOrderItem, qty: number): WizardSplitOrderItem {
  const price = getWizardProductNumber(item.Product.CurrentPrice) ?? 0
  const localPrice = getWizardProductNumber(item.Product.CurrentLocalPrice) ?? 0
  const eurToUahPrice = getWizardProductNumber(item.Product.CurrentPriceEurToUah) ?? 0

  return {
    ...item,
    Qty: qty,
    TotalAmount: roundMoney(qty * price),
    TotalAmountEurToUah: roundMoney(qty * eurToUahPrice),
    TotalAmountLocal: roundMoney(qty * localPrice),
  }
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
