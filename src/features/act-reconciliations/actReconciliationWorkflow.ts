import {
  ActReconciliationDispositionReason,
  type ActReconciliation,
  type ActReconciliationDispositionReasonCode,
  type ActReconciliationItem,
} from './types'

export type ActReconciliationItemWorkflowState =
  | 'pending-shortage'
  | 'pending-surplus'
  | 'dismissed'
  | 'resolved'

export type ActReconciliationWorkflowState =
  | 'pending'
  | 'partial'
  | 'dismissed'
  | 'resolved'

export function getItemWorkflowState(
  item: ActReconciliationItem,
): ActReconciliationItemWorkflowState {
  if (item.IsDismissed) {
    return 'dismissed'
  }

  if (!item.HasDifference || (item.QtyDifference || 0) <= 0.0000001) {
    return 'resolved'
  }

  return item.NegativeDifference ? 'pending-shortage' : 'pending-surplus'
}

export function getActWorkflowState(
  reconciliation: ActReconciliation,
): ActReconciliationWorkflowState {
  const states = (reconciliation.ActReconciliationItems || []).map(getItemWorkflowState)
  const pendingCount = states.filter((state) => state.startsWith('pending-')).length
  const dismissedCount = states.filter((state) => state === 'dismissed').length
  const resolvedCount = states.filter((state) => state === 'resolved').length

  if (pendingCount === 0) {
    return dismissedCount > 0 && resolvedCount === 0 ? 'dismissed' : 'resolved'
  }

  return dismissedCount > 0 || resolvedCount > 0 ? 'partial' : 'pending'
}

export function getDispositionReasonLabel(
  reasonCode?: ActReconciliationDispositionReasonCode | null,
): string {
  switch (reasonCode) {
    case ActReconciliationDispositionReason.TestData:
      return 'Тестові дані'
    case ActReconciliationDispositionReason.DataEntryError:
      return 'Помилка введення в 1С'
    case ActReconciliationDispositionReason.SourceCancelled:
      return 'Документ скасовано в 1С'
    case ActReconciliationDispositionReason.DuplicateDocument:
      return 'Дублікат документа'
    case ActReconciliationDispositionReason.BusinessAcceptedNoStockMovement:
      return 'Залишки змінювати не потрібно'
    case ActReconciliationDispositionReason.Other:
      return 'Інша причина'
    default:
      return 'Причину не вказано'
  }
}

export function buildWorkflowCounts(items: ActReconciliationItem[]) {
  return items.reduce(
    (counts, item) => {
      const state = getItemWorkflowState(item)

      counts.total += 1
      counts[state] += 1

      return counts
    },
    {
      total: 0,
      'pending-shortage': 0,
      'pending-surplus': 0,
      dismissed: 0,
      resolved: 0,
    } satisfies Record<ActReconciliationItemWorkflowState | 'total', number>,
  )
}
