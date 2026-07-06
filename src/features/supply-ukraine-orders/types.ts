export type EntityFields = {
  Created?: Date | string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: Date | string
}

export type NamedEntity = EntityFields & {
  Code?: string
  FullName?: string
  Name?: string
}

export type Currency = NamedEntity

export type Client = NamedEntity & {
  ClientAgreements?: ClientAgreement[]
  IsNotResident?: boolean
  USREOU?: string
}

export type Agreement = NamedEntity & {
  Currency?: Currency | null
  FullName?: string
  Organization?: Organization | null
  OrganizationId?: number
}

export type ClientAgreement = EntityFields & {
  Agreement?: Agreement | null
  AgreementId?: number
  Client?: Client | null
}

export type User = NamedEntity & {
  FirstName?: string
  LastName?: string
  MiddleName?: string
}

export type SupplyPaymentTask = EntityFields & {
  Comment?: string
  GrossPrice?: number
  IsAccounting?: boolean
  IsAvailableForPayment?: boolean
  NetPrice?: number
  PayToDate?: Date | string | null
  TaskStatus?: number
  TaskStatusUpdated?: Date | string | null
  User?: User | null
  UserId?: number
}

export type SupplyOrderPaymentDeliveryProtocolKey = EntityFields & {
  Key?: string
}

export type SupplyOrderPaymentDeliveryProtocol = EntityFields & {
  Discount?: number
  IsAccounting?: boolean
  SupplyInvoiceId?: number
  SupplyOrderPaymentDeliveryProtocolKey?: SupplyOrderPaymentDeliveryProtocolKey | null
  SupplyOrderPaymentDeliveryProtocolKeyId?: number
  SupplyPaymentTask?: SupplyPaymentTask | null
  SupplyPaymentTaskId?: number
  User?: User | null
  UserId?: number
  Value?: number
}

export type SupplyInformationDeliveryProtocolKey = EntityFields & {
  IsDefault?: boolean
  Key?: string
  KeyAssignedTo?: number
  TransportationType?: SupplyTransportationTypeValue
}

export type SupplyInformationDeliveryProtocol = EntityFields & {
  IsDefault?: boolean
  SupplyInformationDeliveryProtocolKey?: SupplyInformationDeliveryProtocolKey | null
  SupplyInformationDeliveryProtocolKeyId?: number
  SupplyInvoiceId?: number
  User?: User | null
  UserId?: number
  Value?: string
}

export type Organization = NamedEntity & {
  Culture?: string
}

export type Product = NamedEntity & {
  MainOriginalNumber?: string
  NameUA?: string
  VendorCode?: string
}

export type SupplyOrderItem = EntityFields & {
  GrossWeight?: number
  IsError?: boolean
  IsPlaced?: boolean
  NetWeight?: number
  Product?: Product | null
  ProductId?: number
  QtyDifference?: number
  Qty?: number
  SupplyInvoiceOrderItems?: SupplyInvoiceOrderItem[]
  TotalAmount?: number
  TotalPrice?: number
  UnitPrice?: number
}

export type SupplyInvoiceOrderItem = EntityFields & {
  GrossUnitPrice?: number
  IsError?: boolean
  PackingListPackageOrderItems?: PackingListPackageOrderItem[]
  Product?: Product | null
  ProductId?: number
  ProductIsImported?: boolean
  Qty?: number
  QtyDifference?: number
  RowNumber?: number
  SupplyInvoice?: SupplyInvoice | null
  SupplyInvoiceId?: number
  SupplyOrderItem?: SupplyOrderItem | null
  SupplyOrderItemId?: number
  TotalAmount?: number
  UnitPrice?: number
  Weight?: number
}

export type PackingListPackageOrderItemSupplyService = EntityFields & {
  GeneralValue?: number
  GeneralValueEur?: number
  GeneralValueUah?: number
  ManagementValue?: number
  ManagementValueEur?: number
  ManagementValueUah?: number
  Name?: string
  NetValue?: number
  NetValueEur?: number
  NetValueUah?: number
}

