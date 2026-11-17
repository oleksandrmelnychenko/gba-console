import { describe, expect, it } from 'vitest'
import type { OrganizationClient } from './types'
import { isValidNip, validateOrganizationClient } from './utils'

const valid: OrganizationClient = {
  Address: 'ul. Prosta 1',
  City: 'Warszawa',
  Country: 'Polska',
  FullName: 'Firma Sp. z o.o.',
  MarginAmount: 12.5,
  NIP: '123-456-32-18',
  OrganizationClientAgreements: [{ Currency: { Id: 1 } }],
} as OrganizationClient

describe('isValidNip', () => {
  it('accepts 10 digits with dashes or a PL prefix only', () => {
    expect(isValidNip('1234563218')).toBe(true)
    expect(isValidNip('123-456-32-18')).toBe(true)
    expect(isValidNip('PL1234563218')).toBe(true)
    expect(isValidNip('abc-NIP')).toBe(false)
    expect(isValidNip('12345')).toBe(false)
  })
})

describe('validateOrganizationClient', () => {
  it('rejects a malformed NIP on create', () => {
    expect(validateOrganizationClient({ ...valid, NIP: 'abc-NIP' })).toBe('NIP має містити 10 цифр (дозволені дефіси)')
  })

  it('keeps an untouched legacy NIP saveable on edit', () => {
    expect(validateOrganizationClient({ ...valid, NIP: 'DE123' }, { baselineNip: 'DE123' })).not.toBe(
      'NIP має містити 10 цифр (дозволені дефіси)',
    )
  })

  it('treats Маржа as a percent up to 100', () => {
    expect(validateOrganizationClient({ ...valid, MarginAmount: 100000 })).toBe('Маржа — відсоток, не більше 100')
    expect(validateOrganizationClient({ ...valid, MarginAmount: 100 })).not.toBe('Маржа — відсоток, не більше 100')
  })
})
