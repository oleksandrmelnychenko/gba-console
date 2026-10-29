import { useEffect, useState } from 'react'
import { getCustomerGroupRegionCodes, type CustomerGroupChoice } from '../api/customerGroupSelectionsApi'
export function useCustomerGroupCodeCatalogue(enabled: boolean) {
  const [codes, setCodes] = useState<CustomerGroupChoice[] | null>(null)
  const [codesFailed, setCodesFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    void getCustomerGroupRegionCodes(controller.signal).then(values => {
      if (!controller.signal.aborted) { setCodes(values); setCodesFailed(false) }
    }).catch(() => { if (!controller.signal.aborted) setCodesFailed(true) })
    return () => controller.abort()
  }, [enabled, attempt])
  return { codes, codesFailed, retryCodes: () => setAttempt(value => value + 1) }
}
