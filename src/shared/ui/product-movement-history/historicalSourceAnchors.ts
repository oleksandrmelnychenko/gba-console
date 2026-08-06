export type HistoricalSourceMovement = {
  AffectsAvailability: boolean
  AllocationId: number
  AnchorKey: string
  CanMutate: boolean
  ClientName?: string
  Comment?: string
  ImportedForAmg: boolean
  Qty: number
  ReasonCode: string
  Responsible?: string
  SaleDocumentDate: Date | string
  SourceAmountEur: number
  SourceBatchDocumentDate: Date | string
  SourceBatchDocumentId: string
  SourceBatchDocumentNumber: string
  SourceBatchDocumentType: number
  SourceCostEur: number
  SourceOrderNumber: string
  SourceOrganizationName: string
  SourceProductCode: number
  SourceSaleId: string
  SourceSaleNumber?: string
  SourceStorageId: string
  SourceStorageName: string
  SourceVatEur: number
  StateCode: string
}

export type HistoricalSourceAnchor = HistoricalSourceMovement & {
  Documents: HistoricalSourceMovement[]
  FirstSaleDocumentDate: Date | string
  LastSaleDocumentDate: Date | string
  TotalQty: number
  TotalSourceCostEur: number
}

export function isSafeHistoricalSourceMovement(row: HistoricalSourceMovement): boolean {
  return row.StateCode === 'HistoricalSourceOnly'
    && row.ReasonCode === 'NoActiveLocalConsignment'
    && row.CanMutate === false
    && row.AffectsAvailability === false
    && Number.isInteger(row.AllocationId)
    && row.AllocationId > 0
    && Boolean(row.AnchorKey?.trim())
    && Boolean(row.SourceBatchDocumentId?.trim())
    && Boolean(row.SourceStorageId?.trim())
    && Number(row.Qty) > 0
}

export function buildHistoricalSourceAnchors(
  rows: HistoricalSourceMovement[],
): HistoricalSourceAnchor[] {
  const groups = new Map<string, HistoricalSourceMovement[]>()

  for (const row of rows) {
    const group = groups.get(row.AnchorKey)

    if (group) {
      group.push(row)
    } else {
      groups.set(row.AnchorKey, [row])
    }
  }

  return Array.from(groups.values(), (documents) => {
    const sortedDocuments = documents.toSorted(compareSaleDateThenAllocation)
    const representative = sortedDocuments[0]

    return {
      ...representative,
      Documents: sortedDocuments,
      FirstSaleDocumentDate: sortedDocuments[0].SaleDocumentDate,
      LastSaleDocumentDate: sortedDocuments[sortedDocuments.length - 1].SaleDocumentDate,
      TotalQty: sortedDocuments.reduce((total, row) => total + Number(row.Qty || 0), 0),
      TotalSourceCostEur: sortedDocuments.reduce((total, row) => total + Number(row.SourceCostEur || 0), 0),
    }
  }).toSorted((left, right) => compareDateDescending(left.SourceBatchDocumentDate, right.SourceBatchDocumentDate))
}

function compareSaleDateThenAllocation(
  left: HistoricalSourceMovement,
  right: HistoricalSourceMovement,
): number {
  const dateComparison = String(left.SaleDocumentDate).localeCompare(String(right.SaleDocumentDate))

  return dateComparison || left.AllocationId - right.AllocationId
}

function compareDateDescending(left: Date | string, right: Date | string): number {
  return String(right).localeCompare(String(left))
}
