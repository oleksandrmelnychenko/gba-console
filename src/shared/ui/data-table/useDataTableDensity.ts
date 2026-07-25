import { useCallback, useState } from 'react'
import type { DataTableDensity } from './types'

const STORAGE_PREFIX = 'gba-data-table'
const STANDARD_DENSITY_DEFAULT_VERSION = '1'

function densityStorageKey(tableId: string) {
  return `${STORAGE_PREFIX}:${tableId}:density`
}

function densityDefaultVersionStorageKey(tableId: string) {
  return `${STORAGE_PREFIX}:${tableId}:density-default-version`
}

function readStoredDensity(tableId: string, fallback: DataTableDensity): DataTableDensity {
  if (typeof window === 'undefined') {
    return fallback
  }

  const storageKey = densityStorageKey(tableId)
  const versionKey = densityDefaultVersionStorageKey(tableId)
  const stored = window.localStorage.getItem(storageKey)
  const migrated =
    window.localStorage.getItem(versionKey) === STANDARD_DENSITY_DEFAULT_VERSION

  if (!migrated) {
    // These page-level density controls predate the standard-density default
    // and use a standalone storage key instead of DataTable's layout object.
    // Drop the old compact value once; compact choices made afterwards carry
    // the version marker and remain an explicit user preference.
    if (stored === 'compact') {
      window.localStorage.removeItem(storageKey)
    }
    window.localStorage.setItem(versionKey, STANDARD_DENSITY_DEFAULT_VERSION)

    return stored === 'normal' ? stored : fallback
  }

  return stored === 'compact' || stored === 'normal' ? stored : fallback
}

/**
 * Page-level row density that can be placed next to the table's other controls.
 * Pass `density` to <DataTable density=... showDensityToggle={false} /> and render
 * a <DataTableDensityToggle /> wherever the page keeps its action buttons.
 */
export function useDataTableDensity(tableId: string, fallback: DataTableDensity = 'normal') {
  const [density, setDensityState] = useState<DataTableDensity>(() => readStoredDensity(tableId, fallback))

  const setDensity = useCallback(
    (next: DataTableDensity) => {
      setDensityState(next)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(densityStorageKey(tableId), next)
        window.localStorage.setItem(
          densityDefaultVersionStorageKey(tableId),
          STANDARD_DENSITY_DEFAULT_VERSION,
        )
      }
    },
    [tableId],
  )

  const toggleDensity = useCallback(() => {
    setDensityState((current) => {
      const next: DataTableDensity = current === 'compact' ? 'normal' : 'compact'
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(densityStorageKey(tableId), next)
        window.localStorage.setItem(
          densityDefaultVersionStorageKey(tableId),
          STANDARD_DENSITY_DEFAULT_VERSION,
        )
      }
      return next
    })
  }, [tableId])

  return { density, setDensity, toggleDensity }
}
