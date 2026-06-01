import type { ActReconciliationItem } from './types'

export type ActionQuantityValidationReason = 'invalidLimit' | 'required' | 'positive' | 'overLimit'

export type ActionQuantityValidationResult =
  | { isValid: true; quantity: number; reason: null }
  | { isValid: false; quantity: null; reason: ActionQuantityValidationReason }

export function getDefaultActionQuantity(item: ActReconciliationItem): number | undefined {
  return readNumber(item.ToOperationQty) || readNumber(item.QtyDifference)
}

export function getActionQuantityLimit(item: ActReconciliationItem): number | undefined {
  return readNumber(item.QtyDifference)
}

export function resolveActionToOperationQty(
  item: ActReconciliationItem,
  changedQty: string | number | undefined,
): number | undefined {
  return readNumber(changedQty) || readNumber(item.QtyDifference)
}

export function validateActionQuantity(
  value: string | number | undefined,
  maxAvailableQty: number | undefined,
): ActionQuantityValidationResult {
  const limit = readNumber(maxAvailableQty)

  if (limit === undefined || limit <= 0) {
    return { isValid: false, quantity: null, reason: 'invalidLimit' }
  }

  const quantity = readNumber(value)

  if (quantity === undefined) {
    return { isValid: false, quantity: null, reason: 'required' }
  }

  if (quantity <= 0) {
    return { isValid: false, quantity: null, reason: 'positive' }
  }

  if (quantity > limit) {
    return { isValid: false, quantity: null, reason: 'overLimit' }
  }

  return { isValid: true, quantity, reason: null }
}

function readNumber(value: string | number | undefined): number | undefined {
  if (value === undefined) {
    return undefined
  }

  if (typeof value === 'string' && value.trim() === '') {
    return undefined
  }

  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : undefined
}
