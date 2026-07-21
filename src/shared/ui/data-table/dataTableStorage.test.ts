import { beforeEach, describe, expect, it } from 'vitest'
import { readCompatibleDataTableLayout, readDataTableLayout } from './dataTableStorage'

const TABLE_ID = 'density-migration-test'
const LAYOUT_KEY = `gba-data-table:${TABLE_ID}:layout`
const LEGACY_DENSITY_KEY = `gba-data-table:${TABLE_ID}:density`

describe('readDataTableLayout density compatibility', () => {
  beforeEach(() => {
    window.localStorage.removeItem(LAYOUT_KEY)
    window.localStorage.removeItem(LEGACY_DENSITY_KEY)
  })

  it('uses the legacy standalone density when layout has none', () => {
    window.localStorage.setItem(LEGACY_DENSITY_KEY, 'compact')

    expect(readDataTableLayout(TABLE_ID)).toMatchObject({ density: 'compact' })
  })

  it('prefers density already stored in the table layout', () => {
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify({ density: 'normal' }))
    window.localStorage.setItem(LEGACY_DENSITY_KEY, 'compact')

    expect(readDataTableLayout(TABLE_ID)).toMatchObject({ density: 'normal' })
  })

  it('keeps density while resetting versioned column layout state', () => {
    window.localStorage.setItem(
      LAYOUT_KEY,
      JSON.stringify({
        columnOrder: ['obsolete-column'],
        density: 'compact',
        version: 'old-version',
      }),
    )

    expect(readCompatibleDataTableLayout(TABLE_ID, 'new-version')).toEqual({ density: 'compact' })
  })

  it('keeps legacy density when the first internal layout is versioned', () => {
    window.localStorage.setItem(LEGACY_DENSITY_KEY, 'compact')

    expect(readCompatibleDataTableLayout(TABLE_ID, 'current-version')).toEqual({ density: 'compact' })
  })
})
