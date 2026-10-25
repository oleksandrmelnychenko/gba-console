import { useEffect, useEffectEvent } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getShiftedSaleById } from '../api/salesUkraineApi'
import type { SalesUkraineSale } from '../types'

export type SaleEditLoadAction =
  | { type: 'loadStarted' }
  | { type: 'loadSucceeded'; sale: SalesUkraineSale }
  | { type: 'loadFailed'; error: string }

/** The edit session owns its read; presentation changes must not reset a draft. */
export function useSaleEditLoad(netId: string | undefined, dispatch: (action: SaleEditLoadAction) => void) {
  const { t } = useI18n()
  const publish = useEffectEvent(dispatch)
  const fail = useEffectEvent((error?: unknown) => {
    dispatch({ type: 'loadFailed', error: error instanceof Error ? error.message : t('Не вдалося завантажити продаж') })
  })

  useEffect(() => {
    if (!netId) return
    const controller = new AbortController()
    publish({ type: 'loadStarted' })
    void getShiftedSaleById(netId, controller.signal).then(sale => {
      if (controller.signal.aborted) return
      if (sale) publish({ type: 'loadSucceeded', sale })
      else fail()
    }).catch(error => {
      if (!controller.signal.aborted) fail(error)
    })
    return () => controller.abort()
  }, [netId])
}
