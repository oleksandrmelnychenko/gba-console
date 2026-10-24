import { notifications } from '@mantine/notifications'
import { useMemo, useState } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { useAuth } from '../../../auth/useAuth'
import { getSalesPendingMutationUserKey } from '../../pendingSalesMutationRegistry'
import { getSaleLifecycleTypeKey } from '../../saleStatus'
import type { SalesUkraineOrderItem, SalesUkraineSale, SalesUkraineUser } from '../../types'
import { createAddOrUpdateSalesCartMutation } from '../../usePersistentSalesCartMutation'
import { getProductAvailabilityBuckets } from './newSaleWizardApi'
import { stageWizardSplitExtraction } from './newSaleWizardState'
import { addWizardCartSplitItems } from './wizardCartSplitItems'
import { useWizardCartItemActions } from './useWizardCartItemActions'
import { useWizardCartSplitState } from './useWizardCartSplitState'
import { useWizardCartEditor } from './useWizardCartEditor'
import { useWizardCartEditorExit } from './useWizardCartEditorExit'
import { useWizardCartMutation } from './useWizardCartMutation'
import { useWizardCartQuantityPreparation, type WizardCartQuantityModalState } from './useWizardCartQuantityPreparation'
import { prepareWizardSplitItemRestore, type WizardSplitItemRestoreAction } from './wizardSplitItemRestore'
import { getPreviousProductKeyboardState, type useWizardKeyboard } from './wizardKeyboard'
import type { WizardCartMutationExpectation } from './wizardMutationOperation'
import {
  getWizardProductNumber,
  normalizeWizardProductAvailability,
  type WizardProductAvailability,
  type WizardSaleProduct,
} from './wizardSaleProduct'
import {
  stageWizardSplitRestoreMutation,
  toWizardSplitMutationSnapshot,
} from './wizardSplitSale'

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'

type WizardCartOperationsOptions = {
  agreementNetId: string | null
  sale: SalesUkraineSale | null
  activeProductNetUid: string | undefined
  hasSearchResults: boolean
  canCreateFutureReservation: boolean
  keyboard: Pick<ReturnType<typeof useWizardKeyboard>, 'consumeNextEscape' | 'restorePreviousProductState' | 'setState'>
  onBusyChange?: (busy: boolean) => void
  onPendingMutationChange?: (pending: boolean) => void
  onCartChanged: () => SalesUkraineSale | null | void | Promise<SalesUkraineSale | null | void>
  onRestoreSplitItems?: () => Promise<boolean>
  cancelPendingSearch: () => void
  clearProductPricingCache: () => void
  clearSelection: () => void
  focusSearchInput: () => void
  onFutureReservation: (product: WizardSaleProduct) => void
  onProductAvailabilityChanged: (productNetUid: string, availability: WizardProductAvailability) => void
  onProductAvailabilityFailure: (message: string) => void
}

