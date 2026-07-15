import type { SalesUkraineOrderItem, SalesUkraineSale } from '../types'

export function buildSaleDiscountPayload(
  sale: SalesUkraineSale,
  orderItem: SalesUkraineOrderItem | null,
  amount: number,
  comment: string,
  canEditPercentage: boolean,
): SalesUkraineSale {
  const orderItems = Array.isArray(sale.Order?.OrderItems) ? sale.Order.OrderItems : []
  const changedItems = orderItem ? orderItems.filter((item) => isSamePersistedOrderItem(item, orderItem)) : orderItems

  if (orderItem && changedItems.length !== 1) {
    throw new Error('Позиція знижки більше не існує або має неоднозначний ідентифікатор')
  }

  const mapChangedItem = (item: SalesUkraineOrderItem): SalesUkraineOrderItem => ({
    Id: item.Id,
    NetUid: item.NetUid,
    Updated: item.Updated,
    OneTimeDiscount: canEditPercentage ? amount : item.OneTimeDiscount,
    OneTimeDiscountComment: comment,
  })

  return {
    Id: sale.Id,
    NetUid: sale.NetUid,
    Updated: sale.Updated,
    ...(orderItem ? {} : { OneTimeDiscountComment: comment }),
    Order: sale.Order
      ? {
          Id: sale.Order.Id,
          NetUid: sale.Order.NetUid,
          OrderItems: changedItems.map(mapChangedItem),
        }
      : sale.Order,
  }
}

export function findSaleOrderItemByIdentity(
  sale: SalesUkraineSale,
  target: SalesUkraineOrderItem,
): SalesUkraineOrderItem | null {
  const matches = (sale.Order?.OrderItems ?? []).filter((item) => isSamePersistedOrderItem(item, target))

  return matches.length === 1 ? matches[0] ?? null : null
}

export function hasSaleDiscountBaselineConflict(
  baselineSale: SalesUkraineSale,
  baselineOrderItem: SalesUkraineOrderItem | null,
  freshSale: SalesUkraineSale,
): boolean {
  if (getSaleLifecycleSignature(freshSale) !== getSaleLifecycleSignature(baselineSale)) {
    return true
  }

  if (baselineOrderItem) {
    const freshItem = findSaleOrderItemByIdentity(freshSale, baselineOrderItem)

    return !freshItem || getItemDiscountSignature(freshItem) !== getItemDiscountSignature(baselineOrderItem)
  }

  return getSaleDiscountSignature(freshSale) !== getSaleDiscountSignature(baselineSale)
}

function getSaleLifecycleSignature(sale: SalesUkraineSale): string {
  return String(sale.BaseLifeCycleStatus?.SaleLifeCycleType ?? sale.BaseLifeCycleStatus?.Name ?? '')
}

function isSamePersistedOrderItem(left: SalesUkraineOrderItem, right: SalesUkraineOrderItem): boolean {
  if (left === right) {
    return true
  }

  const rightNetUid = normalizePersistedNetUid(right.NetUid)

  if (rightNetUid && normalizePersistedNetUid(left.NetUid) === rightNetUid) {
    return true
  }

  return typeof right.Id === 'number' && right.Id > 0 && left.Id === right.Id
}

function getSaleDiscountSignature(sale: SalesUkraineSale): string {
  const items = (sale.Order?.OrderItems ?? [])
    .map((item) => `${getOrderItemIdentity(item)}:${getItemDiscountSignature(item)}`)
    .sort()

  return JSON.stringify([sale.OneTimeDiscountComment ?? '', items])
}

function getItemDiscountSignature(item: SalesUkraineOrderItem): string {
  return JSON.stringify([item.OneTimeDiscount ?? 0, item.OneTimeDiscountComment ?? ''])
}

function getOrderItemIdentity(item: SalesUkraineOrderItem): string {
  const netUid = normalizePersistedNetUid(item.NetUid)

  if (netUid) {
    return `net:${netUid}`
  }

  return typeof item.Id === 'number' && item.Id > 0 ? `id:${item.Id}` : 'unpersisted'
}

function normalizePersistedNetUid(value: string | undefined): string {
  const netUid = value?.trim().toLowerCase() ?? ''

  return netUid === '00000000-0000-0000-0000-000000000000' ? '' : netUid
}
