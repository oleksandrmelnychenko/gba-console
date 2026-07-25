import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useDataTableDensity } from './useDataTableDensity'

const TABLE_ID = 'standalone-density-migration-test'
const DENSITY_KEY = `gba-data-table:${TABLE_ID}:density`
const VERSION_KEY = `gba-data-table:${TABLE_ID}:density-default-version`

describe('useDataTableDensity standard-default migration', () => {
  beforeEach(() => {
    window.localStorage.removeItem(DENSITY_KEY)
    window.localStorage.removeItem(VERSION_KEY)
  })

  it('uses normal when no preference was stored', () => {
    const { result } = renderHook(() => useDataTableDensity(TABLE_ID))

    expect(result.current.density).toBe('normal')
  })

  it('drops compact stored before the standard-density migration', () => {
    window.localStorage.setItem(DENSITY_KEY, 'compact')

    const { result } = renderHook(() => useDataTableDensity(TABLE_ID))

    expect(result.current.density).toBe('normal')
    expect(window.localStorage.getItem(DENSITY_KEY)).toBeNull()
    expect(window.localStorage.getItem(VERSION_KEY)).toBe('1')
  })

  it('keeps compact selected after the migration', () => {
    const firstMount = renderHook(() => useDataTableDensity(TABLE_ID))

    act(() => firstMount.result.current.setDensity('compact'))
    firstMount.unmount()

    const reopened = renderHook(() => useDataTableDensity(TABLE_ID))

    expect(reopened.result.current.density).toBe('compact')
  })
})
