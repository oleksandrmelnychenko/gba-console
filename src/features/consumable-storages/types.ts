export type EntityFields = {
  Created?: string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: string
}

export type NamedEntity = EntityFields & {
  Code?: string
  FirstName?: string
  FullName?: string
  LastName?: string
  MiddleName?: string
  Name?: string
}

export type Organization = NamedEntity

export type UserProfile = NamedEntity & {
  Email?: string
  PhoneNumber?: string
}

export type ConsumableProduct = EntityFields & {
  Article?: string
  Currency?: NamedEntity | null
  PricePerItem?: number
  SpecificationQty?: number
  Name?: string
  TotalQty?: number
  VendorCode?: string
  WorthPrice?: number
}

export type PriceTotal = {
  Amount?: number
  Currency?: NamedEntity | null
  Qty?: number
  TotalPrice?: number
}

export type ConsumablesStorage = EntityFields & {
  ConsumableProducts?: ConsumableProduct[]
  ConsumablesOrders?: unknown[]
  Description?: string
  IsSelected?: boolean
  Name?: string
  Organization?: Organization | null
  PriceTotals?: PriceTotal[]
  ResponsibleUser?: UserProfile | null
}

export type ConsumablesStoragePayload = ConsumablesStorage & {
  Name: string
  Organization: Organization
}

export type PaymentCostMovement = EntityFields & {
  OperationName?: string
}

export type PaymentCostMovementOperation = EntityFields & {
  DepreciatedConsumableOrderItem?: {
    PaymentCostMovementOperation?: PaymentCostMovementOperation
  } | null
  PaymentCostMovement?: PaymentCostMovement | null
}

export type ConsumablesOrderItem = EntityFields & {
  ConsumableProduct?: ConsumableProduct | null
  PaymentCostMovementOperation?: PaymentCostMovementOperation | null
  PricePerItem?: number
  Qty?: number
  TotalPrice?: number
}

export type DeprecatedConsumableOrderItem = EntityFields & {
  ConsumablesOrderItem?: ConsumablesOrderItem | null
  Currency?: NamedEntity | null
  PaymentCostMovementOperation?: PaymentCostMovementOperation | null
  Qty?: number
  TotalPrice?: number
}

export type DeprecatedConsumableOrder = EntityFields & {
  Comment?: string
  CreatedBy?: UserProfile | null
  DepreciatedConsumableOrderItems?: DeprecatedConsumableOrderItem[]
  DepreciatedTo?: UserProfile | null
  Number?: number | string
  PriceTotals?: PriceTotal[]
}

export type DeprecatedConsumableOrdersParams = {
  from: string
  storageNetId?: string
  to: string
  value?: string
}
