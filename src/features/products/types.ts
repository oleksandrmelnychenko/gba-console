export type EntityFields = {
  Created?: Date | string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: Date | string
}

export type MeasureUnit = EntityFields & {
  Name?: string
}

export type Pricing = EntityFields & {
  Name?: string
}

export type ProductGroup = EntityFields & {
  FullName?: string
  Name?: string
}

export type ProductProductGroup = EntityFields & {
  ProductGroup?: ProductGroup | null
  ProductGroupId?: number
  ProductId?: number
}

export type OriginalNumber = EntityFields & {
  MainNumber?: string
  Number?: string
}

export type ProductOriginalNumber = EntityFields & {
  IsMainOriginalNumber?: boolean
  OriginalNumber?: OriginalNumber | null
  OriginalNumberId?: number
  ProductId?: number
}

export type ProductImage = EntityFields & {
  ContentType?: string
  FileName?: string
  ImageUrl?: string
  IsMainImage?: boolean
}

export type ProductPlacement = EntityFields & {
  CellNumber?: string
  ConsignmentItem?: {
    Consignment?: {
      ProductIncome?: {
        Number?: string
      } | null
    } | null
  } | null
  ConsignmentItemId?: number
  ProductId?: number
  Qty?: number
  RowNumber?: string
  StorageId?: number
  StorageNumber?: string
}

export type ProductAvailability = EntityFields & {
  Amount?: number
  Storage?: {
    Name?: string
    Organization?: {
      Name?: string
    } | null
    ProductPlacements?: ProductPlacement[]
  } | null
  StorageId?: number
}

export type ProductReservation = {
  SupplyOrderUkraineCartItem?: {
    ReservedQty?: number
  } | null
  TotalCartReservedPL?: number
  TotalCartReservedUK?: number
  TotalProductReSaleQty?: number
  TotalReservedPL?: number
  TotalReservedUK?: number
}

export type ProductSpecification = EntityFields & {
  CustomsValue?: number | string
  Duty?: number | string
  ProductId?: number
  SpecificationCode?: string
  VATValue?: number | string
}

export type CalculatedProductPrice = {
  DiscountPriceEUR?: number
  DiscountRate?: number
  PriceEUR?: number
  Pricing?: Pricing | null
  RetailPriceEUR?: number
  RetailPriceLocal?: number
}

export type Product = EntityFields & {
  AvailableDefectiveQtyUk?: number
  AvailableQtyRoad?: number
  AvailableQtyUk?: number
  AvailableQtyUkReSale?: number
  AvailableQtyUkVAT?: number
  BaseAnalogueProducts?: unknown[]
  BaseSetProducts?: unknown[]
  CalculatedPrices?: CalculatedProductPrice[]
  ComponentProducts?: unknown[]
  CurrentLocalPrice?: number
  CurrentLocalPriceReSale?: number
  CurrentLocalWithVatPrice?: number
  CurrentPrice?: number
  CurrentPriceEurToUah?: number
  CurrentPriceReSale?: number
  CurrentPriceReSaleEurToUah?: number
  CurrentWithVatPrice?: number
  Description?: string
  DescriptionUA?: string
  HasAnalogue?: boolean
  HasComponent?: boolean
  HasImage?: boolean
  Image?: string
  IsForSale?: boolean
  IsForWeb?: boolean
  IsForZeroSale?: boolean
  MainOriginalNumber?: string
  MeasureUnit?: MeasureUnit | null
  MeasureUnitId?: number
  Name?: string
  NameUA?: string
  Notes?: string
  NotesUA?: string
  OrderStandard?: string
  PackingStandard?: string
  ProductAvailabilities?: ProductAvailability[]
  ProductGroupNames?: string
  ProductImages?: ProductImage[]
  ProductOriginalNumbers?: ProductOriginalNumber[]
  ProductPricings?: unknown[]
  ProductProductGroups?: ProductProductGroup[]
  ProductSpecifications?: ProductSpecification[]
  Size?: string
  Standard?: string
  SynonymsUA?: string
  Top?: string
  UCGFEA?: string
  VendorCode?: string
  Volume?: string
  Weight?: number | null
}

export type ProductSearchMode = '0' | '1' | '2' | '3' | '4' | '5'
export type ProductSortMode = '0' | '1' | '2'

export type ProductSearchParams = {
  limit: number
  offset: number
  searchMode: ProductSearchMode
  sortMode: ProductSortMode
  value?: string
}

export type ProductStorageLocationHistory = EntityFields & {
  AdditionType?: number
  Placement?: string
  Product?: Pick<Product, 'Name' | 'NameUA' | 'NetUid' | 'VendorCode'> | null
  Qty?: number
  Storage?: {
    Name?: string
  } | null
  StorageLocationType?: number
  TotalRowsQty?: number
  User?: {
    FirstName?: string
    LastName?: string
  } | null
}

export type ProductStorageLocationHistoryParams = {
  from: string
  limit: number
  offset: number
  productNetId: string
  to: string
}

export type ProductConsignmentRemaining = EntityFields & {
  AccountingGrossPrice?: number
  CurrencyName?: string
  FromDate?: string | Date
  GrossPrice?: number
  InvoiceNumber?: string
  NetPrice?: number
  OrganizationName?: string
  Product?: Pick<Product, 'Name' | 'NameUA' | 'NetUid' | 'VendorCode'> | null
  ProductIncomeNumber?: string
  RemainingQty?: number
  StorageName?: string
  SupplierName?: string
  TotalNetPrice?: number
  Weight?: number
}

export type ProductMovement = EntityFields & {
  AccountingGrossPrice?: number
  ClientName?: string
  DocumentFromDate?: string | Date
  DocumentNumber?: string
  DocumentType?: string
  FromDate?: string | Date
  IncomeQty?: number
  IsEdited?: boolean
  MovementType?: string
  OutcomeQty?: number
  ProductName?: string
  ProductVendorCode?: string
  Qty?: number
  StorageName?: string
  UserName?: string
}

export type ProductMovementsParams = {
  from: string
  movementType: number
  productNetId: string
  to: string
  types: number[]
}

export type ProductWriteOffRule = EntityFields & {
  Product?: Pick<Product, 'Name' | 'NameUA' | 'NetUid' | 'VendorCode'> | null
  ProductGroup?: ProductGroup | null
  ProductGroupId?: number
  ProductId?: number
  RuleLocale?: string
  RuleType?: number
}

export type ProductWriteOffRulePayload = {
  Product?: Pick<Product, 'Id' | 'NetUid' | 'VendorCode'> | null
  ProductGroup?: Pick<ProductGroup, 'Id' | 'Name' | 'NetUid'> | null
  RuleLocale: string
  RuleType: number
}
