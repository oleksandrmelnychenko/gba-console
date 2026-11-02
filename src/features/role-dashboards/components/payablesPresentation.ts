import type { PayablesAmounts, PayablesRow, PayablesRows, PayablesSelection } from '../payablesTypes'

const money = new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 4 })

export const formatPayablesAmount = (value: number) => money.format(value)
export const formatPayablesDate = (value: string) => value.split('-').reverse().join('.')
export const payablesSettlementRoute = (row: PayablesRow) => row.partyKind === 2
  ? `/suppliers/accounting-cash-flow/${row.supplierNetUid}`
  : `/accounting/supplier-organizations/cash-flow/${row.supplierNetUid}`

export function payablesGridFromDate(asOfDate: string) {
  const next = new Date(`${asOfDate}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  return formatPayablesDate(next.toISOString().slice(0, 10))
}

function sameAmounts(left: PayablesAmounts, right: PayablesAmounts) {
  return left.signedBalance === right.signedBalance && left.payable === right.payable && left.advance === right.advance
}

export function matchesPayablesSelection(data: PayablesRows, selected: PayablesSelection) {
  return data.asOfDate === selected.asOfDate && data.currencyCode === selected.bucket.currencyCode
    && data.total === selected.bucket.rowCount && sameAmounts(data.aggregate, selected.bucket)
}
