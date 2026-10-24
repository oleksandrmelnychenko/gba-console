import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
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

type ProductDetailSnapshot = {
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
  const saleNetId = saleNetUid || EMPTY_GUID
  const scopeKey = JSON.stringify([agreementNetId, saleNetId, isVatSale])
  const [pricingState, setPricingState] = useState<ScopedValues<ProductPricingSnapshot>>({ scopeKey, values: EMPTY_PRICING })
  const [detailState, setDetailState] = useState<ScopedValues<ProductDetailSnapshot>>({ scopeKey, values: EMPTY_DETAILS })
  const [dataRevision, setDataRevision] = useState(0)
  const [detailsRevision, setDetailsRevision] = useState(0)
  const pricingAbortRef = useRef<AbortController | null>(null)
  const detailsAbortRef = useRef<AbortController | null>(null)

  const abortRequests = useCallback(() => {
    pricingAbortRef.current?.abort()
    detailsAbortRef.current?.abort()
  }, [])

  useLayoutEffect(() => abortRequests, [scopeKey, abortRequests])

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
      void (async () => {
        const [pricing, reservations] = await Promise.all([
          Promise.all([
            getProductCurrentPriceByAgreement(productNetUid, agreementNetId, controller.signal),
            getProductCalculatedPricingsByAgreement(productNetUid, agreementNetId, controller.signal),
          ]).catch(() => null),
          getProductReservationsByAgreement(agreementNetId, productNetUid, controller.signal).catch(() => []),
        ])
        if (controller.signal.aborted || !pricing) return
        const reservation = reservations.find((item) => item.ProductNetUid === productNetUid)
          ?? (reservations.length === 1 ? reservations[0] : undefined)
        setPricingState((previous) => {
          const values = new Map(previous.scopeKey === scopeKey ? previous.values : EMPTY_PRICING)
          values.set(productNetUid, { currentPrice: pricing[0], calculatedPricings: pricing[1], reservation })
          return { scopeKey, values }
        })
      })()
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
    const controller = new AbortController()
    detailsAbortRef.current = controller
    queueMicrotask(() => {
      if (controller.signal.aborted) return
      setDetailState((previous) => {
        const values = new Map(previous.scopeKey === scopeKey ? previous.values : EMPTY_DETAILS)
        const existing = values.get(productNetUid)
        values.set(productNetUid, {
          availabilities: existing?.availabilities ?? null,
          detailsError: null,
          detailsLoaded: false,
          nearestOrder: existing?.nearestOrder ?? null,
        })
        return { scopeKey, values }
      })
    })
    const handle = setTimeout(() => {
      void Promise.allSettled([
        getNearestSupplyOrder(productNetUid, controller.signal),
        getAllProductAvailabilities(productNetUid, agreementNetId, saleNetId, controller.signal),
      ]).then(([nearest, totals]) => {
        if (controller.signal.aborted) return
        const detailsError = totals.status === 'rejected'
          ? getErrorMessage(totals.reason, t('Не вдалося завантажити деталі залишків'))
          : null
        setDetailState((previous) => {
          const values = new Map(previous.scopeKey === scopeKey ? previous.values : EMPTY_DETAILS)
          values.set(productNetUid, {
            availabilities: totals.status === 'fulfilled' ? totals.value : null,
            detailsError,
            detailsLoaded: true,
            nearestOrder: nearest.status === 'fulfilled' ? nearest.value : null,
          })
          return { scopeKey, values }
        })
      })
    }, FOCUS_DELAY_MS)
    return () => {
      controller.abort()
      clearTimeout(handle)
    }
  }, [productNetUid, agreementNetId, saleNetId, scopeKey, detailsOpened, dataRevision, detailsRevision, t])

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
