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

export type ServiceOrganization = EntityFields & {
  Name?: string
  ServiceOrganizationTypes?: ServiceOrganizationTypeValue[]
}

export type DocumentFilter = 'invoice' | 'payed'

export type BaseDocument = EntityFields & {
  ContentType?: string
  DocumentURL?: string
  DocumentUrl?: string
  FileName?: string
  GeneratedName?: string
  PdfDocumentURL?: string
  PdfDocumentUrl?: string
  URL?: string
  Url?: string
  url?: string
}

export type BillOfLadingDocument = BaseDocument & {
  Amount?: number
  Date?: string
  Number?: string
}

export type ServiceItem = EntityFields & {
  AccountingGrossPrice?: number
  AccountingNetPrice?: number
  AccountingVat?: number
  AccountingVatPercent?: number
  ActProvidingServiceDocumentId?: number
  BillOfLadingDocument?: BillOfLadingDocument | null
  BillOfLadingDocumentId?: number
  BillOfLadingDocuments?: BillOfLadingDocument[]
  ContainerNumber?: string
  ContainerOrganization?: ServiceOrganization | null
  CustomAgencyOrganization?: ServiceOrganization | null
  CustomOrganization?: ServiceOrganization | null
  ExciseDutyOrganization?: ServiceOrganization | null
  FromDate?: string
  GrossPrice?: number
  InvoiceDocuments?: BaseDocument[]
  LoadDate?: string
  Name?: string
  NetPrice?: number
  Number?: string
  PlaneDeliveryOrganization?: ServiceOrganization | null
  PortCustomAgencyOrganization?: ServiceOrganization | null
  PortWorkOrganization?: ServiceOrganization | null
  ServiceNumber?: string
  ServiceDetailItems?: ServiceDetailItem[]
  SupplyCustomType?: 0 | 1
  SupplyOrganizationAgreement?: ServiceAgreement | null
  SupplyServiceAccountDocumentId?: number
  TermDeliveryInDays?: number
  TransportationOrganization?: ServiceOrganization | null
  Vat?: number
  VatPercent?: number
  VehicleDeliveryOrganization?: ServiceOrganization | null
  VehicleNumber?: string
  VehicleOrganization?: ServiceOrganization | null
}

export type ServiceAgreement = EntityFields & {
  Currency?: {
    Code?: string
    Name?: string
  } | null
  Name?: string
  Number?: string
  Organization?: ServiceOrganization | null
}

export type ServiceDetailItem = EntityFields & {
  GrossPrice?: number
  NetPrice?: number
  Qty?: number
  ServiceDetailItemKey?: {
    Name?: string
    Symbol?: string
  } | null
  UnitPrice?: number
  Vat?: number
  VatPercent?: number
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
  organizationId?: number
  organizationName: string
  organizationNetUid?: string
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
  service: ServiceItem
  serviceName?: string
  serviceType: ServiceOrganizationTypeValue
  serviceTypeLabel: string
  status?: TaskStatus
  task: SupplyPaymentTask
}
