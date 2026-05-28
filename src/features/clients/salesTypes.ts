import type { Agreement, ClientAgreement, Currency, Organization } from './types'

export const SaleOrderSource = {
  Shop: 0,
  Local: 1,
  Offer: 2,
} as const

export type SaleOrderSourceValue = (typeof SaleOrderSource)[keyof typeof SaleOrderSource]

export const SaleLifeCycleType = {
  New: 0,
  Packaging: 1,
  Packaged: 2,
  Shipping: 3,
  Received: 4,
  Await: 5,
  All: 6,
  OrderClosed: 100,
  TransporterChanged: 101,
  InvoiceChanged: 102,
} as const

export type SaleLifeCycleTypeValue = (typeof SaleLifeCycleType)[keyof typeof SaleLifeCycleType]

export const SalePaymentStatusType = {
  NotPaid: 0,
  Paid: 1,
  Overpaid: 2,
  PartialPaid: 3,
  Refund: 4,
} as const

export type SalePaymentStatusTypeValue = (typeof SalePaymentStatusType)[keyof typeof SalePaymentStatusType]

export const SaleShiftStatusType = {
  Full: 0,
  Partial: 1,
  None: 2,
} as const

export type SaleShiftStatusTypeValue = (typeof SaleShiftStatusType)[keyof typeof SaleShiftStatusType]

export const OrderItemShiftStatusType = {
  Store: 0,
  Bill: 1,
} as const

export type OrderItemShiftStatusTypeValue = (typeof OrderItemShiftStatusType)[keyof typeof OrderItemShiftStatusType]

export type SaleUser = {
  Id?: number
  NetUid?: string
  FirstName?: string
  LastName?: string
  MiddleName?: string
}

export type SaleProduct = {
  Id?: number
  NetUid?: string
  VendorCode?: string
  MainOriginalNumber?: string
  Name?: string
}

export type SaleNumber = {
  Id?: number
  NetUid?: string
  Value?: string
  OrganizationId?: number
  Organization?: Organization
}

export type BaseLifeCycleStatus = {
  Id?: number
  NetUid?: string
  SaleLifeCycleType?: SaleLifeCycleTypeValue
}

export type BaseSalePaymentStatus = {
  Id?: number
  NetUid?: string
  SalePaymentStatusType?: SalePaymentStatusTypeValue
  Amount?: number
}

export type SaleBaseShiftStatus = {
  Id?: number
  NetUid?: string
  ShiftStatus?: SaleShiftStatusTypeValue
  Comment?: string
}

export type OrderItemBaseShiftStatus = {
  Id?: number
  NetUid?: string
  Created?: Date | string
  ShiftStatus?: OrderItemShiftStatusTypeValue
  Comment?: string
  Qty?: number
  OrderItemId?: number
  User?: SaleUser
  HistoryInvoiceEditId?: number
}

export type SaleOrderItem = {
  Id?: number
  NetUid?: string
  Created?: Date | string
  OrderId?: number
  ProductId?: number
  Product?: SaleProduct
  Qty?: number
  OrderedQty?: number
  PricePerItem?: number
  TotalAmount?: number
  TotalAmountLocal?: number
  TotalAmountEurToUah?: number
  Discount?: number
  OneTimeDiscount?: number
  Comment?: string
  TotalWeight?: number
  UserId?: number
  User?: SaleUser
  ShiftStatuses?: OrderItemBaseShiftStatus[]
}

export type SaleOrder = {
  Id?: number
  NetUid?: string
  OrderSource?: SaleOrderSourceValue
  OrderItems?: SaleOrderItem[]
  UserId?: number
  User?: SaleUser
  ClientAgreementId?: number
  ClientAgreement?: ClientAgreement
  TotalCount?: number
  TotalAmount?: number
  TotalAmountLocal?: number
  TotalAmountEurToUah?: number
  TotalVat?: number
}

export type Transporter = {
  Id?: number
  NetUid?: string
  Name?: string
}

export type Sale = {
  [key: string]: unknown
  Id?: number
  NetUid?: string
  Created?: Date | string
  Updated?: Date | string
  ChangedToInvoice?: Date | string
  FromDate?: Date | string
  ShipmentDate?: Date | string
  Comment?: string
  OrderId?: number
  Order?: SaleOrder
  UserId?: number
  User?: SaleUser
  UpdateUser?: SaleUser
  ClientAgreementId?: number
  ClientAgreement?: ClientAgreement
  Agreement?: Agreement
  TotalAmount?: number
  TotalAmountLocal?: number
  TotalAmountEurToUah?: number
  TotalCount?: number
  BaseLifeCycleStatusId?: number
  BaseLifeCycleStatus?: BaseLifeCycleStatus
  BaseSalePaymentStatusId?: number
  BaseSalePaymentStatus?: BaseSalePaymentStatus
  ShiftStatusId?: number
  ShiftStatus?: SaleBaseShiftStatus
  SaleNumberId?: number
  SaleNumber?: SaleNumber
  Transporter?: Transporter
  TransporterId?: number
  InputSaleMerges?: unknown[]
  IsVatSale?: boolean
  IsPrinted?: boolean
  IsCashOnDelivery?: boolean
  HasDocuments?: boolean
  IsSent?: boolean
  IsLocked?: boolean
  ExpiredDays?: number
  HistoryInvoiceEdit?: SaleHistoryInvoiceEdit[]
}

export type SaleHistoryInvoiceEdit = {
  Id?: number
  NetUid?: string
}

export type ExchangeRate = {
  Id?: number
  NetUid?: string
  Code?: string
  Currency?: string
  Culture?: string
  Amount?: number
}

export type SaleExchangeRate = {
  Id?: number
  NetUid?: string
  SaleId?: number
  ExchangeRateId?: number
  Value?: number
  ExchangeRate?: ExchangeRate
  Currency?: Currency
}

export type SaleLifeCycleLineItem = {
  Value?: string
  IsActive?: boolean
  Updated?: Date | string
}

export type SaleStatistic = {
  Id?: number
  NetUid?: string
  Sale?: Sale
  SaleReturn?: SaleReturn
  LifeCycleLine?: SaleLifeCycleLineItem[]
  SaleExchangeRates?: SaleExchangeRate[]
  IsOpen?: boolean
}

export type SaleReturnItem = {
  Id?: number
  NetUid?: string
  Created?: Date | string
  OrderItem?: SaleOrderItem
  Qty?: number
  AmountLocal?: number
  CreatedBy?: SaleUser
}

export type SaleReturn = {
  Id?: number
  NetUid?: string
  Created?: Date | string
  Number?: string
  ClientAgreement?: ClientAgreement
  TotalAmount?: number
  TotalAmountLocal?: number
  TotalCount?: number
  CreatedBy?: SaleUser
  SaleReturnItems?: SaleReturnItem[]
}

export type ClientSalesParams = {
  netId: string
  from: Date | string
  to: Date | string
}
