import { useCallback, useLayoutEffect, useRef } from 'react'
import { getProductAvailabilityBuckets } from './newSaleWizardApi'
import { getWizardSellableQty } from './wizardSaleProduct'

// Stock is read fresh for each quantity dialog, scoped to its sale and agreement.
export function useWizardCartAvailability(
  agreementNetId: string | null,
  saleNetUid: string | undefined,
  isVatSale: boolean,
) {
  const pending = useRef<AbortController | null>(null)

  useLayoutEffect(() => () => {
    pending.current?.abort()
    pending.current = null
  }, [agreementNetId, saleNetUid, isVatSale])

  return useCallback(async (productNetUid: string): Promise<number | null> => {
    if (!agreementNetId) return null

    pending.current?.abort()
    const controller = new AbortController()
    pending.current = controller

    try {
      const buckets = await getProductAvailabilityBuckets(productNetUid, agreementNetId, controller.signal)

      // null means retired, not zero stock: cancellation must not open the edit fallback.
      return controller.signal.aborted ? null : getWizardSellableQty(buckets ?? {}, isVatSale) ?? 0
    } catch (error) {
      if (controller.signal.aborted) return null

      throw error
    } finally {
      if (pending.current === controller) pending.current = null
    }
  }, [agreementNetId, isVatSale])
}
