export type InformationalMovement = {
  ActionCode?: string
  ActionNetUid?: string
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
  QueueCode: InformationalMovementQueue
  ReasonCode: string
  SeverityCode: 'Error' | 'Info' | 'Warning'
  SourceItemId: number
  StateCode: string
  TotalRows: number
  VendorCode?: string
}

export type InformationalMovementQueue = 'ActionRequired' | 'BusinessPending' | 'Technical'

const informationalReasonCodes = new Set([
  'AcceptanceTestFixture',
  'NoPhysicalSource',
  'NoStockEffectExpected',
  'PendingReconciliation',
  'ZeroQuantity',
  'ZeroStockSyncShell',
])

const informationalQueueCodes = new Set<InformationalMovementQueue>([
  'ActionRequired',
  'BusinessPending',
  'Technical',
])

const informationalSeverityCodes = new Set(['Error', 'Info', 'Warning'])

export function isSafeInformationalMovement(row: InformationalMovement): boolean {
  return row.StateCode === 'InformationalOnly'
    && row.CanMutate === false
    && row.AffectsAvailability === false
    && row.IsLedgerMovement === false
    && informationalReasonCodes.has(row.ReasonCode)
    && informationalQueueCodes.has(row.QueueCode)
    && informationalSeverityCodes.has(row.SeverityCode)
    && Number.isInteger(row.SourceItemId)
    && row.SourceItemId > 0
    && Boolean(row.InfoKey?.trim())
}

export function getInformationalMovementActionPath(row: InformationalMovement): string | null {
  const actionNetUid = row.ActionNetUid?.trim()

  if (row.ActionCode !== 'OpenReconciliation' || !actionNetUid) {
    return row.ActionCode === 'OpenSale' && actionNetUid
      ? `/sales/ukraine/all?saleNetId=${encodeURIComponent(actionNetUid)}`
      : null
  }

  return `/ukraine/act/reconcoliation/${encodeURIComponent(actionNetUid)}`
}