export type PackingListPackageOrderItem = EntityFields & {
  AccountingTotalGrossPrice?: number
  AccountingTotalGrossPriceEur?: number
  GrossUnitPriceEur?: number
  GrossWeight?: number
  NetWeight?: number
  PackingList?: PackingList | null
  PackingListId?: number
  PackingListPackageId?: number
  PackingListPackageOrderItemSupplyServices?: PackingListPackageOrderItemSupplyService[]
  ProductIsImported?: boolean
  Qty?: number
  QtyDifferent?: number
  SupplyInvoiceOrderItem?: SupplyInvoiceOrderItem | null
  SupplyInvoiceOrderItemId?: number
  TotalGrossPrice?: number
  TotalGrossPriceEur?: number
  TotalGrossWeight?: number
  TotalNetPrice?: number
  TotalNetWeight?: number
  UnitPrice?: number
  UploadedQty?: number
}

export type PackingListPackage = EntityFields & {
  CBM?: number
  GrossWeight?: number
  Height?: number
  Lenght?: number
  NetWeight?: number
  PackingListPackageOrderItems?: PackingListPackageOrderItem[]
  Type?: number
  Width?: number
}

export type PackingList = EntityFields & {
  AccountingTotalGrossPrice?: number
  AccountingTotalGrossPriceEur?: number
  Comment?: string
  DynamicProductPlacementColumns?: unknown[]
  FromDate?: Date | string
  InvoiceDocuments?: SupplyInvoiceDeliveryDocument[]
  InvNo?: string
  IsDocumentsAdded?: boolean
  MarkNumber?: string
  MergedPackingLists?: PackingList[]
  No?: string
  PackingListBoxes?: PackingListPackage[]
  PackingListPackages?: PackingListPackage[]
  PackingListPackageOrderItems?: PackingListPackageOrderItem[]
  PackingListPallets?: PackingListPackage[]
  PlNo?: string
  RefNo?: string
  SupplyInvoiceId?: number
  TotalCustomValue?: number
  TotalDuty?: number
  TotalGrossPrice?: number
  TotalGrossPriceEur?: number
  TotalGrossWeight?: number
  TotalNetPrice?: number
  TotalNetWeight?: number
  TotalQuantity?: number
  TotalVatAmount?: number
}

export type SupplyInvoiceDeliveryDocument = EntityFields & {
  ContentType?: string
  Deleted?: boolean
  DocumentUrl?: string
  FileName?: string
  GeneratedName?: string
  PackingListId?: number
  SupplyInvoiceId?: number
  Type?: number
  Url?: string
}

export type SupplyOrderUkraineDocument = EntityFields & {
  ContentType?: string
  Deleted?: boolean
  DocumentUrl?: string
  FileName?: string
  Name?: string
}

export type SupplyInvoice = EntityFields & {
  Comment?: string
  DateCustomDeclaration?: Date | string | null
  DateFrom?: Date | string
  DeliveryAmount?: number
  DiscountAmount?: number
  InformationDeliveryProtocols?: SupplyInformationDeliveryProtocol[]
  InvoiceDocuments?: SupplyInvoiceDeliveryDocument[]
  IsFullyPlaced?: boolean
  MergedSupplyInvoices?: SupplyInvoice[]
  NetPrice?: number
  Number?: string
  NumberCustomDeclaration?: string
  PackingLists?: PackingList[]
  PaymentDeliveryProtocols?: SupplyOrderPaymentDeliveryProtocol[]
  SupplyOrganization?: SupplyServiceOrganization | null
  SupplyOrganizationAgreement?: SupplyServiceOrganizationAgreement | null
  SupplyOrganizationAgreementId?: number
  SupplyOrganizationId?: number
  SupplyInvoiceDeliveryDocuments?: SupplyInvoiceDeliveryDocument[]
  SupplyInvoiceOrderItems?: SupplyInvoiceOrderItem[]
  SupplyOrder?: DirectSupplyOrder | null
  TotalGrossWeight?: number
  TotalNetPrice?: number
  TotalNetWeight?: number
  TotalQuantity?: number
  TotalValueWithVat?: number
}

export type SupplyOrderDeliveryDocument = EntityFields & {
  Comment?: string
  ContentType?: string
  Deleted?: boolean
  DocumentUrl?: string
  FileName?: string
  IsProcessed?: boolean
  IsReceived?: boolean
  Name?: string
  ProcessedDate?: Date | string
}

export type CreditNoteDocument = SupplyOrderUkraineDocument & {
  Amount?: number
  Comment?: string
  FromDate?: Date | string
  Number?: string
}

