import { describe, expect, it } from 'vitest'
import {
  formatProductStorageDateTimeInput,
  isValidProductStorageDateTimeInput,
  toProductStorageApiDateTime,
} from './dateTime'

describe('product storage date time', () => {
  it('formats the local date and time for a datetime-local input', () => {
    const localDate = new Date(2026, 6, 11, 9, 7, 42, 125)

    expect(formatProductStorageDateTimeInput(localDate)).toBe('2026-07-11T09:07')
  })

  it('serializes a local input value to the matching API ISO instant', () => {
    const localDate = new Date(2026, 6, 11, 9, 7)
    const apiDateTime = toProductStorageApiDateTime('2026-07-11T09:07')

    expect(apiDateTime).toBe(localDate.toISOString())
    expect(formatProductStorageDateTimeInput(new Date(apiDateTime))).toBe('2026-07-11T09:07')
  })

  it('rejects incomplete and normalized local input values', () => {
    expect(isValidProductStorageDateTimeInput('2026-07-11')).toBe(false)
    expect(isValidProductStorageDateTimeInput('2026-02-30T09:07')).toBe(false)
    expect(toProductStorageApiDateTime('2026-02-30T09:07')).toBe('')
  })
})
