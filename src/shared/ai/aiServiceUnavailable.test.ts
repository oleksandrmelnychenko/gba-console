import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/apiClient'
import {
  isAiServiceKnownUnavailable,
  isAiServiceNotConfigured,
  markAiServiceUnavailable,
  resetAiServiceAvailabilityForTests,
} from './aiServiceUnavailable'

describe('isAiServiceNotConfigured', () => {
  it('recognizes the 503 not-configured answer by message or payload', () => {
    expect(isAiServiceNotConfigured(new ApiError('ProductsApi: ai_service_not_configured (ProductsApi:Url is not configured).', 503, null))).toBe(true)
    expect(isAiServiceNotConfigured(new ApiError('Service unavailable', 503, { code: 'ai_service_not_configured' }))).toBe(true)
  })

  it('ignores other failures', () => {
    expect(isAiServiceNotConfigured(new ApiError('Service unavailable', 503, null))).toBe(false)
    expect(isAiServiceNotConfigured(new ApiError('ai_service_not_configured', 500, null))).toBe(false)
    expect(isAiServiceNotConfigured(null)).toBe(false)
  })
})

describe('session availability memo', () => {
  afterEach(resetAiServiceAvailabilityForTests)

  it('remembers an unavailable service for the session', () => {
    expect(isAiServiceKnownUnavailable('solvency')).toBe(false)
    markAiServiceUnavailable('solvency')
    expect(isAiServiceKnownUnavailable('solvency')).toBe(true)
  })

  it('survives a page reload through sessionStorage', () => {
    markAiServiceUnavailable('solvency')
    expect(JSON.parse(window.sessionStorage.getItem('gba.console.aiServicesNotConfigured') || '[]')).toEqual(['solvency'])
  })

  it('still works when storage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    markAiServiceUnavailable('products')
    expect(isAiServiceKnownUnavailable('products')).toBe(true)
    spy.mockRestore()
  })
})
