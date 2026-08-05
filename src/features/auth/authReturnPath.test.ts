import { afterEach, describe, expect, it } from 'vitest'
import {
  clearAuthReturnPath,
  consumeAuthReturnPath,
  rememberAuthReturnPath,
  sanitizeAuthReturnPath,
} from './authReturnPath'

afterEach(clearAuthReturnPath)

describe('authReturnPath', () => {
  it('restores the same internal route after authentication', () => {
    rememberAuthReturnPath({
      hash: '#items',
      pathname: '/sales/ukraine/all',
      search: '?saleNetId=sale-1',
    })

    expect(consumeAuthReturnPath()).toBe('/sales/ukraine/all?saleNetId=sale-1#items')
    expect(consumeAuthReturnPath()).toBe('/dashboard')
  })

  it('does not retain the login route or external redirects', () => {
    expect(sanitizeAuthReturnPath('/login')).toBe(null)
    expect(sanitizeAuthReturnPath('//example.com/steal')).toBe(null)
    expect(sanitizeAuthReturnPath('https://example.com/steal')).toBe(null)
  })
})
