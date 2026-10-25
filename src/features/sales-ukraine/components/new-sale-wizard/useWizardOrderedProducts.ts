import { useLayoutEffect, useRef, useState } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { getClientOrderedProducts } from '../../../clients/api/clientCabinetApi'
import type { ClientOrderedProduct } from '../../../clients/types'

const EMPTY_PRODUCTS: ClientOrderedProduct[] = []
type Snapshot = {
  clientNetId: string
  products: ClientOrderedProduct[]
  isLoading: boolean
  failed: boolean
  errorMessage?: string
}

export function useWizardOrderedProducts(clientNetId: string | null, opened: boolean) {
  const { t } = useI18n()
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const requestRef = useRef<{ controller: AbortController; pending: boolean } | null>(null)

  // Keep an already dispatched read across closing/reopening. Retire it whenever
  // its client changes or the wizard unmounts, even if the drawer is closed.
  useLayoutEffect(() => () => { requestRef.current?.controller.abort() }, [clientNetId])
  useLayoutEffect(() => {
    if (!opened || !clientNetId) return
    if (requestRef.current?.pending && !requestRef.current.controller.signal.aborted) return

    const request = { controller: new AbortController(), pending: true }
    requestRef.current = request
    setSnapshot({ clientNetId, products: EMPTY_PRODUCTS, isLoading: true, failed: false })
    let started = false
    const timer = setTimeout(() => {
      started = true
      void getClientOrderedProducts(clientNetId, request.controller.signal).then(products => {
        if (!request.controller.signal.aborted) {
          setSnapshot({ clientNetId, products, isLoading: false, failed: false })
        }
      }).catch((error: unknown) => {
        if (!request.controller.signal.aborted) {
          setSnapshot({ clientNetId, products: EMPTY_PRODUCTS, isLoading: false, failed: true,
            errorMessage: error instanceof Error ? error.message : undefined })
        }
      }).finally(() => { request.pending = false })
    }, 0)
    return () => {
      clearTimeout(timer)
      if (!started) request.controller.abort()
    }
  }, [clientNetId, opened])

  const current = opened && clientNetId && snapshot?.clientNetId === clientNetId ? snapshot : null
  return {
    products: current?.products ?? EMPTY_PRODUCTS,
    isLoading: Boolean(opened && clientNetId && (!current || current.isLoading)),
    error: current?.failed ? current.errorMessage ?? t('Не вдалося завантажити дані') : null,
  }
}
