import { describe, expect, it } from 'vitest'
import { validateRegionCodeSubmitState } from './validateClientForm'

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
