import { describe, expect, it } from 'vitest'
import type { Client } from '../../types'
import { validateClientForm, validateRegionCodeSubmitState } from './validateClientForm'

const buyerRole = {
  isBuyer: true,
  isProvider: false,
  isSubClient: false,
}

describe('validateRegionCodeSubmitState', () => {
  it('blocks submit while the region code check is loading', () => {
    expect(validateRegionCodeSubmitState(true, undefined, 'Wait for region code check')).toBe('Wait for region code check')
  })

  it('blocks submit when the region code has a validation error', () => {
    expect(validateRegionCodeSubmitState(false, 'Region code is unavailable', 'Wait for region code check')).toBe(
      'Region code is unavailable',
    )
  })

  it('allows submit when the region code is not loading and has no error', () => {
    expect(validateRegionCodeSubmitState(false, undefined, 'Wait for region code check')).toBeUndefined()
  })
})

describe('validateClientForm', () => {
  it('validates buyer tax identifiers before submitting to the server', () => {
    const errors = validateClientForm(
      {
        SROI: '1'.repeat(31),
        TIN: '2'.repeat(31),
        USREOU: '3'.repeat(31),
      } as Client,
      buyerRole,
      'Too many characters',
    )

    expect(errors).toMatchObject({
      SROI: 'Too many characters',
      TIN: 'Too many characters',
      USREOU: 'Too many characters',
    })
  })

  it('allows buyer tax identifiers with thirty characters', () => {
    const errors = validateClientForm(
      {
        SROI: '1'.repeat(30),
        TIN: '2'.repeat(30),
        USREOU: '3'.repeat(30),
      } as Client,
      buyerRole,
      'Too many characters',
    )

    expect(errors).not.toHaveProperty('SROI')
    expect(errors).not.toHaveProperty('TIN')
    expect(errors).not.toHaveProperty('USREOU')
  })
})

describe('validateClientForm format rules', () => {
  const t = (value: string) => value

  it('rejects malformed ЄДРПОУ, ІПН, email and phone before create', () => {
    const errors = validateClientForm(
      {
        USREOU: 'abcxyz123456789012345',
        TIN: 'ІПН-текст',
        EmailAddress: 'not-an-email',
        ClientNumber: 'телефон abc',
        SMSNumber: '123',
      } as Client,
      buyerRole,
      'Too many characters',
      { t },
    )

    expect(errors.USREOU).toBe('ЄДРПОУ має містити 8 цифр')
    expect(errors.TIN).toBe('ІПН має містити 10 або 12 цифр')
    expect(errors.EmailAddress).toBe('Вкажіть коректний email, наприклад name@example.com')
    expect(errors.ClientNumber).toBe('Телефон: 10–15 цифр; дозволені пробіли, +, -, дужки')
    expect(errors.SMSNumber).toBe('Телефон: 10–15 цифр; дозволені пробіли, +, -, дужки')
  })

  it('accepts well-formed values and the individual 10-digit codes', () => {
    expect(validateClientForm(
      {
        USREOU: '12345678',
        TIN: '123456789012',
        EmailAddress: 'buyer@example.com',
        ClientNumber: '+38 (067) 123-45-67',
      } as Client,
      buyerRole,
      'Too many characters',
      { t },
    )).toEqual({})

    const individual = validateClientForm(
      { IsIndividual: true, USREOU: '1234567890', TIN: '12345678' } as Client,
      buyerRole,
      'Too many characters',
      { t },
    )
    expect(individual.USREOU).toBeUndefined()
    expect(validateClientForm({ USREOU: '00000000' } as Client, buyerRole, 'Too many characters', { t }).USREOU)
      .toBe('ЄДРПОУ має містити 8 цифр')
    expect(individual.TIN).toBe('ІПН фізичної особи має містити 10 цифр')
  })

  it('does not block a card save on a legacy value the user did not change', () => {
    const legacy = { USREOU: '0000-legacy', EmailAddress: 'legacy', ClientNumber: 'n/a' } as Client

    expect(validateClientForm({ ...legacy }, buyerRole, 'Too many characters', { t, baseline: legacy })).toEqual({})
    expect(validateClientForm(
      { ...legacy, EmailAddress: 'still-wrong' },
      buyerRole,
      'Too many characters',
      { t, baseline: legacy },
    )).toEqual({ EmailAddress: 'Вкажіть коректний email, наприклад name@example.com' })
  })
})
