export const TypeOfXmlDocument = {
  Sales: 0,
  ProductIncomes: 1,
} as const

export type TypeOfXmlDocument = (typeof TypeOfXmlDocument)[keyof typeof TypeOfXmlDocument]

export const SyncEntityType = {
  Products: 0,
  Clients: 1,
  Consignments: 2,
  Accounting: 3,
  PaymentRegisters: 4,
} as const

export type SyncEntityType = (typeof SyncEntityType)[keyof typeof SyncEntityType]

export const SyncProductConsignmentType = {
  Order: 0,
  Capitalization: 1,
  SaleReturn: 2,
  ProductTransfers: 3,
  DepreciatedOrders: 4,
  ActProductTransfers: 5,
  Sales: 6,
  IncomeCashOrder: 7,
  IncomeBankOrder: 8,
  OutcomeCashOrder: 9,
  OutcomeBankOrder: 10,
  InternalMovementOfFunds: 11,
} as const

export type SyncProductConsignmentType =
  (typeof SyncProductConsignmentType)[keyof typeof SyncProductConsignmentType]

export type SyncHistoryItem = {
  Date?: string | Date
  Type?: number
}

export type SyncRunResponse = {
  Message?: string
}

export type ProductWriteOffRule = {
  Id?: number
  NetUid?: string
  RuleLocale?: string
  RuleType?: number
}
