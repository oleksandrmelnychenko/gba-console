import type { AccountingCashFlow, AccountingCashFlowHeadItem } from './types'

export function getAccountingCashFlowClosingBalance(
  cashFlow: AccountingCashFlow | null | undefined,
  lastItem?: AccountingCashFlowHeadItem,
): number | undefined {
  if (isFiniteNumber(lastItem?.CurrentBalance)) {
    return lastItem.CurrentBalance
  }

  if (!cashFlow) {
    return undefined
  }

  return (
    getFiniteNumberOrZero(cashFlow.BeforeRangeBalance) +
    getFiniteNumberOrZero(cashFlow.AfterRangeInAmount) -
    getFiniteNumberOrZero(cashFlow.AfterRangeOutAmount)
  )
}

function getFiniteNumberOrZero(value: unknown): number {
  return isFiniteNumber(value) ? value : 0
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}
