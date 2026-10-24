import { notifications } from '@mantine/notifications'
import { useCallback, useMemo, useState } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { useAuth } from '../../../auth/useAuth'
import { getSalesPendingMutationUserKey } from '../../pendingSalesMutationRegistry'
import { getSaleLifecycleTypeKey } from '../../saleStatus'
import type { SalesUkraineOrderItem, SalesUkraineSale, SalesUkraineUser } from '../../types'
import { createAddOrUpdateSalesCartMutation } from '../../usePersistentSalesCartMutation'
import { getProductAvailabilityBuckets, type WizardAvailabilityRow } from './newSaleWizardApi'
import {
  clearWizardSplitOrderItems,
  getWizardMergedSaleNetUid,
  getWizardSplitAgreementNetId,
  getWizardSplitOrderItems,
  getWizardSplitRecovery,
  setWizardSplitOrderItems,
  stageWizardSplitExtraction,
} from './newSaleWizardState'
import { useWizardCartMutation, type PendingCartMutation } from './useWizardCartMutation'
import type { WizardCartLocalCommit, WizardCartSelection } from './wizardCartMutation'
import { getPreviousProductKeyboardState, type useWizardKeyboard } from './wizardKeyboard'
import type { WizardCartMutationExpectation } from './wizardMutationOperation'
import {
  getWizardProductNumber,
  getWizardSellableQty,
  normalizeWizardProductAvailability,
  type WizardProductAvailability,
  type WizardSaleProduct,
} from './wizardSaleProduct'
import {
  addWizardSplitOrderItem,
  clearWizardSplitRestoreTracking,
  ensureWizardSplitRestoreOperationNetUids,
  findRestorableWizardOrderItem,
  mapWizardSplitOrderItem,
  resizeWizardSplitOrderItem,
  restoreWizardSplitItemsSequentially,
  stageWizardSplitRestoreMutation,
  toWizardSplitMutationSnapshot,
  updateWizardSplitOrderItemQty,
  type WizardSplitOrderItem,
  type WizardSplitRecoverySource,
} from './wizardSplitSale'

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'

type QtyModalState =
  | { available: number; item: SalesUkraineOrderItem; kind: 'add' }
  | { available: number; item: SalesUkraineOrderItem; kind: 'edit-current' }
  | { available: number; item: WizardSplitOrderItem; kind: 'edit-split' }

