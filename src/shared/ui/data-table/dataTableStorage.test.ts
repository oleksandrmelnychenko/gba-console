import { beforeEach, describe, expect, it } from 'vitest'
import {
  createDefaultDataTableLayout,
  readCompatibleDataTableLayout,
  readDataTableLayout,
  writeDataTableLayout,
} from './dataTableStorage'

const TABLE_ID = 'density-migration-test'
const LAYOUT_KEY = `gba-data-table:${TABLE_ID}:layout`
const LEGACY_DENSITY_KEY = `gba-data-table:${TABLE_ID}:density`

describe('readDataTableLayout density compatibility', () => {
  beforeEach(() => {
    window.localStorage.removeItem(LAYOUT_KEY)
    window.localStorage.removeItem(LEGACY_DENSITY_KEY)
  })

  it('drops the legacy compact density during the standard-default migration', () => {
    window.localStorage.setItem(LEGACY_DENSITY_KEY, 'compact')

    expect(readDataTableLayout(TABLE_ID).density).toBeUndefined()
    expect(window.localStorage.getItem(LEGACY_DENSITY_KEY)).toBeNull()
  })

  it('uses normal as the central table default', () => {
    expect(createDefaultDataTableLayout(['name']).density).toBe('normal')
  })

  it('prefers density already stored in the table layout', () => {
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify({ density: 'normal' }))
    window.localStorage.setItem(LEGACY_DENSITY_KEY, 'compact')

    expect(readDataTableLayout(TABLE_ID)).toMatchObject({ density: 'normal' })
  })

  it('drops stale compact density while preserving versioned column layout state', () => {
    window.localStorage.setItem(
      LAYOUT_KEY,
      JSON.stringify({
        columnOrder: ['obsolete-column'],
        density: 'compact',
        version: 'old-version',
      }),
    )

    expect(readCompatibleDataTableLayout(TABLE_ID, 'new-version').density).toBeUndefined()
  })

  it('keeps compact when the user selects it after the migration', () => {
    writeDataTableLayout(TABLE_ID, { density: 'compact', version: 'current-version' })

    expect(readCompatibleDataTableLayout(TABLE_ID, 'current-version')).toMatchObject({
      density: 'compact',
      version: 'current-version',
    })
  })

  it('restores every user-controlled column setting after a remount', () => {
    writeDataTableLayout(TABLE_ID, {
      columnOrder: ['status', 'name', 'amount'],
      columnVisibility: { amount: false, name: true },
      columnPinning: { left: ['status'], right: ['actions'] },
      columnSizing: { amount: 184, name: 312 },
      density: 'normal',
      version: 'current-version',
    })

    expect(readCompatibleDataTableLayout(TABLE_ID, 'current-version')).toMatchObject({
      columnOrder: ['status', 'name', 'amount'],
      columnVisibility: { amount: false, name: true },
      columnPinning: { left: ['status'], right: ['actions'] },
      columnSizing: { amount: 184, name: 312 },
      density: 'normal',
      version: 'current-version',
    })
  })

  it('invalidates column settings only when the table layout version changes', () => {
    writeDataTableLayout(TABLE_ID, {
      columnVisibility: { amount: false },
      columnSizing: { amount: 184 },
      density: 'compact',
      version: 'old-version',
    })

    expect(readCompatibleDataTableLayout(TABLE_ID, 'new-version')).toEqual({
      density: 'compact',
    })
  })
})
