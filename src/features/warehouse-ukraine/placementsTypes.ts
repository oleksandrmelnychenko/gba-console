import type { EntityFields } from './types'

export type PlacementProduct = {
  Id?: number
  VendorCode?: string
  Name?: string
  NameUA?: string
  MeasureUnit?: PlacementMeasureUnit | null
  ProductPlacements?: PlacementProductPlacement[]
}

export type PlacementMeasureUnit = EntityFields & {
  Name?: string
}

export type PlacementProductSpecification = EntityFields & {
  SpecificationCode?: string
}

export type PlacementProductPlacement = EntityFields & {
  StorageId?: number
  Storage?: PlacementStorage | null
  StorageNumber?: string
  RowNumber?: string
  CellNumber?: string
  Qty?: number
  Address?: string
}

export type PlacementStorage = EntityFields & {
  Name?: string
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
  SupplyOrderUkraineItemId?: number
  DynamicProductPlacementColumnId?: number
  DynamicProductPlacements: DynamicProductPlacement[]
}

export type DynamicProductPlacementColumn = EntityFields & {
  FromDate?: Date | string
  SupplyOrderUkraineId?: number
  DynamicProductPlacementRows: DynamicProductPlacementRow[]
}

export type PlacementOrderItem = EntityFields & {
  AccountingDeliveryExpenseAmount?: number
  AccountingGrossPriceLocal?: number
  DeliveryExpenseAmount?: number
  GrossPriceLocal?: number
  GrossWeight?: number
  IsFullyPlaced?: boolean
  ManagementCost?: number
  NetPriceLocal?: number
  Qty?: number
  PlacedQty?: number
  NotOrdered?: boolean
  NetWeight?: number
  ProductIsImported?: boolean
  ProductSpecification?: PlacementProductSpecification | null
  TotalGrossWeight?: number
  TotalNetWeight?: number
  UnitPrice?: number
  UnitPriceLocal?: number
  VatAmountLocal?: number
  VatPercent?: number
  ProductId?: number
  Product?: PlacementProduct | null
}

export type PlacementSupplyOrder = EntityFields & {
  Number?: string
  FromDate?: Date | string
  IsPlaced?: boolean
  TotalNetWeight?: number
  Supplier?: { FullName?: string } | null
  SupplyOrderUkraineItems: PlacementOrderItem[]
  DynamicProductPlacementColumns: DynamicProductPlacementColumn[]
}

export type PlacementGridRow = {
  index: number
  item: PlacementOrderItem
  rowsByColumn: Map<string, DynamicProductPlacementRow>
}
