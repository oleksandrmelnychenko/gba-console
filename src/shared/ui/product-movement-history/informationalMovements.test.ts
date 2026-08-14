import { describe, expect, it } from 'vitest'
import {
  getInformationalMovementActionPath,
  isSafeInformationalMovement,
  type InformationalMovement,
} from './informationalMovements'

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
    QueueCode: 'BusinessPending',
    ReasonCode: 'PendingReconciliation',
    SeverityCode: 'Warning',
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
    { QueueCode: 'unknown' as InformationalMovement['QueueCode'] },
    { SeverityCode: 'unknown' as InformationalMovement['SeverityCode'] },
    { InfoKey: '' },
  ])('rejects unsafe or incomplete server contracts: %o', (override) => {
    expect(isSafeInformationalMovement(createRow(override))).toBe(false)
  })

  it('builds an action only for a reconciliation row with a target', () => {
    expect(getInformationalMovementActionPath(createRow({
      ActionCode: 'OpenReconciliation',
      ActionNetUid: '8ad5bad8-4f4d-4e66-8a4f-375eca4940b3',
    }))).toBe('/ukraine/act/reconcoliation/8ad5bad8-4f4d-4e66-8a4f-375eca4940b3')

    expect(getInformationalMovementActionPath(createRow())).toBeNull()
  })

  it('builds a focused sale link for a posted sale without stock movement', () => {
    expect(getInformationalMovementActionPath(createRow({
      ActionCode: 'OpenSale',
      ActionNetUid: '6f7c248c-f994-46b0-bff6-2ec6061b26d2',
      QueueCode: 'ActionRequired',
      SeverityCode: 'Error',
    }))).toBe('/sales/ukraine/all?saleNetId=6f7c248c-f994-46b0-bff6-2ec6061b26d2')
  })
})