export function useWizardCartOperations({
  agreementNetId,
  sale,
  activeProductNetUid,
  hasSearchResults,
  canCreateFutureReservation,
  keyboard,
  onBusyChange,
  onPendingMutationChange,
  onCartChanged,
  onRestoreSplitItems,
  cancelPendingSearch,
  clearProductPricingCache,
  clearSelection,
  focusSearchInput,
  onFutureReservation,
  onProductAvailabilityChanged,
  onProductAvailabilityFailure,
}: WizardCartOperationsOptions) {
  const { t } = useI18n()
  const { session, user } = useAuth()
  const pendingMutationUserKey = getSalesPendingMutationUserKey(session)
  const isVatSale = Boolean(sale?.IsVatSale)
  const [qtyModal, setQtyModal] = useState<WizardCartQuantityModalState | null>(null)
  // Keep row sorting independent from editor selection and recovery progress.
  const orderItems = useMemo(() => getOrderItemsNewestFirst(sale), [sale])
  const { editCart, setEditCart, moveCartSelection, toggleSplitMode } = useWizardCartEditor(orderItems.length)
  const { getSplitRecoverySource, persistSplitItems, readSplitItems, commitLocalChange } = useWizardCartSplitState({
    agreementNetId, saleNetUid: sale?.NetUid, userKey: pendingMutationUserKey, setEditCart,
  })

  const cartMutation = useWizardCartMutation({
    agreementNetId,
    sale,
    pendingMutationUserKey,
    activeProductNetUid,
    hasSearchResults,
    orderItems,
    onBusyChange,
    onPendingMutationChange,
    onCartChanged,
    persistSplitItems,
    commitLocalChange,
    clearProductPricingCache,
    refreshVisibleProductAvailability,
  })

  const {
    beginBusy,
    busy,
    createCartMutation,
    currentReconciliationError,
    endBusy,
    isCurrentAvailabilityContext,
    isCurrentMutationContext,
    pendingMutationError,
    retryCartReconciliation,
    retryPendingCartMutation,
    runCartMutation,
  } = cartMutation

  const { prepareAddToCart, onEditOrderItem, canChangePrintedSale } = useWizardCartQuantityPreparation({
    sale, agreementNetId, canCreateFutureReservation, onFutureReservation, onReady: setQtyModal,
    mutation: cartMutation,
  })

  const { removeItem, confirmRemoveRow, confirmRemoveSelected, applyShift,
    shiftRow, setShiftRow, removeConfirmOpen, setRemoveConfirmOpen, removeRowItem, setRemoveRowItem } = useWizardCartItemActions({
    agreementNetId, saleNetUid: sale?.NetUid, user: user as unknown as SalesUkraineUser,
    orderItems, editCart, getSplitRecoverySource, restoreSplitItem, clearProductPricingCache, focusSearchInput,
    mutation: cartMutation,
  })

  const exitEditCart = useWizardCartEditorExit({
    agreementNetId, saleNetUid: sale?.NetUid, orderItems, editCart, commitLocalChange, persistSplitItems,
    clearProductPricingCache, onRestoreSplitItems, onRestored: closeEditCartAfterRestoration,
    mutation: cartMutation,
  })

  async function refreshVisibleProductAvailability(context: string, productNetUid: string) {
    const refreshErrorMessage = t('Не вдалося оновити залишок товару. Повторіть пошук.')

    if (!agreementNetId) {
      onProductAvailabilityFailure(refreshErrorMessage)

      return
    }

    cancelPendingSearch()

    try {
      const buckets = await getProductAvailabilityBuckets(productNetUid, agreementNetId)
      const availability = normalizeWizardProductAvailability(buckets, isVatSale)

      if (!availability) {
        throw new Error('Product availability response is incomplete or invalid.')
      }

      if (!isCurrentAvailabilityContext(context)) {
        return
      }

      onProductAvailabilityChanged(productNetUid, availability)
    } catch {
      if (isCurrentAvailabilityContext(context)) {
        onProductAvailabilityFailure(refreshErrorMessage)
      }
    }
  }

  async function acceptQtyModal(qty: number, comment: string) {
    const modal = qtyModal

    if (!modal) {
      return
    }

    const context = beginBusy()

    if (!context) {
      return
    }

    setQtyModal(null)

    try {
      if (modal.kind === 'add') {
        if (!agreementNetId || !sale?.NetUid) {
          return
        }

        const requestItem = { ...modal.item, Comment: comment, Qty: qty }
        const mutation = createAddOrUpdateSalesCartMutation({
          clientAgreementNetId: agreementNetId,
          orderItem: requestItem,
          orderItems,
          saleNetId: sale.NetUid,
        })
        const completed = await runCartMutation(
          context,
          createCartMutation(context, {
            expectation: mutation.expectation,
            fallbackMessage: t('Не вдалося додати товар'),
            request: mutation.request,
          }),
        )

        if (completed && isCurrentMutationContext(context)) {
          focusSearchInput()
        }
      } else if (modal.kind === 'edit-current') {
        if (editCart?.isSplit) {
          const ordered = getWizardProductNumber(modal.item.Qty) ?? 0
          const rest = ordered - qty

          if (rest < 0) {
            return
          }

          if (rest === 0 && (!modal.item.NetUid || modal.item.NetUid === EMPTY_GUID)) {
            throw new Error('Cannot split an order item without a persisted uid')
          }

          const product = modal.item.Product as WizardSaleProduct | undefined

          if (!product) {
            throw new Error('Cannot split an order item without a product')
          }

          const splitItems = addWizardCartSplitItems(
            editCart.splitItems,
            { ...modal.item, Product: product },
            qty,
            comment,
            user as unknown as SalesUkraineUser,
            agreementNetId,
          )

          const expectation: WizardCartMutationExpectation = rest > 0
            ? {
                afterQty: rest,
                beforeQty: ordered,
                kind: 'row-quantity',
                rowNetUid: modal.item.NetUid ?? '',
              }
            : {
                beforeQty: ordered,
                kind: 'row-deleted',
                rowNetUid: modal.item.NetUid ?? '',
              }
          const operation = createCartMutation(context, {
            localCommit: {
              agreementNetId,
              failureSplitItems: editCart.splitItems,
              kind: 'replace-split-items',
              splitItems,
            },
            expectation,
            fallbackMessage: t('Не вдалося розділити позицію'),
            request: rest > 0
              ? { kind: 'update', orderItem: { ...modal.item, Qty: rest } }
              : {
                  kind: 'delete',
                  orderItemNetId: modal.item.NetUid as string,
                },
          })

          stageWizardSplitExtraction({
            fallbackItems: editCart.splitItems,
            items: splitItems,
            mutation: toWizardSplitMutationSnapshot(operation),
            source: getSplitRecoverySource(),
          })

          await runCartMutation(context, operation)
        } else {
          await runCartMutation(
            context,
            createCartMutation(context, {
              expectation: {
                afterQty: qty,
                beforeQty: getWizardProductNumber(modal.item.Qty) ?? 0,
                kind: 'row-quantity',
                rowNetUid: modal.item.NetUid ?? '',
              },
              fallbackMessage: t('Не вдалося оновити кількість'),
              request: {
                kind: 'update',
                orderItem: { ...modal.item, Comment: comment, Qty: qty },
              },
            }),
          )
        }
      } else {
        if (!editCart) {
          throw new Error('Cannot restore a split item outside cart edit mode')
        }

        await restoreSplitItem(context, { kind: 'quantity', index: editCart.splitItems.indexOf(modal.item), qty })
      }

      if (isCurrentMutationContext(context)) {
        clearProductPricingCache()
      }
    } catch (mutationError) {
      if (isCurrentMutationContext(context)) {
        notifications.show({ color: 'red', message: getRequestErrorMessage(mutationError, t('Не вдалося оновити кількість')) })
      }
    } finally {
      endBusy(context)
    }
  }

  function cancelQtyModal() {
    setQtyModal(null)
    keyboard.consumeNextEscape()
    focusSearchInput()
  }

  function openEditCart() {
    if (orderItems.length === 0) {
      notifications.show({ color: 'orange', message: t('Немає позицій для редагування') })

      return
    }

    if (!sale?.NetUid) {
      notifications.show({ color: 'orange', message: t('Завантаження рахунку') })

      return
    }

    if (getSaleLifecycleTypeKey(sale.BaseLifeCycleStatus?.SaleLifeCycleType) !== '0') {
      notifications.show({ color: 'red', message: t('Неможливо редагувати накладну') })

      return
    }

    try {
      const splitItems = readSplitItems()
      setEditCart({ isSplit: splitItems.length > 0, selected: { index: 0, list: 'current' }, splitItems })
      keyboard.setState('EditShoppingCart')
    } catch (error) {
      notifications.show({ color: 'red', message: getRequestErrorMessage(error, t('Не вдалося відновити всі позиції')) })
    }
  }

  function closeEditCartAfterRestoration() {
    persistSplitItems([])
    setEditCart(null)

    const previousState = getPreviousProductKeyboardState()

    if (previousState === 'ProductSearch' || previousState === 'ProductSelection') {
      clearSelection()
    } else {
      keyboard.restorePreviousProductState()
    }
  }

  async function editSelectedCartRow() {
    const cart = editCart

    if (!cart?.selected) {
      return
    }

    if (!canChangePrintedSale()) {
      return
    }

    if (cart.selected.list === 'current') {
      const item = orderItems[cart.selected.index]

      if (item) {
        await onEditOrderItem(item)
      }
    } else {
      const item = cart.splitItems[cart.selected.index]

      if (item) {
        setQtyModal({ available: item.Qty, item, kind: 'edit-split' })
      }
    }
  }

  async function restoreSplitItem(context: string, action: WizardSplitItemRestoreAction) {
    if (!editCart) throw new Error('Cannot restore a split item outside cart edit mode')
    const plan = prepareWizardSplitItemRestore({
      items: editCart.splitItems, orderItems, agreementNetId, saleNetUid: sale?.NetUid, action,
    })
    if (!plan) return

    const operation = createCartMutation(context, {
      ...plan.mutation,
      fallbackMessage: t('Не вдалося відновити позицію'),
    })
    const stagedItems = stageWizardSplitRestoreMutation(plan.trackedItems, action.index, toWizardSplitMutationSnapshot(operation))
    commitLocalChange({ kind: 'replace-split-items', agreementNetId, splitItems: stagedItems })
    await runCartMutation(context, operation)
  }

  return {
    acceptQtyModal,
    applyShift,
    busy,
    cancelQtyModal,
    confirmRemoveSelected,
    confirmRemoveRow,
    currentReconciliationError,
    editCart,
    editSelectedCartRow,
    exitEditCart,
    moveCartSelection,
    onEditOrderItem,
    openEditCart,
    orderItems,
    pendingMutationError,
    prepareAddToCart,
    qtyModal,
    removeConfirmOpen,
    removeItem,
    removeRowItem,
    retryCartReconciliation,
    retryPendingCartMutation,
    setRemoveConfirmOpen,
    setRemoveRowItem,
    setShiftRow,
    shiftRow,
    toggleSplitMode,
  }
}

function getOrderItemsNewestFirst(sale: SalesUkraineSale | null): SalesUkraineOrderItem[] {
  const items = Array.isArray(sale?.Order?.OrderItems) ? sale.Order.OrderItems : []

  // Parse each Created once (Date.parse per comparator call is O(n log n) parses).
  return items
    .map((item) => [getCreatedTime(item), item] as const)
    .sort((a, b) => b[0] - a[0])
    .map(([, item]) => item)
}

function getCreatedTime(item: SalesUkraineOrderItem): number {
  const created = item.Created

  if (created instanceof Date) {
    return created.getTime()
  }

  if (typeof created === 'string') {
    const parsed = Date.parse(created)

    return Number.isNaN(parsed) ? 0 : parsed
  }

  return 0
}


function getRequestErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback
}
