import type { Currency, OrganizationClient, OrganizationClientAgreement } from './types'
import { translate } from '../../shared/i18n/translate'

const EMPTY_NET_UID = '00000000-0000-0000-0000-000000000000'

const fullNameMaxLength = 200
const shortTextMaxLength = 50
const nipMaxLength = 20
const agreementDateFormatter = new Intl.DateTimeFormat('uk-UA')

export function createEmptyOrganizationClient(): OrganizationClient {
  return {
    Id: 0,
    NetUid: EMPTY_NET_UID,
    Deleted: false,
    OrganizationClientAgreements: [],
  }
}

export function createAgreement(currency: Currency, fromDate: string): OrganizationClientAgreement {
  return {
    Currency: currency,
    CurrencyId: currency.Id,
    Deleted: false,
    FromDate: fromDate,
    Id: 0,
    NetUid: EMPTY_NET_UID,
    OrganizationClientId: 0,
  }
}

export function getOrganizationClientName(client: OrganizationClient): string {
  return client.FullName?.trim() || translate('Без назви')
}

export function getCurrencyLabel(currency: Currency): string {
  return [currency.Name, currency.Code].filter(Boolean).join(' / ') || translate('Без назви')
}

export function displayValue(value?: number | string | null): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '-'
  }

  const normalized = value?.trim()
  return normalized || '-'
}

export function formatAgreementDate(value?: Date | string): string {
  if (!value) {
    return '-'
  }

  const date = value instanceof Date ? value : parseDateValue(value)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return agreementDateFormatter.format(date)
}

export function getTodayInputDate(): string {
  const today = new Date()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  return `${today.getFullYear()}-${month}-${day}`
}

export function normalizeNumberInput(value: number | string): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined
  }

  if (!value.trim()) {
    return undefined
  }

  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseDateValue(value: string): Date {
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch

    return new Date(Number(year), Number(month) - 1, Number(day))
  }

  return new Date(value)
}

export function normalizeClientForSave(client: OrganizationClient): OrganizationClient {
  return {
    ...client,
    Address: client.Address?.trim(),
    City: client.City?.trim(),
    Country: client.Country?.trim(),
    FullName: client.FullName?.trim(),
    NIP: client.NIP?.trim(),
    OrganizationClientAgreements: (client.OrganizationClientAgreements || []).map((agreement) => ({
      ...agreement,
      CurrencyId: agreement.Currency?.Id || agreement.CurrencyId,
    })),
  }
}

export function validateOrganizationClient(client: OrganizationClient): string | null {
  const fullName = client.FullName?.trim() || ''
  const nip = client.NIP?.trim() || ''
  const address = client.Address?.trim() || ''
  const country = client.Country?.trim() || ''
  const city = client.City?.trim() || ''
  const marginAmount = Number(client.MarginAmount)
  const agreements = client.OrganizationClientAgreements || []

  if (!fullName) {
    return translate('Вкажіть повну назву')
  }

  if (fullName.length > fullNameMaxLength) {
    return translate('Повна назва має містити не більше {count} символів', { count: fullNameMaxLength })
  }

  if (!nip) {
    return translate('Вкажіть NIP')
  }

  if (nip.length > nipMaxLength) {
    return translate('NIP має містити не більше {count} символів', { count: nipMaxLength })
  }

  if (!Number.isFinite(marginAmount) || marginAmount <= 0) {
    return translate('Вкажіть коректну маржу')
  }

  if (!address) {
    return translate('Вкажіть адресу')
  }

  if (address.length > shortTextMaxLength) {
    return translate('Адреса має містити не більше {count} символів', { count: shortTextMaxLength })
  }

  if (!country) {
    return translate('Вкажіть країну')
  }

  if (country.length > shortTextMaxLength) {
    return translate('Країна має містити не більше {count} символів', { count: shortTextMaxLength })
  }

  if (!city) {
    return translate('Вкажіть місто')
  }

  if (city.length > shortTextMaxLength) {
    return translate('Місто має містити не більше {count} символів', { count: shortTextMaxLength })
  }

  if (agreements.length === 0) {
    return translate('Додайте хоча б один договір')
  }

  if (agreements.some((agreement) => !agreement.Currency?.Id && !agreement.CurrencyId)) {
    return translate('Оберіть валюту для кожного договору')
  }

  return null
}
