export type EntityFields = {
  Created?: Date | string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: Date | string
}

export type NamedEntity = EntityFields & {
  Abbreviation?: string
  Code?: string
  FullName?: string
  LastName?: string
  Name?: string
  NameUA?: string
  Value?: string
  VendorCode?: string
}

export type SalesReturnCurrency = NamedEntity

export type SalesReturnOrganization = NamedEntity & {
  Address?: string
}

export type SalesReturnStorage = EntityFields & {
  ForDefective?: boolean
  Name?: string
  Organization?: SalesReturnOrganization | null
  OrganizationId?: number | null
}

export type SalesReturnAgreement = NamedEntity & {
  Currency?: SalesReturnCurrency | null
  FullName?: string
  Organization?: SalesReturnOrganization | null
  OrganizationId?: number
  WithVATAccounting?: boolean
}

export type SalesReturnClientAgreement = EntityFields & {
  Agreement?: SalesReturnAgreement | null
  Client?: SalesReturnClient | null
}

export type SalesReturnRegionCode = {
  Value?: string
}

export type SalesReturnClient = NamedEntity & {
  ClientAgreements?: SalesReturnClientAgreement[]
  RegionCode?: SalesReturnRegionCode | null
}

export type SalesReturnUser = NamedEntity

export type SalesReturnProduct = NamedEntity & {
  MainOriginalNumber?: string
}

export type SalesReturnSaleNumber = {
  Value?: string
}

export type SalesReturnPaymentStatus = {
  SalePaymentStatusType?: number
}

export type SalesReturnOrderItem = EntityFields & {
  Created?: Date | string
  IsSelected?: boolean
  Order?: SalesReturnOrder | null
  PricePerItem?: number
  Product?: SalesReturnProduct | null
  Qty?: number
  ReturnItemQty?: number
  ReturnItemStatus?: SalesReturnItemStatusValue
  ReturnItemToStorage?: SalesReturnStorage | null
  ReturnedQty?: number
  TotalAmount?: number
  TotalAmountLocal?: number
  User?: SalesReturnUser | null
}

export type SalesReturnOrder = EntityFields & {
  OrderItems?: SalesReturnOrderItem[]
  Sale?: SalesReturnSale | null
}

export type SalesReturnSale = EntityFields & {
  BaseSalePaymentStatus?: SalesReturnPaymentStatus | null
  ClientAgreement?: SalesReturnClientAgreement | null
  Created?: Date | string
  IsSaleExpanded?: boolean
  Order?: SalesReturnOrder | null
  SaleNumber?: SalesReturnSaleNumber | null
  TotalAmount?: number
  TotalAmountLocal?: number
  User?: SalesReturnUser | null
}

export type SalesReturnItem = EntityFields & {
  Amount?: number
  AmountLocal?: number
  OrderItem?: SalesReturnOrderItem | null
  Qty?: number
  SaleReturnItemStatus?: SalesReturnItemStatusValue
  Storage?: SalesReturnStorage | null
}

export type SalesReturn = EntityFields & {
  Client?: SalesReturnClient | null
  ClientAgreement?: SalesReturnClientAgreement | null
  CreatedBy?: SalesReturnUser | null
  Currency?: SalesReturnCurrency | null
  FromDate?: Date | string
  IsCanceled?: boolean
  Number?: string
  SaleReturnItems?: SalesReturnItem[]
  Storage?: SalesReturnStorage | null
  TotalAmount?: number
  TotalAmountLocal?: number
  TotalRowsQty?: number
}

export type SalesReturnsSearchParams = {
  from: string
  limit: number
  offset: number
  to: string
  value?: string
}

export type SalesForReturnSearchParams = {
  clientNetId?: string
  from: string
  organizationNetId?: string
  to: string
  value?: string
}

export type SalesReturnDocument = {
  DocumentURL?: string
  PdfDocumentURL?: string
  XlsxDocument?: string
  PdfDocument?: string
}

export type SalesReturnBatch = {
  AccountingGrossPrice?: number
  Currency?: string
  GrossPrice?: number
  IncomeInvoiceDate?: Date | string
  IncomeInvoiceNumber?: string
  IncomeQty?: number
  IncomeToStorageDate?: Date | string
  IncomeToStorageNumber?: string
  NetPrice?: number
  OrganizationName?: string
  RemainingQty?: number
  ReturnPrice?: number
  StorageName?: string
  SupplierName?: string
  UnitPriceLocal?: number
}

export type DirectSalesReturnProduct = {
  batch: SalesReturnBatch
  product: SalesReturnProduct
  qty: number
  status: SalesReturnItemStatusValue
}

export type CreateDirectSalesReturnPayload = {
  ClientAgreementId: number
  ClientId: number
  Products: Array<{
    Batch: SalesReturnBatch
    ProductId: number
    ReasoForReturn: SalesReturnItemStatusValue
    SpecificationQty: number
  }>
  StorageId: number
}

export type CreateSalesReturnPayload = {
  Client: SalesReturnClient
  SaleReturnItems: Array<{
    OrderItem: SalesReturnOrderItem
    Qty: number
    SaleReturnItemStatus: SalesReturnItemStatusValue
    Storage: SalesReturnStorage
  }>
}

export type ReturnOrderItemDraft = {
  orderItem: SalesReturnOrderItem
  qty: number
  status?: SalesReturnItemStatusValue
  storage?: SalesReturnStorage | null
}

export const SALE_RETURN_ITEM_STATUSES = [
  {
    value: 0,
    code: 'ProductArrivedNotAtTime',
    label: 'Товар прибув пізніше заявленого терміну',
  },
  {
    value: 1,
    code: 'NotFullDelivery',
    label: 'Доставка не в повному обсязі',
  },
  {
    value: 2,
    code: 'IncorectAssortment',
    label: 'Помилка підбору',
  },
  {
    value: 3,
    code: 'IncorectCrossCode',
    label: 'Неправильний крос-код',
  },
  {
    value: 4,
    code: 'ProductAbadon',
    label: 'Відмова від товару кінцевим покупцем',
  },
  {
    value: 5,
    code: 'IncorectQuality',
    label: 'Невідповідність очікуваній якості',
  },
  {
    value: 6,
    code: 'Defect',
    label: 'Брак',
  },
  {
    value: 7,
    code: 'ClientNotTookProduct',
    label: 'Клієнт не забрав товар',
  },
  {
    value: 8,
    code: 'SupplierWithDrawal',
    label: 'Відкликання виробником',
  },
] as const

export type SalesReturnItemStatusValue = (typeof SALE_RETURN_ITEM_STATUSES)[number]['value']
