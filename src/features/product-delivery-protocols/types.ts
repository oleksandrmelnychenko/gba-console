export type EntityFields = {
  Created?: Date | string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: Date | string
}

export const SupplyTransportationType = {
  Vehicle: 0,
  Ship: 1,
  Plane: 2,
} as const

export type SupplyTransportationType = (typeof SupplyTransportationType)[keyof typeof SupplyTransportationType]

export type ProtocolOrganization = EntityFields & {
  Abbreviation?: string
  Code?: string
  FullName?: string
  Name?: string
}

export type ProtocolUser = EntityFields & {
  FirstName?: string
  FullName?: string
  LastName?: string
  MiddleName?: string
  Name?: string
}

export type ProtocolClient = EntityFields & {
  FullName?: string
  Name?: string
}

export type ProtocolSupplyOrder = EntityFields & {
  Client?: ProtocolClient | null
  Number?: string
}

export type ProtocolSupplyInvoice = EntityFields & {
  Number?: string
  SupplyOrder?: ProtocolSupplyOrder | null
}

export type DeliveryProductProtocolNumber = EntityFields & {
  Number?: string
}

export type DeliveryProductProtocol = EntityFields & {
  Comment?: string
  DeliveryProductProtocolNumber?: DeliveryProductProtocolNumber | null
  DeliveryProductProtocolDocuments?: ProtocolSupplyDocument[]
  FromDate?: Date | string
  IsCompleted?: boolean
  IsPartiallyPlaced?: boolean
  IsPlaced?: boolean
  IsShipped?: boolean
  Organization?: ProtocolOrganization | null
  SupplyInvoices?: ProtocolSupplyInvoice[]
  TransportationType?: SupplyTransportationType
  User?: ProtocolUser | null
}

export type DeliveryProductProtocolListResult = {
  items: DeliveryProductProtocol[]
  totalQty: number
}

export type ProtocolsSearchParams = {
  from: string
  limit: number
  offset: number
  organization?: string
  supplier?: string
  to: string
}

export type CreateProtocolPayload = {
  Comment?: string
  FromDate: string
  Organization: ProtocolOrganization
  TransportationType: SupplyTransportationType
}

export type ProtocolSupplyDocument = EntityFields & {
  ContentType?: string
  Deleted?: boolean
  DocumentUrl?: string
  FileName?: string
}

export type ProtocolExportColumn = {
  ColumnName: string
  Number: number
  TableName: string
  Translate: string
}

export type ProtocolExportDocument = {
  DocumentURL?: string
  PdfDocumentURL?: string
}
