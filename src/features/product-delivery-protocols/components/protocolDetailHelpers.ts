import { translate } from '../../../shared/i18n/translate'
import type { SupplyInvoice } from '../detailTypes'
import { SupplyTransportationType } from '../types'

const dateFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short' })
const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short', timeStyle: 'short' })

export function formatDate(value?: Date | string | null): string {
  if (!value) {
    return ''
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return dateFormatter.format(date)
}

export function formatDateTime(value?: Date | string | null): string {
  if (!value) {
    return ''
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return dateTimeFormatter.format(date)
}

export function formatMoney(value: number | undefined | null, code?: string | null): string {
  const amount = typeof value === 'number' && !Number.isNaN(value) ? value : 0
  const formatted = amount.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return code ? `${formatted} ${code}` : formatted
}

export function getInvoiceCurrencyCode(invoice?: SupplyInvoice | null): string {
  const code = invoice?.SupplyOrganizationAgreement?.Currency?.Code
    || invoice?.SupplyOrganizationAgreement?.Currency?.Name
    || invoice?.SupplyOrder?.ClientAgreement?.Agreement?.Currency?.Code
    || invoice?.SupplyOrder?.ClientAgreement?.Agreement?.Currency?.Name

  if (code) {
    return code
  }

  for (const mergedInvoice of invoice?.MergedSupplyInvoices || []) {
    const mergedCode = getInvoiceCurrencyCode(mergedInvoice)

    if (mergedCode) {
      return mergedCode
    }
  }

  return ''
}

export function getInvoiceTotalNetPrice(invoice?: SupplyInvoice | null): number {
  const record = invoice as (SupplyInvoice & {
    TotalAmount?: number | string
    TotalValue?: number | string
  }) | null | undefined
  const amount =
    readFiniteNumber(record?.TotalNetPrice)
    ?? readFiniteNumber(record?.NetPrice)
    ?? readFiniteNumber(record?.TotalAmount)
    ?? readFiniteNumber(record?.TotalValue)
    ?? readFiniteNumber(record?.TotalValueWithVat)

  if (typeof amount === 'number') {
    return amount
  }

  return (invoice?.MergedSupplyInvoices || []).reduce(
    (total, mergedInvoice) => total + getInvoiceTotalNetPrice(mergedInvoice),
    0,
  )
}

export function transportationTypeLabel(type?: SupplyTransportationType): string {
  switch (type) {
    case SupplyTransportationType.Vehicle:
      return translate('Поставка вантажівкою')
    case SupplyTransportationType.Ship:
      return translate('Поставка кораблем')
    case SupplyTransportationType.Plane:
      return translate('Доставка літаком')
    default:
      return ''
  }
}

function readFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const normalizedValue = value.replace(/\s/g, '').replace(',', '.')
    const parsedValue = Number(normalizedValue)

    return Number.isFinite(parsedValue) ? parsedValue : undefined
  }

  return undefined
}

export function responsibleName(user?: { FirstName?: string; LastName?: string } | null): string {
  if (!user) {
    return ''
  }

  return `${user.LastName || ''} ${user.FirstName || ''}`.trim()
}
