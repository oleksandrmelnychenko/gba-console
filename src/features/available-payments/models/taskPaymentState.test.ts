import { describe, expect, it } from 'vitest'
import { TaskStatusValue } from '../types'
import { getTaskPaymentState } from './taskPaymentState'

describe('getTaskPaymentState', () => {
  it('does not call a Done placeholder task without payments «paid»', () => {
    expect(getTaskPaymentState({ GrossPrice: 1500, TaskStatus: TaskStatusValue.Done })).toBe('closed-without-payment')
  })

  it('is paid when the Done task has linked outgoing payments', () => {
    expect(getTaskPaymentState({
      OutcomePaymentOrderSupplyPaymentTasks: [{ OutcomePaymentOrder: { Amount: 1500 } }],
      TaskStatus: TaskStatusValue.Done,
    })).toBe('paid')
  })

  it.each([
    [TaskStatusValue.PartiallyDone, 'partial'],
    [TaskStatusValue.NotDone, 'unpaid'],
  ] as const)('maps status %s to %s', (status, expected) => {
    expect(getTaskPaymentState({ TaskStatus: status })).toBe(expected)
  })
})
