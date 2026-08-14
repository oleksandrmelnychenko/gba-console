import { describe, expect, it } from 'vitest'
import {
  buildWorkflowCounts,
  getActWorkflowState,
  getDispositionReasonLabel,
  getItemWorkflowState,
} from './actReconciliationWorkflow'

describe('act reconciliation workflow', () => {
  it('keeps pending, dismissed and resolved rows distinct', () => {
    const items = [
      { HasDifference: true, NegativeDifference: true, QtyDifference: 6 },
      { HasDifference: true, NegativeDifference: false, QtyDifference: 2 },
      { HasDifference: true, NegativeDifference: true, QtyDifference: 4, IsDismissed: true },
      { HasDifference: false, QtyDifference: 0 },
    ]

    expect(items.map(getItemWorkflowState)).toEqual([
      'pending-shortage',
      'pending-surplus',
      'dismissed',
      'resolved',
    ])
    expect(buildWorkflowCounts(items)).toEqual({
      total: 4,
      'pending-shortage': 1,
      'pending-surplus': 1,
      dismissed: 1,
      resolved: 1,
    })
  })

  it('classifies a mixed act as partially processed', () => {
    expect(getActWorkflowState({
      ActReconciliationItems: [
        { HasDifference: true, NegativeDifference: true, QtyDifference: 6 },
        { HasDifference: true, QtyDifference: 4, IsDismissed: true },
      ],
    })).toBe('partial')
  })

  it('returns a changed closure to the active queue for a new decision', () => {
    expect(getItemWorkflowState({
      HasDifference: true,
      IsDismissed: false,
      IsDispositionStale: true,
      NegativeDifference: true,
      QtyDifference: 6,
    })).toBe('pending-shortage')
  })

  it('renders stable business labels for stored reason codes', () => {
    expect(getDispositionReasonLabel('BusinessAcceptedNoStockMovement'))
      .toBe('Залишки змінювати не потрібно')
    expect(getDispositionReasonLabel(null)).toBe('Причину не вказано')
  })
})
