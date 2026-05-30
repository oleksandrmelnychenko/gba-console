import { translate } from '../../../shared/i18n/translate'
import { SupplyTransportationType } from '../types'

const dateFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short' })
const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short', timeStyle: 'short' })

export function formatDate(value?: Date | string | null): string {
  if (!value) {
    return '-'
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return dateFormatter.format(date)
}

export function formatDateTime(value?: Date | string | null): string {
  if (!value) {
    return '-'
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

export function responsibleName(user?: { FirstName?: string; LastName?: string } | null): string {
  if (!user) {
    return ''
  }

  return `${user.LastName || ''} ${user.FirstName || ''}`.trim()
}
