import { describe, expect, it } from 'vitest'
import { agreementsForNewOperation, isAgreementOpenForNewOperations } from './agreementOperationPolicy'

const active = { NetUid: 'a', Agreement: { IsActive: true } }
const inactive = { NetUid: 'i', Agreement: { IsActive: false } }
const unknown = { NetUid: 'u', Agreement: {} }

describe('agreementOperationPolicy', () => {
  it('opens only agreements not marked inactive', () => {
    expect(isAgreementOpenForNewOperations(active)).toBe(true)
    expect(isAgreementOpenForNewOperations(inactive)).toBe(false)
    expect(isAgreementOpenForNewOperations(unknown)).toBe(true)
  })

  it('drops inactive agreements from a new-operation picker', () => {
    expect(agreementsForNewOperation([active, inactive, unknown]).map((item) => item.NetUid)).toEqual(['a', 'u'])
  })

  it('keeps the inactive agreement an existing document already uses', () => {
    expect(agreementsForNewOperation([active, inactive], (item) => item.NetUid === 'i').map((item) => item.NetUid))
      .toEqual(['a', 'i'])
  })
})
