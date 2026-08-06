import { describe, expect, it } from 'vitest'
import {
  buildHistoricalSourceAnchors,
  isSafeHistoricalSourceMovement,
  type HistoricalSourceMovement,
} from './historicalSourceAnchors'

function createRow(overrides: Partial<HistoricalSourceMovement> = {}): HistoricalSourceMovement {
  return {
    AffectsAvailability: false,
    AllocationId: 1,
    AnchorKey: '0:3:BATCH:PRODUCT:STORAGE',
    CanMutate: false,
    ImportedForAmg: false,
    Qty: 2,
    ReasonCode: 'NoActiveLocalConsignment',
    SaleDocumentDate: '2026-05-02T10:00:00',
    SourceAmountEur: 20,
    SourceBatchDocumentDate: '2025-04-01T00:00:00',
    SourceBatchDocumentId: 'BATCH',
    SourceBatchDocumentNumber: 'IN-1',
    SourceBatchDocumentType: 3,
    SourceCostEur: 14,
    SourceOrderNumber: 'ORDER-1',
    SourceOrganizationName: 'Fenix',
    SourceProductCode: 123,
    SourceSaleId: 'SALE',
    SourceSaleNumber: 'SALE-1',
    SourceStorageId: 'STORAGE',
    SourceStorageName: 'Склад 1',
    SourceVatEur: 4,
    StateCode: 'HistoricalSourceOnly',
    ...overrides,
  }
}

describe('historical source anchors', () => {
  it('groups exact allocations under the source batch anchor without losing documents', () => {
    const first = createRow()
    const second = createRow({ AllocationId: 2, Qty: 3, SaleDocumentDate: '2026-05-03T10:00:00' })

    const result = buildHistoricalSourceAnchors([second, first])

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      FirstSaleDocumentDate: first.SaleDocumentDate,
      LastSaleDocumentDate: second.SaleDocumentDate,
      TotalQty: 5,
      TotalSourceCostEur: 28,
    })
    expect(result[0].Documents.map((row) => row.AllocationId)).toEqual([1, 2])
  })

  it('never merges a different source world, storage, or batch identity', () => {
    const result = buildHistoricalSourceAnchors([
      createRow(),
      createRow({ AllocationId: 2, AnchorKey: '1:3:BATCH:PRODUCT:STORAGE', ImportedForAmg: true }),
      createRow({ AllocationId: 3, AnchorKey: '0:3:BATCH:PRODUCT:OTHER-STORAGE', SourceStorageId: 'OTHER-STORAGE' }),
      createRow({ AllocationId: 4, AnchorKey: '0:3:OTHER-BATCH:PRODUCT:STORAGE', SourceBatchDocumentId: 'OTHER-BATCH' }),
    ])

    expect(result).toHaveLength(4)
  })

  it('fails closed when the API safety contract changes', () => {
    expect(isSafeHistoricalSourceMovement(createRow())).toBe(true)
    expect(isSafeHistoricalSourceMovement(createRow({ CanMutate: true }))).toBe(false)
    expect(isSafeHistoricalSourceMovement(createRow({ AffectsAvailability: true }))).toBe(false)
    expect(isSafeHistoricalSourceMovement(createRow({ ReasonCode: 'Unknown' }))).toBe(false)
    expect(isSafeHistoricalSourceMovement(createRow({ Qty: 0 }))).toBe(false)
  })
})
