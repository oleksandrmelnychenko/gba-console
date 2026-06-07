import { describe, expect, it } from 'vitest'
import { parseAvailablePaymentsAccountingType } from './availablePaymentsSearchParams'
import { AccountingTypeValue } from '../types'

describe('parseAvailablePaymentsAccountingType', () => {
  it('keeps legacy type as accounting filter outside outcome-payment mode', () => {
    const searchParams = new URLSearchParams('type=0')

    expect(parseAvailablePaymentsAccountingType(searchParams)).toBe(AccountingTypeValue.ManagementAccounting)
  })

  it('does not treat outcome register type as accounting filter', () => {
    const searchParams = new URLSearchParams('type=0&operationType=4')

    expect(parseAvailablePaymentsAccountingType(searchParams)).toBe(AccountingTypeValue.All)
  })

  it('uses explicit typePaymentTask in outcome-payment mode', () => {
    const searchParams = new URLSearchParams('type=0&operationType=4&typePaymentTask=1')

    expect(parseAvailablePaymentsAccountingType(searchParams)).toBe(AccountingTypeValue.Accounting)
  })
})
