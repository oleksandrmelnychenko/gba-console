import type { AccountingCashFlowHeadItem } from '../types'
import {
  type AccountingCashFlowPaymentStatus,
  getAccountingCashFlowPaymentStatus,
  getAccountingCashFlowRecordPaymentStatus,
} from '../accountingCashFlowPaymentStatus'

export type CashFlowDetailRow = {
  ContainerNumber?: string
  Currency?: string
  FromData?: string
  GrossPrice?: number
  Name?: string
  NetPrice?: number
  Number?: string
  PaymentStatus?: AccountingCashFlowPaymentStatus | null
  ServiceNumber?: string
  Symbol?: string
  Vat?: number
  VatPercent?: number
}

export type CashFlowDetailDocument = {
  name: string
  url: string
}

export type CashFlowDetailColumnKind = 'baseService' | 'supplyPaymentTask'

export type CashFlowDetailViewModel = {
  columnKind: CashFlowDetailColumnKind
  documents: CashFlowDetailDocument[]
  linkToOrder: string
  rows: CashFlowDetailRow[]
  title: string
}

const JOIN_SERVICE_TYPE = {
  SupplyOrderPaymentDeliveryProtocol: 0,
  SupplyOrderPolandPaymentDeliveryProtocol: 1,
  ContainerService: 2,
  CustomService: 3,
  PortWorkService: 4,
  TransportationService: 5,
  PortCustomAgencyService: 6,
  CustomAgencyService: 7,
  PlaneDeliveryService: 8,
  VehicleDeliveryService: 9,
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
  VehicleService: 21,
  AccountingContainerPaymentTask: 22,
  AccountingVehicleService: 23,
  AccountingCustomService: 24,
  AccountingTransportationService: 25,
  AccountingPortCustomAgencyService: 26,
  AccountingCustomAgencyService: 27,
  AccountingPlaneDeliveryService: 28,
  AccountingVehicleDeliveryService: 29,
  AccountingMergedService: 30,
  AccountingContainerService: 31,
  AccountingPortWorkService: 32,
  BillOfLadingService: 33,
  AccountingBillOfLadingService: 34,
  ActProvidingService: 35,
  AccountingActProvidingService: 36,
  ReSale: 37,
} as const

const BASE_SERVICE_FIELD_BY_TYPE: Partial<Record<number, keyof AccountingCashFlowHeadItem>> = {
  [JOIN_SERVICE_TYPE.ContainerService]: 'ContainerService',
  [JOIN_SERVICE_TYPE.CustomService]: 'CustomService',
  [JOIN_SERVICE_TYPE.AccountingCustomService]: 'CustomService',
  [JOIN_SERVICE_TYPE.PortWorkService]: 'PortWorkService',
  [JOIN_SERVICE_TYPE.PortCustomAgencyService]: 'PortCustomAgencyService',
  [JOIN_SERVICE_TYPE.AccountingPortCustomAgencyService]: 'PortCustomAgencyService',
  [JOIN_SERVICE_TYPE.CustomAgencyService]: 'CustomAgencyService',
  [JOIN_SERVICE_TYPE.AccountingCustomAgencyService]: 'CustomAgencyService',
  [JOIN_SERVICE_TYPE.PlaneDeliveryService]: 'PlaneDeliveryService',
  [JOIN_SERVICE_TYPE.AccountingPlaneDeliveryService]: 'PlaneDeliveryService',
  [JOIN_SERVICE_TYPE.VehicleService]: 'VehicleService',
  [JOIN_SERVICE_TYPE.AccountingVehicleService]: 'VehicleService',
  [JOIN_SERVICE_TYPE.TransportationService]: 'TransportationService',
  [JOIN_SERVICE_TYPE.AccountingTransportationService]: 'TransportationService',
  [JOIN_SERVICE_TYPE.VehicleDeliveryService]: 'VehicleDeliveryService',
  [JOIN_SERVICE_TYPE.AccountingVehicleDeliveryService]: 'VehicleDeliveryService',
  [JOIN_SERVICE_TYPE.MergedService]: 'MergedService',
  [JOIN_SERVICE_TYPE.AccountingMergedService]: 'MergedService',
  [JOIN_SERVICE_TYPE.BillOfLadingService]: 'BillOfLadingService',
  [JOIN_SERVICE_TYPE.AccountingBillOfLadingService]: 'BillOfLadingService',
}

export function mapItemToDetailViewModel(item: AccountingCashFlowHeadItem): CashFlowDetailViewModel | null {
  try {
    if (typeof item.Type !== 'number') {
      return null
    }

    if (item.Type === JOIN_SERVICE_TYPE.SupplyPaymentTask) {
      return mapSupplyPaymentTask(item)
    }

    const serviceField = BASE_SERVICE_FIELD_BY_TYPE[item.Type]

    if (serviceField) {
      return mapBaseService(item, serviceField)
    }

    return null
  } catch {
    return null
  }
}

function mapBaseService(
  item: AccountingCashFlowHeadItem,
  serviceField: keyof AccountingCashFlowHeadItem,
): CashFlowDetailViewModel | null {
  const service = toRecord(item[serviceField])

  if (!service) {
    return null
  }

  return {
    columnKind: 'baseService',
    documents: collectServiceDocuments(service),
    linkToOrder: getLinkToOrder(service),
    rows: getRowsFromBaseService(service, Boolean(item.IsAccounting), getAccountingCashFlowPaymentStatus(item)),
    title: stringValue(item.Name),
  }
}

