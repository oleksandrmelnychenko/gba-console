export type AccountingCashFlowMode = 'client' | 'supplier'

export type AccountingCashFlowDocument = {
  DocumentURL?: string
  PdfDocumentURL?: string
}

export type AccountingCashFlowCounterparty = {
  ClientAgreements?: AccountingCashFlowClientAgreement[]
  FullName?: string
  Id?: number
  Name?: string
  NetUid?: string
  SupplierName?: string
  [key: string]: unknown
}

export type AccountingCashFlowClientAgreement = {
  AccountBalance?: number
  Agreement?: AccountingCashFlowAgreement
  Id?: number
  NetUid?: string
  OriginalClientName?: string
  [key: string]: unknown
}

export type AccountingCashFlowAgreement = {
  AmountDebt?: number
  ClientInDebts?: AccountingCashFlowClientInDebt[]
  Currency?: {
    Code?: string
    Name?: string
  }
  Id?: number
  IsActive?: boolean
  IsControlAmountDebt?: boolean
  IsControlNumberDaysDebt?: boolean
  IsSelected?: boolean
  Name?: string
  NetUid?: string
  NumberDaysDebt?: number
  Organization?: {
    Name?: string
  }
  [key: string]: unknown
}

export type AccountingCashFlowClientInDebt = {
  Debt?: AccountingCashFlowDebt
  [key: string]: unknown
}

export type AccountingCashFlowDebt = {
  Days?: number
  Total?: number
  [key: string]: unknown
}

export type AccountingCashFlowAgreementDebtSummary = {
  accountBalance: number
  allowedDays: number
  debtLimit: number
  isControlAmountDebt: boolean
  isControlNumberDaysDebt: boolean
  isOverdue: boolean
  overdueDays: number
  totalOverdueDebt: number
}

export type AccountingCashFlowSaleReturn = {
  Client?: {
    FullName?: string
    RegionCode?: { Value?: string }
    [key: string]: unknown
  }
  ClientAgreement?: {
    Agreement?: { Name?: string }
    [key: string]: unknown
  }
  Number?: string
  SaleReturnItems?: AccountingCashFlowSaleReturnItem[]
  [key: string]: unknown
}

export type AccountingCashFlowSaleReturnItem = {
  AmountLocal?: number
  OrderItem?: {
    Order?: {
      Sale?: {
        IsVatSale?: boolean
        SaleNumber?: { Value?: string }
        [key: string]: unknown
      }
      [key: string]: unknown
    }
    Product?: {
      Name?: string
      VendorCode?: string
      [key: string]: unknown
    }
    [key: string]: unknown
  }
  Qty?: number
  SaleReturnItemStatus?: number | string
  Storage?: { Name?: string }
  VatAmountLocal?: number
  [key: string]: unknown
}

export type AccountingCashFlow = {
  AccountingCashFlowHeadItems: AccountingCashFlowHeadItem[]
  AfterRangeInAmount?: number
  AfterRangeInAmountEuro?: number
  AfterRangeOutAmount?: number
  AfterRangeOutAmountEuro?: number
  BeforeRangeBalance?: number
  BeforeRangeBalanceEuro?: number
  BeforeRangeInAmount?: number
  BeforeRangeInAmountEuro?: number
  BeforeRangeOutAmount?: number
  BeforeRangeOutAmountEuro?: number
  Client?: AccountingCashFlowCounterparty
  ClientAgreement?: AccountingCashFlowClientAgreement
  [key: string]: unknown
}

export type AccountingCashFlowHeadItem = {
  AccountingContainerPaymentTask?: unknown
  BillOfLadingService?: unknown
  ContainerService?: unknown
  ConsumablesOrder?: unknown
  CurrentBalance?: number
  CurrentBalanceEuro?: number
  CurrentValue?: number
  CustomAgencyService?: unknown
  CustomService?: unknown
  FromDate?: string
  IncomePaymentOrder?: unknown
  IsAccounting?: boolean
  IsCreditValue?: boolean
  MergedService?: unknown
  Name?: string
  Number?: string
  OrganizationName?: string
  OutcomePaymentOrder?: unknown
  PlaneDeliveryService?: unknown
  PortCustomAgencyService?: unknown
  PortWorkService?: unknown
  ProductIncome?: unknown
  Sale?: unknown
  SaleReturn?: unknown
  SupplyOrderPaymentDeliveryProtocol?: unknown
  SupplyOrderUkraine?: unknown
  SupplyOrderUkrainePaymentDeliveryProtocol?: unknown
  SupplyPaymentTask?: unknown
  TransportationService?: unknown
  Type?: number
  UpdatedReSaleModel?: unknown
  VehicleDeliveryService?: unknown
  VehicleService?: unknown
  [key: string]: unknown
}

export type AccountingCashFlowSearchParams = {
  from: string
  mode: AccountingCashFlowMode
  netId: string
  to: string
}

export type AccountingCashFlowExportParams = {
  from: string
  netId: string
  to: string
}
