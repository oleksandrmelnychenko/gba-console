import { describe, expect, it } from 'vitest'
import { ApiError } from './apiClient'
import { isConflictError, isNotFoundError } from './staleRecord'

describe('stale record errors', () => {
  it('tells a conflict from a missing record', () => {
    expect(isConflictError(new ApiError('changed', 409, null))).toBe(true)
    expect(isNotFoundError(new ApiError('gone', 404, null))).toBe(true)
    expect(isConflictError(new ApiError('bad', 400, null))).toBe(false)
    expect(isNotFoundError(new Error('x'))).toBe(false)
  })
})
