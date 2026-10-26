import { useEffect, useState } from 'react'
import { getAnalysisHierarchyStatus } from '../api/currentVparivanieAnalysisApi'
import type { AnalysisHierarchyStatus } from '../data/currentVparivanieAnalysis'

const STATUS_TTL_MS = 60_000
export const ANALYSIS_HIERARCHY_STATUS_FAILED: AnalysisHierarchyStatus = {
  counterpartyGroup: 'Не вдалося перевірити ієрархію груп контрагентів; умови груп тимчасово недоступні.',
  warehouseGroup: 'Не вдалося перевірити ієрархію груп складів; умови груп тимчасово недоступні.',
}

let cached: { at: number; promise: Promise<AnalysisHierarchyStatus> } | null = null

export function loadAnalysisHierarchyStatus(now = Date.now()): Promise<AnalysisHierarchyStatus> {
  if (!cached || now - cached.at > STATUS_TTL_MS) {
    const entry = {
      at: now,
      promise: getAnalysisHierarchyStatus().catch(() => {
        if (cached === entry) cached = null
        return ANALYSIS_HIERARCHY_STATUS_FAILED
      }),
    }
    cached = entry
  }
  return cached.promise
}

export function resetAnalysisHierarchyStatus(): void {
  cached = null
}

export function useAnalysisHierarchyStatus(enabled: boolean): AnalysisHierarchyStatus | null {
  const [status, setStatus] = useState<AnalysisHierarchyStatus | null>(null)
  useEffect(() => {
    if (!enabled) return
    let live = true
    void loadAnalysisHierarchyStatus().then(value => { if (live) setStatus(value) })
    return () => { live = false }
  }, [enabled])
  return enabled ? status : null
}
