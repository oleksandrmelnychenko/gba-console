import type { DirectSupplyOrder, PackingList, SupplyInvoice, SupplyOrderUkraine } from './types'

export type OrderAmountBreakdown = {
  net: number | undefined
  vat: number | undefined
  withVat: number | undefined
}

export function getDirectOrderAmountBreakdown(order: DirectSupplyOrder): OrderAmountBreakdown {
  const net = finiteNumber(order.TotalNetPrice)
  const vat = finiteNumber(order.TotalVat)
  const calculatedWithVat = addDefined(net, vat)

  return {
    net,
    vat,
    withVat: resolveVatInclusiveAmount(calculatedWithVat, order.TotalNetPriceWithVat),
  }
}

export function getInvoiceAmountBreakdown(invoice: SupplyInvoice): OrderAmountBreakdown {
  const detailedNet = finiteNumber(invoice.TotalNetPrice)
  const storedNet = finiteNumber(invoice.NetPrice)
  // The direct-order response does not hydrate packing-list totals, so
  // TotalNetPrice is legitimately zero there while the persisted invoice
  // amount lives in NetPrice. Prefer a non-zero detailed total and otherwise
  // fall back to the persisted amount used by the legacy invoice form.
  const net = detailedNet !== undefined && detailedNet !== 0 ? detailedNet : storedNet ?? detailedNet
  const vat = finiteNumber(invoice.TotalVatAmount)
  const calculatedWithVat = addDefined(net, vat)

  return {
    net,
    vat,
    withVat: resolveVatInclusiveAmount(
      calculatedWithVat,
      invoice.TotalNetPriceWithVat,
      invoice.TotalValueWithVat,
    ),
  }
}

/** Legacy invoice payment tasks use invoice net + delivery - discount as their default amount. */
export function getInvoicePaymentAmount(invoice: SupplyInvoice): number {
  const net = getInvoiceStoredNetAmount(invoice)
  const delivery = finiteNumber(invoice.DeliveryAmount) ?? 0
  const discount = finiteNumber(invoice.DiscountAmount) ?? 0

  return net + delivery - discount
}

/** Maximum valid discount in the legacy invoice form: invoice net + delivery. */
export function getInvoiceDiscountLimit(invoice: SupplyInvoice): number {
  const delivery = finiteNumber(invoice.DeliveryAmount) ?? 0

  return getInvoiceStoredNetAmount(invoice) + delivery
}

function getInvoiceStoredNetAmount(invoice: SupplyInvoice): number {
  const storedNet = finiteNumber(invoice.NetPrice)

  if (storedNet !== undefined && storedNet !== 0) {
    return storedNet
  }

  return getInvoiceAmountBreakdown(invoice).net ?? 0
}

export function getPackingListAmountBreakdown(packList: PackingList): OrderAmountBreakdown {
  const net = finiteNumber(packList.TotalNetPrice)
  const vat = finiteNumber(packList.TotalVatAmount)
  const calculatedWithVat = addDefined(net, vat)

  return {
    net,
    vat,
    withVat: resolveVatInclusiveAmount(calculatedWithVat, packList.TotalNetPriceWithVat),
  }
}

export function getToUkraineOrderAmountBreakdown(order: SupplyOrderUkraine): OrderAmountBreakdown {
  const net = finiteNumber(order.TotalNetPriceLocal)
  const vat = finiteNumber(order.TotalVatAmount)

  return {
    net,
    vat,
    withVat: finiteNumber(order.TotalNetPriceLocalWithVat) ?? addDefined(net, vat),
  }
}

function addDefined(left: number | undefined, right: number | undefined): number | undefined {
  if (left === undefined && right === undefined) {
    return undefined
  }

  return (left ?? 0) + (right ?? 0)
}

function finiteNumber(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function resolveVatInclusiveAmount(
  calculated: number | undefined,
  ...explicitValues: Array<number | undefined>
): number | undefined {
  const explicit = explicitValues
    .map(finiteNumber)
    .filter((value): value is number => value !== undefined)

  if (calculated !== undefined) {
    const matching = explicit.find((value) => Math.abs(value - calculated) < 0.01)
    return matching ?? calculated
  }

  return explicit.find((value) => value !== 0) ?? explicit[0]
}
