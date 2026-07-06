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
