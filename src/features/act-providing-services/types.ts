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
  NameUA?: string
  Number?: string
}

export type SupplyOrganizationAgreement = EntityFields & {
  Currency?: NamedEntity | null
  Name?: string
  Organization?: NamedEntity | null
}

export type SupplyOrganization = NamedEntity

export type ProductDeliveryProtocol = EntityFields & {
  Number?: string
}

export type ServiceProduct = EntityFields & {
  Name?: string
  VendorCode?: string
}

export type BillOfLadingService = EntityFields & {
  AccountingGrossPrice?: number
  AccountingNetPrice?: number
  AccountingVat?: number
  AccountingVatPercent?: number
  DeliveryProductProtocol?: ProductDeliveryProtocol | null
  FromDate?: string
  GrossPrice?: number
  NetPrice?: number
  Number?: string
  ServiceNumber?: string
  SupplyOrganization?: SupplyOrganization | null
  SupplyOrganizationAgreement?: SupplyOrganizationAgreement | null
  TypeBillOfLadingService?: number
  User?: NamedEntity | null
  Vat?: number
  VatPercent?: number
}

export type MergedService = BillOfLadingService & {
  ConsumableProduct?: ServiceProduct | null
  SupplyOrderUkraine?: (EntityFields & {
    Organization?: NamedEntity | null
  }) | null
}

export type DeliveryExpense = EntityFields & {
  AccountingGrossAmount?: number
  AccountingVatPercent?: number
  ConsumableProduct?: ServiceProduct | null
  FromDate?: string
  InvoiceNumber?: string
  SupplyOrderUkraine?: (EntityFields & {
    Organization?: NamedEntity | null
  }) | null
  SupplyOrganization?: SupplyOrganization | null
  SupplyOrganizationAgreement?: SupplyOrganizationAgreement | null
  User?: NamedEntity | null
  VatAmount?: number
}

export type ActProvidingService = EntityFields & {
  AccountingBillOfLadingService?: BillOfLadingService | null
  AccountingMergedService?: MergedService | null
  BillOfLadingService?: BillOfLadingService | null
  Comment?: string
  DeliveryExpense?: DeliveryExpense | null
  FromDate?: string
  IsAccounting?: boolean
  MergedService?: MergedService | null
  Number?: string
  Price?: number
  User?: NamedEntity | null
  UserId?: number
}

export type ActProvidingServicesSearchParams = {
  from: string
  isFiltered?: boolean
  limit: number
  offset: number
  to: string
}

export type ActProvidingServicesResponse = {
  HasMore?: boolean
  Items: ActProvidingService[]
  Total?: number
}
