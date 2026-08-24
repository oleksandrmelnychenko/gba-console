import type { PaymentRegister } from './types'

export type IncomeCashflowCurrencyOption = {
  label: string
  value: string
}

export function buildIncomeCashflowCurrencyOptions(
  register?: PaymentRegister | null,
): IncomeCashflowCurrencyOption[] {
  const options: IncomeCashflowCurrencyOption[] = []

  for (const currencyRegister of register?.PaymentCurrencyRegisters || []) {
    const currency = currencyRegister.Currency
    const value = String(currency?.NetUid || currency?.Id || '')

    if (!value) {
      continue
    }

    options.push({
      label: currency?.Code || currency?.Name || value,
      value,
    })
  }

  return options
}
