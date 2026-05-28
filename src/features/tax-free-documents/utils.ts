import { TaxFreeStatus, type Statham, type TaxFreeDocument, type TaxFreeItem } from './types'

const statusLabels: Record<TaxFreeStatus, string> = {
  [TaxFreeStatus.NotFormed]: 'Не сформовано',
  [TaxFreeStatus.Formed]: 'Сформовано',
  [TaxFreeStatus.Printed]: 'Надруковано',
  [TaxFreeStatus.Tabulated]: 'Підбито',
  [TaxFreeStatus.Returned]: 'Повернено',
  [TaxFreeStatus.Closed]: 'Закрито',
}

export function getTaxFreeStatusLabel(status?: TaxFreeStatus) {
  if (typeof status !== 'number') {
    return ''
  }

  return statusLabels[status] || ''
}

export function getTaxFreeStatusOptions() {
  return [
    { label: 'Усі', status: '' as const, value: 'all' },
    ...Object.values(TaxFreeStatus)
      .filter((status): status is TaxFreeStatus => typeof status === 'number')
      .map((status) => ({
        label: getTaxFreeStatusLabel(status),
        status,
        value: String(status),
      })),
  ]
}

export function getPersonName(person?: Pick<Statham, 'FirstName' | 'FullName' | 'LastName' | 'MiddleName'> | null) {
  if (!person) {
    return ''
  }

  return [person.LastName, person.FirstName, person.MiddleName].filter(Boolean).join(' ') || person.FullName || ''
}

export function getTaxFreeClient(document: TaxFreeDocument) {
  return document.TaxFreePackList?.Client?.FullName || document.TaxFreePackList?.Client?.Name || ''
}

export function getTaxFreeResponsible(document: TaxFreeDocument) {
  return document.Responsible?.LastName || document.TaxFreePackList?.Responsible?.LastName || document.Responsible?.FullName || ''
}

export function getTaxFreeItemProduct(item: TaxFreeItem) {
  return (
    item.SupplyOrderUkraineCartItem?.Product
    || item.TaxFreePackListOrderItem?.OrderItem?.Product
    || item.OrderItem?.Product
    || null
  )
}
