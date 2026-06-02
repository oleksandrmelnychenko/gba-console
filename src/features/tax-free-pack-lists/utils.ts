import { translate } from '../../shared/i18n/translate'
import type {
  Client,
  ClientAgreement,
  NamedEntity,
  Product,
  Statham,
  StathamPassport,
  TaxFree,
  TaxFreeItem,
  TaxFreePackList,
  TaxFreeStatus,
  TaxFreeStatusOption,
} from './types'
import { TaxFreeStatus as TaxFreeStatusValue } from './types'

const EMPTY_VALUE = '-'

export const numberFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 3,
})

export const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

export const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

export function displayValue(value: unknown): string {
  if (value === null || typeof value === 'undefined' || value === '') {
    return EMPTY_VALUE
  }

  return String(value)
}

export function formatNumber(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? numberFormatter.format(value) : EMPTY_VALUE
}

export function formatMoney(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? moneyFormatter.format(value) : EMPTY_VALUE
}

export function formatDateTime(value?: string): string {
  if (!value) {
    return EMPTY_VALUE
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? EMPTY_VALUE : dateTimeFormatter.format(date)
}

export function getEntityName(entity?: NamedEntity | null): string {
  return entity?.FullName || entity?.Name || entity?.LastName || ''
}

export function getProductName(product?: Product): string {
  return [product?.VendorCode, product?.Name].filter(Boolean).join(' ')
}

export function getTaxFreeItemProduct(item: TaxFreeItem): Product | undefined {
  return item.TaxFreePackListOrderItem?.OrderItem?.Product || item.SupplyOrderUkraineCartItem?.Product
}

export function getTaxFreeItemUnitPrice(item: TaxFreeItem): number | undefined {
  return item.TaxFreePackListOrderItem?.UnitPrice
    ?? item.TaxFreePackListOrderItem?.OrderItem?.TotalAmount
    ?? item.SupplyOrderUkraineCartItem?.UnitPrice
}

export function getPackListAgreementName(packList: TaxFreePackList): string {
  if (packList.IsFromSale) {
    return packList.Sales?.[0]?.ClientAgreement?.Agreement?.Name || ''
  }

  return packList.ClientAgreement?.Agreement?.Name || ''
}

export function getClientAgreementLabel(clientAgreement: ClientAgreement): string {
  const agreement = clientAgreement.Agreement
  const code = agreement?.Currency?.Code
  const name = agreement?.Name || agreement?.FullName || ''

  return code ? `${name} (${code})` : name
}

export function getClientLabel(client: Client): string {
  const name = getEntityName(client)

  return client.USREOU ? `${name} - ${client.USREOU}` : name
}

export function getStathamLabel(statham: Statham): string {
  return [statham.LastName, statham.FirstName, statham.MiddleName].filter(Boolean).join(' ') || getEntityName(statham)
}

export function getPassportLabel(passport?: StathamPassport): string {
  return passport?.PasportName || [passport?.PassportSeria, passport?.PassportNumber].filter(Boolean).join(' ')
}

export function parseTaxFreeStatus(status?: TaxFreeStatus): string {
  switch (status) {
    case TaxFreeStatusValue.Tabulated:
      return translate('Підбито')
    case TaxFreeStatusValue.Printed:
      return translate('Надруковано')
    case TaxFreeStatusValue.NotFormed:
      return translate('Не сформовано')
    case TaxFreeStatusValue.Formed:
      return translate('Сформовано')
    case TaxFreeStatusValue.Returned:
      return translate('Повернуто')
    case TaxFreeStatusValue.Closed:
      return translate('Закрито')
    default:
      return EMPTY_VALUE
  }
}

export function getEditableTaxFreeStatuses(): TaxFreeStatusOption[] {
  return [
    { label: parseTaxFreeStatus(TaxFreeStatusValue.NotFormed), value: TaxFreeStatusValue.NotFormed },
    { label: parseTaxFreeStatus(TaxFreeStatusValue.Formed), value: TaxFreeStatusValue.Formed },
    { label: parseTaxFreeStatus(TaxFreeStatusValue.Printed), value: TaxFreeStatusValue.Printed },
  ]
}

export function normalizeTaxFree(taxFree: TaxFree): TaxFree {
  return {
    ...taxFree,
    TaxFreeDocuments: Array.isArray(taxFree.TaxFreeDocuments) ? taxFree.TaxFreeDocuments : [],
    TaxFreeItems: Array.isArray(taxFree.TaxFreeItems)
      ? taxFree.TaxFreeItems.map((item) => ({
          ...item,
          ChangedQty: item.ChangedQty ?? item.Qty ?? 0,
          IsSelected: Boolean(item.IsSelected),
        }))
      : [],
    TaxFreeStatus: taxFree.TaxFreeStatus ?? TaxFreeStatusValue.NotFormed,
  }
}

export function normalizePackList(packList: TaxFreePackList): TaxFreePackList {
  return {
    ...packList,
    Sales: Array.isArray(packList.Sales) ? packList.Sales : [],
    SupplyOrderUkraineCartItems: Array.isArray(packList.SupplyOrderUkraineCartItems)
      ? packList.SupplyOrderUkraineCartItems
      : [],
    TaxFreePackListOrderItems: Array.isArray(packList.TaxFreePackListOrderItems)
      ? packList.TaxFreePackListOrderItems
      : [],
    TaxFrees: Array.isArray(packList.TaxFrees) ? packList.TaxFrees.map(normalizeTaxFree) : [],
  }
}

export function openDocumentUrl(document: { DocumentURL?: string, PdfDocumentURL?: string } | null): boolean {
  const url = document?.PdfDocumentURL || document?.DocumentURL

  if (!url) {
    return false
  }

  window.open(url.replace(/^http:\/\//i, 'https://'), '_blank', 'noopener,noreferrer')
  return true
}

export function getTaxFreeTotalQty(taxFree: TaxFree): number {
  return (taxFree.TaxFreeItems || []).reduce((total, item) => total + (item.Qty || 0), 0)
}

export function clonePackList(packList: TaxFreePackList): TaxFreePackList {
  return normalizePackList(structuredClone(packList))
}
