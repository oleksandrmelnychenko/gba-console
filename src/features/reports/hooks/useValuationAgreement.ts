import { useEffect, useState } from 'react'
import { searchValuationAgreements, type ValuationAgreement } from '../api/reportsApi'

type LookupResult = { key: string; items: ValuationAgreement[]; failed: boolean }

export function useValuationAgreementLookup(query: string, enabled: boolean, retry: number) {
  const [result, setResult] = useState<LookupResult | null>(null)
  const key = `${retry}:${query}`
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    searchValuationAgreements({ value: query, limit: 30, offset: 0 }, controller.signal)
      .then(items => { if (!controller.signal.aborted) setResult({ key, items, failed: false }) })
      .catch(() => { if (!controller.signal.aborted) setResult({ key, items: [], failed: true }) })
    return () => controller.abort()
  }, [enabled, key, query])
  return { result: enabled && result?.key === key ? result : null, loading: enabled && result?.key !== key }
}

function agreementError(result: LookupResult | null, agreement: ValuationAgreement | undefined) {
  if (result?.failed) return 'Не вдалося перевірити обраний договір. Спробуйте ще раз.'
  if (result && !agreement) return 'Обраний договір недоступний для оцінки. Виберіть доступний договір.'
  return null
}

export function useValuationAgreement(value: number | undefined, enabled: boolean) {
  const [retry, setRetry] = useState(0)
  const lookup = useValuationAgreementLookup(String(value ?? ''), enabled && value !== undefined, retry)
  const agreement = lookup.result?.items.find(item => item.Id === value)
  return { agreement, error: agreementError(lookup.result, agreement), loading: lookup.loading,
    retry: () => setRetry(current => current + 1) }
}
