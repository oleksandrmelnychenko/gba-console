import { translate } from '../../shared/i18n/translate'
import type { AccountingBank } from './types'

/** Column sizes of dbo.Bank: longer values made the server fail without an answer. */
export const BANK_FIELD_LIMITS = {
  address: 150,
  city: 150,
  name: 100,
  phones: 100,
} as const

export function validateBank(bank: AccountingBank): string | null {
  const name = bank.Name?.trim() || ''
  const mfo = bank.MfoCode?.trim() || ''
  const edrpou = bank.EdrpouCode?.trim() || ''

  if (!name) {
    return translate('Вкажіть назву')
  }

  if (name.length > BANK_FIELD_LIMITS.name) {
    return translate('Назва банку — не більше 100 символів')
  }

  if (!mfo) {
    return translate('Вкажіть МФО')
  }

  if (!/^\d{6}$/.test(mfo)) {
    return translate('МФО має містити 6 цифр')
  }

  if (!edrpou) {
    return translate('Вкажіть ЄДРПОУ')
  }

  if (!/^\d{8}$/.test(edrpou)) {
    return translate('ЄДРПОУ має містити 8 цифр')
  }

  if ((bank.City?.trim().length || 0) > BANK_FIELD_LIMITS.city) {
    return translate('Місто — не більше 150 символів')
  }

  if ((bank.Phones?.trim().length || 0) > BANK_FIELD_LIMITS.phones) {
    return translate('Телефон — не більше 100 символів')
  }

  if ((bank.Address?.trim().length || 0) > BANK_FIELD_LIMITS.address) {
    return translate('Адреса — не більше 150 символів')
  }

  return null
}

/* A second identical bank (same name, МФО and ЄДРПОУ) made two indistinguishable
   options in the account form's «Банк» picker. */
export function findDuplicateBank(bank: AccountingBank, banks: AccountingBank[]): AccountingBank | null {
  const key = (item: AccountingBank) =>
    [item.Name?.trim().toLocaleLowerCase('uk-UA') || '', item.MfoCode?.trim() || '', item.EdrpouCode?.trim() || ''].join('|')
  const target = key(bank)

  return banks.find((item) =>
    !item.Deleted
    && !(bank.Id && item.Id === bank.Id)
    && !(bank.NetUid && item.NetUid === bank.NetUid)
    && key(item) === target,
  ) ?? null
}
