import { useMemo, useState } from 'react'
import { currentLiquidityDefaultEndpoints, isCurrentLiquidityCapabilities, type CurrentLiquidityCapabilities, type CurrentLiquidityEndpoints } from '../data/currentLiquidity'

export type CurrentLiquidityModalProps = { capability: CurrentLiquidityCapabilities | null; enabled: boolean; generating: boolean
  callerKey: string | null; initialEndpoints: CurrentLiquidityEndpoints; onClose: () => void; onLoadingChange: (loading: boolean) => void }
export function useCurrentLiquidityConstructor({ enabled, disabled, callerKey, today }: {
  enabled: boolean; disabled: boolean; callerKey: string | null; today: string
}) {
  const scope = useMemo(() => ({ enabled, callerKey }), [enabled, callerKey])
  const [selection, setSelection] = useState<{ scope: typeof scope; capability: CurrentLiquidityCapabilities } | null>(null)
  const capability = selection?.scope === scope ? selection.capability : null
  const runScope = useMemo(() => ({ scope, capability }), [scope, capability])
  const [loading, setLoading] = useState<{ scope: typeof runScope; value: boolean } | null>(null)
  const generating = loading?.scope === runScope && loading.value
  function open(next: CurrentLiquidityCapabilities): boolean {
    if (!enabled || disabled || !callerKey || !isCurrentLiquidityCapabilities(next) || !next.RuntimeImplemented) return false
    setSelection({ scope, capability: structuredClone(next) }); return true
  }
  return { open, modalProps: { capability, enabled, generating, callerKey, initialEndpoints: currentLiquidityDefaultEndpoints(today),
    onClose: () => { if (!generating) setSelection(null) },
    onLoadingChange: (value: boolean) => setLoading(previous => value || previous?.scope === runScope ? { scope: runScope, value } : previous),
  } satisfies CurrentLiquidityModalProps }
}
