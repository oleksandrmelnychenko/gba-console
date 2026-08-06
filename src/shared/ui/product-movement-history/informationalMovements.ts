export type InformationalMovement = {
  AffectsAvailability: boolean
  CanMutate: boolean
  Comment?: string
  DocumentDate?: Date | string
  DocumentNumber?: string
  DocumentType: string
  InfoKey: string
  IsKnownFixture: boolean
  IsLedgerMovement: boolean
  KindCode: string
  MissingEvidenceCode: string
  ProductName?: string
  ProductNetUid?: string
  Qty: number
  ReasonCode: string
  SourceItemId: number
  StateCode: string
  TotalRows: number
  VendorCode?: string
}

const informationalReasonCodes = new Set([
  'AcceptanceTestFixture',
  'NoPhysicalSource',
  'PendingReconciliation',
  'ZeroQuantity',
  'ZeroStockSyncShell',
])

export function isSafeInformationalMovement(row: InformationalMovement): boolean {
  return row.StateCode === 'InformationalOnly'
    && row.CanMutate === false
    && row.AffectsAvailability === false
    && row.IsLedgerMovement === false
    && informationalReasonCodes.has(row.ReasonCode)
    && Number.isInteger(row.SourceItemId)
    && row.SourceItemId > 0
    && Boolean(row.InfoKey?.trim())
}
