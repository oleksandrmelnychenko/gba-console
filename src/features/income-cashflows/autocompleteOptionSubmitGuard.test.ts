import { describe, expect, it } from 'vitest'
import { createAutocompleteOptionSubmitGuard } from './autocompleteOptionSubmitGuard'

describe('autocomplete option-submit guard', () => {
  it('distinguishes the option-submit echo from a later text edit', () => {
    const guard = createAutocompleteOptionSubmitGuard()

    guard.markSubmitted('Client A')

    expect(guard.consumeChange('Client A')).toBe(true)
    expect(guard.consumeChange('Client A')).toBe(false)
  })

  it('does not treat a different value as a submitted selection', () => {
    const guard = createAutocompleteOptionSubmitGuard()

    guard.markSubmitted('Client A')

    expect(guard.consumeChange('Client')).toBe(false)
    expect(guard.consumeChange('Client A')).toBe(false)
  })
})
