export type EntityFields = {
  Created?: Date | string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: Date | string
}

export type BasketSupplyWorkflowTab = 'cart' | 'sales' | 'recommendations' | 'dashboard'

export type BasketProduct = EntityFields & {
  MainOriginalNumber?: string
  Name?: string
  NameUA?: string
  VendorCode?: string
}

export type BasketUser = EntityFields & {
  FirstName?: string
  FullName?: string
  LastName?: string
  MiddleName?: string
  Name?: string
}

export type BasketClient = EntityFields & {
  Abbreviation?: string
  FullName?: string
  Name?: string
}

export type BasketClientAgreement = EntityFields & {
  Client?: BasketClient | null
  ClientId?: number
}

export type BasketSaleNumber = EntityFields & {
  Value?: string
}

export type BasketOrderItem = EntityFields & {
  Product?: BasketProduct | null
  Qty?: number
  TotalAmount?: number
  TotalAmountLocal?: number
  TotalWeight?: number
  User?: BasketUser | null
}

export type BasketOrder = EntityFields & {
  OrderItems?: BasketOrderItem[]
}

export type BasketSale = EntityFields & {
  ChangedToInvoice?: Date | string
  ClientAgreement?: BasketClientAgreement | null
  FromDate?: Date | string
  IsSelected?: boolean
  Order?: BasketOrder | null
  SaleNumber?: BasketSaleNumber | null
  TotalAmount?: number
  TotalAmountLocal?: number
  TotalRowsQty?: number
  User?: BasketUser | null
}

export const SUPPLY_ORDER_UKRAINE_CART_ITEM_PRIORITY = {
  Low: 1,
  High: 2,
  TIR: 3,
} as const

export type SupplyOrderUkraineCartItemPriority =
  (typeof SUPPLY_ORDER_UKRAINE_CART_ITEM_PRIORITY)[keyof typeof SUPPLY_ORDER_UKRAINE_CART_ITEM_PRIORITY]

export type SupplyOrderUkraineCartItem = EntityFields & {
  AvailableQty?: number
  ChangedQty?: number
  Coef?: number
  Comment?: string
  CreatedBy?: BasketUser | null
  CreatedById?: number
  FromDate?: Date | string
  IsDirty?: boolean
  IsError?: boolean
  IsFromFile?: boolean
  IsSelected?: boolean
  ItemPriority?: SupplyOrderUkraineCartItemPriority
  MaxQtyPerTF?: number
  NetWeight?: number
  PackageSize?: number
  Product?: BasketProduct | null
  ProductId?: number
  ReservedQty?: number
  Responsible?: BasketUser | null
  ResponsibleId?: number
  Supplier?: BasketClient | null
  SupplierId?: number
  TempQty?: string
  TotalAmount?: number
  TotalAmountLocal?: number
  TotalNetWeight?: number
  UnitPrice?: number
  UnitPriceLocal?: number
  UnpackedQty?: number
  UploadedQty?: number
}

export type PreviewCartItem = {
  AvailableQty?: number
  HasError?: boolean
  LessAvailable?: boolean
  NoCartItem?: boolean
  Product?: BasketProduct | null
  Qty?: number
  SupplyOrderUkraineCartItem?: SupplyOrderUkraineCartItem | null
  ZeroAvailable?: boolean
}

export type CartItemsParseConfiguration = {
  EndRow: number
  FromDateColumnNumber?: number
  GrossWeightColumnNumber?: number
  IsImportedProduct?: number
  IsWeightPerItem?: boolean
  PriorityColumnNumber?: number
  QtyColumnNumber: number
  SpecificationCodeColumnNumber?: number
  StartRow: number
  VendorCodeColumnNumber: number
  WeightColumnNumber?: number
  WithGrossWeight?: boolean
  WithIsImportedProduct?: boolean
  WithSpecificationCode?: boolean
  WithWeight?: boolean
}

export type CartItemsTotals = {
  TotalEuroAmount: number
  TotalPlnAmount: number
  TotalQty: number
  TotalWeight: number
}

export type TaxFreePackList = EntityFields & {
  Client?: BasketClient | null
  Comment?: string
  FromDate?: Date | string
  IsFromSale?: boolean
  IsSent?: boolean
  Number?: string
  Sales?: BasketSale[]
  SupplyOrderUkraineCartItems?: SupplyOrderUkraineCartItem[]
  TotalAmount?: number
  TotalAmountLocal?: number
  TotalWeight?: number
}

export const SAD_TYPES = {
  Sad: 0,
  TIR: 1,
} as const

export type SadTypeValue = (typeof SAD_TYPES)[keyof typeof SAD_TYPES]

export type SadItem = EntityFields & {
  Qty?: number
  SupplyOrderUkraineCartItem?: SupplyOrderUkraineCartItem | null
}

export type Sad = EntityFields & {
  Comment?: string
  FromDate?: Date | string
  IsFromSale?: boolean
  IsSend?: boolean
  Number?: string
  SadItems?: SadItem[]
  SadType?: SadTypeValue
  Sales?: BasketSale[]
  TotalAmount?: number
  TotalAmountLocal?: number
  TotalGrossWeight?: number
  TotalNetWeight?: number
  TotalQty?: number
}

export type BasketSupplyDocumentType = 'taxFree' | 'sad'

export type BasketSupplyDocumentState = {
  documentType: BasketSupplyDocumentType
  existingSadNetUid: string
  existingTaxFreeNetUid: string
  isSelectExistingDocument: boolean
  sadType: SadTypeValue
}

export type BasketSupplySalesFilters = {
  from: string
  to: string
  value: string
}

export type BasketSupplyFileUploadMode = 'load' | 'preview'

export type BasketSupplyUploadForm = {
  endRow: number | ''
  file: File | null
  fromDateColumnNumber: number | ''
  grossWeightColumnNumber: number | ''
  isImportedProductColumnNumber: number | ''
  isWeightPerItem: boolean
  priorityColumnNumber: number | ''
  qtyColumnNumber: number | ''
  specificationCodeColumnNumber: number | ''
  startRow: number | ''
  vendorCodeColumnNumber: number | ''
  weightColumnNumber: number | ''
  withGrossWeight: boolean
  withIsImportedProduct: boolean
  withSpecificationCode: boolean
  withWeight: boolean
}
