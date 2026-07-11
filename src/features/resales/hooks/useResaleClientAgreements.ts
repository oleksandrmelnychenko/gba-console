import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getResaleClientAgreements } from '../api/resalesApi'
import type { ResaleClientAgreement } from '../types'

export function filterEligibleResaleClientAgreements(
  agreements: ResaleClientAgreement[],
  organizationId?: number,
): ResaleClientAgreement[] {
  if (!organizationId) {
    return []
  }

  return agreements.filter((clientAgreement) => {
    const agreement = clientAgreement.Agreement

    return clientAgreement.Deleted !== true
      && agreement != null
      && agreement.Deleted !== true
      && agreement.IsActive === true
      && agreement.ForReSale === true
      && agreement.OrganizationId === organizationId
  })
}

export function useResaleClientAgreements(organizationId?: number) {
  const [loadedAgreements, setLoadedAgreements] = useState<ResaleClientAgreement[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setLoading] = useState(false)
  const requestIdRef = useRef(0)
  const abortControllerRef = useRef<AbortController | null>(null)
  const agreements = useMemo(
    () => filterEligibleResaleClientAgreements(loadedAgreements, organizationId),
    [loadedAgreements, organizationId],
  )

  const loadForClient = useCallback(async (clientNetId?: string | null) => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    setLoadedAgreements([])
    setError(null)

    if (!clientNetId) {
      setLoading(false)
      return
    }

    const controller = new AbortController()
    abortControllerRef.current = controller
    setLoading(true)

    try {
      const nextAgreements = await getResaleClientAgreements(clientNetId, controller.signal)

      if (requestIdRef.current === requestId) {
        setLoadedAgreements(nextAgreements)
      }
    } catch (loadError) {
      if (requestIdRef.current === requestId && !isAbortError(loadError)) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load client agreements')
      }
    } finally {
      if (requestIdRef.current === requestId) {
        abortControllerRef.current = null
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => () => {
    requestIdRef.current += 1
    abortControllerRef.current?.abort()
  }, [])

  return {
    agreements,
    error,
    isLoading,
    loadForClient,
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}
