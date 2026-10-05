import { Loader } from '@mantine/core'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { getFenixDiscountCapability } from '../api/originalFenixDiscountAnalysisApi'
import { isFenixDiscountCatalogueEntry, type FenixDiscountCapability } from '../data/originalFenixDiscountAnalysis'
import type { ReportCatalogueEntry } from '../types'
import { DiscountAnalysisCatalogueFrame } from './DiscountAnalysisCatalogueFrame'
const Panel = lazy(() => import('./OriginalFenixDiscountAnalysisPanel').then(module => ({ default: module.OriginalFenixDiscountAnalysisPanel })))
type Scope = { present: boolean; enabled: boolean; callerKey: string | null; attempt: number }
function useFenixCapability(scope: Scope) {
  const [load, setLoad] = useState<{ scope: Scope; capability: FenixDiscountCapability | null; failed: boolean } | null>(null)
  useEffect(() => {
    if (!scope.present || !scope.enabled || !scope.callerKey) return
    const controller = new AbortController()
    getFenixDiscountCapability(controller.signal).then(capability => { if (!controller.signal.aborted) setLoad({ scope, capability, failed: false }) })
      .catch(() => { if (!controller.signal.aborted) setLoad({ scope, capability: null, failed: true }) })
    return () => controller.abort()
  }, [scope])
  return load?.scope === scope ? load : null
}
export function OriginalFenixDiscountAnalysisCatalogueLaunch({ report, worlds, enabled, disabled, callerKey }: {
  report: ReportCatalogueEntry; worlds: readonly string[]; enabled: boolean; disabled: boolean; callerKey: string | null
}) {
  const [attempt, setAttempt] = useState(0), [opened, setOpened] = useState(false)
  const present = isFenixDiscountCatalogueEntry(report, worlds)
  const scope = useMemo(() => ({ present, enabled, callerKey, attempt }), [present, enabled, callerKey, attempt]), current = useFenixCapability(scope), capability = current?.capability ?? null
  if (!present) return null
  const allowed = enabled && !disabled && !!callerKey && !!capability?.Executable
  return <DiscountAnalysisCatalogueFrame current={current} enabled={enabled} callerKey={callerKey} disabled={disabled} retry={() => setAttempt(n => n + 1)}
    allowed={allowed} opened={opened} onOpen={() => setOpened(true)} onClose={() => setOpened(false)}
    title="Fenix · Аналіз знижок і націнок" description="Поточні дані перевіряються під час формування. Оберіть дату та, за потреби, контрагентів і номенклатуру." closeLabel="Закрити аналіз знижок Fenix">
      {opened && allowed && capability ? <Suspense fallback={<Loader size="sm" />}><Panel key={JSON.stringify(scope)} capability={capability} callerKey={callerKey} canGenerate={allowed}
        initialThrough={new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Kyiv' })} /></Suspense> : null}
    </DiscountAnalysisCatalogueFrame>
}
