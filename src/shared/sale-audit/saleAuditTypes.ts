export const SaleAuditShiftStatusType = {
  Store: 0,
  Bill: 1,
} as const

export type SaleAuditPrintDocument = {
  DocumentURL?: string
  PdfDocumentURL?: string
}

export type SaleAuditProduct = {
  Name?: string
  VendorCode?: string
  MainOriginalNumber?: string
}

export type SaleAuditUser = {
  FirstName?: string
  LastName?: string
}

export type SaleAuditShiftStatus = {
  Id?: number
  NetUid?: string
  Created?: Date | string
  ShiftStatus?: number
  Qty?: number
  User?: SaleAuditUser
  HistoryInvoiceEditId?: number
}

export type SaleAuditOrderItem = {
  Id?: number
  NetUid?: string
  Product?: SaleAuditProduct
  ShiftStatuses?: SaleAuditShiftStatus[]
}

export type SaleAuditExchangeRate = {
  Id?: number
  NetUid?: string
  ExchangeRate?: {
    Code?: string
    Amount?: number
  }
}

export type SaleAuditLifeCycleLineItem = {
  Value?: string
  IsActive?: boolean
  Updated?: Date | string
}

export type SaleAuditHistoryEdit = {
  Id?: number
  NetUid?: string
  IsDevelopment?: boolean
  ApproveUpdate?: boolean
}

export type SaleAuditSale = {
  NetUid?: string
  HistoryInvoiceEdit?: SaleAuditHistoryEdit[]
  Order?: {
    OrderItems?: SaleAuditOrderItem[]
  }
}

export type SaleAuditStatistic = {
  NetUid?: string
  Sale?: SaleAuditSale
  LifeCycleLine?: SaleAuditLifeCycleLineItem[]
  SaleExchangeRates?: SaleAuditExchangeRate[]
}
