import type { ClientBankDetails } from '../../types'

export type BankDetailsErrorKey =
  | 'BankIban'
  | 'BankIbanCurrency'
  | 'BankSwift'
  | 'BankAccountNumber'
  | 'BankAccountCurrency'

export type BankDetailsErrors = Partial<Record<BankDetailsErrorKey, string>>

function compact(value: string | undefined | null): string {
  return (value || '').replace(/\s+/g, '').toUpperCase()
}

function ibanChecksum(iban: string): number {
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  let remainder = 0
  for (const character of rearranged) {
    const digits = /[A-Z]/.test(character) ? String(character.charCodeAt(0) - 55) : character
    for (const digit of digits) {
      remainder = (remainder * 10 + Number(digit)) % 97
    }
  }
  return remainder
}

/** IBAN: Ukrainian «UA» + 27 digits, or any country's IBAN shape; the ISO 7064 checksum must hold. */
export function isValidIban(value: string): boolean {
  const iban = compact(value)
  const shape = iban.startsWith('UA') ? /^UA\d{27}$/ : /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/
  return shape.test(iban) && ibanChecksum(iban) === 1
}

/** SWIFT/BIC: 8 or 11 characters (bank, country, location, optional branch). */
export function isValidSwift(value: string): boolean {
  return /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(compact(value))
}

/** Account number: digits only (spaces allowed), 5–34 digits. */
export function isValidAccountNumber(value: string): boolean {
  return /^\d{5,34}$/.test(compact(value))
}

function changed(value: string | undefined, baseline: string | undefined, hasBaseline: boolean): boolean {
  return !hasBaseline || (value || '') !== (baseline || '')
}

/**
 * Format rules for «Банківські дані». With a baseline (the card as loaded), a value the user did
 * not touch is not re-checked, so legacy 1C data never blocks saving another field.
 */
export function validateBankDetails(
  bank: ClientBankDetails | undefined | null,
  t: (value: string) => string,
  baseline?: ClientBankDetails | null,
): BankDetailsErrors {
  const errors: BankDetailsErrors = {}
  if (!bank) {
    return errors
  }

  const hasBaseline = baseline !== undefined
  const iban = bank.ClientBankDetailIbanNo?.IBANNO?.trim() || ''
  const account = bank.AccountNumber?.AccountNumber?.trim() || ''
  const swift = bank.Swift?.trim() || ''

  if (iban) {
    if (changed(iban, baseline?.ClientBankDetailIbanNo?.IBANNO?.trim(), hasBaseline) && !isValidIban(iban)) {
      errors.BankIban = t('Некоректний IBAN: UA і 27 цифр (або IBAN іншої країни з правильною контрольною сумою)')
    }
    if (!bank.ClientBankDetailIbanNo?.Currency?.Id) {
      errors.BankIbanCurrency = t('Оберіть валюту IBAN')
    }
  }

  if (account) {
    if (changed(account, baseline?.AccountNumber?.AccountNumber?.trim(), hasBaseline) && !isValidAccountNumber(account)) {
      errors.BankAccountNumber = t('Номер рахунку: лише цифри (5–34)')
    }
    if (!bank.AccountNumber?.Currency?.Id) {
      errors.BankAccountCurrency = t('Оберіть валюту рахунку')
    }
  }

  if (swift && changed(swift, baseline?.Swift?.trim(), hasBaseline) && !isValidSwift(swift)) {
    errors.BankSwift = t('SWIFT: 8 або 11 латинських літер і цифр')
  }

  return errors
}

/**
 * The card sends only what the user filled: a new IBAN or account entry without its number is
 * dropped (the server rejects it), and a new, entirely empty bank record is not sent at all.
 */
export function prepareBankDetailsForSave(bank: ClientBankDetails | undefined): ClientBankDetails | undefined {
  if (!bank) {
    return bank
  }

  const next: ClientBankDetails = { ...bank }
  if (next.ClientBankDetailIbanNo && !next.ClientBankDetailIbanNo.Id && !next.ClientBankDetailIbanNo.IBANNO?.trim()) {
    delete next.ClientBankDetailIbanNo
  }
  if (next.AccountNumber && !next.AccountNumber.Id && !next.AccountNumber.AccountNumber?.trim()) {
    delete next.AccountNumber
  }

  const isEmptyNew = !next.Id
    && !next.ClientBankDetailIbanNo
    && !next.AccountNumber
    && !next.BankAndBranch?.trim()
    && !next.Swift?.trim()
    && !next.BranchCode?.trim()
    && !next.BankAddress?.trim()

  return isEmptyNew ? undefined : next
}

/** True when the user sent bank data but the saved card came back without it (server dropped it). */
export function bankDetailsWereDropped(sent: ClientBankDetails | undefined, saved: ClientBankDetails | undefined | null): boolean {
  const hasData = (bank: ClientBankDetails | undefined | null) => Boolean(
    bank && (bank.ClientBankDetailIbanNo?.IBANNO?.trim() || bank.AccountNumber?.AccountNumber?.trim()
      || bank.BankAndBranch?.trim() || bank.Swift?.trim()),
  )
  return hasData(sent) && !hasData(saved)
}
