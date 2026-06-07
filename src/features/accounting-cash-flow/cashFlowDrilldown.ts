import type { AccountingCashFlowHeadItem } from './types'

const JOIN_SERVICE_TYPE = {
  ConsumablesOrder: 10,
  OutcomePaymentOrder: 11,
  IncomePaymentOrder: 12,
  Sale: 13,
  SupplyPaymentTask: 14,
  SaleReturn: 15,
  SupplyOrderUkraine: 16,
  MergedService: 17,
  SupplyOrderUkrainePaymentDeliveryProtocol: 18,
  ProductIncomePL: 19,
  ProductIncomeUK: 20,
  AccountingContainerPaymentTask: 22,
  BillOfLadingService: 33,
  AccountingBillOfLadingService: 34,
  ActProvidingService: 35,
  AccountingActProvidingService: 36,
  ReSale: 37,
} as const

const TASK_SERVICE_FIELDS = [
  'SupplyOrderUkrainePaymentDeliveryProtocols',
  'MergedServices',
  'BillOfLadingServices',
  'ConsumablesOrder',
  'ContainerServices',
  'VehicleServices',
  'BrokerServices',
  'PortWorkServices',
  'TransportationServices',
  'PortCustomAgencyServices',
  'CustomAgencyServices',
  'PlaneDeliveryServices',
  'VehicleDeliveryServices',
] as const

export function getAccountingCashFlowDrilldownRoute(item: AccountingCashFlowHeadItem): string | null {
  const itemRecord = toRecord(item)

  if (!itemRecord || item.Type === JOIN_SERVICE_TYPE.ProductIncomePL) {
    return null
  }

  return resolveDirectRoute(itemRecord, item.Type) || resolveTaskRoute(itemRecord)
}

function resolveDirectRoute(record: Record<string, unknown>, type?: number): string | null {
  if (type === JOIN_SERVICE_TYPE.OutcomePaymentOrder) {
    const route = resolveOutcomePaymentOrderRoute(toRecord(record.OutcomePaymentOrder) || record)

    if (route) {
      return route
    }
  }

  if (type === JOIN_SERVICE_TYPE.ConsumablesOrder) {
    const route = resolveConsumablesOrderRoute(toRecord(record.ConsumablesOrder) || record)

    if (route) {
      return route
    }
  }

  if (type === JOIN_SERVICE_TYPE.ProductIncomeUK) {
    const productIncomeNetUid = getNetUid(toRecord(record.ProductIncome))

    if (productIncomeNetUid) {
      return `/orders/ukraine/${encodeURIComponent(productIncomeNetUid)}/product-income`
    }
  }

  if (type === JOIN_SERVICE_TYPE.SupplyOrderUkraine) {
    return resolveUkraineOrderRoute(toRecord(record.SupplyOrderUkraine), 'view')
  }

  if (type === JOIN_SERVICE_TYPE.SupplyOrderUkrainePaymentDeliveryProtocol) {
    return resolveUkraineProtocolRoute(toRecord(record.SupplyOrderUkrainePaymentDeliveryProtocol))
  }

  const explicitRoute =
    resolveUkraineProtocolRoute(toRecord(record.SupplyOrderUkrainePaymentDeliveryProtocol) || record) ||
    resolveUkraineOrderRoute(toRecord(record.SupplyOrderUkraine), 'protocols') ||
    resolveConsumablesOrderRoute(toRecord(record.ConsumablesOrder)) ||
    resolveProductDeliveryProtocolRoute(record) ||
    resolveActProvidingServiceRoute(record) ||
    resolveResaleRoute(record)

  if (explicitRoute) {
    return explicitRoute
  }

  if (type === JOIN_SERVICE_TYPE.SupplyPaymentTask || type === JOIN_SERVICE_TYPE.AccountingContainerPaymentTask) {
    return resolveTaskRoute(record)
  }

  return null
}

