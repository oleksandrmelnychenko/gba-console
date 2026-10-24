import { notifications } from '@mantine/notifications'
import { useState } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import type { SalesUkraineOrderItem, SalesUkraineUser } from '../../types'
import { stageWizardSplitExtraction } from './newSaleWizardState'
import type { WizardAvailabilityRow } from './newSaleWizardApi'
import type { useWizardCartMutation } from './useWizardCartMutation'
import type { WizardCartEditorState } from './wizardCartEditor'
import type { WizardCartLocalCommit } from './wizardCartMutation'
import { addWizardCartSplitItems } from './wizardCartSplitItems'
import { getWizardProductNumber, type WizardSaleProduct } from './wizardSaleProduct'
import type { WizardSplitItemRestoreAction } from './wizardSplitItemRestore'
import { toWizardSplitMutationSnapshot, type WizardSplitRecoverySource } from './wizardSplitSale'

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'

type Options = {
  agreementNetId: string | null
  saleNetUid: string | undefined
  user: SalesUkraineUser | undefined
  orderItems: SalesUkraineOrderItem[]
  editCart: WizardCartEditorState | null
  getSplitRecoverySource: () => WizardSplitRecoverySource
  restoreSplitItem: (context: string, action: WizardSplitItemRestoreAction) => Promise<void>
  clearProductPricingCache: () => void
  focusSearchInput: () => void
  mutation: Pick<ReturnType<typeof useWizardCartMutation>,
    'beginBusy' | 'endBusy' | 'isCurrentMutationContext' | 'createCartMutation' | 'runCartMutation'>
}

export function useWizardCartItemActions({
  agreementNetId, saleNetUid, user, orderItems, editCart, getSplitRecoverySource,
  restoreSplitItem, clearProductPricingCache, focusSearchInput, mutation,
}: Options) {
  const { t } = useI18n()
  const { beginBusy, endBusy, isCurrentMutationContext, createCartMutation, runCartMutation } = mutation
  const [shiftRow, setShiftRow] = useState<WizardAvailabilityRow | null>(null)
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false)
  const [removeRowItem, setRemoveRowItem] = useState<SalesUkraineOrderItem | null>(null)

  function createRemoval(context: string, item: SalesUkraineOrderItem, localCommit: WizardCartLocalCommit = { kind: 'none' }) {
    if (!item.NetUid || item.NetUid === EMPTY_GUID) throw new Error('Cannot remove an order item without a persisted uid')
    return createCartMutation(context, {
      expectation: { beforeQty: getWizardProductNumber(item.Qty) ?? 0, kind: 'row-deleted', rowNetUid: item.NetUid },
      fallbackMessage: t('Не вдалося видалити товар'),
      localCommit,
      request: { kind: 'delete', orderItemNetId: item.NetUid },
    })
  }

  function confirmRemoveRow() {
    if (removeRowItem) return removeItem(removeRowItem, () => setRemoveRowItem(null))
  }

  async function removeItem(item: SalesUkraineOrderItem, onAccepted?: () => void) {
    if (!item.NetUid || item.NetUid === EMPTY_GUID) {
      return
    }

    const context = beginBusy()

    if (!context) {
      return
    }

    try {
      onAccepted?.()
      const completed = await runCartMutation(
        context,
        createRemoval(context, item),
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

  async function confirmRemoveSelected() {
    const cart = editCart
    const selected = cart?.selected

    if (!cart || !selected || !(selected.list === 'current' ? orderItems[selected.index] : cart.splitItems[selected.index])) {
      return
    }

    const context = beginBusy()

    if (!context) {
      return
    }

    setRemoveConfirmOpen(false)

    try {
      if (selected.list === 'current') {
        const item = orderItems[selected.index]

        if (item) {
          const product = item.Product as WizardSaleProduct | undefined
          const splitItems = cart.isSplit && product
            ? addWizardCartSplitItems(
                cart.splitItems,
                { ...item, Product: product },
                getWizardProductNumber(item.Qty) ?? 0,
                item.Comment,
                user,
                agreementNetId,
              )
            : null

          const operation = createRemoval(context, item, splitItems
              ? {
                  agreementNetId,
                  failureSplitItems: cart.splitItems,
                  kind: 'replace-split-items',
                  selected: { index: Math.max(0, selected.index - 1), list: 'current' },
                  splitItems,
                }
              : { kind: 'none' },
          )

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
          await restoreSplitItem(context, { kind: 'remove', index: selected.index })
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

  async function applyShift(qty: number) {
    const row = shiftRow

    if (!row?.NetId || !row.OrderItem) {
      return
    }

    const saleToNetId = saleNetUid && saleNetUid !== EMPTY_GUID ? saleNetUid : agreementNetId || ''
    if (!saleToNetId || !Number.isFinite(qty) || qty <= 0 || qty > (getWizardProductNumber(row.Amount) ?? 0)) return

    const context = beginBusy()

    if (!context) {
      return
    }

    setShiftRow(null)

    try {
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

  return { removeItem, confirmRemoveRow, confirmRemoveSelected, applyShift,
    shiftRow, setShiftRow, removeConfirmOpen, setRemoveConfirmOpen, removeRowItem, setRemoveRowItem }
}

function getRequestErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback
}
