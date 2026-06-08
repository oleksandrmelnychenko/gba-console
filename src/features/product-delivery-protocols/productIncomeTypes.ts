import type { EntityFields } from './types'

export type IncomeProductSpecification = EntityFields & {
  SpecificationCode?: string
  DutyPercent?: number
  CustomsValue?: number
}

export type IncomeMeasureUnit = EntityFields & {
  Name?: string
}

export type IncomeProduct = EntityFields & {
  VendorCode?: string
  Name?: string
  NameUA?: string
  MeasureUnit?: IncomeMeasureUnit | null
  ProductSpecifications?: IncomeProductSpecification[]
  ProductPlacements?: IncomeProductPlacement[]
}

export type IncomeProductPlacement = EntityFields & {
  StorageId?: number
  Storage?: IncomeStorage | null
  StorageNumber?: string
  RowNumber?: string
  CellNumber?: string
  Qty?: number
  Address?: string
}

export type IncomeStorage = EntityFields & {
  Name?: string
  Organization?: IncomeOrganization | null
}

export type IncomeSupplyOrderItem = EntityFields & {
  Number?: string
}

export type IncomeSupplyInvoiceOrderItem = EntityFields & {
  Product?: IncomeProduct | null
  SupplyOrderItem?: IncomeSupplyOrderItem | null
}

export type IncomeAuditEntityProperty = {
  Name?: string
  Value?: string
}

export type IncomeAuditEntity = EntityFields & {
  NewValues?: IncomeAuditEntityProperty[]
  OldValues?: IncomeAuditEntityProperty[]
  Type?: number | string
  UpdatedBy?: string
  UpdatedByNetUid?: string
}

export type DynamicProductPlacement = EntityFields & {
  IsApplied?: boolean
  Qty?: number
  StorageNumber?: string
  RowNumber?: string
  CellNumber?: string
  DynamicProductPlacementRowId?: number
}

export type DynamicProductPlacementRow = EntityFields & {
  Qty?: number
  PackingListPackageOrderItemId?: number
  DynamicProductPlacementColumnId?: number
  DynamicProductPlacements: DynamicProductPlacement[]
}

export type DynamicProductPlacementColumn = EntityFields & {
  FromDate?: Date | string
  PackingListId?: number
  DynamicProductPlacementRows: DynamicProductPlacementRow[]
}

export type PackingListPackageOrderItem = EntityFields & {
  Qty?: number
  PlacedQty?: number
  NetWeight?: number
  GrossWeight?: number
  UnitPrice?: number
  TotalNetPrice?: number
  VatPercent?: number
  Placement?: string
  IsReadyToPlaced?: boolean
  IsPlaced?: boolean
  ProductIsImported?: boolean
  SupplyInvoiceOrderItem?: IncomeSupplyInvoiceOrderItem | null
}

export type IncomePackingList = EntityFields & {
  No?: string
  PlNo?: string
  IsPlaced?: boolean
  IsSelected?: boolean
  TotalNetPrice?: number
  TotalCustomValue?: number
  TotalNetWeight?: number
  TotalGrossWeight?: number
  PackingListPackageOrderItems: PackingListPackageOrderItem[]
  DynamicProductPlacementColumns: DynamicProductPlacementColumn[]
}

export type IncomeSupplyOrder = EntityFields & {
  Number?: string
}

export type IncomeSupplyInvoice = EntityFields & {
  Number?: string
  IsPartiallyPlaced?: boolean
  IsFullyPlaced?: boolean
  IsSelected?: boolean
  TotalVatAmount?: number
  TotalNetPriceWithVat?: number
  SupplyOrder?: IncomeSupplyOrder | null
  PackingLists: IncomePackingList[]
}

export type ProtocolNumber = EntityFields & {
  Number?: string
}

export type IncomeOrganization = EntityFields & {
  Code?: string
  Name?: string
}

export type IncomeCurrency = EntityFields & {
  Code?: string
  Name?: string
}

export type IncomeAgreement = EntityFields & {
  Currency?: IncomeCurrency | null
  Name?: string
}

export type IncomeClientAgreement = EntityFields & {
  Agreement?: IncomeAgreement | null
}

export type IncomeClient = EntityFields & {
  FullName?: string
  Name?: string
}

export type IncomeUser = EntityFields & {
  FirstName?: string
  LastName?: string
  MiddleName?: string
  Name?: string
}

export type IncomeProductIncome = EntityFields & {
  FromDate?: Date | string
  Number?: string
  Storage?: IncomeStorage | null
  User?: IncomeUser | null
}

export type IncomeProtocol = EntityFields & {
  Client?: IncomeClient | null
  ClientAgreement?: IncomeClientAgreement | null
  DeliveryProductProtocolNumber?: ProtocolNumber | null
  FromDate?: Date | string
  IsCompleted?: boolean
  IsPartiallyPlaced?: boolean
  IsPlaced?: boolean
  Number?: string
  Organization?: IncomeOrganization | null
  SupplyOrderNumber?: ProtocolNumber | null
  SupplyInvoices: IncomeSupplyInvoice[]
}

export type IncomeGridRow = {
  index: number
  item: PackingListPackageOrderItem
  rowsByColumn: Map<string, DynamicProductPlacementRow>
}