function resolveTaskRoute(record: Record<string, unknown>): string | null {
  const task = toRecord(record.SupplyPaymentTask) || toRecord(record.AccountingContainerPaymentTask) || record

  for (const field of TASK_SERVICE_FIELDS) {
    const value = task[field]
    const items = Array.isArray(value) ? value : value ? [value] : []

    for (const item of items) {
      const itemRecord = toRecord(item)
      const route = itemRecord
        ? resolveDirectRoute(
            itemRecord,
            field === 'ConsumablesOrder' ? JOIN_SERVICE_TYPE.ConsumablesOrder : undefined,
          )
        : null

      if (route) {
        return route
      }
    }
  }

  return null
}

function resolveUkraineOrderRoute(order: Record<string, unknown> | null, mode: 'protocols' | 'view'): string | null {
  const orderNetUid = getNetUid(order)

  if (!orderNetUid) {
    return null
  }

  return mode === 'protocols'
    ? `/orders/ukraine/protocols/${encodeURIComponent(orderNetUid)}`
    : `/orders/ukraine/view/${encodeURIComponent(orderNetUid)}`
}

function resolveOutcomePaymentOrderRoute(outcome: Record<string, unknown> | null): string | null {
  const outcomeNetUid = getNetUid(outcome)

  if (outcome?.IsUnderReport === true && outcomeNetUid) {
    return `/accounting/outgoing-cashflow/${encodeURIComponent(outcomeNetUid)}/advanced-report/view`
  }

  return resolveOutcomeConsumablesOrderRoute(outcome)
}

function resolveOutcomeConsumablesOrderRoute(outcome: Record<string, unknown> | null): string | null {
  const relatedOrders = toArray(outcome?.OutcomePaymentOrderConsumablesOrders)

  for (const relatedOrder of relatedOrders) {
    const relatedOrderRecord = toRecord(relatedOrder)
    const consumablesOrder = toRecord(relatedOrderRecord?.ConsumablesOrder)

    if (relatedOrderRecord?.Deleted === true || consumablesOrder?.Deleted === true) {
      continue
    }

    const route = resolveConsumablesOrderRoute(consumablesOrder)

    if (route) {
      return route
    }
  }

  return null
}

function resolveUkraineProtocolRoute(protocol: Record<string, unknown> | null): string | null {
  return resolveUkraineOrderRoute(toRecord(protocol?.SupplyOrderUkraine), 'protocols')
}

function resolveConsumablesOrderRoute(order: Record<string, unknown> | null): string | null {
  const orderNetUid = getNetUid(order)

  return orderNetUid ? `/accounting/consumable-orders/edit/${encodeURIComponent(orderNetUid)}` : null
}

function resolveProductDeliveryProtocolRoute(record: Record<string, unknown>): string | null {
  const protocolNetUid =
    getNetUid(toRecord(record.DeliveryProductProtocol)) ||
    getNetUid(toRecord(toRecord(record.MergedService)?.DeliveryProductProtocol)) ||
    getNetUid(toRecord(toRecord(record.BillOfLadingService)?.DeliveryProductProtocol))

  return protocolNetUid ? `/product-delivery-protocols/${encodeURIComponent(protocolNetUid)}` : null
}

function resolveActProvidingServiceRoute(record: Record<string, unknown>): string | null {
  const actNetUid =
    getNetUid(toRecord(record.ActProvidingService)) ||
    getNetUid(toRecord(record.AccountingActProvidingService)) ||
    getNetUid(toRecord(toRecord(record.MergedService)?.ActProvidingService)) ||
    getNetUid(toRecord(toRecord(record.MergedService)?.AccountingActProvidingService))

  return actNetUid ? `/act-providing-services/${encodeURIComponent(actNetUid)}` : null
}

function resolveResaleRoute(record: Record<string, unknown>): string | null {
  const updatedReSaleModel = toRecord(record.UpdatedReSaleModel)
  const resaleNetUid =
    getNetUid(toRecord(record.ReSale)) ||
    getNetUid(updatedReSaleModel) ||
    getNetUid(toRecord(updatedReSaleModel?.ReSale))

  return resaleNetUid ? `/resales/${encodeURIComponent(resaleNetUid)}` : null
}

function getNetUid(record: Record<string, unknown> | null): string {
  return stringValue(record?.NetUid) || stringValue(record?.NetUID) || stringValue(record?.NetUidSimple)
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value ? [value] : []
}