export type SupplyProFormDocument = EntityFields & {
  Comment?: string
  ContentType?: string
  Deleted?: boolean
  DocumentUrl?: string
  FileName?: string
  GeneratedName?: string
  Name?: string
  SupplyProFormId?: number | string
}

export type SupplyProForm = EntityFields & {
  DateFrom?: Date | string
  IsSkipped?: boolean
  NetPrice?: number
  Number?: string
  ProFormDocuments?: SupplyProFormDocument[]
  ServiceNumber?: string
  SupplyInformationProtocols?: EntityFields[]
  SupplyPaymentProtocols?: EntityFields[]
}

export type DirectSupplyOrder = EntityFields & {
  AdditionalPercent?: number
  Client?: Client | null
  ClientAgreement?: ClientAgreement | null
  DateFrom?: Date | string
  IsApproved?: boolean
  IsCompleted?: boolean
  IsFullyPlaced?: boolean
  IsOrderArrived?: boolean
  IsOrderShipped?: boolean
  IsPlaced?: boolean
  NetPrice?: number
  OrderArrivedDate?: Date | string
  OrderShippedDate?: Date | string
  Organization?: Organization | null
  Responsible?: User | null
  CreditNoteDocuments?: CreditNoteDocument[]
  SupplyOrderDeliveryDocuments?: SupplyOrderDeliveryDocument[]
  SupplyOrderItems?: SupplyOrderItem[]
  SupplyInvoices?: SupplyInvoice[]
  SupplyProForm?: SupplyProForm | null
  SupplyOrderNumber?: { Number?: string } | null
  SupplyProFormId?: number | string | null
  TotalNetPrice?: number
  TotalQuantity?: number
  TotalRowsQty?: number
  TotalVat?: number
  TransportationType?: SupplyTransportationTypeValue
}

export type SupplyOrderUkraineItem = EntityFields & Record<string, unknown> & {
  VatPercent?: number
  VatPercentStore?: number
  isChanged?: boolean
}

export type SupplyServiceOrganizationAgreement = EntityFields & {
  Currency?: Currency | null
  Name?: string
  Number?: string
}

export type SupplyServiceOrganization = NamedEntity & {
  SupplyOrganizationAgreements?: SupplyServiceOrganizationAgreement[]
}

export type SupplyServiceConsumableProduct = NamedEntity

export type ProductDeliveryExpense = EntityFields & {
  AccountingGrossAmount?: number
  AccountingVatPercent?: number
  ConsumableProduct?: SupplyServiceConsumableProduct | null
  ConsumableProductId?: number
  FromDate?: Date | string
  GrossAmount?: number
  InvoiceNumber?: string
  SupplyOrderUkraineId?: number
  SupplyOrganization?: SupplyServiceOrganization | null
  SupplyOrganizationAgreement?: SupplyServiceOrganizationAgreement | null
  SupplyOrganizationAgreementId?: number
  SupplyOrganizationId?: number
  VatPercent?: number
}

export type SupplyOrderUkraineSad = EntityFields & {
  Client?: Client | null
  OrganizationClient?: NamedEntity | null
  SadType?: number
}

export type SupplyOrderUkraine = EntityFields & {
  AdditionalPercent?: number
  ClientAgreement?: ClientAgreement | null
  DeliveryExpenses?: ProductDeliveryExpense[]
  ExchangeRateAmount?: number
  InvDate?: Date | string
  InvNumber?: string
  IsDirectFromSupplier?: boolean
  IsPlaced?: boolean
  Number?: string
  FromDate?: Date | string
  Organization?: Organization | null
  Responsible?: User | null
  Sad?: SupplyOrderUkraineSad | null
  Supplier?: Client | null
  SupplyOrderUkraineDocuments?: SupplyOrderUkraineDocument[]
  SupplyOrderUkraineItems?: SupplyOrderUkraineItem[]
  TotalAccountingGrossPrice?: number
  TotalAccountingGrossPriceLocal?: number
  TotalDeliveryExpenseAmount?: number
  TotalAccountingDeliveryExpenseAmount?: number
  TotalGrossPriceLocal?: number
  TotalGrossWeight?: number
  TotalNetPriceLocal?: number
  TotalNetPriceLocalWithVat?: number
  TotalNetWeight?: number
  TotalQty?: number
  TotalRowsQty?: number
  TotalVatAmount?: number
  VatPercent?: number
}