function getRowsFromBaseService(
  service: Record<string, unknown>,
  isAccounting: boolean,
  fallbackPaymentStatus: AccountingCashFlowPaymentStatus | null,
): CashFlowDetailRow[] {
  const currencyCode = readPath(service, ['SupplyOrganizationAgreement', 'Currency', 'Code'])
  const detailItems = readArray(service, 'ServiceDetailItems')
  const servicePaymentStatus = getAccountingCashFlowRecordPaymentStatus(service) || fallbackPaymentStatus

  if (detailItems.length > 0) {
    return detailItems.map((detailItem) => {
      const detail = toRecord(detailItem)
      const key = toRecord(detail?.ServiceDetailItemKey)

      return {
        Currency: currencyCode,
        FromData: stringValue(service.FromDate),
        GrossPrice: numberValue(detail?.GrossPrice),
        Name: stringValue(key?.Name),
        NetPrice: numberValue(detail?.NetPrice),
        Number: stringValue(service.Number),
        PaymentStatus: getAccountingCashFlowRecordPaymentStatus(detail) || servicePaymentStatus,
        ServiceNumber: stringValue(service.ServiceNumber),
        Symbol: stringValue(key?.Symbol),
        Vat: numberValue(detail?.Vat),
        VatPercent: numberValue(detail?.VatPercent),
      }
    })
  }

  return [
    {
      Currency: currencyCode,
      FromData: stringValue(service.FromDate),
      GrossPrice: numberValue(isAccounting ? service.AccountingGrossPrice : service.GrossPrice),
      Name: stringValue(service.Name) || stringValue(service.Number),
      NetPrice: numberValue(isAccounting ? service.AccountingNetPrice : service.NetPrice),
      Number: stringValue(service.Number),
      PaymentStatus: servicePaymentStatus,
      ServiceNumber: stringValue(service.ServiceNumber),
      Symbol: '',
      Vat: numberValue(isAccounting ? service.AccountingVat : service.Vat),
      VatPercent: numberValue(isAccounting ? service.AccountingVatPercent : service.VatPercent),
    },
  ]
}

function mapSupplyPaymentTask(item: AccountingCashFlowHeadItem): CashFlowDetailViewModel | null {
  const task = toRecord(item.SupplyPaymentTask)

  if (!task) {
    return null
  }

  const containerServices = readArray(task, 'ContainerServices')
  const services = containerServices.length > 0 ? containerServices : readArray(task, 'VehicleServices')

  const rows = services.map((serviceItem) => {
    const service = toRecord(serviceItem)

    return {
      ContainerNumber: stringValue(service?.ContainerNumber),
      Currency: readPath(service, ['SupplyOrganizationAgreement', 'Currency', 'Code']),
      FromData: stringValue(readPath(service, ['BillOfLadingDocument', 'Date'])),
      NetPrice: numberValue(service?.NetPrice),
      Number: stringValue(service?.Number),
      PaymentStatus: getAccountingCashFlowRecordPaymentStatus(service) || getAccountingCashFlowPaymentStatus(item),
      ServiceNumber: stringValue(service?.ServiceNumber),
    }
  })

  return {
    columnKind: 'supplyPaymentTask',
    documents: [],
    linkToOrder: getLinkToOrder(toRecord(containerServices[0])),
    rows,
    title: stringValue(item.Name),
  }
}

function collectServiceDocuments(service: Record<string, unknown>): CashFlowDetailDocument[] {
  const source = Array.isArray(service.InvoiceDocuments)
    ? readArray(service, 'InvoiceDocuments')
    : readArray(service, 'BillOfLadingDocuments')

  return source
    .map((documentItem) => toRecord(documentItem))
    .filter((document): document is Record<string, unknown> => Boolean(document) && Boolean(stringValue(document?.DocumentUrl)))
    .map((document) => ({
      name: stringValue(document.FileName) || stringValue(document.Name) || stringValue(document.Number),
      url: stringValue(document.DocumentUrl),
    }))
}

function getLinkToOrder(service: Record<string, unknown> | null): string {
  if (!service) {
    return ''
  }

  const supplyOrder = toRecord(service.SupplyOrder)

  if (supplyOrder) {
    return '/orders/poland/all/edit/' + stringValue(supplyOrder.NetUid)
  }

  const supplyOrders = readArray(service, 'SupplyOrders')
  const firstSupplyOrder = toRecord(supplyOrders[0])

  if (firstSupplyOrder) {
    return '/orders/poland/all/edit/' + stringValue(firstSupplyOrder.NetUid)
  }

  const supplyOrderUkraine = toRecord(service.SupplyOrderUkraine)

  if (supplyOrderUkraine) {
    return '/orders/ukraine/protocols/' + stringValue(supplyOrderUkraine.NetUid)
  }

  return ''
}

function readArray(record: Record<string, unknown> | null, key: string): unknown[] {
  const value = record?.[key]

  return Array.isArray(value) ? value : []
}

function readPath(record: Record<string, unknown> | null, path: string[]): string {
  const value = path.reduce<unknown>((current, key) => toRecord(current)?.[key], record)

  return stringValue(value)
}

function stringValue(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  return ''
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)

    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return undefined
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}
