export type EntityFields = {
  Created?: string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: string
}

export type NamedEntity = EntityFields & {
  Code?: string
  FullName?: string
  IsNotResident?: boolean
  LastName?: string
  MeasureUnit?: NamedEntity | null
  Name?: string
  NameUA?: string
  Number?: string
  VendorCode?: string
}

export type ProductIncomeStorage = NamedEntity & {
  Organization?: NamedEntity | null
}

export type ProductIncomeProduct = NamedEntity

export type ProductIncomeItem = EntityFields & {
  ActReconciliationItem?: {
    ActReconciliation?: {
      InvNumber?: string
      InvDate?: string
      FromDate?: string
      NetUid?: string
      SupplyInvoice?: {
        SupplyOrder?: {
          Client?: NamedEntity | null
          Organization?: NamedEntity | null
        } | null
      } | null
      SupplyOrderUkraine?: {
        FromDate?: string
        InvDate?: string
        InvNumber?: string
        Organization?: NamedEntity | null
        Supplier?: NamedEntity | null
      } | null
    } | null
    Comment?: string
    NetWeight?: number
    Product?: ProductIncomeProduct | null
    TotalAmount?: number
    UnitPrice?: number
  } | null
  Comment?: string
  ConsignmentItems?: Array<{
    ProductSpecification?: {
      CustomsValue?: number
      DutyPercent?: number
      SpecificationCode?: string
    } | null
  }>
  PackingListPackageOrderItem?: {
    ConsignmentItems?: Array<{
      ProductSpecification?: {
        CustomsValue?: number
        DutyPercent?: number
        SpecificationCode?: string
      } | null
    }>
    ExchangeRateAmount?: number
    PackingList?: ProductIncomePackingList | null
    ProductIsImported?: boolean
    ProductPlacements?: ProductIncomePlacement[]
    Qty?: number
    SupplyInvoiceOrderItem?: {
      Product?: ProductIncomeProduct & {
        MeasureUnit?: NamedEntity | null
      } | null
    } | null
    TotalGrossWeight?: number
    TotalNetPrice?: number
    TotalNetWeight?: number
    UnitPrice?: number
    VatAmount?: number
    VatPercent?: number
  } | null
  Product?: ProductIncomeProduct | null
  ProductCapitalizationItem?: {
    ProductCapitalization?: {
      Comment?: string
      FromDate?: string
      NetUid?: string
      Number?: string
      Organization?: NamedEntity | null
    } | null
  } | null
  Qty?: number
  SaleReturnItem?: {
    Amount?: number
    AmountLocal?: number
    Comment?: string
    OrderItem?: {
      Order?: {
        Sale?: {
          ClientAgreement?: {
            Agreement?: {
              Currency?: NamedEntity | null
              Name?: string
              Organization?: NamedEntity | null
              WithVATAccounting?: boolean
            } | null
          } | null
        } | null
      } | null
      Product?: ProductIncomeProduct | null
    } | null
    Qty?: number
    SaleReturn?: {
      Client?: NamedEntity | null
      FromDate?: string
      IsCanceled?: boolean
      NetUid?: string
      Number?: string
    } | null
    VatAmount?: number
  } | null
  SupplyOrderUkraineItem?: {
    GrossPriceLocal?: number
    NetPriceLocal?: number
    PlacedQty?: number
    Product?: ProductIncomeProduct | null
    ProductIsImported?: boolean
    ProductSpecification?: {
      CustomsValue?: number
      DutyPercent?: number
      SpecificationCode?: string
    } | null
    Qty?: number
    SupplyOrderUkraine?: {
      ClientAgreement?: {
        Agreement?: {
          Currency?: NamedEntity | null
          Name?: string
        } | null
      } | null
      Comment?: string
      FromDate?: string
      InvDate?: string
      InvNumber?: string
      NetUid?: string
      Number?: string
      Organization?: NamedEntity | null
      Supplier?: NamedEntity | null
    } | null
    TotalGrossWeight?: number
    TotalNetWeight?: number
    UnitPriceLocal?: number
    VatAmountLocal?: number
    VatPercent?: number
  } | null
}

export type ProductIncomeDocument = EntityFields & {
  Comment?: string
  Currency?: NamedEntity | null
  FromDate?: string
  Number?: string
  ProductIncomeItems?: ProductIncomeItem[]
  Storage?: ProductIncomeStorage | null
  TotalNetPrice?: number
  TotalNetWeight?: number
  TotalNetWithVat?: number
  TotalQty?: number
  TotalRowQty?: number
  TotalRowsQty?: number
  TotalVatAmount?: number
  User?: NamedEntity | null
}

export type ProductIncomeDocumentsSearchParams = {
  from: string
  limit: number
  offset: number
  to: string
  value?: string
}

export type ProductIncomeDocumentsResponse = {
  Items: ProductIncomeDocument[]
  Total?: number
}

export type ProductIncomeDocumentsExportDocument = {
  DocumentURL?: string
  PdfDocumentURL?: string
  URL?: string
  XlsxDocument?: string
  PdfDocument?: string
  url?: string
}

export type ProductIncomeInfo = EntityFields & {
  Comment?: string
  Currency?: NamedEntity | null
  ExchangeRateToUah?: number
  FromDate?: string
  Number?: string
  Organization?: NamedEntity | null
  PackingList?: ProductIncomePackingList | null
  ProductIncomeItems?: ProductIncomeItem[]
  Storage?: ProductIncomeStorage | null
  TotalGrossPrice?: number
  TotalGrossWeight?: number
  TotalNetPrice?: number
  TotalNetWeight?: number
  TotalNetWithVat?: number
  TotalQty?: number
  TotalVatAmount?: number
  User?: NamedEntity | null
}

export type ProductIncomePlacement = EntityFields & {
  Address?: string
  CellNumber?: string
  IsApplied?: boolean
  Placement?: string
  Qty?: number
  RowNumber?: string
  Storage?: ProductIncomeStorage | null
  StorageNumber?: string
}

export type ProductIncomePackingList = EntityFields & {
  InvNo?: string
  IsPlaced?: boolean
  Number?: string
  TotalGrossWeight?: number
  TotalNetPrice?: number
  TotalNetPriceWithVat?: number
  TotalNetWeight?: number
  TotalQuantity?: number
  TotalVatAmount?: number
  SupplyInvoice?: {
    Comment?: string
    Created?: string
    DateCustomDeclaration?: string
    DateFrom?: string
    IsFullyPlaced?: boolean
    IsPartiallyPlaced?: boolean
    Number?: string
    SupplyOrder?: {
      Client?: NamedEntity | null
      ClientAgreement?: {
        Agreement?: {
          Currency?: NamedEntity | null
          Name?: string
        } | null
      } | null
      DateFrom?: string
      Organization?: NamedEntity | null
      SupplyOrderNumber?: {
        Number?: string
      } | null
    } | null
  } | null
}

export type RemainingConsignment = EntityFields & {
  AccountingGrossPrice?: number
  CurrencyName?: string
  FromDate?: string
  GrossPrice?: number
  InvoiceNumber?: string
  NetPrice?: number
  OrganizationName?: string
  Product?: ProductIncomeProduct | null
  ProductIncomeNumber?: string
  RemainingQty?: number
  StorageName?: string
  SupplierName?: string
  TotalNetPrice?: number
  Weight?: number
}
