import { describe, expect, it } from 'vitest'
import { isSafeInformationalMovement, type InformationalMovement } from './informationalMovements'

function createRow(overrides: Partial<InformationalMovement> = {}): InformationalMovement {
  return {
    AffectsAvailability: false,
    CanMutate: false,
    DocumentType: 'Незастосована різниця інвентаризації',
    InfoKey: 'RECONCILIATION_PENDING:1',
    IsKnownFixture: false,
    IsLedgerMovement: false,
    KindCode: 'PendingReconciliation',
    MissingEvidenceCode: 'ConcreteInventoryAction',
    Qty: 1,
    ReasonCode: 'PendingReconciliation',
    SourceItemId: 1,
    StateCode: 'InformationalOnly',
    TotalRows: 1,
    ...overrides,
  }
}

describe('isSafeInformationalMovement', () => {
  it('accepts a complete fail-closed informational row', () => {
    expect(isSafeInformationalMovement(createRow())).toBe(true)
  })

  it.each([
    { AffectsAvailability: true },
    { CanMutate: true },
    { IsLedgerMovement: true },
    { StateCode: 'Movement' },
    { ReasonCode: 'Unknown' },
    { InfoKey: '' },
  ])('rejects unsafe or incomplete server contracts: %o', (override) => {
    expect(isSafeInformationalMovement(createRow(override))).toBe(false)
  })
})
