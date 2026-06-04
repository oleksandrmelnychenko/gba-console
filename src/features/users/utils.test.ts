import { describe, expect, it } from 'vitest'

import { validatePasswordPair } from './utils'

describe('validatePasswordPair', () => {
  it('accepts a valid password with a special character in the middle', () => {
    expect(validatePasswordPair('Hrimm_jow92', 'Hrimm_jow92')).toBeNull()
  })

  it('rejects a password without a special character', () => {
    expect(validatePasswordPair('Hrimmjow92', 'Hrimmjow92')).not.toBeNull()
  })
})
