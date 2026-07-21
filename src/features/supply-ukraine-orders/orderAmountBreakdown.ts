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
  const net = finiteNumber(invoice.TotalNetPrice) ?? finiteNumber(invoice.NetPrice)
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