type EditCartState = {
  isSplit: boolean
  selected: WizardCartSelection | null
  splitItems: WizardSplitOrderItem[]
}

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
  const isSaleLifecycleNew = getSaleLifecycleTypeKey(sale?.BaseLifeCycleStatus?.SaleLifeCycleType) === '0'
  const [editCart, setEditCart] = useState<EditCartState | null>(null)
  const [qtyModal, setQtyModal] = useState<QtyModalState | null>(null)
  const [shiftRow, setShiftRow] = useState<WizardAvailabilityRow | null>(null)
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false)
  const [removeRowItem, setRemoveRowItem] = useState<SalesUkraineOrderItem | null>(null)
  const getSplitRecoverySource = useCallback((
    targetAgreementNetId: string | null = agreementNetId,
    targetSaleNetUid: string | null | undefined = sale?.NetUid,
  ): WizardSplitRecoverySource => {
    const existing = getWizardSplitRecovery()

    if (
      existing &&
      existing.agreementNetId === targetAgreementNetId?.trim().toLowerCase() &&
      existing.saleNetUid === targetSaleNetUid?.trim().toLowerCase() &&
      existing.userKey === pendingMutationUserKey
    ) {
      return {
        agreementNetId: existing.agreementNetId,
        origin: existing.origin,
        saleNetUid: existing.saleNetUid,
        userKey: existing.userKey,
      }
    }

    if (!targetAgreementNetId || !targetSaleNetUid || targetSaleNetUid === EMPTY_GUID || !pendingMutationUserKey) {
      throw new Error(t('Неможливо безпечно зберегти розділення без поточного рахунку та користувача'))
    }

    return {
      agreementNetId: targetAgreementNetId,
      origin: getWizardMergedSaleNetUid()?.trim().toLowerCase() === targetSaleNetUid.trim().toLowerCase()
        ? 'merged'
        : 'ordinary',
      saleNetUid: targetSaleNetUid,
      userKey: pendingMutationUserKey,
    }
  }, [agreementNetId, pendingMutationUserKey, sale?.NetUid, t])

  const persistSplitItems = useCallback((
    items: WizardSplitOrderItem[],
    targetAgreementNetId: string | null = agreementNetId,
  ) => {
    if (items.length === 0) {
      setWizardSplitOrderItems([], null)

      return
    }

    setWizardSplitOrderItems(items, targetAgreementNetId, getSplitRecoverySource(targetAgreementNetId))
  }, [agreementNetId, getSplitRecoverySource])

  // Memoized: the sort clones + Date.parses per comparison; unmemoized it also
  // returned a fresh array identity every render, invalidating the cart grid's
  // column defs and TanStack row model on every search keystroke.
  const orderItems = useMemo(() => getOrderItemsNewestFirst(sale), [sale])
  function commitLocalChange(localCommit: Extract<WizardCartLocalCommit, { kind: 'replace-split-items' }>) {
    persistSplitItems(localCommit.splitItems, localCommit.agreementNetId)
    setEditCart((previous) => previous
      ? {
          ...previous,
          ...(localCommit.isSplit === undefined ? {} : { isSplit: localCommit.isSplit }),
          ...(localCommit.selected === undefined ? {} : { selected: localCommit.selected }),
          splitItems: localCommit.splitItems,
        }
      : previous)
  }

  const {
    beginBusy,
    busy,
    createCartMutation,
    currentReconciliationError,
    endBusy,
    isCurrentAvailabilityContext,
    isCurrentMutationContext,
    pendingMutationError,
    persistPendingCartMutation,
    retryCartReconciliation,
    retryPendingCartMutation,
    runCartMutation,
    setPendingMutationError,
  } = useWizardCartMutation({
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
      const available = isVatSale
        ? buckets?.AvailableQtyUkVAT ?? 0
        : (buckets?.AvailableQtyUk ?? 0) + (buckets?.AvailableQtyUkReSale ?? 0)
      const item: SalesUkraineOrderItem = {
        Deleted: false,
        Id: 0,
        NetUid: EMPTY_GUID,
        Product: product,
        Qty: 0,
      }

      if (isCurrentMutationContext(context)) {
        setQtyModal({ available, item, kind: 'add' })
      }
    } catch (loadError) {
      if (isCurrentMutationContext(context)) {
        notifications.show({ color: 'red', message: getRequestErrorMessage(loadError, t('Не вдалося додати товар')) })
      }
    } finally {
      endBusy(context)
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

          const splitItems = addToSplitItems(
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

        const splitIndex = editCart.splitItems.indexOf(modal.item)
        const trackedSplitItems = ensureWizardSplitRestoreOperationNetUids(editCart.splitItems)
        const trackedItem = trackedSplitItems[splitIndex]

        if (!trackedItem?.RestoreOperationNetUid) {
          throw new Error('Cannot create a stable restore operation')
        }

        const rest = trackedItem.Qty - qty

        if (rest < 0) {
          return
        }

        const existing = findRestorableWizardOrderItem(orderItems, trackedItem)
        const saleNetUid = sale?.NetUid
        const existingQty = getWizardProductNumber(existing?.Qty) ?? 0

        if (!existing && (!agreementNetId || !saleNetUid)) {
          throw new Error('Cannot restore a split item without a current sale')
        }

        const splitItems = clearWizardSplitRestoreTracking(
          updateWizardSplitOrderItemQty(trackedSplitItems, trackedItem, rest),
          trackedItem.RestoreOperationNetUid,
        )
        const operation = createCartMutation(context, {
          localCommit: {
            agreementNetId,
            failureSplitItems: clearWizardSplitRestoreTracking(
              trackedSplitItems,
              trackedItem.RestoreOperationNetUid,
            ),
            isSplit: splitItems.length > 0,
            kind: 'replace-split-items',
            splitItems,
          },
          expectation: existing?.NetUid
            ? {
                afterQty: existingQty + qty,
                beforeQty: existingQty,
                kind: 'row-quantity',
                rowNetUid: existing.NetUid,
              }
            : { kind: 'operation-marker' },
          fallbackMessage: t('Не вдалося відновити позицію'),
          operationId: trackedItem.RestoreOperationNetUid,
          request: existing
            ? { kind: 'update', orderItem: { ...existing, Qty: existingQty + qty } }
            : {
                clientAgreementNetId: agreementNetId as string,
                kind: 'add',
                orderItem: mapWizardSplitOrderItem(resizeWizardSplitOrderItem(trackedItem, qty)),
                saleNetId: saleNetUid as string,
              },
        })
        const stagedSplitItems = stageWizardSplitRestoreMutation(
          trackedSplitItems,
          splitIndex,
          toWizardSplitMutationSnapshot(operation),
        )

        persistSplitItems(stagedSplitItems, agreementNetId)
        setEditCart((previous) => (previous ? { ...previous, splitItems: stagedSplitItems } : previous))
        await runCartMutation(context, operation)
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

  async function removeItem(item: SalesUkraineOrderItem) {
    if (!item.NetUid) {
      return
    }

    const context = beginBusy()

    if (!context) {
      return
    }

    try {
      const completed = await runCartMutation(
        context,
        createCartMutation(context, {
          expectation: {
            beforeQty: getWizardProductNumber(item.Qty) ?? 0,
            kind: 'row-deleted',
            rowNetUid: item.NetUid,
          },
          fallbackMessage: t('Не вдалося видалити товар'),
          request: { kind: 'delete', orderItemNetId: item.NetUid },
        }),
      )

      if (completed && isCurrentMutationContext(context)) {
        clearProductPricingCache()
      }
    } catch (mutationError) {
      if (isCurrentMutationContext(context)) {
        notifications.show({ color: 'red', message: getRequestErrorMessage(mutationError, t('Не вдалося видалити товар')) })
      }
    } finally {
      endBusy(context)
    }
  }

  async function onEditOrderItem(item: SalesUkraineOrderItem) {
    if (!isSaleLifecycleNew) {
      if (sale?.IsPrinted) {
        const approved = (sale.HistoryInvoiceEdit ?? []).some((entry) => Boolean((entry as { ApproveUpdate?: boolean }).ApproveUpdate))

        if (!approved) {
          notifications.show({ color: 'red', message: t('Зміни заборонені') })

          return
        }
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
      const available = isVatSale
        ? buckets?.AvailableQtyUkVAT ?? 0
        : (buckets?.AvailableQtyUk ?? 0) + (buckets?.AvailableQtyUkReSale ?? 0)

      if (isCurrentMutationContext(context)) {
        setQtyModal({ available: (getWizardProductNumber(item.Qty) ?? 0) + available, item, kind: 'edit-current' })
      }
    } catch {
      if (isCurrentMutationContext(context)) {
        setQtyModal({ available: getWizardProductNumber(item.Qty) ?? 0, item, kind: 'edit-current' })
      }
    } finally {
      endBusy(context)
    }
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

    const splitItems = getWizardSplitOrderItems()
    setEditCart({ isSplit: splitItems.length > 0, selected: { index: 0, list: 'current' }, splitItems })
    keyboard.setState('EditShoppingCart')
  }

  function closeEditCartAfterRestoration() {
    clearWizardSplitOrderItems()
    setEditCart(null)

    const previousState = getPreviousProductKeyboardState()

    if (previousState === 'ProductSearch' || previousState === 'ProductSelection') {
      clearSelection()
    } else {
      keyboard.restorePreviousProductState()
    }
  }

  async function exitEditCart() {
    const cart = editCart

    if (!cart) {
      return
    }

    if (cart.splitItems.length > 0 && onRestoreSplitItems) {
      const context = beginBusy()

      if (!context) {
        return
      }

      try {
        if (!(await onRestoreSplitItems()) || !isCurrentMutationContext(context)) {
          return
        }

        clearProductPricingCache()
        closeEditCartAfterRestoration()
      } catch (restoreError) {
        if (isCurrentMutationContext(context)) {
          notifications.show({
            color: 'red',
            message: getRequestErrorMessage(restoreError, t('Не вдалося відновити всі позиції')),
          })
        }
      } finally {
        endBusy(context)
      }

      return
    }

    if (cart.splitItems.length > 0) {
      if (!agreementNetId || !sale?.NetUid) {
        notifications.show({ color: 'red', message: t('Не вдалося відновити позиції без поточного рахунку') })

        return
      }

      const currentAgreementNetId = agreementNetId
      const saleNetUid = sale.NetUid
      const trackedSplitItems = ensureWizardSplitRestoreOperationNetUids(cart.splitItems)

      persistSplitItems(trackedSplitItems, currentAgreementNetId)
      setEditCart((previous) => (previous ? { ...previous, splitItems: trackedSplitItems } : previous))

      const context = beginBusy()

      if (!context) {
        return
      }

      const restoredQtyByOrderItem = new Map<string, number>()
      const restoreOperations = new Map<string, PendingCartMutation>()

      try {
        const result = await restoreWizardSplitItemsSequentially(
          trackedSplitItems,
          async (item, index, operationId, isRetry) => {
            const existing = findRestorableWizardOrderItem(orderItems, item)
            const existingQty = getWizardProductNumber(existing?.Qty) ?? 0
            const restoredQty = existing?.NetUid
              ? restoredQtyByOrderItem.get(existing.NetUid) ?? 0
              : 0
            const remainingAfterCommit = trackedSplitItems.slice(index + 1)
            const operation = createCartMutation(context, {
              expectation: existing?.NetUid
                ? {
                    afterQty: existingQty + restoredQty + item.Qty,
                    beforeQty: existingQty + restoredQty,
                    kind: 'row-quantity',
                    rowNetUid: existing.NetUid,
                  }
                : { kind: 'operation-marker' },
              fallbackMessage: t('Не вдалося відновити всі позиції'),
              localCommit: {
                agreementNetId: currentAgreementNetId,
                failureSplitItems: clearWizardSplitRestoreTracking(
                  trackedSplitItems.slice(index),
                  operationId,
                ),
                isSplit: remainingAfterCommit.length > 0,
                kind: 'replace-split-items',
                selected: remainingAfterCommit.length > 0
                  ? { index: 0, list: 'split' }
                  : orderItems.length > 0
                    ? { index: 0, list: 'current' }
                    : null,
                splitItems: remainingAfterCommit,
              },
              operationId,
              request: existing
                ? {
                    kind: 'update',
                    orderItem: { ...existing, Qty: existingQty + restoredQty + item.Qty },
                  }
                : {
                    clientAgreementNetId: currentAgreementNetId,
                    kind: 'add',
                    orderItem: mapWizardSplitOrderItem(item),
                    saleNetId: saleNetUid,
                  },
            })
            restoreOperations.set(operationId, operation)
            const stagedItem = stageWizardSplitRestoreMutation(
              [item],
              0,
              toWizardSplitMutationSnapshot(operation),
            )[0] as WizardSplitOrderItem
            Object.assign(item, stagedItem)
            trackedSplitItems[index] = item
            persistSplitItems(trackedSplitItems.slice(index), currentAgreementNetId)
            persistPendingCartMutation(operation)
            const completed = await runCartMutation(context, operation, isRetry)

            if (!completed) {
              throw new Error(t('Операція відновлення не підтверджена; повторіть звірку тим самим ключем'))
            }

            if (existing?.NetUid) {
              restoredQtyByOrderItem.set(existing.NetUid, restoredQty + item.Qty)
            }
          },
          ({ remaining }) => {
            if (isCurrentMutationContext(context)) {
              persistSplitItems(remaining, currentAgreementNetId)
              setEditCart((previous) =>
                previous
                  ? {
                      ...previous,
                      isSplit: remaining.length > 0,
                      selected: remaining.length > 0
                        ? { index: 0, list: 'split' }
                        : orderItems.length > 0
                          ? { index: 0, list: 'current' }
                          : null,
                      splitItems: remaining,
                    }
                  : previous,
              )
            }
          },
          async (item, _index, operationId, error) => {
            const operation = restoreOperations.get(operationId)

            if (!operation) {
              return 'pending'
            }

            const completed = await runCartMutation(context, operation, true)

            if (completed) {
              const existing = findRestorableWizardOrderItem(orderItems, item)

              if (existing?.NetUid) {
                restoredQtyByOrderItem.set(
                  existing.NetUid,
                  (restoredQtyByOrderItem.get(existing.NetUid) ?? 0) + item.Qty,
                )
              }

              return 'committed'
            }

            setPendingMutationError(getRequestErrorMessage(error, operation.fallbackMessage))

            return 'pending'
          },
          ({ remaining }) => {
            if (isCurrentMutationContext(context)) {
              persistSplitItems(remaining, currentAgreementNetId)
              setEditCart((previous) => (previous ? { ...previous, splitItems: remaining } : previous))
            }
          },
        )

        if ((result.committed.length > 0 || result.error) && isCurrentMutationContext(context)) {
          clearProductPricingCache()
        }

        if (result.error) {
          if (isCurrentMutationContext(context)) {
            persistSplitItems(result.remaining, currentAgreementNetId)
            setEditCart((previous) => previous
              ? {
                  ...previous,
                  isSplit: result.remaining.length > 0,
                  selected: result.remaining.length > 0 ? { index: 0, list: 'split' } : null,
                  splitItems: result.remaining,
                }
              : previous)
            notifications.show({
              color: 'red',
              message: getRequestErrorMessage(result.error, t('Не вдалося відновити всі позиції')),
            })
          }

          return
        }
      } catch (mutationError) {
        if (isCurrentMutationContext(context)) {
          notifications.show({ color: 'red', message: getRequestErrorMessage(mutationError, t('Не вдалося оновити кількість')) })
        }

        return
      } finally {
        endBusy(context)
      }

      if (!isCurrentMutationContext(context)) {
        return
      }
    }

    closeEditCartAfterRestoration()
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

  async function confirmRemoveSelected() {
    setRemoveConfirmOpen(false)
    const cart = editCart
    const selected = cart?.selected

    if (!cart || !selected) {
      return
    }

    const context = beginBusy()

    if (!context) {
      return
    }

    try {
      if (selected.list === 'current') {
        const item = orderItems[selected.index]

        if (item) {
          const product = item.Product as WizardSaleProduct | undefined
          const splitItems = cart.isSplit && product
            ? addToSplitItems(
                cart.splitItems,
                { ...item, Product: product },
                getWizardProductNumber(item.Qty) ?? 0,
                item.Comment,
                user as unknown as SalesUkraineUser,
                agreementNetId,
              )
            : null

          if (!item.NetUid || item.NetUid === EMPTY_GUID) {
            throw new Error('Cannot remove an order item without a persisted uid')
          }
          const itemNetUid = item.NetUid
          const operation = createCartMutation(context, {
            expectation: {
              beforeQty: getWizardProductNumber(item.Qty) ?? 0,
              kind: 'row-deleted',
              rowNetUid: itemNetUid,
            },
            fallbackMessage: t('Не вдалося видалити товар'),
            localCommit: splitItems
              ? {
                  agreementNetId,
                  failureSplitItems: cart.splitItems,
                  kind: 'replace-split-items',
                  selected: { index: Math.max(0, selected.index - 1), list: 'current' },
                  splitItems,
                }
              : { kind: 'none' },
            request: { kind: 'delete', orderItemNetId: itemNetUid },
          })

          if (splitItems) {
            stageWizardSplitExtraction({
              fallbackItems: cart.splitItems,
              items: splitItems,
              mutation: toWizardSplitMutationSnapshot(operation),
              source: getSplitRecoverySource(),
            })
          }

          await runCartMutation(context, operation)
        }
      } else {
        const item = cart.splitItems[selected.index]

        if (item) {
          const trackedSplitItems = ensureWizardSplitRestoreOperationNetUids(cart.splitItems)
          const trackedItem = trackedSplitItems[selected.index]

          if (!trackedItem?.RestoreOperationNetUid) {
            throw new Error('Cannot create a stable restore operation')
          }

          const existing = findRestorableWizardOrderItem(orderItems, trackedItem)
          const saleNetUid = sale?.NetUid
          const existingQty = getWizardProductNumber(existing?.Qty) ?? 0

          if (!existing && (!agreementNetId || !saleNetUid)) {
            throw new Error('Cannot restore a split item without a current sale')
          }

          const splitItems = trackedSplitItems.filter((_, index) => index !== selected.index)

          const operation = createCartMutation(context, {
            localCommit: {
              agreementNetId,
              failureSplitItems: clearWizardSplitRestoreTracking(
                trackedSplitItems,
                trackedItem.RestoreOperationNetUid,
              ),
              isSplit: splitItems.length > 0,
              kind: 'replace-split-items',
              selected: splitItems.length > 0
                ? { index: Math.max(0, selected.index - 1), list: 'split' }
                : null,
              splitItems,
            },
            expectation: existing?.NetUid
              ? {
                  afterQty: existingQty + trackedItem.Qty,
                  beforeQty: existingQty,
                  kind: 'row-quantity',
                  rowNetUid: existing.NetUid,
                }
              : { kind: 'operation-marker' },
            fallbackMessage: t('Не вдалося відновити позицію'),
            operationId: trackedItem.RestoreOperationNetUid,
            request: existing
              ? { kind: 'update', orderItem: { ...existing, Qty: existingQty + trackedItem.Qty } }
              : {
                  clientAgreementNetId: agreementNetId as string,
                  kind: 'add',
                  orderItem: mapWizardSplitOrderItem(trackedItem),
                  saleNetId: saleNetUid as string,
                },
          })
          const stagedSplitItems = stageWizardSplitRestoreMutation(
            trackedSplitItems,
            selected.index,
            toWizardSplitMutationSnapshot(operation),
          )

          persistSplitItems(stagedSplitItems, agreementNetId)
          setEditCart((previous) => (previous ? { ...previous, splitItems: stagedSplitItems } : previous))
          await runCartMutation(context, operation)
        }
      }

      if (isCurrentMutationContext(context)) {
        clearProductPricingCache()
      }
    } catch (mutationError) {
      if (isCurrentMutationContext(context)) {
        notifications.show({ color: 'red', message: getRequestErrorMessage(mutationError, t('Не вдалося видалити товар')) })
      }
    } finally {
      endBusy(context)
    }
  }

  function moveCartSelection(direction: 1 | -1) {
    const items = orderItems

    setEditCart((previous) => {
      if (!previous) {
        return previous
      }

      const flat: WizardCartSelection[] = []

      for (let index = 0; index < items.length; index += 1) {
        flat.push({ index, list: 'current' })
      }

      if (previous.isSplit) {
        for (let index = 0; index < previous.splitItems.length; index += 1) {
          flat.push({ index, list: 'split' })
        }
      }

      if (flat.length === 0) {
        return { ...previous, selected: null }
      }

      const selected = previous.selected
      const currentIndex = selected ? flat.findIndex((entry) => entry.list === selected.list && entry.index === selected.index) : -1
      const nextIndex =
        currentIndex === -1
          ? direction === 1
            ? 0
            : flat.length - 1
          : direction === 1 && currentIndex === flat.length - 1 && previous.isSplit && previous.splitItems.length > 0
            ? items.length
            : (currentIndex + direction + flat.length) % flat.length

      return { ...previous, selected: flat[nextIndex] ?? null }
    })
  }

  function toggleSplitMode() {
    const items = orderItems

    setEditCart((previous) => {
      if (!previous) {
        return previous
      }

      const isSplit = !previous.isSplit
      let selected = previous.selected

      if (!isSplit && (!selected || selected.list === 'split')) {
        selected = items.length > 0 ? { index: 0, list: 'current' } : null
      }

      return { ...previous, isSplit, selected }
    })
  }

  async function applyShift(qty: number) {
    const row = shiftRow

    if (!row?.NetId || !row.OrderItem) {
      return
    }

    setShiftRow(null)

    const context = beginBusy()

    if (!context) {
      return
    }

    try {
      const saleToNetId = sale?.NetUid && sale.NetUid !== EMPTY_GUID ? sale.NetUid : agreementNetId || ''
      const completed = await runCartMutation(
        context,
        createCartMutation(context, {
          expectation: { kind: 'operation-marker' },
          fallbackMessage: t('Не вдалося перемістити'),
          request: {
            kind: 'shift',
            orderItem: { ...row.OrderItem, Qty: qty },
            saleFromNetId: row.NetId,
            saleToNetId,
          },
        }),
      )

      if (completed && isCurrentMutationContext(context)) {
        clearProductPricingCache()
        focusSearchInput()
      }
    } catch (mutationError) {
      if (isCurrentMutationContext(context)) {
        notifications.show({ color: 'red', message: getRequestErrorMessage(mutationError, t('Не вдалося перемістити')) })
      }
    } finally {
      endBusy(context)
    }
  }

  return {
    acceptQtyModal,
    applyShift,
    busy,
    cancelQtyModal,
    confirmRemoveSelected,
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

function addToSplitItems(
  items: WizardSplitOrderItem[],
  source: SalesUkraineOrderItem & { Product: WizardSaleProduct },
  qty: number,
  comment: string | undefined,
  user: SalesUkraineUser | undefined,
  agreementNetId: string | null,
): WizardSplitOrderItem[] {
  const base = items.length > 0 && getWizardSplitAgreementNetId() === agreementNetId ? items : []

  return addWizardSplitOrderItem(base, source, qty, comment, user)
}

function getRequestErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback
}
