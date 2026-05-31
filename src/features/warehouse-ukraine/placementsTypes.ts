import type { EntityFields } from './types'

export type PlacementProduct = {
  Id?: number
  VendorCode?: string
  Name?: string
  NameUA?: string
  ProductPlacements?: PlacementProductPlacement[]
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
  IsFullyPlaced?: boolean
  Qty?: number
  PlacedQty?: number
  NotOrdered?: boolean
  NetWeight?: number
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
