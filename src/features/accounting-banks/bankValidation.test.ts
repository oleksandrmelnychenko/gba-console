import { describe, expect, it } from 'vitest'
import { validateBank } from './bankValidation'

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
