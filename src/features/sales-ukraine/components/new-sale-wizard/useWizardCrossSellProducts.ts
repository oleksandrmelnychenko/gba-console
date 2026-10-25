import { useLayoutEffect, useRef, useState } from 'react'
import { getProductCoPurchaseRecommendations } from '../../../clients/api/clientRecommendationsApi'
import { useI18n } from '../../../../shared/i18n/useI18n'
import type { WizardSaleProduct } from './wizardSaleProduct'

const EMPTY_PRODUCTS: WizardSaleProduct[] = []
type Snapshot = { scopeKey: string; products: WizardSaleProduct[]; isLoading: boolean; failed: boolean }

export function useWizardCrossSellProducts({ agreementNetId, clientNetId, productNetId, opened }: {
  agreementNetId: string | null
  clientNetId: string | null
  productNetId: string | undefined
  opened: boolean
}) {
  const { t } = useI18n()
  const scopeKey = JSON.stringify([agreementNetId, clientNetId, productNetId ?? ''])
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const requestRef = useRef<{ controller: AbortController; pending: boolean } | null>(null)

  // A closed panel can reuse its dispatched read; changing its scope or unmounting
  // always retires that read, including when the panel is currently closed.
  useLayoutEffect(() => () => { requestRef.current?.controller.abort() }, [scopeKey])
  useLayoutEffect(() => {
    if (!opened || !agreementNetId || !clientNetId) return
    const previous = requestRef.current
    if (previous?.pending && !previous.controller.signal.aborted) return

    const request = { controller: new AbortController(), pending: true }
    requestRef.current = request
    setSnapshot({ scopeKey, products: EMPTY_PRODUCTS, isLoading: true, failed: false })
    let started = false
    const timer = setTimeout(() => {
      started = true
      void getProductCoPurchaseRecommendations(productNetId ?? '', clientNetId, false, {
        clientAgreementNetId: agreementNetId,
        signal: request.controller.signal,
      }).then(products => {
        if (!request.controller.signal.aborted) {
          setSnapshot({ scopeKey, products: products as WizardSaleProduct[], isLoading: false, failed: false })
        }
      }).catch(() => {
        if (!request.controller.signal.aborted) {
          setSnapshot({ scopeKey, products: EMPTY_PRODUCTS, isLoading: false, failed: true })
        }
      }).finally(() => { request.pending = false })
    }, 0)
    return () => {
      clearTimeout(timer)
      if (!started) request.controller.abort()
    }
  }, [agreementNetId, clientNetId, productNetId, opened, scopeKey])

  const current = opened && agreementNetId && clientNetId && snapshot?.scopeKey === scopeKey ? snapshot : null
  return {
    products: current?.products ?? EMPTY_PRODUCTS,
    isLoading: Boolean(opened && agreementNetId && clientNetId && (!current || current.isLoading)),
    error: current?.failed ? t('Не вдалося завантажити кросс-продажі') : null,
  }
}
