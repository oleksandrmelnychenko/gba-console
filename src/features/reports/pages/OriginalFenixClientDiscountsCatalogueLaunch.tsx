import { Loader } from '@mantine/core'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { getFenixDiscountReadiness } from '../api/originalFenixClientDiscountsApi'
import { isFenixDiscountCatalogueEntry, type FenixDiscountReadiness } from '../data/originalFenixClientDiscounts'
import type { ReportCatalogueEntry } from '../types'
import { ClientDiscountsCatalogueFrame } from './ClientDiscountsCatalogueFrame'
const Panel = lazy(() => import('./OriginalFenixClientDiscountsPanel').then(module => ({ default: module.OriginalFenixClientDiscountsPanel })))
type Scope = { present: boolean; enabled: boolean; callerKey: string | null; attempt: number }
function useFenixReadiness(scope: Scope) {
  const [load, setLoad] = useState<{ scope: Scope; readiness: FenixDiscountReadiness | null; failed: boolean } | null>(null)
  useEffect(() => {
    if (!scope.present || !scope.enabled || !scope.callerKey) return
    const controller = new AbortController()
    getFenixDiscountReadiness(controller.signal).then(readiness => { if (!controller.signal.aborted) setLoad({ scope, readiness, failed: false }) })
      .catch(() => { if (!controller.signal.aborted) setLoad({ scope, readiness: null, failed: true }) })
    return () => controller.abort()
  }, [scope])
  return load?.scope === scope ? load : null
}
export function OriginalFenixClientDiscountsCatalogueLaunch({ report, worlds, enabled, disabled, callerKey }: {
  report: ReportCatalogueEntry; worlds: readonly string[]; enabled: boolean; disabled: boolean; callerKey: string | null
}) {
  const [attempt, setAttempt] = useState(0), [opened, setOpened] = useState(false)
  const present = isFenixDiscountCatalogueEntry(report, worlds)
  const scope = useMemo(() => ({ present, enabled, callerKey, attempt }), [present, enabled, callerKey, attempt]), current = useFenixReadiness(scope), readiness = current?.readiness ?? null
  if (!present) return null
  const allowed = enabled && !disabled && !!callerKey && !!readiness?.Executable
  return <ClientDiscountsCatalogueFrame current={current} enabled={enabled} callerKey={callerKey} disabled={disabled} retry={() => setAttempt(n => n + 1)}
    allowed={allowed} opened={opened} onOpen={() => setOpened(true)} onClose={() => setOpened(false)} title="FENIX · ОтчетПоСкидкам"
    closeLabel="Закрити звіт про знижки FENIX" unavailableLabel="Повні синхронізовані дані FENIX ще недоступні."
    unavailable={!readiness?.Executable && !!current && !current.failed}>
      {opened && allowed && readiness ? <Suspense fallback={<Loader size="sm" />}><Panel key={JSON.stringify(scope)} readiness={readiness} callerKey={callerKey} canGenerate={allowed}
        initialThrough={new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Kyiv' })} /></Suspense> : null}
  </ClientDiscountsCatalogueFrame>
}
