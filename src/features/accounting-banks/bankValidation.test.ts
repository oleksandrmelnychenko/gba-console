import { describe, expect, it } from 'vitest'
import { findDuplicateBank, validateBank } from './bankValidation'

const valid = { Address: 'Київ', EdrpouCode: '11112222', MfoCode: '300778', Name: 'QA Банк' }

describe('validateBank', () => {
  it('accepts a bank that fits the database', () => {
    expect(validateBank(valid)).toBeNull()
  })

  it.each([
    [{ ...valid, MfoCode: 'abcdef' }, 'МФО має містити 6 цифр'],
    [{ ...valid, EdrpouCode: '12' }, 'ЄДРПОУ має містити 8 цифр'],
    [{ ...valid, Name: `QA ${'Б'.repeat(500)}` }, 'Назва банку — не більше 100 символів'],
    [{ ...valid, Address: 'A'.repeat(3000) }, 'Адреса — не більше 150 символів'],
  ])('rejects %#', (bank, message) => {
    expect(validateBank(bank)).toBe(message)
  })
})

describe('findDuplicateBank', () => {
  const existing = { Id: 7, NetUid: 'bank-7', Name: 'CH3 Банк', MfoCode: '300001', EdrpouCode: '12345678' }

  it('finds an identical bank (name case and spaces ignored) but not the bank being edited or a deleted one', () => {
    expect(findDuplicateBank({ Name: ' ch3 банк ', MfoCode: '300001', EdrpouCode: '12345678' }, [existing])).toBe(existing)
    expect(findDuplicateBank({ ...existing }, [existing])).toBeNull()
    expect(findDuplicateBank({ Name: 'CH3 Банк', MfoCode: '300001', EdrpouCode: '12345678' }, [{ ...existing, Deleted: true }])).toBeNull()
    expect(findDuplicateBank({ Name: 'Інший', MfoCode: '300001', EdrpouCode: '12345678' }, [existing])).toBeNull()
  })
})
