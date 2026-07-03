import type { RetailClient } from '../clients/onlineShopTypes'
import type { IncompleteSalesOnlineShopItem, IncompleteSalesOnlineShopStatus } from './types'
import { translate } from '../../shared/i18n/translate'

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

export function getIncompleteSaleStatus(sale: IncompleteSalesOnlineShopItem): IncompleteSalesOnlineShopStatus | null {
  const status = toNumber(sale.MisplacedSaleStatus)

  if (status === 0 || status === 1 || status === 2) {
    return status
  }

  return null
}

export function getIncompleteSaleStatusLabel(sale: IncompleteSalesOnlineShopItem): string {
  switch (getIncompleteSaleStatus(sale)) {
    case 0:
      return translate('Новий')
    case 1:
      return translate('В процесі')
    case 2:
      return translate('Виконано')
    default:
      return ''
  }
}

export function getIncompleteSaleKey(sale: IncompleteSalesOnlineShopItem, index = 0): string {
  return sale.NetUid?.trim() || String(sale.Id || index)
}

export function getIncompleteSaleCreatedTime(sale: IncompleteSalesOnlineShopItem): number {
  const date = parseDate(sale.Created)
  return date?.getTime() ?? 0
}

export function formatIncompleteSaleDate(sale: IncompleteSalesOnlineShopItem): string {
  const date = parseDate(sale.Created)
  return date ? dateTimeFormatter.format(date) : ''
}

export function getIncompleteSaleProductCount(sale: IncompleteSalesOnlineShopItem): number {
  return sale.OrderItems?.length || 0
}

export function getIncompleteSaleResponsibleName(sale: IncompleteSalesOnlineShopItem): string {
  const user = sale.User

  return (
    user?.FullName?.trim()
    || user?.Name?.trim()
    || joinTrimmedParts([user?.LastName, user?.FirstName, user?.MiddleName])
  )
}

export function getRetailClientNetUid(client?: RetailClient): string {
  return client?.NetUid?.trim() || client?.Client?.NetUid?.trim() || ''
}

export function getRetailClientName(client?: RetailClient): string {
  const nestedClient = client?.Client
  const directName = client?.FullName?.trim() || client?.Name?.trim()

  if (directName) {
    return directName
  }

  const nestedName = nestedClient?.FullName?.trim() || nestedClient?.Name?.trim()

  if (nestedName) {
    return nestedName
  }

  return joinTrimmedParts([
    client?.LastName || nestedClient?.LastName,
    client?.FirstName || nestedClient?.FirstName,
    client?.MiddleName || nestedClient?.MiddleName,
  ])
}

function joinTrimmedParts(parts: Array<string | undefined | null>): string {
  return parts.reduce<string[]>((values, part) => {
    const value = part?.trim()

    if (value) {
      values.push(value)
    }

    return values
  }, []).join(' ')
}

export function getRetailClientPhone(client?: RetailClient): string {
  return (
    client?.PhoneNumber?.trim()
    || client?.Phone?.trim()
    || client?.MobileNumber?.trim()
    || client?.Client?.ClientNumber?.trim()
    || client?.Client?.MobileNumber?.trim()
    || ''
  )
}

export function displayValue(value?: number | string | null): string {
  if (typeof value === 'number') {
    return String(value)
  }

  const normalized = value?.trim()
  return normalized || ''
}

function parseDate(value: Date | string | undefined): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (!value) {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const parsed = Number(value)

    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}
