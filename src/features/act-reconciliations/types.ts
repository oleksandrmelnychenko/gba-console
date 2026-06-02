export type EntityFields = {
  Created?: Date | string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: Date | string
}

export type NamedEntity = EntityFields & {
  Name?: string
}

export type ActReconciliationOrganization = EntityFields & {
  Abbreviation?: string
  Code?: string
  FullName?: string
  Name?: string
}

export type ActReconciliationStorage = EntityFields & {
  ForDefective?: boolean
  ForEcommerce?: boolean
  ForVatProducts?: boolean
  IsResale?: boolean
  Locale?: string
  Name?: string
  Organization?: ActReconciliationOrganization | null
  OrganizationId?: number | null
}

export type ActReconciliationUser = EntityFields & {
  Email?: string
  FirstName?: string
  FullName?: string
  LastName?: string
  MiddleName?: string
  Name?: string
}

export type ActReconciliationMeasureUnit = EntityFields & {
  Name?: string
  ShortName?: string
}

export type ActReconciliationProduct = EntityFields & {
  Articul?: string
  MeasureUnit?: ActReconciliationMeasureUnit | null
  Name?: string
  NameUA?: string
  VendorCode?: string
}

export type ActReconciliationItemAvailability = {
  Qty?: number
  Storage?: ActReconciliationStorage | null
}

export type ActReconciliationItem = EntityFields & {
  ActualQty?: number
  Availabilities?: ActReconciliationItemAvailability[]
  Comment?: string
  HasDifference?: boolean
  NegativeDifference?: boolean
  OrderedQty?: number
  Product?: ActReconciliationProduct | null
  QtyDifference?: number
  Reason?: string
  ToOperationQty?: number
}

export type ActReconciliationSupplyInvoiceOrder = EntityFields & {
  Number?: string
  Organization?: ActReconciliationOrganization | null
}

export type ActReconciliationSupplyInvoice = EntityFields & {
  Number?: string
  SupplyOrder?: ActReconciliationSupplyInvoiceOrder | null
}

export type ActReconciliationSupplyOrderUkraine = EntityFields & {
  InvNumber?: string
  Number?: string
  Organization?: ActReconciliationOrganization | null
}

export type ActReconciliation = EntityFields & {
  ActReconciliationItems?: ActReconciliationItem[]
  Comment?: string
  FromDate?: Date | string
  Number?: string
  Responsible?: ActReconciliationUser | null
  SupplyInvoice?: ActReconciliationSupplyInvoice | null
  SupplyOrderUkraine?: ActReconciliationSupplyOrderUkraine | null
}

export type ActReconciliationsSearchParams = {
  from: string
  to: string
}

export const ActReconciliationAppliedActionType = {
  ProductIncome: 0,
  DepreciatedOrder: 1,
  ProductTransfer: 2,
} as const

export type ActReconciliationAppliedActionTypeValue =
  (typeof ActReconciliationAppliedActionType)[keyof typeof ActReconciliationAppliedActionType]

export type AppliedActionProductIncome = EntityFields & {
  FromDate?: Date | string
  Number?: string
  ProductIncomeItems?: { Qty?: number }[]
  Storage?: ActReconciliationStorage | null
}

export type AppliedActionDepreciatedOrder = EntityFields & {
  DepreciatedOrderItems?: { Qty?: number }[]
  FromDate?: Date | string
  Number?: string
  Storage?: ActReconciliationStorage | null
}

export type AppliedActionProductTransfer = EntityFields & {
  FromDate?: Date | string
  FromStorage?: ActReconciliationStorage | null
  Number?: string
  ProductTransferItems?: { Qty?: number }[]
  ToStorage?: ActReconciliationStorage | null
}

export type ActReconciliationAppliedActionItem = {
  ActionType?: ActReconciliationAppliedActionTypeValue
  DepreciatedOrder?: AppliedActionDepreciatedOrder | null
  ProductIncome?: AppliedActionProductIncome | null
  ProductTransfer?: AppliedActionProductTransfer | null
}

export type ActReconciliationAppliedAction = {
  ActReconciliationItem?: ActReconciliationItem | null
  Items?: ActReconciliationAppliedActionItem[]
}

export type ReconciliationStorageOption = EntityFields & {
  ForDefective?: boolean
  Name?: string
  Organization?: ActReconciliationOrganization | null
}

export type ProductIncomeFromItemQueryParams = {
  cellNumber?: string
  comment: string
  fromDate: string
  itemNetId: string
  qty: string
  reason: string
  rowNumber?: string
  storageNetId: string
  storageNumber?: string
}

export type ProductIncomeFromItemsQueryParams = {
  comment: string
  fromDate: string
  storageNetId: string
}

export type ProductTransferFromItemQueryParams = {
  cellNumber?: string
  comment: string
  fromDate: string
  fromStorageNetId: string
  itemNetId: string
  organizationNetId: string
  qty: string
  reason: string
  rowNumber?: string
  storageNumber?: string
  toStorageNetId: string
}

export type ProductTransferFromItemsQueryParams = {
  comment: string
  fromDate: string
  fromStorageNetId: string
  organizationNetId: string
  toStorageNetId: string
}

export type DepreciatedOrderFromItemQueryParams = {
  comment: string
  fromDate: string
  itemNetId: string
  organizationNetId: string
  qty: string
  reason: string
  storageNetId: string
}

export type DepreciatedOrderFromItemsQueryParams = {
  comment: string
  fromDate: string
  organizationNetId: string
  storageNetId: string
}
