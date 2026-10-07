import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Loader } from '@mantine/core'
import { getOriginalOrderAnalysisCapability } from '../api/originalOrderAnalysesApi'
import { orderAnalysisCatalogueKind, orderAnalysisTitles, type OrderAnalysisCapability, type OrderAnalysisKind } from '../data/originalOrderAnalyses'
import type { ReportCatalogueEntry } from '../types'
import { ClientDiscountsCatalogueFrame } from './ClientDiscountsCatalogueFrame'
import { formatKyivBusinessDate } from '../../../shared/date/dateTime'
const Panel = lazy(() => import('./OriginalOrderAnalysesPanel').then(v => ({ default: v.OriginalOrderAnalysesPanel })))
type Scope = { kind: OrderAnalysisKind | null; enabled: boolean; callerKey: string | null; attempt: number }
function useOrderCapability(scope: Scope) {
  const [stored, setStored] = useState<{ scope: Scope; capability: OrderAnalysisCapability | null; failed: boolean } | null>(null)
  useEffect(() => {
    if (scope.kind === null || !scope.enabled || !scope.callerKey) return
    const controller = new AbortController()
    getOriginalOrderAnalysisCapability(scope.kind, controller.signal).then(capability => { if (!controller.signal.aborted) setStored({ scope, capability, failed: false }) })
      .catch(() => { if (!controller.signal.aborted) setStored({ scope, capability: null, failed: true }) })
    return () => controller.abort()
  }, [scope])
  return stored?.scope === scope ? stored : null
}
export function OriginalOrderAnalysesCatalogueLaunch({ report, worlds, enabled, disabled, callerKey }: { report: ReportCatalogueEntry; worlds: readonly string[]; enabled: boolean; disabled: boolean; callerKey: string | null }) {
  const kind = orderAnalysisCatalogueKind(report, worlds), [opened, setOpened] = useState(false), [attempt, setAttempt] = useState(0)
  const scope = useMemo(() => ({ kind, enabled, callerKey, attempt }), [kind, enabled, callerKey, attempt]), current = useOrderCapability(scope), capability = current?.capability ?? null
  const allowed = enabled && !disabled && !!callerKey && capability?.OurOnlyReaderImplemented === true
  if (kind === null) return null
  const title = `Fenix · ${orderAnalysisTitles[kind]}`, today = formatKyivBusinessDate(new Date())
  return <ClientDiscountsCatalogueFrame current={current} enabled={enabled} disabled={disabled} callerKey={callerKey} retry={() => setAttempt(v => v + 1)} allowed={allowed} opened={opened}
    onOpen={() => setOpened(true)} onClose={() => setOpened(false)} title={title} closeLabel="Закрити аналіз замовлень" unavailable={current !== null && capability === null} unavailableLabel="Аналіз замовлень поки недоступний на цій версії сервера.">
    {opened && allowed && capability ? <Suspense fallback={<Loader size="sm" />}><Panel key={JSON.stringify(scope)} capability={capability} callerKey={callerKey} canGenerate={enabled && !disabled} initialFrom={`${today.slice(0, 7)}-01`} initialThrough={today} /></Suspense> : null}
  </ClientDiscountsCatalogueFrame>
}
