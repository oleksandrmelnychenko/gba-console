import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import {
  getAllProductAvailabilities,
  getNearestSupplyOrder,
  getProductCalculatedPricingsByAgreement,
  getProductCurrentPriceByAgreement,
  getProductReservationsByAgreement,
  type WizardCalculatedProductPricing,
  type WizardNearestSupplyOrder,
  type WizardProductReservation,
  type WizardTotalProductAvailabilities,
} from './newSaleWizardApi'

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'
const FOCUS_DELAY_MS = 240

type ProductPricingSnapshot = {
  calculatedPricings: WizardCalculatedProductPricing[]
  currentPrice: number | null
  reservation?: WizardProductReservation
}

export type ProductDetailSnapshot = {
  availabilities: WizardTotalProductAvailabilities | null
  detailsError: string | null
  detailsLoaded: boolean
  nearestOrder: WizardNearestSupplyOrder | null
}

type ScopedValues<T> = { scopeKey: string; values: Map<string, T> }
const EMPTY_PRICING = new Map<string, ProductPricingSnapshot>()
const EMPTY_DETAILS = new Map<string, ProductDetailSnapshot>()

export function useWizardProductData({
  agreementNetId,
  productNetUid,
  saleNetUid,
  isVatSale,
  detailsOpened,
}: {
  agreementNetId: string | null
  productNetUid: string | undefined
  saleNetUid: string | undefined
  isVatSale: boolean
  detailsOpened: boolean
}) {
  const { t } = useI18n()
  const detailsFailureMessage = useEffectEvent((error: unknown) => getErrorMessage(error, t('Не вдалося завантажити деталі залишків')))
  const saleNetId = saleNetUid || EMPTY_GUID
  const scopeKey = JSON.stringify([agreementNetId, saleNetId, isVatSale])
  const [pricingState, setPricingState] = useState<ScopedValues<ProductPricingSnapshot>>({ scopeKey, values: EMPTY_PRICING })
  const [detailState, setDetailState] = useState<ScopedValues<ProductDetailSnapshot>>({ scopeKey, values: EMPTY_DETAILS })
  const [dataRevision, setDataRevision] = useState(0)
  const [detailsRevision, setDetailsRevision] = useState(0)
  const pricingAbortRef = useRef<AbortController | null>(null)
  const detailsAbortRef = useRef<AbortController | null>(null)
  const detailsPendingRef = useRef(false)

  const abortRequests = useCallback(() => {
    pricingAbortRef.current?.abort()
    detailsAbortRef.current?.abort()
  }, [])

  useLayoutEffect(() => abortRequests, [scopeKey, productNetUid, abortRequests])

  const invalidateProductData = useCallback(() => {
    // Retire responses synchronously, before React runs the effects again.
    abortRequests()
    setPricingState((previous) => ({ ...previous, values: EMPTY_PRICING }))
    setDetailState((previous) => ({ ...previous, values: EMPTY_DETAILS }))
    setDataRevision((revision) => revision + 1)
  }, [abortRequests])

  const resetProductDetails = useCallback(() => {
    detailsAbortRef.current?.abort()
    setDetailState((previous) => ({ ...previous, values: EMPTY_DETAILS }))
    setDetailsRevision((revision) => revision + 1)
  }, [])

  const retryProductDetails = useCallback(() => {
    detailsAbortRef.current?.abort()
    setDetailsRevision((revision) => revision + 1)
  }, [])

  // Product identity, rather than its object or carousel source, drives pricing.
  // Editing a description or focusing the same item elsewhere needs no request.
  useEffect(() => {
    if (!productNetUid || !agreementNetId) return
    const controller = new AbortController()
    pricingAbortRef.current = controller
    const handle = setTimeout(() => {
      let pricing: [number | null, WizardCalculatedProductPricing[]] | null = null
      let reservation: WizardProductReservation | undefined
      const publish = () => {
        if (controller.signal.aborted || !pricing) return
        const [currentPrice, calculatedPricings] = pricing
        setPricingState((previous) => {
          const existing = previous.scopeKey === scopeKey ? previous.values.get(productNetUid) : undefined
          if (existing?.currentPrice === currentPrice && existing.calculatedPricings === calculatedPricings && existing.reservation === reservation) return previous
          const values = new Map(previous.scopeKey === scopeKey ? previous.values : EMPTY_PRICING)
          values.set(productNetUid, { currentPrice, calculatedPricings, reservation })
          return { scopeKey, values }
        })
      }
      // Neither a slow reserve lookup nor its failure should hold back prices.
      void Promise.all([
        getProductCurrentPriceByAgreement(productNetUid, agreementNetId, controller.signal),
        getProductCalculatedPricingsByAgreement(productNetUid, agreementNetId, controller.signal),
      ]).then((values) => { pricing = values; publish() }).catch(() => {})
      void getProductReservationsByAgreement(agreementNetId, productNetUid, controller.signal)
        .catch(() => [])
        .then((reservations) => {
          reservation = reservations.find((item) => item.ProductNetUid === productNetUid)
            ?? (reservations.length === 1 ? reservations[0] : undefined)
          publish()
        })
    }, FOCUS_DELAY_MS)
    return () => {
      controller.abort()
      clearTimeout(handle)
    }
  }, [productNetUid, agreementNetId, scopeKey, dataRevision])

  // Extended stock and supply data is loaded only for an open details panel.
  // Both manual retry and realtime/cart invalidation refresh that panel.
  useEffect(() => {
    if (!productNetUid || !agreementNetId || !detailsOpened) return
    // Closing a panel does not restart an already dispatched read on reopening.
    // Product/context changes, explicit invalidation and unmount still abort it.
    if (detailsPendingRef.current && detailsAbortRef.current && !detailsAbortRef.current.signal.aborted) return
    const controller = new AbortController()
    detailsAbortRef.current = controller
    detailsPendingRef.current = true
    let started = false
    queueMicrotask(() => {
      if (controller.signal.aborted) return
      setDetailState((previous) => {
        const values = new Map(previous.scopeKey === scopeKey ? previous.values : EMPTY_DETAILS)
        const existing = values.get(productNetUid)
        values.set(productNetUid, {
          availabilities: existing?.availabilities ?? null,
          detailsError: null,
          detailsLoaded: false,
          nearestOrder: null,
        })
        return { scopeKey, values }
      })
    })
    const handle = setTimeout(() => {
      started = true
      const supply = getNearestSupplyOrder(productNetUid, controller.signal).catch(() => null).then(nearestOrder => {
        if (controller.signal.aborted) return
        setDetailState(previous => {
          const existing = previous.scopeKey === scopeKey ? previous.values.get(productNetUid) : undefined
          if (!existing || existing.nearestOrder === nearestOrder) return previous
          const values = new Map(previous.values)
          values.set(productNetUid, { ...existing, nearestOrder })
          return { scopeKey, values }
        })
      })
      const stock = getAllProductAvailabilities(productNetUid, agreementNetId, saleNetId, controller.signal)
        .then(availabilities => ({ availabilities, detailsError: null }))
        .catch((error: unknown) => ({ availabilities: null, detailsError: detailsFailureMessage(error) }))
        .then(snapshot => {
          if (controller.signal.aborted) return
          setDetailState(previous => {
            const values = new Map(previous.scopeKey === scopeKey ? previous.values : EMPTY_DETAILS)
            values.set(productNetUid, { ...snapshot, detailsLoaded: true, nearestOrder: values.get(productNetUid)?.nearestOrder ?? null })
            return { scopeKey, values }
          })
        })
      void Promise.all([supply, stock]).finally(() => {
        if (detailsAbortRef.current === controller) detailsPendingRef.current = false
      })
    }, FOCUS_DELAY_MS)
    return () => {
      clearTimeout(handle)
      if (!started) controller.abort()
    }
  }, [productNetUid, agreementNetId, saleNetId, scopeKey, detailsOpened, dataRevision, detailsRevision])

  const getProductDetailSnapshot = useCallback((product: { NetUid?: string } | null) => (
    product?.NetUid && detailState.scopeKey === scopeKey
      ? detailState.values.get(product.NetUid) ?? null
      : null
  ), [detailState, scopeKey])

  return {
    dataRevision,
    getProductDetailSnapshot,
    invalidateProductData,
    productPricing: pricingState.scopeKey === scopeKey ? pricingState.values : EMPTY_PRICING,
    resetProductDetails,
    retryProductDetails,
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback
}
