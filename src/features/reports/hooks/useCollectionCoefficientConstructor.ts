import { useState } from 'react'
import { isCollectionCoefficientCapabilities, type CollectionCoefficientCapabilities } from '../data/collectionCoefficient'

export type CollectionCoefficientModalProps = {
  capability: CollectionCoefficientCapabilities | null
  enabled: boolean
  generating: boolean
  callerKey: string | null
  initialMonth: string
  onClose: () => void
  onLoadingChange: (loading: boolean) => void
}

/** Keeps the independent constructor flow outside the native report workspace. */
export function useCollectionCoefficientConstructor({ enabled, disabled, callerKey, from, today }: {
  enabled: boolean; disabled: boolean; callerKey: string | null; from: string; today: string
}) {
  const initialMonth = (from || today).slice(0, 7)
  const [capability, setCapability] = useState<CollectionCoefficientCapabilities | null>(null)
  const [generating, setGenerating] = useState(false)
  function open(next: CollectionCoefficientCapabilities): boolean {
    if (!enabled || disabled || !isCollectionCoefficientCapabilities(next) || !next.Executable) return false
    setCapability(structuredClone(next))
    return true
  }
  return { open, modalProps: { capability, generating, enabled, callerKey, initialMonth,
    onClose: () => { if (!generating) setCapability(null) }, onLoadingChange: setGenerating } satisfies CollectionCoefficientModalProps }
}

