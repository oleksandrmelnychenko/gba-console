export type EntityFields = {
  Created?: Date | string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: Date | string
}

export type WarehouseUkraineNumber = {
  Value?: string
}

export type WarehouseUkraineRegionCode = {
  Value?: string
}

export type WarehouseUkraineClient = EntityFields & {
  FullName?: string
  Name?: string
  RegionCode?: WarehouseUkraineRegionCode | null
  OriginalRegionCode?: string | null
}

export type WarehouseUkraineAgreement = EntityFields & {
  Name?: string
  Currency?: { Code?: string } | null
}

export type WarehouseUkraineClientAgreement = EntityFields & {
  Client?: WarehouseUkraineClient | null
  Agreement?: WarehouseUkraineAgreement | null
}

export type WarehouseUkraineUser = EntityFields & {
  FirstName?: string
  LastName?: string
  MiddleName?: string
  FullName?: string
  Name?: string
}

export type WarehouseUkraineTransporter = EntityFields & {
  Name?: string
}

export type WarehouseUkraineCustomersOwnTtn = {
  Number?: string
  TtnPDFPath?: string | null
}

export type WarehouseUkraineHistoryInvoiceEdit = {
  ApproveUpdate?: boolean
}

export type WarehouseUkraineShipmentDetails = EntityFields & {
  CashOnDeliveryAmount?: number
  City?: string
  Comment?: string
  Department?: string
  FullName?: string
  HasDocument?: boolean
  IsCashOnDelivery?: boolean
  MobilePhone?: string
  Number?: string
  ShipmentDate?: Date | string
  Transporter?: WarehouseUkraineTransporter | null
  TTN?: string
  TtnPDFPath?: string | null
  User?: WarehouseUkraineUser | null
}

export type WarehouseUkraineOrderItem = EntityFields & {
  Qty?: number
}

export type WarehouseUkraineOrder = EntityFields & {
  OrderItems?: WarehouseUkraineOrderItem[]
}

export type Sale = EntityFields & {
  SaleNumber?: WarehouseUkraineNumber | null
  ClientAgreement?: WarehouseUkraineClientAgreement | null
  RetailClient?: (EntityFields & { Name?: string; PhoneNumber?: string }) | null
  Order?: WarehouseUkraineOrder | null
  ChangedToInvoice?: Date | string
  TotalAmountLocal?: number
  Comment?: string
  TTN?: string
  Transporter?: WarehouseUkraineTransporter | null
  UpdateUser?: WarehouseUkraineUser | null
  User?: WarehouseUkraineUser | null
  UpdateDataCarrier?: unknown[]
  CustomersOwnTtn?: WarehouseUkraineCustomersOwnTtn | null
  HistoryInvoiceEdit?: WarehouseUkraineHistoryInvoiceEdit[]
  WarehousesShipment?: WarehouseUkraineShipmentDetails | null
  IsVatSale?: boolean
  IsInvoice?: boolean
  IsPrinted?: boolean
  IsPrintedActProtocolEdit?: boolean
  ShippingAmount?: number
  TotalRowsQty?: number
}

export type SalesResponse = {
  items: Sale[]
  totalQty: number
}

export type WarehouseUkraineSupplier = EntityFields & {
  FullName?: string
  Name?: string
}

export type WarehouseUkraineOrganization = EntityFields & {
  Name?: string
}

export type SupplyOrderUkraineItem = EntityFields & Record<string, unknown>

export type SupplyOrderUkraine = EntityFields & {
  Number?: string
  FromDate?: Date | string
  Supplier?: WarehouseUkraineSupplier | null
  ClientAgreement?: WarehouseUkraineClientAgreement | null
  SupplyOrderUkraineItems?: SupplyOrderUkraineItem[]
  Organization?: WarehouseUkraineOrganization | null
  IsPlaced?: boolean
  Responsible?: WarehouseUkraineUser | null
  TotalRowsQty?: number
}

export type SupplyOrdersResponse = {
  items: SupplyOrderUkraine[]
  totalQty: number
}

export type RegisterInvoicesResponse = {
  items: Sale[]
  totalQty: number
}

export type WarehouseUkraineStorage = EntityFields & {
  Name?: string
  Organization?: WarehouseUkraineOrganization | null
}

export type DocumentVerificationProduct = {
  VendorCode?: string
  NameUA?: string
}

export type DocumentVerificationItem = EntityFields & {
  Product?: DocumentVerificationProduct | null
  Storage?: WarehouseUkraineStorage | null
  StorageNumber?: string | number
  RowNumber?: string | number
  CellNumber?: string | number
  Qty?: number
  TotalRowQty?: number
}

export type DocumentVerificationResponse = {
  items: DocumentVerificationItem[]
  totalQty: number
}

export type EditingActItem = EntityFields & {
  Sale?: Sale | null
  IsDevelopment?: boolean
  ApproveUpdate?: boolean
  TotalRowsQty?: number
}

export type EditingItemsResponse = {
  items: EditingActItem[]
  totalQty: number
}

export type WarehouseUkraineExportDocument = {
  DocumentURL?: string
  PdfDocumentURL?: string
}
