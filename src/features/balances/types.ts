export type EntityFields = {
  Created?: Date | string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: Date | string
}

export type NamedEntity = EntityFields & {
  Code?: string
  Name?: string
}

export const ContractorType = {
  Client: 0,
  Supplier: 1,
  SupplyOrganization: 2,
  None: 10,
} as const

export type ContractorTypeValue = (typeof ContractorType)[keyof typeof ContractorType]

export type SyncDocumentClient = EntityFields & {
  FullName?: string
  Name?: string
}

export type SyncDocumentAgreement = EntityFields & {
  Name?: string
}

export type SyncDocumentClientAgreement = EntityFields & {
  Agreement?: SyncDocumentAgreement | null
}

export type SyncDocument = EntityFields & {
  Amount?: number
  Client?: SyncDocumentClient | null
  ClientAgreement?: SyncDocumentClientAgreement | null
  ContractorType?: ContractorTypeValue | number
  Currency?: NamedEntity | null
  Number?: string
  Organization?: NamedEntity | null
  SupplyOrganization?: NamedEntity | null
  SupplyOrganizationAgreement?: SyncDocumentAgreement | null
  SynchronizationDate?: Date | string
  TotalQty?: number
  Type?: string
}

export type SyncDocumentsSearchParams = {
  from: string
  limit: number
  name: string
  offset: number
  to: string
  type: number
}

export type SyncDocumentsResult = {
  items: SyncDocument[]
  totalQty: number
}
