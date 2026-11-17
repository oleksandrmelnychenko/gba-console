import type { Currency, PaymentRegister } from './types'

function valueOf(entity: { NetUid?: string | null; Id?: number | null } | null | undefined): string {
  return String(entity?.NetUid || entity?.Id || '')
}

/**
 * The register the user already picked, while it still fits the organization and type.
 * Picking the counterparty after the register used to switch it back to the default one.
 */
export function keepPickedRegister(
  paymentRegisters: PaymentRegister[],
  currentValue: string,
  fits: (register: PaymentRegister) => boolean,
): PaymentRegister | null {
  if (!currentValue) return null
  const current = paymentRegisters.find((register) => valueOf(register) === currentValue) || null

  return current && fits(current) ? current : null
}

/** The picked currency when the register has it, else the register's first currency. */
export function pickRegisterCurrency(register: PaymentRegister | null, currentValue: string): Currency | null {
  const currencies = (register?.PaymentCurrencyRegisters || [])
    .map((item) => item.Currency)
    .filter((currency): currency is Currency => Boolean(currency))

  return currencies.find((currency) => valueOf(currency) === currentValue) || currencies[0] || null
}
