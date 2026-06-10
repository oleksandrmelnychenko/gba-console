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

export type CashFlowDetailOrderLink = {
  isNavigable: boolean
  route: string
}

export type CashFlowDetailViewModel = {
  columnKind: CashFlowDetailColumnKind
  documents: CashFlowDetailDocument[]
  orderLink: CashFlowDetailOrderLink | null
  rows: CashFlowDetailRow[]
  title: string
}

type SupplyPaymentTaskServiceEntry = {
  service: unknown
  taskPaymentStatus: AccountingCashFlowPaymentStatus | null
}

const SUPPLY_PAYMENT_TASK_SERVICE_FIELDS = [
  'ConsumablesOrder',
  'SupplyOrderUkrainePaymentDeliveryProtocols',
  'CustomAgencyServices',
  'VehicleDeliveryServices',
  'TransportationServices',
  'PortCustomAgencyServices',
  'PlaneDeliveryServices',
  'BrokerServices',
  'PaymentDeliveryProtocols',
  'PortWorkServices',
  'MergedServices',
  'ContainerServices',
  'VehicleServices',
  'BillOfLadingServices',
] as const

const SERVICE_DOCUMENT_FIELDS = [
  'InvoiceDocuments',
  'BillOfLadingDocuments',
  'ConsumablesOrderDocuments',
  'SupplyPaymentTaskDocuments',
  'ProFormDocuments',
] as const

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
  [JOIN_SERVICE_TYPE.AccountingContainerService]: 'ContainerService',
  [JOIN_SERVICE_TYPE.CustomService]: 'CustomService',
  [JOIN_SERVICE_TYPE.AccountingCustomService]: 'CustomService',
  [JOIN_SERVICE_TYPE.PortWorkService]: 'PortWorkService',
  [JOIN_SERVICE_TYPE.AccountingPortWorkService]: 'PortWorkService',
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
      return mapSupplyPaymentTask(item, 'SupplyPaymentTask')
    }

    if (item.Type === JOIN_SERVICE_TYPE.AccountingContainerPaymentTask) {
      return mapSupplyPaymentTask(item, 'AccountingContainerPaymentTask')
    }

    if (item.Type === JOIN_SERVICE_TYPE.OutcomePaymentOrder) {
      const outcomeDetail = mapOutcomePaymentOrderSupplyPaymentTasks(item)

      if (outcomeDetail) {
        return outcomeDetail
      }
    }

    if (item.Type === JOIN_SERVICE_TYPE.SupplyOrderPaymentDeliveryProtocol) {
      return mapSupplyOrderPaymentDeliveryProtocol(item)
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

function mapSupplyOrderPaymentDeliveryProtocol(item: AccountingCashFlowHeadItem): CashFlowDetailViewModel | null {
  const protocol = toRecord(item.SupplyOrderPaymentDeliveryProtocol)

  if (!protocol) {
    return null
  }

  const invoice = toRecord(protocol.SupplyInvoice)
  const proForm = toRecord(protocol.SupplyProForm)
  const document = invoice || proForm || protocol
  const supplyOrder = toRecord(document.SupplyOrder) || toRecord(readArray(document, 'SupplyOrders')[0])
  const clientAgreement = toRecord(readArray(toRecord(supplyOrder?.Client), 'ClientAgreements')[0])
  const agreement = toRecord(clientAgreement?.Agreement)
  const paymentStatus =
    getAccountingCashFlowRecordPaymentStatus(protocol) ||
    getAccountingCashFlowRecordPaymentStatus(document) ||
    getAccountingCashFlowPaymentStatus(item)

  return {
    columnKind: 'supplyPaymentTask',
    documents: uniqueDocuments([
      ...collectServiceDocuments(protocol),
      ...collectServiceDocuments(document),
    ]),
    orderLink: getOrderLink(document) || getOrderLink(protocol),
    rows: [
      {
        Currency:
          readPath(document, ['SupplyOrganizationAgreement', 'Currency', 'Code']) ||
          readPath(agreement, ['Currency', 'Code']),
        FromData: stringValue(document.DateFrom) || stringValue(protocol.FromDate),
        NetPrice: firstNumberValue(document.NetPrice, document.TotalNetPrice, protocol.Value),
        Number: stringValue(document.Number),
        PaymentStatus: paymentStatus,
        ServiceNumber: stringValue(document.ServiceNumber),
      },
    ],
    title: stringValue(item.Name) || stringValue(document.Number),
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
    orderLink: getOrderLink(service),
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

function mapSupplyPaymentTask(
  item: AccountingCashFlowHeadItem,
  taskField: keyof AccountingCashFlowHeadItem,
): CashFlowDetailViewModel | null {
  const task = toRecord(item[taskField])

  if (!task) {
    return null
  }

  return mapSupplyPaymentTaskRecords(item, [task], stringValue(item.Name))
}

function mapOutcomePaymentOrderSupplyPaymentTasks(item: AccountingCashFlowHeadItem): CashFlowDetailViewModel | null {
  const outcome = toRecord(item.OutcomePaymentOrder)

  if (!outcome) {
    return null
  }

  const tasks = readArray(outcome, 'OutcomePaymentOrderSupplyPaymentTasks')
    .map((taskLink) => toRecord(toRecord(taskLink)?.SupplyPaymentTask))
    .filter((task): task is Record<string, unknown> => Boolean(task))

  if (tasks.length === 0) {
    return null
  }

  return mapSupplyPaymentTaskRecords(item, tasks, stringValue(item.Name) || stringValue(outcome.Number))
}

function mapSupplyPaymentTaskRecords(
  item: AccountingCashFlowHeadItem,
  tasks: Record<string, unknown>[],
  title: string,
): CashFlowDetailViewModel {
  const entries = tasks.flatMap<SupplyPaymentTaskServiceEntry>((task) => {
    const taskPaymentStatus = getAccountingCashFlowRecordPaymentStatus(task) || getAccountingCashFlowPaymentStatus(item)

    return collectSupplyPaymentTaskServices(task).map((service) => ({
      service,
      taskPaymentStatus,
    }))
  })

  const rows = entries.map(({ service: serviceItem, taskPaymentStatus }) => {
    const service = toRecord(serviceItem)
    const nestedProForm = toRecord(service?.SupplyProForm)
    const nestedInvoice = toRecord(service?.SupplyInvoice)
    const nestedUkraineOrder = toRecord(service?.SupplyOrderUkraine)
    const nestedSupplyOrder = toRecord(nestedInvoice?.SupplyOrder) || toRecord(readArray(nestedProForm, 'SupplyOrders')[0])
    const nestedSupplyOrderClientAgreement = toRecord(readArray(toRecord(nestedSupplyOrder?.Client), 'ClientAgreements')[0])
    const nestedSupplyOrderAgreement = toRecord(nestedSupplyOrderClientAgreement?.Agreement)
    const nestedAgreement = toRecord(nestedUkraineOrder?.ClientAgreement)
    const nestedAgreementDetail = toRecord(nestedAgreement?.Agreement)

    return {
      ContainerNumber:
        stringValue(service?.ContainerNumber) ||
        stringValue(service?.VehicleNumber) ||
        stringValue(service?.BillOfLadingNumber),
      Currency:
        readPath(service, ['SupplyOrganizationAgreement', 'Currency', 'Code']) ||
        readPath(nestedInvoice, ['SupplyOrganizationAgreement', 'Currency', 'Code']) ||
        readPath(nestedProForm, ['SupplyOrganizationAgreement', 'Currency', 'Code']) ||
        readPath(nestedSupplyOrderAgreement, ['Currency', 'Code']) ||
        readPath(nestedAgreementDetail, ['Currency', 'Code']),
      FromData:
        stringValue(service?.FromDate) ||
        stringValue(readPath(service, ['BillOfLadingDocument', 'Date'])) ||
        stringValue(nestedProForm?.DateFrom) ||
        stringValue(nestedInvoice?.DateFrom) ||
        stringValue(nestedUkraineOrder?.FromDate),
      NetPrice: firstNumberValue(
        service?.NetPrice,
        service?.AccountingNetPrice,
        nestedProForm?.NetPrice,
        nestedInvoice?.NetPrice,
        service?.Value,
        service?.GrossPrice,
      ),
      Number:
        stringValue(service?.Number) ||
        stringValue(nestedProForm?.Number) ||
        stringValue(nestedInvoice?.Number) ||
        stringValue(nestedUkraineOrder?.InvNumber),
      PaymentStatus: getAccountingCashFlowRecordPaymentStatus(service) || taskPaymentStatus,
      ServiceNumber:
        stringValue(service?.ServiceNumber) ||
        stringValue(nestedProForm?.ServiceNumber) ||
        stringValue(nestedInvoice?.ServiceNumber) ||
        stringValue(nestedUkraineOrder?.Number),
    }
  })

  return {
    columnKind: 'supplyPaymentTask',
    documents: uniqueDocuments([
      ...tasks.flatMap((task) => collectServiceDocuments(task)),
      ...entries.flatMap((entry) => collectServiceDocuments(toRecord(entry.service) || {})),
    ]),
    orderLink: getOrderLink(toRecord(entries[0]?.service)),
    rows,
    title,
  }
}

function collectSupplyPaymentTaskServices(task: Record<string, unknown>): unknown[] {
  const result: unknown[] = []

  for (const field of SUPPLY_PAYMENT_TASK_SERVICE_FIELDS) {
    const value = task[field]
    const services = Array.isArray(value) ? value : value ? [value] : []

    for (const service of services) {
      if (toRecord(service)?.Deleted !== true) {
        result.push(service)
      }
    }
  }

  return result
}

function collectServiceDocuments(service: Record<string, unknown>): CashFlowDetailDocument[] {
  const nestedProForm = toRecord(service.SupplyProForm)
  const nestedInvoice = toRecord(service.SupplyInvoice)
  const source = [
    ...SERVICE_DOCUMENT_FIELDS.flatMap((field) => readArray(service, field)),
    ...readArray(nestedProForm, 'ProFormDocuments'),
    ...readArray(nestedInvoice, 'InvoiceDocuments'),
  ]

  return source
    .map((documentItem) => toRecord(documentItem))
    .filter((document): document is Record<string, unknown> =>
      Boolean(document && document.Deleted !== true && getDocumentUrl(document)),
    )
    .map((document) => ({
      name: stringValue(document.FileName) || stringValue(document.Name) || stringValue(document.Number),
      url: getDocumentUrl(document),
    }))
}

function uniqueDocuments(documents: CashFlowDetailDocument[]): CashFlowDetailDocument[] {
  const seen = new Set<string>()
  const result: CashFlowDetailDocument[] = []

  for (const document of documents) {
    const key = document.url || document.name

    if (!key || seen.has(key)) {
      continue
    }

    seen.add(key)
    result.push(document)
  }

  return result
}

function getDocumentUrl(document: Record<string, unknown>): string {
  return stringValue(document.DocumentUrl)
    || stringValue(document.DocumentURL)
    || stringValue(document.PdfDocumentUrl)
    || stringValue(document.PdfDocumentURL)
    || stringValue(document.URL)
    || stringValue(document.Url)
    || stringValue(document.url)
}

function getOrderLink(service: Record<string, unknown> | null): CashFlowDetailOrderLink | null {
  if (!service) {
    return null
  }

  const supplyOrder = toRecord(service.SupplyOrder) || toRecord(readArray(service, 'SupplyOrders')[0])
  const supplyOrderNetUid = stringValue(supplyOrder?.NetUid)

  if (supplyOrderNetUid) {
    return { isNavigable: false, route: '/orders/poland/all/edit/' + supplyOrderNetUid }
  }

  const supplyOrderUkraine = toRecord(service.SupplyOrderUkraine)
  const supplyOrderUkraineNetUid = stringValue(supplyOrderUkraine?.NetUid)

  if (supplyOrderUkraineNetUid) {
    return { isNavigable: true, route: '/orders/ukraine/protocols/' + supplyOrderUkraineNetUid }
  }

  return null
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

function firstNumberValue(...values: unknown[]): number | undefined {
  for (const value of values) {
    const parsed = numberValue(value)

    if (parsed !== undefined) {
      return parsed
    }
  }

  return undefined
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}
