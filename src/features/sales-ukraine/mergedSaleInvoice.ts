import type { SalesUkraineOrderItem, SalesUkraineSale, SalesUkraineSaleMerged } from './types'

export type MergedSaleInvoiceDraft = {
  items: Record<string, MergedSaleInvoiceDraftItem>
  selected: boolean
}

export type MergedSaleInvoiceDraftItem = {
  qty: number | string
  selected: boolean
}

export type MergedSaleInvoiceDraftBySale = Record<string, MergedSaleInvoiceDraft>

export function buildMergedSaleInvoiceDrafts(merges: SalesUkraineSaleMerged[]): MergedSaleInvoiceDraftBySale {
  const drafts: MergedSaleInvoiceDraftBySale = {}

  merges.forEach((merge, saleIndex) => {
    const sale = merge.InputSale

    if (!sale) {
      return
    }

    const items = getOrderItems(sale)
    const itemDrafts: Record<string, MergedSaleInvoiceDraftItem> = {}

    items.forEach((item, itemIndex) => {
      itemDrafts[getOrderItemKey(item, itemIndex)] = {
        qty: getNumber(item.Qty) ?? '',
        selected: true,
      }
    })

    drafts[getMergedSaleKey(sale, saleIndex)] = {
      items: itemDrafts,
      selected: items.length > 0,
    }
  })

  return drafts
}

export function buildMergedSaleInvoicePayload(
  sale: SalesUkraineSale,
  draft: MergedSaleInvoiceDraft | undefined,
): SalesUkraineSale {
  const orderItems = getOrderItems(sale)
  const selectedItems: SalesUkraineOrderItem[] = []

  orderItems.forEach((item, index) => {
    const itemDraft = draft?.items[getOrderItemKey(item, index)]
    const qty = getNumber(itemDraft?.qty) ?? getNumber(item.Qty) ?? 0

    if (itemDraft?.selected && qty > 0) {
      selectedItems.push({ ...item, Qty: qty })
    }
  })

  return {
    ...sale,
    Order: {
      ...sale.Order,
      OrderItems: selectedItems,
    },
  }
}

export function hasSelectedMergedSaleItems(sale: SalesUkraineSale, draft: MergedSaleInvoiceDraft | undefined): boolean {
  return buildMergedSaleInvoicePayload(sale, draft).Order?.OrderItems?.length ? true : false
}

export function getMergedSaleKey(sale: SalesUkraineSale, index: number): string {
  return String(sale.NetUid || sale.Id || index)
}

export function getOrderItemKey(item: SalesUkraineOrderItem, index: number): string {
  return String(item.NetUid || item.Id || index)
}

export function getOrderItems(sale: SalesUkraineSale | undefined): SalesUkraineOrderItem[] {
  return Array.isArray(sale?.Order?.OrderItems) ? sale.Order.OrderItems : []
}

export function getNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'))

    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}
