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
  BasePricingId?: number
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
  ConsignmentId?: number
  PackingListPackageOrderItemId?: number
  Product?: Pick<Product, 'Id' | 'Name' | 'NameUA' | 'NetUid' | 'VendorCode'> | null
  ProductId?: number
  Qty?: number
  RowNumber?: string
  Storage?: {
    Id?: number
    Name?: string
  } | null
  StorageId?: number
  StorageNumber?: string
  SupplyOrderUkraineItemId?: number
}

export type ProductAvailability = EntityFields & {
  Amount?: number
  ProductId?: number
  Storage?: {
    Id?: number
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
  AddedBy?: {
    FirstName?: string
    LastName?: string
  } | null
  CustomsValue?: number | string
  Duty?: number | string
  DutyPercent?: number | string
  Name?: string
  ProductId?: number
  SpecificationCode?: string
  VATValue?: number | string
}

export type ProductAuditField =
  | 'Description'
  | 'Top'
  | 'Size'
  | 'Volume'
  | 'Weight'
  | 'PackingStandard'
  | 'MainOriginalNumber'
  | 'Notes'
  | 'Synonyms'

export type AuditEntityProperty = {
  Name?: string
  Value?: string
}

export type AuditEntity = EntityFields & {
  NewValues?: AuditEntityProperty[]
  OldValues?: AuditEntityProperty[]
  UpdatedBy?: string
  UpdatedByNetUid?: string
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
  AnalogueProducts?: unknown[]
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
  AccountingPrice?: number
  ClientName?: string
  Comment?: string
  Discount?: number
  DocumentFromDate?: string | Date
  DocumentNumber?: string
  DocumentType?: string
  FromDate?: string | Date
  IncomeDocumentFromDate?: string | Date
  IncomeDocumentNumber?: string
  IncomeQty?: number
  IsEdited?: boolean
  MovementType?: string
  OrganizationName?: string
  OutcomeQty?: number
  Price?: number
  ProductName?: string
  ProductVendorCode?: string
  Qty?: number
  Responsible?: string
  StorageName?: string
  UserName?: string
}

export type ProductIncomeMovement = EntityFields & {
  AccountingEurUnitPrice?: number
  AccountingGrossPrice?: number
  Currency?: string
  ExchangeRate?: number
  FromInvoiceDate?: Date | string
  FromInvoiceNumber?: string | number
  GrossPrice?: number
  IncomeInvoiceDate?: Date | string
  IncomeInvoiceNumber?: string | number
  IncomeQty?: number
  IncomeToStorageDate?: Date | string
  IncomeToStorageNumber?: string | number
  ManagementEurUnitPrice?: number
  NetPrice?: number
  OrganizationName?: string
  PriceDifference?: number
  RemainingQty?: number
  ReturnPrice?: number
  StorageName?: string
  SupplierName?: string
  TotalNetPrice?: number
  UnitPriceLocal?: number
  Weight?: number
}

export type ProductOutcomeMovement = EntityFields & {
  ClientName?: string
  DocumentNumber?: string | number
  DocumentTypeName?: string
  FromDate?: Date | string
  HasUpdateDataCarrier?: boolean
  OrganizationName?: string
  Price?: number
  Qty?: number
  ResponsibleName?: string
  StorageName?: string
}

export type ProductMovementsParams = {
  from: string
  movementType: number
  productNetId: string
  to: string
  types: number[]
}

export type ProductMovementExportParams = {
  from: string
  movementType: number
  productNetId: string
  to: string
  types: number[]
}

export type Storage = {
  Id?: number
  Name?: string
  NetUid?: string
}

export type ProductPlacementUploadConfiguration = {
  ColumnPlacement: number
  ColumnQty: number
  ColumnVendorCode: number
  EndRow: number
  StartRow: number
}

export type ProductPlacementStorage = EntityFields & {
  ErrorMessage?: string
  Placement?: string
  Product?: Pick<Product, 'Name' | 'NameUA' | 'NetUid' | 'VendorCode'> | null
  ProductId?: number
  Qty?: number
  StorageId?: number
  VendorCode?: string
}

export type ProductIncomeOutcomeMovementParams = {
  from: string
  productNetId: string
  to: string
}

export type ProductMovementExportDocument = {
  DocumentURL?: string
  PdfDocumentURL?: string
}

export type ProductRelatedUploadType = 'analogues' | 'components' | 'originalNumbers'

export type ProductFileUploadMode = 0 | 1 | 2

export type ProductFileUploadPriceConfiguration = {
  ColumnNumber: number
  PricingId: number
}

export type ProductFileUploadConfiguration = {
  DescriptionPL: number
  DescriptionRU: number
  DescriptionUA: number
  EndRow: number
  IsForSale: number
  IsForWeb: number
  MainOriginalNumber: number
  MeasureUnit: number
  Mode: ProductFileUploadMode
  NamePL: number
  NameRU: number
  NameUA: number
  NewVendorCode: number
  OrderStandard: number
  PackingStandard: number
  PriceConfigurations: ProductFileUploadPriceConfiguration[]
  ProductGroup: number
  Size: number
  StartRow: number
  Top: number
  UCGFEA: number
  VendorCode: number
  Volume: number
  Weight: number
  WithDescriptionPL: boolean
  WithDescriptionRU: boolean
  WithDescriptionUA: boolean
  WithIsForSale: boolean
  WithIsForWeb: boolean
  WithMainOriginalNumber: boolean
  WithMeasureUnit: boolean
  WithNamePL: boolean
  WithNameRU: boolean
  WithNameUA: boolean
  WithNewVendorCode: boolean
  WithOrderStandard: boolean
  WithPackingStandard: boolean
  WithPrices: boolean
  WithProductGroup: boolean
  WithSize: boolean
  WithTop: boolean
  WithUCGFEA: boolean
  WithVolume: boolean
  WithWeight: boolean
}

export type ProductUploadDocumentPayload = {
  analogueVendorCode?: string
  componentVendorCode?: string
  from: number
  isCleanBeforeLoading?: boolean
  originalNumber?: string
  qty?: number
  to: number
  vendorCode: string
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
