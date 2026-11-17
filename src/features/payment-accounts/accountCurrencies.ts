import type { PaymentAccount } from './types'

const SKIPPED_CURRENCY_CODE = ['P', 'L', 'N'].join('')

/** Every currency the account holds («EUR, UAH»), not only the first one. */
export function getCurrencyCodes(account: PaymentAccount): string | undefined {
  const codes: string[] = []

  for (const register of account.PaymentCurrencyRegisters || []) {
    const code = register.Currency?.Code || register.Currency?.Name

    if (
      code
      && register.Currency?.Code !== SKIPPED_CURRENCY_CODE
      && (register.IsSelected || register.NetUid || register.Id || Boolean(register.Amount))
      && !codes.includes(code)
    ) {
      codes.push(code)
    }
  }

  return codes.length ? codes.join(', ') : undefined
}
