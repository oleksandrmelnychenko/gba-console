import type { IncomePaymentOrder } from './types'

/**
 * What cancelling an income order does to the client's debts, for the confirmation.
 *
 * An order allocated to sales reopens their debt; a client payment without allocations
 * may have been taken by a later sale as an advance, which then becomes a debt again.
 */
export function getIncomeCancelEffect(income: IncomePaymentOrder | null | undefined): {
  saleNumbers: string[]
  isClientPayment: boolean
} {
  const saleNumbers = (income?.IncomePaymentOrderSales || [])
    .filter((junction) => junction && junction.Deleted !== true)
    .map((junction) => junction.Sale?.SaleNumber?.Value?.trim() || junction.ReSale?.SaleNumber?.Value?.trim() || '')
    .filter((value, index, values) => Boolean(value) && values.indexOf(value) === index)
  const isClientPayment = Boolean(income?.Client || income?.ClientAgreement)

  return { isClientPayment, saleNumbers }
}

export function getIncomeCancelWarning(income: IncomePaymentOrder | null | undefined): string | null {
  const { isClientPayment, saleNumbers } = getIncomeCancelEffect(income)

  if (saleNumbers.length > 0) {
    return `Оплату зараховано в ${saleNumbers.length === 1 ? 'продаж' : 'продажі'} ${saleNumbers.join(', ')}: після скасування їх борг відновиться.`
  }

  if (isClientPayment) {
    return 'Якщо цей ордер уже використано як аванс у продажі, борг за продажем відновиться.'
  }

  return null
}
