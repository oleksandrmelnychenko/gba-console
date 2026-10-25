import { useCallback, useEffect, useReducer, useState } from 'react'
import { useI18n } from '../../shared/i18n/useI18n'
import { getProductByNetId, getProductReservationByNetId } from './api/productsApi'
import type { Product, ProductReservation } from './types'

function emptySnapshot(netId?: string) {
  return {
    netId, product: null as Product | null, reservation: {} as ProductReservation,
    error: null as string | null, reservationError: null as string | null,
    isLoading: Boolean(netId), reservationLoading: Boolean(netId),
  }
}

/** Product and reservation requests start together, but neither delays the other's display. */
export function useProductDetailData(netId?: string) {
  const { t } = useI18n()
  const [revision, reload] = useReducer((value: number) => value + 1, 0)
  const [snapshot, setSnapshot] = useState(() => ({ ...emptySnapshot(netId), revision, translate: t }))
  const setProduct = useCallback((product: Product | null) => {
    setSnapshot(current => ({ ...current, product }))
  }, [])

  // Reset during render so consumers never commit stale data or an extra loading render.
  if (snapshot.netId !== netId || snapshot.revision !== revision || snapshot.translate !== t) {
    setSnapshot({ ...emptySnapshot(netId), revision, translate: t,
      product: snapshot.netId === netId ? snapshot.product : null })
  }

  useEffect(() => {
    if (!netId) return
    const controller = new AbortController()
    const { signal } = controller
    void getProductByNetId(netId, signal).then(product => {
      if (!signal.aborted) setSnapshot(current => ({ ...current, product, isLoading: false }))
    }).catch((error: unknown) => {
      if (!signal.aborted) setSnapshot(current => ({ ...current, product: null, isLoading: false,
        error: error instanceof Error ? error.message : t('Не вдалося завантажити товар') }))
    })
    void getProductReservationByNetId(netId, signal).then(reservation => {
      if (!signal.aborted) setSnapshot(current => ({ ...current, reservation, reservationLoading: false }))
    }).catch((error: unknown) => {
      if (!signal.aborted) setSnapshot(current => ({ ...current, reservationLoading: false,
        reservationError: error instanceof Error ? error.message : t('Не вдалося завантажити резерви товару') }))
    })
    return () => controller.abort()
  }, [netId, revision, t])

  const { product, reservation, reservationError, reservationLoading, error, isLoading } = snapshot
  return { product, reservation, reservationError, reservationLoading, error, isLoading, reload, setProduct }
}
