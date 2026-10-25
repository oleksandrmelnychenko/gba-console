import { useCallback } from 'react'
import { useI18n } from '../../shared/i18n/useI18n'
import { getProductByNetId, getProductReservationByNetId } from './api/productsApi'
import type { Product, ProductReservation } from './types'
import { useProductResource } from './useProductResource'

const EMPTY_RESERVATION: ProductReservation = {}

/** Product and reservation reads recover independently without discarding known data. */
export function useProductDetailData(netId?: string) {
  const { t } = useI18n()
  const product = useProductResource(netId, getProductByNetId, null, t('Не вдалося завантажити товар'))
  const reservation = useProductResource(netId, getProductReservationByNetId, EMPTY_RESERVATION, t('Не вдалося завантажити резерви товару'))
  const { refresh: refreshProduct, setValue } = product
  const { refresh: refreshReservation } = reservation
  const reload = useCallback(() => Promise.all([refreshProduct(true), refreshReservation(true)]), [refreshProduct, refreshReservation])
  const retryReservation = useCallback(() => refreshReservation(), [refreshReservation])
  const setProduct = useCallback((next: Product | null) => {
    if (next?.NetUid && next.NetUid.toLowerCase() !== netId?.toLowerCase()) return
    setValue(next)
  }, [netId, setValue])

  return { product: product.value, reservation: reservation.value, reservationError: reservation.error,
    reservationLoading: reservation.isLoading, error: product.error, isLoading: product.isLoading,
    reload, retryReservation, setProduct }
}
