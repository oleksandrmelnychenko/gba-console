export type EntityFields = {
  Created?: string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: string
}

export type ServiceOrganizationTypeValue = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export type ServiceOrganizationTypeOption = {
  label: string
  value: ServiceOrganizationTypeValue
}

export const SERVICE_ORGANIZATION_TYPES = [
  { value: 0, label: 'Контейнерний сервіс' },
  { value: 1, label: 'Митна агенція' },
  { value: 2, label: 'Митниця' },
  { value: 3, label: 'Акциз' },
  { value: 4, label: 'Авіадоставка' },
  { value: 5, label: 'Митна агенція в порту' },
  { value: 6, label: 'Портові роботи' },
  { value: 7, label: 'Доставка з порту' },
  { value: 8, label: 'Автодоставка' },
  { value: 9, label: 'Об’єднаний сервіс' },
] satisfies ServiceOrganizationTypeOption[]

export type ServiceOrganization = {
  Name?: string
  ServiceOrganizationTypes?: ServiceOrganizationTypeValue[]
}

export type DocumentFilter = 'invoice' | 'payed'

export type BaseDocument = EntityFields & {
  ContentType?: string
  DocumentUrl?: string
  FileName?: string
  GeneratedName?: string
}

export type BillOfLadingDocument = BaseDocument & {
  Amount?: number
  Date?: string
  Number?: string
}

export type ServiceItem = EntityFields & {
  AccountingGrossPrice?: number
  AccountingNetPrice?: number
  BillOfLadingDocument?: BillOfLadingDocument | null
  BillOfLadingDocuments?: BillOfLadingDocument[]
  FromDate?: string
  GrossPrice?: number
  InvoiceDocuments?: BaseDocument[]
  Name?: string
  NetPrice?: number
  Number?: string
  ServiceNumber?: string
  SupplyCustomType?: 0 | 1
}

export type TaskStatus = 0 | 1 | 2

export type SupplyPaymentTask = EntityFields & {
  BrokerServices?: ServiceItem[]
  ContainerServices?: ServiceItem[]
  CustomAgencyServices?: ServiceItem[]
  GrossPrice?: number
  InvoiceDocuments?: BaseDocument[]
  IsAvailableForPayment?: boolean
  IsPayed?: boolean
  MergedServices?: ServiceItem[]
  NetPrice?: number
  PayToDate?: string
  PlaneDeliveryServices?: ServiceItem[]
  PortCustomAgencyServices?: ServiceItem[]
  PortWorkServices?: ServiceItem[]
  SupplyPaymentTaskDocuments?: BaseDocument[]
  TaskStatus?: TaskStatus
  TransportationServices?: ServiceItem[]
  VehicleDeliveryServices?: ServiceItem[]
  VehicleServices?: ServiceItem[]
}

export type OrganizationPaymentTasks = {
  SupplyPaymentTasks: SupplyPaymentTask[]
  Total: number
  TotalByRange: number
}

export type OrganizationPaymentTasksParams = {
  from: string
  organizationName: string
  serviceTypes: ServiceOrganizationTypeValue[]
  to: string
}

export type PaymentTaskRow = {
  amount?: number
  date?: string
  documentName?: string
  hasInvoice: boolean
  id: string
  isPayed: boolean
  number?: string
  serviceName?: string
  serviceType: ServiceOrganizationTypeValue
  serviceTypeLabel: string
  status?: TaskStatus
}
