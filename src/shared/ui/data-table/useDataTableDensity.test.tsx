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

  it('uses compact when no preference was stored', () => {
    const { result } = renderHook(() => useDataTableDensity(TABLE_ID))

    expect(result.current.density).toBe('compact')
  })

  it('drops normal stored before the standard-density migration', () => {
    window.localStorage.setItem(DENSITY_KEY, 'normal')

    const { result } = renderHook(() => useDataTableDensity(TABLE_ID))

    expect(result.current.density).toBe('compact')
    expect(window.localStorage.getItem(DENSITY_KEY)).toBeNull()
    expect(window.localStorage.getItem(VERSION_KEY)).toBe('2')
  })

  it('keeps normal selected after the migration', () => {
    const firstMount = renderHook(() => useDataTableDensity(TABLE_ID))

    act(() => firstMount.result.current.setDensity('normal'))
    firstMount.unmount()

    const reopened = renderHook(() => useDataTableDensity(TABLE_ID))

    expect(reopened.result.current.density).toBe('normal')
  })
})
