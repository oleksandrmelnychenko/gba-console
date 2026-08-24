import type {
  ClientInDebt,
  IncomePaymentOrderSale,
} from './types'

export type IncomeCashflowPaymentTargets = {
  clientDebts: ClientInDebt[]
  saleTargets: IncomePaymentOrderSale[]
}

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
  return buildIncomeCashflowSaleTargetsFromDebts(
    selectIncomeCashflowDebtTargets(debts, selectedDebtValues),
  )
}

export function resolveIncomeCashflowPaymentTargets({
  autoAllocate,
  debts,
  paymentAmountInDebtCurrency,
  selectedDebtValues,
}: {
  autoAllocate: boolean
  debts: ClientInDebt[]
  paymentAmountInDebtCurrency: number | null
  selectedDebtValues: string[]
}): IncomeCashflowPaymentTargets {
  let clientDebts = selectIncomeCashflowDebtTargets(
    debts,
    selectedDebtValues,
  )

  if (!selectedDebtValues.length) {
    const allSaleTargets = buildIncomeCashflowSaleTargetsFromDebts(debts)
    const canTargetEveryDebt =
      debts.length > 0 &&
      allSaleTargets.length === debts.length

    if (
      canTargetEveryDebt &&
      (
        autoAllocate ||
        debts.length === 1 ||
        paymentCoversEveryDebt(debts, paymentAmountInDebtCurrency)
      )
    ) {
      clientDebts = debts
    }
  }

  return {
    clientDebts,
    saleTargets: buildIncomeCashflowSaleTargetsFromDebts(clientDebts),
  }
}

function buildIncomeCashflowSaleTargetsFromDebts(
  debts: ClientInDebt[],
): IncomePaymentOrderSale[] {
  const targets: IncomePaymentOrderSale[] = []

  for (const debt of debts) {
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

function paymentCoversEveryDebt(
  debts: ClientInDebt[],
  paymentAmountInDebtCurrency: number | null,
): boolean {
  const paymentCents = toSafeCents(paymentAmountInDebtCurrency)

  if (paymentCents == null || paymentCents <= 0) {
    return false
  }

  let totalDebtCents = 0

  for (const debt of debts) {
    const debtCents = toSafeCents(debt.Debt?.Total)

    if (
      debtCents == null ||
      debtCents <= 0 ||
      !Number.isSafeInteger(totalDebtCents + debtCents)
    ) {
      return false
    }

    totalDebtCents += debtCents
  }

  return paymentCents >= totalDebtCents
}

function toSafeCents(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }

  const cents = Math.round(value * 100)

  return Number.isSafeInteger(cents) ? cents : null
}
