import type { UnconvertedDebt } from '../../solvencyTypes'
import type { ClientAgreement } from '../../types'

export type CurrencyCodeLookup = Readonly<Record<number, string>>

export function agreementCurrencyCodes(agreements: ClientAgreement[] | null | undefined): CurrencyCodeLookup {
  const codes: Record<number, string> = {}

  for (const clientAgreement of agreements ?? []) {
    const agreement = clientAgreement.Agreement
    const id = agreement?.Currency?.Id ?? agreement?.CurrencyId
    const code = agreement?.Currency?.Code?.trim()
    if (typeof id === 'number' && id > 0 && code) {
      codes[id] = code
    }
  }

  return codes
}

export function resolveCurrencyCode(
  currencyId: number | null | undefined,
  codes: CurrencyCodeLookup | null | undefined,
  ...debtSources: Array<UnconvertedDebt[] | null | undefined>
): string | null {
  if (currencyId == null) {
    return null
  }

  const known = codes?.[currencyId]?.trim()
  if (known) {
    return known
  }

  for (const rows of debtSources) {
    const code = rows?.find((row) => row.currency_id === currencyId)?.currency?.trim()
    if (code) {
      return code
    }
  }

  return null
}
