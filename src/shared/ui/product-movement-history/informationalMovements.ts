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

export function isSafeInformationalMovement(value: unknown): value is InformationalMovement {
  if (!value || typeof value !== 'object') return false
  const row = value as InformationalMovement
  return row.StateCode === 'InformationalOnly'
    && row.CanMutate === false
    && row.AffectsAvailability === false
    && row.IsLedgerMovement === false
    && informationalReasonCodes.has(row.ReasonCode)
    && informationalQueueCodes.has(row.QueueCode)
    && informationalSeverityCodes.has(row.SeverityCode)
    && Number.isSafeInteger(row.SourceItemId)
    && row.SourceItemId > 0
    && typeof row.InfoKey === 'string'
    && Boolean(row.InfoKey.trim())
    && typeof row.DocumentType === 'string'
    && typeof row.KindCode === 'string'
    && typeof row.MissingEvidenceCode === 'string'
    && typeof row.IsKnownFixture === 'boolean'
    && Number.isFinite(row.Qty)
    && Number.isSafeInteger(row.TotalRows)
    && row.TotalRows > 0
    && ['ActionCode', 'ActionNetUid', 'Comment', 'DocumentNumber', 'ProductName', 'ProductNetUid', 'VendorCode']
      .every(key => (value as Record<string, unknown>)[key] == null || typeof (value as Record<string, unknown>)[key] === 'string')
    && (row.DocumentDate == null || ((typeof row.DocumentDate === 'string' || row.DocumentDate instanceof Date)
      && Number.isFinite(new Date(row.DocumentDate).getTime())))
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


/** A malformed or wrong-scope response must never become a successful empty audit. */
export function parseInformationalMovementPage(
  result: unknown,
  context: { queue: InformationalMovementQueue; productNetId?: string; offset: number; limit: number },
): InformationalMovement[] {
  const payload = result && typeof result === 'object' ? result as Record<string, unknown> : null
  const rows = Array.isArray(result)
    ? result
    : ['Items', 'Collection', 'Data', 'Movements', 'History']
      .map(key => payload?.[key]).find(Array.isArray)
  const invalidResponse = () => new Error('Некоректна відповідь контролю складських даних. Результат перевірки не підтверджено. Оновіть дані.')
  if (!Array.isArray(rows) || rows.length > context.limit || !rows.every(isSafeInformationalMovement)) {
    throw invalidResponse()
  }
  const totalRows = rows[0]?.TotalRows
  if (rows.some(row => row.QueueCode !== context.queue
    || row.TotalRows !== totalRows
    || (context.productNetId && row.ProductNetUid?.toLowerCase() !== context.productNetId.toLowerCase()))
    || (rows.length > 0 && totalRows < context.offset + rows.length)
    || new Set(rows.map(row => row.InfoKey)).size !== rows.length) {
    throw invalidResponse()
  }
  return rows
}
