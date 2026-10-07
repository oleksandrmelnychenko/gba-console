import { Loader } from '@mantine/core'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { getAmgDiscountReadiness } from '../api/originalAmgClientDiscountsApi'
import { isAmgDiscountCatalogueEntry, type AmgDiscountReadiness } from '../data/originalAmgClientDiscounts'
import type { ReportCatalogueEntry } from '../types'
import { ClientDiscountsCatalogueFrame } from './ClientDiscountsCatalogueFrame'
const Panel = lazy(() => import('./OriginalAmgClientDiscountsPanel').then(module => ({ default: module.OriginalAmgClientDiscountsPanel })))
type Scope = { present: boolean; enabled: boolean; callerKey: string | null; attempt: number }
function useAmgReadiness(scope: Scope) {
  const [load, setLoad] = useState<{ scope: Scope; readiness: AmgDiscountReadiness | null; failed: boolean } | null>(null)
  useEffect(() => {
    if (!scope.present || !scope.enabled || !scope.callerKey) return
    const controller = new AbortController()
    getAmgDiscountReadiness(controller.signal).then(readiness => { if (!controller.signal.aborted) setLoad({ scope, readiness, failed: false }) })
      .catch(() => { if (!controller.signal.aborted) setLoad({ scope, readiness: null, failed: true }) })
    return () => controller.abort()
  }, [scope])
  return load?.scope === scope ? load : null
}
export function OriginalAmgClientDiscountsCatalogueLaunch({ report, worlds, enabled, disabled, callerKey }: {
  report: ReportCatalogueEntry; worlds: readonly string[]; enabled: boolean; disabled: boolean; callerKey: string | null
}) {
  const [attempt, setAttempt] = useState(0), [opened, setOpened] = useState(false)
  const present = isAmgDiscountCatalogueEntry(report, worlds)
  const scope = useMemo(() => ({ present, enabled, callerKey, attempt }), [present, enabled, callerKey, attempt]), current = useAmgReadiness(scope), readiness = current?.readiness ?? null
  if (!present) return null
  const allowed = enabled && !disabled && !!callerKey && !!readiness?.Executable
  return <ClientDiscountsCatalogueFrame current={current} enabled={enabled} callerKey={callerKey} disabled={disabled} retry={() => setAttempt(n => n + 1)}
    allowed={allowed} opened={opened} onOpen={() => setOpened(true)} onClose={() => setOpened(false)} title="AMG · ОтчетПоСкидкам"
    closeLabel="Закрити звіт про знижки AMG" unavailableLabel="Повні синхронізовані дані AMG ще недоступні."
    unavailable={!readiness?.Executable && !!current && !current.failed}>
      {opened && allowed && readiness ? <Suspense fallback={<Loader size="sm" />}><Panel key={JSON.stringify(scope)} readiness={readiness} callerKey={callerKey} canGenerate={allowed}
        initialThrough={new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Kyiv' })} /></Suspense> : null}
  </ClientDiscountsCatalogueFrame>
}
