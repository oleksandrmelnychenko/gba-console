import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Loader } from '@mantine/core'
import { getOriginalStockAvailabilityCapability } from '../api/originalStockAvailabilityApi'
import { stockCatalogueMatches, type StockCapability } from '../data/originalStockAvailability'
import type { ReportCatalogueEntry } from '../types'
import { ClientDiscountsCatalogueFrame } from './ClientDiscountsCatalogueFrame'
const Panel = lazy(() => import('./OriginalStockAvailabilityPanel').then(v => ({ default: v.OriginalStockAvailabilityPanel })))
const stockPointFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
type Scope = { matches: boolean; enabled: boolean; callerKey: string | null; attempt: number }
function useStockCapability(scope: Scope) {
  const [stored, setStored] = useState<{ scope: Scope; capability: StockCapability | null; failed: boolean } | null>(null)
  useEffect(() => {
    if (!scope.matches || !scope.enabled || !scope.callerKey) return
    const controller = new AbortController()
    getOriginalStockAvailabilityCapability(controller.signal).then(capability => { if (!controller.signal.aborted) setStored({ scope, capability, failed: false }) })
      .catch(() => { if (!controller.signal.aborted) setStored({ scope, capability: null, failed: true }) })
    return () => controller.abort()
  }, [scope])
  return stored?.scope === scope ? stored : null
}
function currentStockPoint() {
  return stockPointFormatter.format(new Date())
}
export function OriginalStockAvailabilityCatalogueLaunch({ report, worlds, enabled, disabled, callerKey }: { report: ReportCatalogueEntry; worlds: readonly string[]; enabled: boolean; disabled: boolean; callerKey: string | null }) {
  const [opened, setOpened] = useState(false), [attempt, setAttempt] = useState(0), matches = stockCatalogueMatches(report, worlds)
  const scope = useMemo(() => ({ matches, enabled, callerKey, attempt }), [matches, enabled, callerKey, attempt]), current = useStockCapability(scope), capability = current?.capability ?? null
  const allowed = enabled && !disabled && !!callerKey && capability?.Executable === true
  if (!matches) return null
  return <ClientDiscountsCatalogueFrame current={current} enabled={enabled} disabled={disabled} callerKey={callerKey} retry={() => setAttempt(v => v + 1)} allowed={allowed} opened={opened} onOpen={() => setOpened(true)} onClose={() => setOpened(false)}
    title="Fenix · доступність товарів на складах" closeLabel="Закрити доступність товарів" unavailable={current !== null && !capability?.Executable} unavailableLabel="Доступність товарів поки недоступна на цій версії сервера.">
    {opened && allowed && capability ? <Suspense fallback={<Loader size="sm" />}><Panel key={JSON.stringify(scope)} capability={capability} callerKey={callerKey} canGenerate={enabled && !disabled} initialAt={currentStockPoint()} /></Suspense> : null}
  </ClientDiscountsCatalogueFrame>
}
