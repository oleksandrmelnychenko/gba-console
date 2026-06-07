import { useCallback, useState } from 'react'
import type { DataTableDensity } from './types'

const STORAGE_PREFIX = 'gba-data-table'

function densityStorageKey(tableId: string) {
  return `${STORAGE_PREFIX}:${tableId}:density`
}

function readStoredDensity(tableId: string, fallback: DataTableDensity): DataTableDensity {
  if (typeof window === 'undefined') {
    return fallback
  }

  const stored = window.localStorage.getItem(densityStorageKey(tableId))

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
      }
    },
    [tableId],
  )

  const toggleDensity = useCallback(() => {
    setDensityState((current) => {
      const next: DataTableDensity = current === 'compact' ? 'normal' : 'compact'
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(densityStorageKey(tableId), next)
      }
      return next
    })
  }, [tableId])

  return { density, setDensity, toggleDensity }
}
