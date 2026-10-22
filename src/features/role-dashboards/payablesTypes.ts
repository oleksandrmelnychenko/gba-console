export type PayablesWorkspace = 'finance' | 'executive'
export type PayablesWorldKey = 'fenix' | 'amg'

export type PayablesAmounts = {
  signedBalance: number
  payable: number
  advance: number
}

export type PayablesBucket = PayablesAmounts & {
  currencyCode: string
  currencyLabel: string | null
  rowCount: number
}

export type PayablesWorld = {
  world: PayablesWorldKey
  status: 'unavailable' | 'confirmed'
  reason: string | null
  publicationId: string | null
  sourceCutoffUtc: string | null
  capturedAtUtc: string | null
  publishedAtUtc: string | null
  scopeComplete: boolean
  scope: string
  requestedKeys: number | null
  returnedKeys: number | null
  excludedKeys: number | null
  buckets: PayablesBucket[]
}

export type PayablesSnapshot = { readAtUtc: string; worlds: PayablesWorld[] }

export type PayablesRowsRequest = {
  workspace: PayablesWorkspace
  world: PayablesWorldKey
  publicationId: string
  currencyCode: string
  offset: number
  limit: number
}

export type PayablesRow = PayablesAmounts & {
  id: string
  partyKind: number
  supplierCode: string
  supplierName: string | null
  agreementId: string
  agreementName: string | null
  organizationName: string | null
}

export type PayablesRows = {
  world: PayablesWorldKey
  publicationId: string
  currencyCode: string
  sourceCutoffUtc: string
  offset: number
  limit: number
  total: number
  aggregate: PayablesAmounts
  rows: PayablesRow[]
}

export type PayablesSelection = { world: PayablesWorld; bucket: PayablesBucket }
