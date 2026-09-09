import { PAYMENT_COMPARISON_TITLE, paymentComparisonExactId } from './paymentComparison'
import type { SpreadsheetRow, SpreadsheetSheet } from '../types'
import { isImportedPaymentCaption } from './importedPaymentsSpreadsheet'

const CURRENCY_GROUP = 'Валюта рахунку'
export type PaymentChartCurrency = { value: string; label: string }
export type PaymentChartCurrencyScope = {
  status: 'ready' | 'empty' | 'missing-axis' | 'unknown-column' | 'ambiguous-axis'
  options: PaymentChartCurrency[]
  fixedCurrency: PaymentChartCurrency | null
  rowsByCurrency: Map<string, SpreadsheetRow[]>
  unknownRows: number
}

/** Only a native ID in the declared currency axis proves the domain. Names and amounts do not. */
function readCurrency(value: unknown, strictInt64 = false): PaymentChartCurrency | null {
  if (typeof value !== 'string') return null
  const label = value.trim(), match = label.match(/^.+ \[([1-9]\d*)\]$/u)
  return match && (!strictInt64 || paymentComparisonExactId({ Id: match[1] }) !== null) ? { value: match[1], label } : null
}

export function getPaymentChartCurrencyScope(sheet: SpreadsheetSheet, rows: SpreadsheetRow[], measurementIndex: number): PaymentChartCurrencyScope {
  const scope: PaymentChartCurrencyScope = { status: 'ready', options: [], fixedCurrency: null, rowsByCurrency: new Map(), unknownRows: 0 }
  const leaves = rows.filter(row => row.kind === 'data')
  if (!leaves.length) return { ...scope, status: 'empty' }
  const header = sheet.header, rowAxis = header?.rowGroupings.indexOf(CURRENCY_GROUP) ?? -1, columnAxis = header?.columnGroupings.indexOf(CURRENCY_GROUP) ?? -1
  if (!header || (rowAxis < 0 && columnAxis < 0)) return { ...scope, status: 'missing-axis' }
  if (rowAxis >= 0 && columnAxis >= 0) return { ...scope, status: 'ambiguous-axis' }
  if (columnAxis >= 0) {
    // A flat pivot caption is usable only when every declared axis has exactly one segment.
    // An embedded separator makes the position ambiguous; do not guess which ID is currency.
    const parts = sheet.columns[measurementIndex]?.split(' · ') ?? []
    if (measurementIndex < header.rowGroupings.length || parts.length !== header.columnGroupings.length + 2
      || parts.at(-2) !== 'Записані платежі' || !isImportedPaymentCaption(parts.at(-1))) return { ...scope, status: 'unknown-column' }
    scope.fixedCurrency = readCurrency(parts[columnAxis])
    if (!scope.fixedCurrency) return { ...scope, status: 'unknown-column' }
  }
  const strictInt64 = header.lines[0] === PAYMENT_COMPARISON_TITLE
  const currencies = new Map<string, PaymentChartCurrency>()
  for (const row of leaves) {
    const currency = rowAxis >= 0 ? readCurrency(row.cells[rowAxis], strictInt64) : scope.fixedCurrency
    if (!currency) { scope.unknownRows += 1; continue }
    currencies.set(currency.value, currencies.get(currency.value) ?? currency)
    const currencyRows = scope.rowsByCurrency.get(currency.value) ?? []
    currencyRows.push(row)
    scope.rowsByCurrency.set(currency.value, currencyRows)
  }
  if (scope.fixedCurrency) currencies.set(scope.fixedCurrency.value, scope.fixedCurrency)
  scope.options = [...currencies.values()]
  return scope
}
