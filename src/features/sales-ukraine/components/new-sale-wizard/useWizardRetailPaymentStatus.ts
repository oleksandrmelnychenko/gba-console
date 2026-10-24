import { useEffect, useState } from 'react'
import { getRetailPaymentStatusBySaleId } from '../../api/salesUkraineApi'
import type { SalesUkraineRetailPaymentStatus, SalesUkraineSale } from '../../types'

export function useWizardRetailPaymentStatus(sale: SalesUkraineSale | null) {
  const saleId = sale?.RetailClient ? sale.Id : undefined
  const [result, setResult] = useState<{
    saleId: number
    status: SalesUkraineRetailPaymentStatus | null
  } | null>(null)

  useEffect(() => {
    if (!saleId) return
    let cancelled = false

    void getRetailPaymentStatusBySaleId(saleId).then(
      (status) => { if (!cancelled) setResult({ saleId, status }) },
      () => { if (!cancelled) setResult({ saleId, status: null }) },
    )

    return () => { cancelled = true }
  }, [saleId])

  // Never validate another sale using the previous sale's payment response.
  return saleId && result?.saleId === saleId ? result.status : null
}
