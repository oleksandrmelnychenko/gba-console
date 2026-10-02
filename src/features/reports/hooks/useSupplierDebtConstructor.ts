import { useMemo, useState } from 'react'
import { isSupplierDebtCapabilities, type SupplierDebtCapabilities } from '../data/supplierDebt'

export type SupplierDebtModalProps = {
  capability: SupplierDebtCapabilities | null
  enabled: boolean
  generating: boolean
  callerKey: string | null
  initialMonth: string
  onClose: () => void
  onLoadingChange: (loading: boolean) => void
}

/** Keeps this monthly variant outside the native report builder's filters and cache. */
export function useSupplierDebtConstructor({ enabled, disabled, callerKey, from, today }: {
  enabled: boolean; disabled: boolean; callerKey: string | null; from: string; today: string
}) {
  const [capability, setCapability] = useState<SupplierDebtCapabilities | null>(null)
  const scope = useMemo(() => ({ callerKey, enabled, capability }), [callerKey, enabled, capability])
  const [loading, setLoading] = useState<{ scope: typeof scope; value: boolean } | null>(null)
  const generating = loading?.scope === scope && loading.value
  function open(next: SupplierDebtCapabilities): boolean {
    if (!enabled || disabled || !isSupplierDebtCapabilities(next) || !next.RuntimeImplemented) return false
    setCapability(structuredClone(next))
    return true
  }
  return { open, modalProps: { capability, enabled, generating, callerKey, initialMonth: (from || today).slice(0, 7),
    onClose: () => { if (!generating) setCapability(null) },
    onLoadingChange: (value: boolean) => setLoading(previous => value || previous?.scope === scope ? { scope, value } : previous),
  } satisfies SupplierDebtModalProps }
}
