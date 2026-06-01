import { describe, expect, it } from 'vitest'
import {
  canRemoveAdvanceReportConsumableRow,
  canRemoveAdvanceReportFuelRow,
  isLocalAdvanceReportEntity,
} from './advanceReportRowPermissions'

describe('advance report row permissions', () => {
  it('treats missing id and local net uid as draft entities', () => {
    expect(isLocalAdvanceReportEntity({ NetUid: 'local-row' })).toBe(true)
    expect(isLocalAdvanceReportEntity({ Id: 0 })).toBe(true)
  })

  it('locks persisted rows after the report is done', () => {
    expect(
      canRemoveAdvanceReportConsumableRow(
        true,
        { Id: 1, NetUid: 'entry' },
        { Id: 2, NetUid: 'order' },
        { Id: 3, NetUid: 'item' },
      ),
    ).toBe(false)
    expect(canRemoveAdvanceReportFuelRow(true, { Id: 1, NetUid: 'fuel' })).toBe(false)
  })

  it('allows removing draft rows after the report is done', () => {
    expect(
      canRemoveAdvanceReportConsumableRow(
        true,
        { Id: 1, NetUid: 'entry' },
        { Id: 2, NetUid: 'order' },
        { NetUid: 'local-item' },
      ),
    ).toBe(true)
    expect(canRemoveAdvanceReportFuelRow(true, { NetUid: 'local-fuel' })).toBe(true)
  })

  it('allows removing all rows before the report is done', () => {
    expect(
      canRemoveAdvanceReportConsumableRow(
        false,
        { Id: 1, NetUid: 'entry' },
        { Id: 2, NetUid: 'order' },
        { Id: 3, NetUid: 'item' },
      ),
    ).toBe(true)
    expect(canRemoveAdvanceReportFuelRow(false, { Id: 1, NetUid: 'fuel' })).toBe(true)
  })
})
