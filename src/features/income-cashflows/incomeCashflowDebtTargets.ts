import type {
  ClientInDebt,
  IncomePaymentOrderSale,
} from './types'

export function getIncomeCashflowDebtTargetValue(debt: ClientInDebt): string {
  return String(
    debt.NetUid ||
    debt.Id ||
    debt.Sale?.NetUid ||
    debt.ReSale?.NetUid ||
    debt.Sale?.Id ||
    debt.ReSale?.Id ||
    debt.SaleId ||
    debt.ReSaleId ||
    '',
  )
}

export function selectIncomeCashflowDebtTargets(
  debts: ClientInDebt[],
  selectedDebtValues: string[],
): ClientInDebt[] {
  if (!selectedDebtValues.length) {
    return []
  }

  const selectedValues = new Set(selectedDebtValues)

  return debts.filter((debt) =>
    selectedValues.has(getIncomeCashflowDebtTargetValue(debt)),
  )
}

export function buildIncomeCashflowSaleTargets(
  debts: ClientInDebt[],
  selectedDebtValues: string[],
): IncomePaymentOrderSale[] {
  const targets: IncomePaymentOrderSale[] = []

  for (const debt of selectIncomeCashflowDebtTargets(
    debts,
    selectedDebtValues,
  )) {
    if (debt.Sale) {
      targets.push({ Sale: debt.Sale })
    } else if (debt.SaleId) {
      targets.push({ SaleId: debt.SaleId })
    } else if (debt.ReSale) {
      targets.push({ ReSale: debt.ReSale })
    } else if (debt.ReSaleId) {
      targets.push({ ReSaleId: debt.ReSaleId })
    }
  }

  return targets
}
