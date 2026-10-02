import { useMemo, useState } from 'react'
import { isDefectProductionCapabilities, type DefectProductionCapabilities } from '../data/defectProduction'

export type DefectProductionModalProps = { capability: DefectProductionCapabilities | null; enabled: boolean; generating: boolean
  callerKey: string | null; initialMonth: string; onClose: () => void; onLoadingChange: (loading: boolean) => void }
export function useDefectProductionConstructor({ enabled, disabled, callerKey, from, today }: {
  enabled: boolean; disabled: boolean; callerKey: string | null; from: string; today: string
}) {
  const scope = useMemo(() => ({ enabled, callerKey }), [enabled, callerKey])
  const [selection, setSelection] = useState<{ scope: typeof scope; capability: DefectProductionCapabilities } | null>(null)
  const capability = selection?.scope === scope ? selection.capability : null
  const runScope = useMemo(() => ({ scope, capability }), [scope, capability])
  const [loading, setLoading] = useState<{ scope: typeof runScope; value: boolean } | null>(null)
  const generating = loading?.scope === runScope && loading.value
  function open(next: DefectProductionCapabilities): boolean {
    if (!enabled || disabled || !callerKey || !isDefectProductionCapabilities(next) || !next.RuntimeImplemented) return false
    setSelection({ scope, capability: structuredClone(next) }); return true
  }
  return { open, modalProps: { capability, enabled, generating, callerKey, initialMonth: (from || today).slice(0, 7),
    onClose: () => { if (!generating) setSelection(null) },
    onLoadingChange: (value: boolean) => setLoading(previous => value || previous?.scope === runScope ? { scope: runScope, value } : previous),
  } satisfies DefectProductionModalProps }
}
