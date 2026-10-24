import { notifications } from '@mantine/notifications'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { getSaleLifecycleTypeKey } from '../../saleStatus'
import type { SalesUkraineOrderItem, SalesUkraineSale } from '../../types'
import { getProductAvailabilityBuckets } from './newSaleWizardApi'
import type { useWizardCartMutation } from './useWizardCartMutation'
import { getWizardProductNumber, getWizardSellableQty, type WizardSaleProduct } from './wizardSaleProduct'
import type { WizardSplitOrderItem } from './wizardSplitSale'

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'

export type WizardCartQuantityModalState =
  | { available: number; item: SalesUkraineOrderItem; kind: 'add' }
  | { available: number; item: SalesUkraineOrderItem; kind: 'edit-current' }
  | { available: number; item: WizardSplitOrderItem; kind: 'edit-split' }

type Options = {
  sale: SalesUkraineSale | null
  agreementNetId: string | null
  canCreateFutureReservation: boolean
  onFutureReservation: (product: WizardSaleProduct) => void
  onReady: (modal: WizardCartQuantityModalState) => void
  mutation: Pick<ReturnType<typeof useWizardCartMutation>, 'beginBusy' | 'endBusy' | 'isCurrentMutationContext'>
}

// This hook prepares the quantity dialog; saving quantities stays in the mutation controller.
export function useWizardCartQuantityPreparation({
  sale, agreementNetId, canCreateFutureReservation, onFutureReservation, onReady, mutation,
}: Options) {
  const { t } = useI18n()
  const { beginBusy, endBusy, isCurrentMutationContext } = mutation
  const isVatSale = Boolean(sale?.IsVatSale)
  const isSaleLifecycleNew = getSaleLifecycleTypeKey(sale?.BaseLifeCycleStatus?.SaleLifeCycleType) === '0'

  function canChangePrintedSale(): boolean {
    if (sale?.IsPrinted) {
      const approved = (sale.HistoryInvoiceEdit ?? []).some((entry) => Boolean((entry as { ApproveUpdate?: boolean }).ApproveUpdate))

      if (!approved) {
        notifications.show({ color: 'red', message: t('Зміни заборонені') })

        return false
      }
    }

    return true
  }

  async function prepareAddToCart(product: WizardSaleProduct | null) {
    if (!product?.NetUid) {
      return
    }

    if (!canChangePrintedSale()) {
      return
    }

    if (!agreementNetId || !sale?.NetUid) {
      notifications.show({ color: 'orange', message: t('Сесія поточного клієнта була видалена відкриттям іншої вкладки') })

      return
    }

    const sellable = getWizardSellableQty(product, isVatSale)

    if (typeof sellable === 'number' && sellable === 0) {
      if (!canCreateFutureReservation) {
        notifications.show({ color: 'red', message: t('Недостатньо прав для резервування під поставку') })

        return
      }

      onFutureReservation(product)

      return
    }

    const context = beginBusy()

    if (!context) {
      return
    }

    try {
      const buckets = await getProductAvailabilityBuckets(product.NetUid, agreementNetId)
      const available = getWizardSellableQty(buckets ?? {}, isVatSale) ?? 0
      const item: SalesUkraineOrderItem = {
        Deleted: false,
        Id: 0,
        NetUid: EMPTY_GUID,
        Product: product,
        Qty: 0,
      }

      if (isCurrentMutationContext(context)) {
        onReady({ available, item, kind: 'add' })
      }
    } catch (loadError) {
      if (isCurrentMutationContext(context)) {
        notifications.show({ color: 'red', message: getRequestErrorMessage(loadError, t('Не вдалося додати товар')) })
      }
    } finally {
      endBusy(context)
    }
  }

  async function onEditOrderItem(item: SalesUkraineOrderItem) {
    if (!isSaleLifecycleNew) {
      if (sale?.IsPrinted) {
        if (!canChangePrintedSale()) return
      } else {
        // Was a silent return — from the row-actions popup that read as "nothing works".
        notifications.show({ color: 'red', message: t('Неможливо редагувати накладну') })

        return
      }
    }

    if (!item.Product?.NetUid || !agreementNetId) {
      return
    }

    const context = beginBusy()

    if (!context) {
      return
    }

    try {
      const buckets = await getProductAvailabilityBuckets(item.Product.NetUid, agreementNetId)
      const available = getWizardSellableQty(buckets ?? {}, isVatSale) ?? 0

      if (isCurrentMutationContext(context)) {
        onReady({ available: (getWizardProductNumber(item.Qty) ?? 0) + available, item, kind: 'edit-current' })
      }
    } catch {
      if (isCurrentMutationContext(context)) {
        onReady({ available: getWizardProductNumber(item.Qty) ?? 0, item, kind: 'edit-current' })
      }
    } finally {
      endBusy(context)
    }
  }

  return { prepareAddToCart, onEditOrderItem, canChangePrintedSale }
}

function getRequestErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback
}
