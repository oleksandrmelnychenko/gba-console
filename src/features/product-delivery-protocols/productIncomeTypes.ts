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

export type IncomeSupplyInvoiceOrderItem = EntityFields & {
  Product?: IncomeProduct | null
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
  Name?: string
}

export type IncomeProtocol = EntityFields & {
  DeliveryProductProtocolNumber?: ProtocolNumber | null
  FromDate?: Date | string
  Organization?: IncomeOrganization | null
  SupplyInvoices: IncomeSupplyInvoice[]
}

export type IncomeGridRow = {
  index: number
  item: PackingListPackageOrderItem
  rowsByColumn: Map<string, DynamicProductPlacementRow>
}
