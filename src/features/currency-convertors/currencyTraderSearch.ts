import type { CurrencyTrader } from './types'

export function filterCurrencyTraders(
  traders: CurrencyTrader[],
  searchValue: string,
): CurrencyTrader[] {
  const normalizedSearch = normalizeSearchValue(searchValue)

  if (!normalizedSearch) {
    return traders
  }

  return traders.filter((trader) => {
    const searchableValue = [
      trader.FirstName,
      trader.LastName,
      trader.MiddleName,
      trader.PhoneNumber,
    ].join(' ')
    const normalizedValue = normalizeSearchValue(searchableValue)
    const normalizedPhone = String(trader.PhoneNumber ?? '').replace(/\D/g, '')

    return normalizedSearch.split(' ').every((term) => {
      if (normalizedValue.includes(term)) {
        return true
      }

      const normalizedPhoneTerm = term.replace(/\D/g, '')

      return normalizedPhoneTerm.length > 0 && normalizedPhone.includes(normalizedPhoneTerm)
    })
  })
}

function normalizeSearchValue(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('uk')
}
