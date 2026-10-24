import { notifications } from '@mantine/notifications'
import { useI18n } from '../../../../shared/i18n/useI18n'
import type { SalesUkraineOrderItem } from '../../types'
import type { useWizardCartMutation, PendingCartMutation } from './useWizardCartMutation'
import type { WizardCartSplitCommit } from './useWizardCartSplitState'
import type { WizardCartEditorState } from './wizardCartEditor'
import { getWizardProductNumber } from './wizardSaleProduct'
import {
  clearWizardSplitRestoreTracking,
  ensureWizardSplitRestoreOperationNetUids,
  findRestorableWizardOrderItem,
  mapWizardSplitOrderItem,
  restoreWizardSplitItemsSequentially,
  stageWizardSplitRestoreMutation,
  toWizardSplitMutationSnapshot,
  type WizardSplitOrderItem,
} from './wizardSplitSale'

type Options = {
  agreementNetId: string | null
  saleNetUid: string | undefined
  orderItems: SalesUkraineOrderItem[]
  editCart: WizardCartEditorState | null
  commitLocalChange: (commit: WizardCartSplitCommit) => void
  persistSplitItems: (items: WizardSplitOrderItem[], agreementNetId: string | null) => void
  clearProductPricingCache: () => void
  onRestoreSplitItems?: () => Promise<boolean>
  onRestored: () => void
  mutation: Pick<ReturnType<typeof useWizardCartMutation>,
    'beginBusy' | 'busy' | 'endBusy' | 'isCurrentMutationContext' | 'createCartMutation' |
    'persistPendingCartMutation' | 'runCartMutation' | 'setPendingMutationError'>
}

// Exit is complete only after all extracted items have been restored or reconciled.
// The mutation controller owns request identity, locking and durable retry records.
export function useWizardCartEditorExit({
  agreementNetId, saleNetUid, orderItems, editCart, commitLocalChange, persistSplitItems,
  clearProductPricingCache, onRestoreSplitItems, onRestored, mutation,
}: Options) {
  const { t } = useI18n()
  const { beginBusy, busy, endBusy, isCurrentMutationContext, createCartMutation,
    persistPendingCartMutation, runCartMutation, setPendingMutationError } = mutation

  async function exitEditCart() {
    const cart = editCart

    if (!cart || busy) {
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
        onRestored()
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
      if (!agreementNetId || !saleNetUid) {
        notifications.show({ color: 'red', message: t('Не вдалося відновити позиції без поточного рахунку') })

        return
      }

      const currentAgreementNetId = agreementNetId
      const context = beginBusy()

      if (!context) {
        return
      }

      const restoredQtyByOrderItem = new Map<string, number>()
      const restoreOperations = new Map<string, PendingCartMutation>()

      try {
        // Acquire the mutation lock before changing either recovery state or the editor.
        const trackedSplitItems = ensureWizardSplitRestoreOperationNetUids(cart.splitItems)
        commitLocalChange({ kind: 'replace-split-items', agreementNetId: currentAgreementNetId, splitItems: trackedSplitItems })

        const result = await restoreWizardSplitItemsSequentially(
          trackedSplitItems,
          async (item, index, operationId, isRetry) => {
            if (!isCurrentMutationContext(context)) {
              throw new Error('Cart restoration context changed')
            }

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

            if (!completed || !isCurrentMutationContext(context)) {
              throw new Error(t('Операція відновлення не підтверджена; повторіть звірку тим самим ключем'))
            }

            if (existing?.NetUid) {
              restoredQtyByOrderItem.set(existing.NetUid, restoredQty + item.Qty)
            }
          },
          ({ remaining }) => {
            if (isCurrentMutationContext(context)) {
              commitLocalChange({
                kind: 'replace-split-items', agreementNetId: currentAgreementNetId,
                isSplit: remaining.length > 0,
                selected: remaining.length > 0 ? { index: 0, list: 'split' }
                  : orderItems.length > 0 ? { index: 0, list: 'current' } : null,
                splitItems: remaining,
              })
            }
          },
          async (item, _index, operationId, error) => {
            const operation = restoreOperations.get(operationId)

            if (!operation || !isCurrentMutationContext(context)) {
              return 'pending'
            }

            const completed = await runCartMutation(context, operation, true)

            if (!isCurrentMutationContext(context)) {
              return 'pending'
            }

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
              commitLocalChange({ kind: 'replace-split-items', agreementNetId: currentAgreementNetId, splitItems: remaining })
            }
          },
        )

        if ((result.committed.length > 0 || result.error) && isCurrentMutationContext(context)) {
          clearProductPricingCache()
        }

        if (result.error) {
          if (isCurrentMutationContext(context)) {
            commitLocalChange({
              kind: 'replace-split-items', agreementNetId: currentAgreementNetId,
              isSplit: result.remaining.length > 0,
              selected: result.remaining.length > 0 ? { index: 0, list: 'split' } : null,
              splitItems: result.remaining,
            })
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

    try {
      onRestored()
    } catch (error) {
      notifications.show({ color: 'red', message: getRequestErrorMessage(error, t('Не вдалося відновити всі позиції')) })
    }
  }

  return exitEditCart
}

function getRequestErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback
}
