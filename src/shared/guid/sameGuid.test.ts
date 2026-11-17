import { describe, expect, it } from 'vitest'
import { isGuid, sameGuid } from './sameGuid'

describe('sameGuid', () => {
  it('compares GUIDs case-insensitively', () => {
    expect(sameGuid('01AA5A80-2600-42C0-A09C-DCD0FC158C81', '01aa5a80-2600-42c0-a09c-dcd0fc158c81')).toBe(true)
  })

  it('rejects different or empty values', () => {
    expect(sameGuid('01aa5a80-2600-42c0-a09c-dcd0fc158c81', '01aa5a80-2600-42c0-a09c-dcd0fc158c82')).toBe(false)
    expect(sameGuid('', '')).toBe(false)
    expect(sameGuid(undefined, null)).toBe(false)
    expect(sameGuid('x', undefined)).toBe(false)
  })
})

describe('isGuid', () => {
  it('accepts GUIDs in any case and rejects anything else', () => {
    expect(isGuid('01AA5A80-2600-42C0-A09C-DCD0FC158C81')).toBe(true)
    expect(isGuid('not-a-guid')).toBe(false)
    expect(isGuid('999999')).toBe(false)
    expect(isGuid(undefined)).toBe(false)
  })
})
