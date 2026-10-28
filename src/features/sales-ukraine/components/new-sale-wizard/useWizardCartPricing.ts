import { useCallback, useEffect, useState } from 'react'
import type { SalesUkraineOrderItem } from '../../types'
import { getProductCalculatedPricingsByAgreement, type WizardCalculatedProductPricing } from './newSaleWizardApi'

export type WizardCartPricing = {
  status: 'ready' | 'error'
  pricing?: WizardCalculatedProductPricing
}

const EMPTY_PRICING = new Map<string, WizardCartPricing>()

export function useWizardCartPricing(items: SalesUkraineOrderItem[], agreementNetId: string | null | undefined, enabled: boolean) {
  const productIds = JSON.stringify([...new Set(items.flatMap(item => item.Product?.NetUid ? [item.Product.NetUid] : []))].sort())
  const [revision, setRevision] = useState(0)
  const scope = JSON.stringify([agreementNetId, productIds, enabled, revision])
  const [state, setState] = useState({ scope, prices: EMPTY_PRICING })
  const retry = useCallback(() => setRevision(value => value + 1), [setRevision])

  useEffect(() => {
    if (!enabled || !agreementNetId) return
    const controller = new AbortController()
    const pending: string[] = JSON.parse(productIds)
    const workerCount = Math.min(4, pending.length)
    const publish = (productId: string, value: WizardCartPricing) => {
      if (controller.signal.aborted) return
      setState(previous => ({ scope, prices: new Map(previous.scope === scope ? previous.prices : EMPTY_PRICING).set(productId, value) }))
    }
    async function load() {
      while (pending.length && !controller.signal.aborted) {
        const productId = pending.shift()!
        try {
          const result = await getProductCalculatedPricingsByAgreement(productId, agreementNetId!, controller.signal)
          publish(productId, { status: 'ready', pricing: result[0] })
        } catch {
          publish(productId, { status: 'error' })
        }
      }
    }
    for (let index = 0; index < workerCount; index += 1) void load()
    return () => controller.abort()
  }, [agreementNetId, enabled, productIds, scope])

  return { prices: state.scope === scope ? state.prices : EMPTY_PRICING, retry }
}
