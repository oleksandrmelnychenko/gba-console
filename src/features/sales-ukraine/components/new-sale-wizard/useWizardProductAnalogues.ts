import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getProductAnalogues } from './newSaleWizardApi'
import { getWizardStorageQty, type WizardSaleProduct } from './wizardSaleProduct'

type AnalogueState = { items: WizardSaleProduct[]; parentNetUid: string | null; scopeKey: string | null }
const EMPTY_ANALOGUES: AnalogueState = { items: [], parentNetUid: null, scopeKey: null }

export function useWizardProductAnalogues({
  agreementNetId,
  saleNetUid,
  isVatSale,
  dataRevision,
  productNetUid,
  hasAnalogue,
  isAnalogueSource,
  onResetFocus,
}: {
  agreementNetId: string | null
  saleNetUid: string | undefined
  isVatSale: boolean
  dataRevision: number
  productNetUid: string | undefined
  hasAnalogue: boolean
  isAnalogueSource: boolean
  onResetFocus: () => void
}) {
  const scopeKey = JSON.stringify([agreementNetId, isVatSale, saleNetUid || '00000000-0000-0000-0000-000000000000', dataRevision])
  const [analogueState, setAnalogueState] = useState<AnalogueState>(EMPTY_ANALOGUES)
  const [resetRevision, setResetRevision] = useState(0)
  const cacheRef = useRef(new Map<string, WizardSaleProduct[]>())
  const abortRef = useRef<AbortController | null>(null)
  const resetFocusRef = useRef(onResetFocus)
  useLayoutEffect(() => { resetFocusRef.current = onResetFocus })

  const publish = useCallback((items: WizardSaleProduct[], parentNetUid: string | null, scopeKey: string) => {
    setAnalogueState(previous => previous.items === items && previous.parentNetUid === parentNetUid && previous.scopeKey === scopeKey
      ? previous : { items, parentNetUid, scopeKey })
  }, [])

  useLayoutEffect(() => {
    cacheRef.current.clear()
    return () => { abortRef.current?.abort() }
  }, [scopeKey])

  const resetAnalogues = useCallback(() => {
    abortRef.current?.abort()
    setAnalogueState(EMPTY_ANALOGUES)
    setResetRevision((revision) => revision + 1)
  }, [])

  const patchAnalogues = useCallback((patch: (product: WizardSaleProduct) => WizardSaleProduct) => {
    // The visible list normally shares its array with the cache. Transform each
    // list once and retain its identity when the patch affects another product.
    const patchedLists = new Map<WizardSaleProduct[], WizardSaleProduct[]>()
    const patchItems = (items: WizardSaleProduct[]) => {
      const existing = patchedLists.get(items)
      if (existing) return existing
      const next = items.map(patch)
      const result = next.every((item, index) => item === items[index]) ? items : next
      patchedLists.set(items, result)
      return result
    }
    cacheRef.current.forEach((items, key) => cacheRef.current.set(key, patchItems(items)))
    setAnalogueState((previous) => {
      const items = patchItems(previous.items)
      return items === previous.items ? previous : { ...previous, items }
    })
  }, [])

  const restoreCachedAnalogues = useCallback((product: WizardSaleProduct) => {
    const items = product.NetUid ? cacheRef.current.get(product.NetUid) : undefined
    if (items || !product.HasAnalogue) {
      publish(items ?? EMPTY_ANALOGUES.items, product.NetUid ?? null, scopeKey)
    }
  }, [scopeKey, publish])

  useEffect(() => {
    // Selecting an analogue retains the original parent's list and focus.
    if (!productNetUid || !agreementNetId || isAnalogueSource) return
    const cached = cacheRef.current.get(productNetUid)
    if (cached || !hasAnalogue) {
      publish(cached ?? EMPTY_ANALOGUES.items, productNetUid, scopeKey)
      resetFocusRef.current()
      return
    }
    const controller = new AbortController()
    abortRef.current = controller
    const handle = setTimeout(() => {
      void getProductAnalogues(productNetUid, agreementNetId, controller.signal).then((items) => {
        if (controller.signal.aborted) return
        const filtered = items
          .filter((item) => (item.ProductAvailabilities?.length ?? 0) > 0)
          .sort((a, b) => (getWizardStorageQty(b, isVatSale) ?? 0) - (getWizardStorageQty(a, isVatSale) ?? 0))
        const cache = cacheRef.current
        cache.set(productNetUid, filtered)
        if (cache.size > 100) {
          const oldestKey = cache.keys().next().value
          if (oldestKey) cache.delete(oldestKey)
        }
        publish(filtered, productNetUid, scopeKey)
        resetFocusRef.current()
      }).catch(() => {
        if (controller.signal.aborted) return
        // Failures remain retryable when the product is selected again.
        publish(EMPTY_ANALOGUES.items, productNetUid, scopeKey)
        resetFocusRef.current()
      })
    }, 240)
    return () => {
      controller.abort()
      clearTimeout(handle)
    }
  }, [productNetUid, agreementNetId, isAnalogueSource, hasAnalogue, isVatSale, scopeKey, resetRevision, publish])

  return { analogueState, analogueScopeKey: scopeKey, patchAnalogues, resetAnalogues, restoreCachedAnalogues }
}