export type SupplyUkraineOrderKind = 'all' | 'direct' | 'toUkraine'

export type SupplyUkraineOrdersSearchParams = {
  currencyId?: string
  from: string
  limit: number
  offset: number
  supplierName?: string
  to: string
}

export type SupplyUkraineOrdersResponse<TOrder> = {
  items: TOrder[]
  totalQty: number
}

export type SupplyOrderPrintColumn = {
  ColumnName: string
  Number: number
  TableName: string
  Translate: string
}

export type SupplyOrderPrintDocument = {
  DocumentURL?: string
  PdfDocumentURL?: string
}

export type SupplyTransportationTypeValue = 0 | 1 | 2

export type SupplyOrderDocumentParseConfiguration = {
  EndRow: number
  GrossWeightColumnNumber: number
  IsWeightPerUnit: boolean
  NetWeightColumnNumber: number
  ProductIsImported: boolean
  QtyColumnNumber: number
  StartRow: number
  TotalAmountColumnNumber: number
  UnitPriceColumnNumber: number
  VendorCodeColumnNumber: number
  WithGrossWeight: boolean
  WithNetWeight: boolean
  WithTotalAmount: boolean
}

export type UkraineOrderFromSupplierParseConfiguration = {
  EndRow: number
  GrossWeightColumnNumber: number
  IsImportedProduct: number
  IsPricePerItem: boolean
  IsWeightPerItem: boolean
  QtyColumnNumber: number
  SpecificationCodeColumnNumber: number
  StartRow: number
  TotalAmountColumnNumber: number
  UnitPriceColumnNumber: number
  VendorCodeColumnNumber: number
  WeightColumnNumber: number
  WithTotalAmount: boolean
  WithGrossWeight: boolean
  WithIsImportedProduct: boolean
  WithSpecificationCode: boolean
  WithWeight: boolean
}

export type PackingListDocumentParseConfiguration = {
  EndRow: number
  GrossWeightColumnNumber: number
  IsWeightPerUnit: boolean
  NetWeightColumnNumber: number
  QtyColumnNumber: number
  StartRow: number
  TotalAmountColumnNumber: number
  UnitPriceColumnNumber: number
  VendorCodeColumnNumber: number
  WithGrossWeight: boolean
  WithNetWeight: boolean
  WithTotalAmount: boolean
}

export type DirectSupplyOrderCreatePayload = {
  Client: Client
  ClientAgreement: ClientAgreement
  Comment?: string
  DateFrom: string
  Organization: Organization
  TransportationType: SupplyTransportationTypeValue
}

export type SupplyOrderUkraineSupplierCreatePayload = {
  ClientAgreement: ClientAgreement
  Comment?: string
  FromDate: string
  InvDate: string
  InvNumber?: string
  IsDirectFromSupplier: boolean
  Organization: Organization
  Supplier: Client
}

export type SupplyOrderFromFileResponse = {
  HasError?: boolean
  MissingVendorCodes?: string[]
  MissingVendorCodesFileUrl?: string
  SupplyOrder?: DirectSupplyOrder | null
}

export type SupplyOrderUkraineFromFileResponse = {
  HasError?: boolean
  MissingVendorCodes?: string[]
  MissingVendorCodesFileUrl?: string
  SupplyOrderUkraine?: SupplyOrderUkraine | null
}

export type SupplyOrderInvoiceTotals = {
  TotalInvoiceQty?: number
  TotalInvoiceValue?: number
  TotalOrderQty?: number
  TotalOrderValue?: number
  [key: string]: unknown
}

export type SupplyUkraineOrdersFilter = {
  currencyId: string
  from: string
  supplier: string
  to: string
  type: SupplyUkraineOrderKind
}

export type SupplyUkraineOrderRowKind = 'direct' | 'invoice' | 'toUkraine'

export type SupplyUkraineOrderRow = {
  additionalPercent?: number
  agreement?: string
  createdDate?: Date | string
  currency?: string
  directOrder?: DirectSupplyOrder
  grossPrice?: number
  index: number
  invoice?: SupplyInvoice
  invoiceDate?: Date | string
  invoiceNumber?: string
  isPlaced?: boolean
  kind: SupplyUkraineOrderRowKind
  netUid?: string
  number?: string
  order?: SupplyOrderUkraine
  orderDate?: Date | string
  organization?: string
  qty?: number
  responsible?: string
  supplier?: string
}
