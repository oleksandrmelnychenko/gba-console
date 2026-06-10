import { describe, expect, it } from 'vitest'
import { buildAvailablePaymentsPaymentTasksPath } from './outgoingPaymentTasksRoute'

describe('buildAvailablePaymentsPaymentTasksPath', () => {
  it('keeps cash payment-task register type', () => {
    expect(buildAvailablePaymentsPaymentTasksPath('?type=0')).toBe('/accounting/available-payments?type=0&operationType=4')
  })

  it('keeps bank payment-task register type and explicit accounting type', () => {
    expect(buildAvailablePaymentsPaymentTasksPath('?type=2&typePaymentTask=1')).toBe(
      '/accounting/available-payments?type=2&typePaymentTask=1&operationType=4',
    )
  })

  it('falls back to all payment-task register type for unsupported values', () => {
    expect(buildAvailablePaymentsPaymentTasksPath('?type=1&operationType=8')).toBe('/accounting/available-payments?type=2&operationType=4')
  })

  it('preserves route hash', () => {
    expect(buildAvailablePaymentsPaymentTasksPath('?type=0', '#pending')).toBe('/accounting/available-payments?type=0&operationType=4#pending')
  })
})
