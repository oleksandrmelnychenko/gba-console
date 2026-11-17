import { describe, expect, it } from 'vitest'
import { getUserRegionName, normalizeUserRegion } from './utils'

describe('user region', () => {
  it('shows seeded UA and console-created uk as one region «Україна»', () => {
    expect(getUserRegionName('UA')).toBe('Україна')
    expect(getUserRegionName('uk')).toBe('Україна')
    expect(normalizeUserRegion(' UA ')).toBe(normalizeUserRegion('uk'))
    expect(getUserRegionName('PL')).toBe('Польща')
    expect(normalizeUserRegion('pl')).toBe(normalizeUserRegion('PL'))
  })

  it('leaves unknown values as they are', () => {
    expect(getUserRegionName('DE')).toBe('DE')
    expect(normalizeUserRegion(null)).toBe('')
  })
})
