import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Loader } from '@mantine/core'
import { getOriginalCashAvailabilityCapability } from '../api/originalCashAvailabilityApi'
import { availabilityCatalogueMatches, type AvailabilityCapability } from '../data/originalCashAvailability'
import type { ReportCatalogueEntry } from '../types'
import { ClientDiscountsCatalogueFrame } from './ClientDiscountsCatalogueFrame'
const Panel = lazy(() => import('./OriginalCashAvailabilityPanel').then(v => ({ default: v.OriginalCashAvailabilityPanel })))
type Scope = { matches: boolean; enabled: boolean; callerKey: string | null; attempt: number }
function useAvailabilityCapability(scope: Scope) {
  const [loaded, setLoaded] = useState<{ scope: Scope; capability: AvailabilityCapability | null; failed: boolean } | null>(null)
  useEffect(() => {
    if (!scope.matches || !scope.enabled || !scope.callerKey) return
    const controller = new AbortController()
    getOriginalCashAvailabilityCapability(controller.signal).then(capability => { if (!controller.signal.aborted) setLoaded({ scope, capability, failed: false }) })
      .catch(() => { if (!controller.signal.aborted) setLoaded({ scope, capability: null, failed: true }) })
    return () => controller.abort()
  }, [scope])
  return loaded?.scope === scope ? loaded : null
}
function currentKyivPoint() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date()).replace(' ', 'T')
}
export function OriginalCashAvailabilityCatalogueLaunch({ report, worlds, enabled, disabled, callerKey }: { report: ReportCatalogueEntry; worlds: readonly string[]; enabled: boolean; disabled: boolean; callerKey: string | null }) {
  const [opened, setOpened] = useState(false), [attempt, setAttempt] = useState(0), matches = availabilityCatalogueMatches(report, worlds)
  const scope = useMemo(() => ({ matches, enabled, callerKey, attempt }), [matches, enabled, callerKey, attempt]), current = useAvailabilityCapability(scope), capability = current?.capability ?? null
  const allowed = enabled && !disabled && !!callerKey && capability?.Executable === true
  if (!matches) return null
  return <ClientDiscountsCatalogueFrame current={current} enabled={enabled} disabled={disabled} callerKey={callerKey} retry={() => setAttempt(v => v + 1)} allowed={allowed} opened={opened}
    onOpen={() => setOpened(true)} onClose={() => setOpened(false)} title="Fenix · доступні кошти" closeLabel="Закрити доступні кошти" unavailable={current !== null && !capability?.Executable}
    unavailableLabel="Повний звіт доступних коштів поки недоступний на цій версії сервера.">
    {opened && allowed && capability ? <Suspense fallback={<Loader size="sm" />}><Panel key={JSON.stringify(scope)} capability={capability} callerKey={callerKey} canGenerate={enabled && !disabled} initialDateKon={currentKyivPoint()} /></Suspense> : null}
  </ClientDiscountsCatalogueFrame>
}
