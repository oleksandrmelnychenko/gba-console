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
    cacheRef.current.forEach((items, key) => cacheRef.current.set(key, items.map(patch)))
    setAnalogueState((previous) => ({ ...previous, items: previous.items.map(patch) }))
  }, [])

  const restoreCachedAnalogues = useCallback((product: WizardSaleProduct) => {
    const items = product.NetUid ? cacheRef.current.get(product.NetUid) : undefined
    if (items || !product.HasAnalogue) {
      setAnalogueState({ items: items ?? [], parentNetUid: product.NetUid ?? null, scopeKey })
    }
  }, [scopeKey])

  useEffect(() => {
    // Selecting an analogue retains the original parent's list and focus.
    if (!productNetUid || !agreementNetId || isAnalogueSource) return
    const cached = cacheRef.current.get(productNetUid)
    if (cached || !hasAnalogue) {
      setAnalogueState({ items: cached ?? [], parentNetUid: productNetUid, scopeKey })
      onResetFocus()
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
        setAnalogueState({ items: filtered, parentNetUid: productNetUid, scopeKey })
        onResetFocus()
      }).catch(() => {
        if (controller.signal.aborted) return
        // Failures remain retryable when the product is selected again.
        setAnalogueState({ items: [], parentNetUid: productNetUid, scopeKey })
        onResetFocus()
      })
    }, 240)
    return () => {
      controller.abort()
      clearTimeout(handle)
    }
  }, [productNetUid, agreementNetId, isAnalogueSource, hasAnalogue, isVatSale, scopeKey, resetRevision, onResetFocus])

  return { analogueState, analogueScopeKey: scopeKey, patchAnalogues, resetAnalogues, restoreCachedAnalogues }
}
