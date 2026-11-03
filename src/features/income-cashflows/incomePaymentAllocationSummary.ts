import { IncomePaymentOperationType } from './types'
import type { IncomePaymentAllocationRow, IncomePaymentAllocationSummary, IncomePaymentOrder, IncomePaymentOrderSale } from './types'

const record = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
const money = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
const guid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value) && value !== '00000000-0000-0000-0000-000000000000'
const key = (value: string) => value.toLowerCase()
// Unknown application currency codes never become an invented monetary unit.
const currencyCodes = new Set(Intl.supportedValuesOf('currency'))

/** An unavailable summary never makes legacy amounts or sale totals proof of allocation. */
export function normalizeIncomePaymentAllocationSummary(value: unknown): IncomePaymentAllocationSummary | null {
  const data = record(value)
  if (!data || typeof data.Applicable !== 'boolean' || data.AccountingBaseCurrencyCode !== 'EUR'
    || typeof data.PaymentCurrencyCode !== 'string' || !currencyCodes.has(data.PaymentCurrencyCode)
    || !money(data.PaymentAmount) || typeof data.AccountingBaseAmountsKnown !== 'boolean' || typeof data.PaymentAmountsKnown !== 'boolean'
    || (data.Reason != null && typeof data.Reason !== 'string') || !Array.isArray(data.Rows)) return null
  const known = data.AccountingBaseAmountsKnown && data.PaymentAmountsKnown
  if (data.AccountingBaseAmountsKnown !== data.PaymentAmountsKnown) return null
  const totals = [data.AllocatedAccountingBaseAmount, data.AllocatedPaymentAmount, data.UnallocatedPaymentAmount]
  if (known ? !data.Applicable || !totals.every(money) : !totals.every(value => value === null) || data.Rows.length !== 0) return null
  const identities = new Set<string>()
  const rows: IncomePaymentAllocationRow[] = []
  for (const value of data.Rows) {
    const row = record(value)
    if (!row || (row.Status !== 'Allocated' && row.Status !== 'Unallocated')
      || (row.SaleNetUid !== null && !guid(row.SaleNetUid)) || !money(row.PaymentAmount)) return null
    if (row.Status === 'Allocated') {
      if (!guid(row.AllocationNetUid) || !money(row.AccountingBaseAmount) || identities.has(key(row.AllocationNetUid))) return null
      identities.add(key(row.AllocationNetUid))
    } else if (row.AllocationNetUid !== null || row.AccountingBaseAmount !== null) return null
    rows.push({ AllocationNetUid: row.AllocationNetUid as string | null, SaleNetUid: row.SaleNetUid as string | null,
      Status: row.Status, PaymentAmount: row.PaymentAmount, AccountingBaseAmount: row.AccountingBaseAmount as number | null })
  }
  return { Applicable: data.Applicable, AccountingBaseCurrencyCode: 'EUR', PaymentCurrencyCode: data.PaymentCurrencyCode,
    PaymentAmount: data.PaymentAmount, AccountingBaseAmountsKnown: data.AccountingBaseAmountsKnown,
    AllocatedAccountingBaseAmount: data.AllocatedAccountingBaseAmount as number | null,
    PaymentAmountsKnown: data.PaymentAmountsKnown, AllocatedPaymentAmount: data.AllocatedPaymentAmount as number | null,
    UnallocatedPaymentAmount: data.UnallocatedPaymentAmount as number | null, Reason: data.Reason as string | null ?? null, Rows: rows }
}

export function incomePaymentAllocationView(income: IncomePaymentOrder) {
  const sales = income.IncomePaymentOrderSales ?? []
  const summary = normalizeIncomePaymentAllocationSummary(income.AllocationSummary)
  const applicable = sales.length > 0 || summary?.Applicable === true
    || (summary?.Applicable !== false && (income.OperationType === IncomePaymentOperationType.ClientPayment || income.OperationType === '0' || income.OperationType === 'ClientPayment'))
  const allocated = summary?.Rows.filter(row => row.Status === 'Allocated') ?? []
  const byId = new Map(allocated.map(row => [key(row.AllocationNetUid!), row]))
  const nativeIds = sales.map(row => row.NetUid).filter(guid).map(key)
  const identitiesMatch = nativeIds.length === sales.length && new Set(nativeIds).size === sales.length
    && byId.size === sales.length && nativeIds.every(id => byId.has(id))
  const documentIdentitiesMatch = sales.every(row => {
    const proof = guid(row.NetUid) ? byId.get(key(row.NetUid)) : undefined
    const document = row.Sale ?? row.ReSale
    return !proof?.SaleNetUid || !document?.NetUid || (guid(document.NetUid) && key(document.NetUid) === key(proof.SaleNetUid))
  })
  const confirmed = summary?.Applicable === true && summary.AccountingBaseAmountsKnown && summary.PaymentAmountsKnown
    && summary.PaymentAmount === income.Amount && summary.PaymentCurrencyCode === income.Currency?.Code?.trim().toUpperCase()
    && identitiesMatch && documentIdentitiesMatch
  return { applicable, summary: confirmed ? summary : null,
    allocation: (sale: IncomePaymentOrderSale) => confirmed && guid(sale.NetUid) ? byId.get(key(sale.NetUid)) ?? null : null }
}
