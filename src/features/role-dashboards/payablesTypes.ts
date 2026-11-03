export type PayablesWorkspace = 'finance' | 'executive'
export type PayablesPartyKind = 2 | 3

export type PayablesAmounts = {
  signedBalance: number
  payable: number
  advance: number
}

export type PayablesBucket = PayablesAmounts & {
  currencyCode: string
  rowCount: number
  goodsRowCount: number
  serviceRowCount: number
  unknownRowCount: number
}

export type PayablesSnapshot = { partyKind?: PayablesPartyKind | null; readAtUtc: string; asOfDate: string; buckets: PayablesBucket[] }

export type PayablesRowsRequest = {
  workspace: PayablesWorkspace
  partyKind?: PayablesPartyKind
  asOfDate: string
  currencyCode: string
  offset: number
  limit: number
}

export type PayablesRow = PayablesAmounts & {
  id: string
  partyKind: PayablesPartyKind
  supplierNetUid: string
  supplierName: string | null
  agreementNetUid: string
  agreementName: string | null
  organizationName: string | null
  known: boolean
}

export type PayablesRows = {
  partyKind?: PayablesPartyKind | null
  asOfDate: string
  currencyCode: string
  offset: number
  limit: number
  total: number
  aggregate: PayablesAmounts
  rows: PayablesRow[]
}

export type PayablesSelection = { partyKind?: PayablesPartyKind; asOfDate: string; bucket: PayablesBucket }
