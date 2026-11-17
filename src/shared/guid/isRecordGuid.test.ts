import { describe, expect, it } from 'vitest'
import { isRecordGuid } from './isRecordGuid'

describe('isRecordGuid', () => {
  it('accepts a well-formed GUID in any case', () => {
    expect(isRecordGuid('6F1C2A4E-1B2C-4D3E-8F90-123456789ABC')).toBe(true)
  })

  it('rejects junk, the zero GUID and empty values', () => {
    expect(isRecordGuid('not-a-guid')).toBe(false)
    expect(isRecordGuid('00000000-0000-0000-0000-000000000000')).toBe(false)
    expect(isRecordGuid('')).toBe(false)
    expect(isRecordGuid(undefined)).toBe(false)
  })
})
