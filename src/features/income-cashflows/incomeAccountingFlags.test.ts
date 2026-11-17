import { describe, expect, it } from 'vitest'
import { differsFromAgreementAccounting, getAgreementAccountingFlags } from './incomeAccountingFlags'

describe('income order accounting type follows the agreement (outgoing#27)', () => {
  it('reads the agreement flags only when both are known', () => {
    expect(getAgreementAccountingFlags({ IsAccounting: false, IsManagementAccounting: true })).toEqual({ isAccounting: false, isManagementAccounting: true })
    expect(getAgreementAccountingFlags({ IsAccounting: true })).toBeNull()
    expect(getAgreementAccountingFlags(null)).toBeNull()
  })

  it('flags an order posted in a different accounting than its agreement', () => {
    const agreement = { isAccounting: true, isManagementAccounting: false }
    expect(differsFromAgreementAccounting({ isAccounting: false, isManagementAccounting: true }, agreement)).toBe(true)
    expect(differsFromAgreementAccounting(agreement, agreement)).toBe(false)
    expect(differsFromAgreementAccounting({ isAccounting: false, isManagementAccounting: true }, null)).toBe(false)
  })
})
