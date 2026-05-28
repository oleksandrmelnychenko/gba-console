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
  Currency?: {
    Code?: string
    Name?: string
  }
  Id?: number
  IsActive?: boolean
  Name?: string
  NetUid?: string
  Organization?: {
    Name?: string
  }
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
