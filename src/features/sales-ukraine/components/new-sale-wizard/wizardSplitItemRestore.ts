import type { SalesUkraineOrderItem } from '../../types'
import type { PersistedWizardCartMutation, WizardCartLocalCommit } from './wizardCartMutation'
import { getWizardProductNumber } from './wizardSaleProduct'
import {
  clearWizardSplitRestoreTracking,
  ensureWizardSplitRestoreOperationNetUids,
  findRestorableWizardOrderItem,
  mapWizardSplitOrderItem,
  resizeWizardSplitOrderItem,
  type WizardSplitOrderItem,
} from './wizardSplitSale'

export type WizardSplitItemRestoreAction =
  | { kind: 'quantity'; index: number; qty: number }
  | { kind: 'remove'; index: number }

type RestorePlan = {
  trackedItems: WizardSplitOrderItem[]
  mutation: Pick<PersistedWizardCartMutation, 'expectation' | 'request' | 'operationId'> & {
    localCommit: Extract<WizardCartLocalCommit, { kind: 'replace-split-items' }>
  }
}

// Builds the request and both success/failure snapshots without writing storage or sending a request.
export function prepareWizardSplitItemRestore({
  items, orderItems, agreementNetId, saleNetUid, action,
}: {
  items: WizardSplitOrderItem[]
  orderItems: SalesUkraineOrderItem[]
  agreementNetId: string | null
  saleNetUid: string | undefined
  action: WizardSplitItemRestoreAction
}): RestorePlan | null {
  const source = items[action.index]
  if (!source) throw new Error('Cannot restore a missing split item')
  const qty = action.kind === 'quantity' ? action.qty : source.Qty
  if (!Number.isFinite(source.Qty) || !Number.isFinite(qty) || qty <= 0 || qty > source.Qty) return null

  const trackedItems = ensureWizardSplitRestoreOperationNetUids(items)
  const item = trackedItems[action.index]
  const operationId = item.RestoreOperationNetUid
  if (!operationId) throw new Error('Cannot create a stable restore operation')
  const rest = item.Qty - qty
  const existing = findRestorableWizardOrderItem(orderItems, item)
  const existingQty = getWizardProductNumber(existing?.Qty) ?? 0
  if (!existing && (!agreementNetId || !saleNetUid)) {
    throw new Error('Cannot restore a split item without a current sale')
  }

  // Update the selected occurrence, even when two rows have identical product metadata.
  const remaining = rest === 0
    ? trackedItems.filter((_, index) => index !== action.index)
    : trackedItems.map((candidate, index) => index === action.index ? resizeWizardSplitOrderItem(candidate, rest) : candidate)
  const splitItems = clearWizardSplitRestoreTracking(remaining, operationId)

  return {
    trackedItems,
    mutation: {
      operationId,
      localCommit: {
        agreementNetId,
        failureSplitItems: clearWizardSplitRestoreTracking(trackedItems, operationId),
        isSplit: splitItems.length > 0,
        kind: 'replace-split-items',
        ...(action.kind === 'remove' ? {
          selected: splitItems.length > 0 ? { index: Math.max(0, action.index - 1), list: 'split' as const } : null,
        } : {}),
        splitItems,
      },
      expectation: existing?.NetUid
        ? { afterQty: existingQty + qty, beforeQty: existingQty, kind: 'row-quantity', rowNetUid: existing.NetUid }
        : { kind: 'operation-marker' },
      request: existing
        ? { kind: 'update', orderItem: { ...existing, Qty: existingQty + qty } }
        : {
            clientAgreementNetId: agreementNetId as string,
            kind: 'add',
            orderItem: mapWizardSplitOrderItem(action.kind === 'remove' ? item : resizeWizardSplitOrderItem(item, qty)),
            saleNetId: saleNetUid as string,
          },
    },
  }
}
