import { Button, Loader, Stack, Text } from '@mantine/core'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { getAmgDiscountAnalysisCapability } from '../api/originalAmgDiscountAnalysisApi'
import { isAmgDiscountAnalysisCatalogueEntry, type AmgDiscountAnalysisCapability } from '../data/originalAmgDiscountAnalysis'
import type { ReportCatalogueEntry } from '../types'
import { ReportCapabilityStatus } from './ReportCapabilityStatus'
const Panel = lazy(() => import('./OriginalAmgDiscountAnalysisPanel').then(module => ({ default: module.OriginalAmgDiscountAnalysisPanel })))
type Scope = { present: boolean; enabled: boolean; callerKey: string | null; attempt: number }
function useAmgDiscountAnalysisCapability(scope: Scope) {
  const [load, setLoad] = useState<{ scope: Scope; capability: AmgDiscountAnalysisCapability | null; failed: boolean } | null>(null)
  useEffect(() => {
    if (!scope.present || !scope.enabled || !scope.callerKey) return
    const controller = new AbortController()
    getAmgDiscountAnalysisCapability(controller.signal).then(capability => { if (!controller.signal.aborted) setLoad({ scope, capability, failed: false }) })
      .catch(() => { if (!controller.signal.aborted) setLoad({ scope, capability: null, failed: true }) })
    return () => controller.abort()
  }, [scope])
  return load?.scope === scope ? load : null
}
export function OriginalAmgDiscountAnalysisCatalogueLaunch({ report, worlds, enabled, disabled, callerKey }: {
  report: ReportCatalogueEntry; worlds: readonly string[]; enabled: boolean; disabled: boolean; callerKey: string | null
}) {
  const { t } = useI18n(), [attempt, setAttempt] = useState(0), [opened, setOpened] = useState(false)
  const present = isAmgDiscountAnalysisCatalogueEntry(report, worlds)
  const scope = useMemo(() => ({ present, enabled, callerKey, attempt }), [present, enabled, callerKey, attempt]), current = useAmgDiscountAnalysisCapability(scope), capability = current?.capability ?? null
  if (!present) return null
  const allowed = enabled && !disabled && !!callerKey && !!capability?.Executable
  return <Stack gap={6}><ReportCapabilityStatus current={current} enabled={enabled} callerKey={callerKey} disabled={disabled} retry={() => setAttempt(n => n + 1)}
    loadingLabel="Перевірка доступності звіту" failureMessage="Не вдалося перевірити доступність звіту." />
    <Button disabled={!allowed} onClick={() => setOpened(true)}>{t('AMG · Аналіз знижок і націнок')}</Button>
    <Text size="sm" c="dimmed">{t('Поточні дані перевіряються під час формування. Оберіть дату та оновіть назви для відбору у власній формі AMG.')}</Text>
    <AppModal opened={opened && allowed} title={t('AMG · Аналіз знижок і націнок')} size={1250} onClose={() => setOpened(false)} closeButtonProps={{ 'aria-label': t('Закрити аналіз знижок AMG') }}>
      {opened && allowed && capability ? <Suspense fallback={<Loader size="sm" />}><Panel key={JSON.stringify(scope)} capability={capability} callerKey={callerKey} canGenerate={allowed}
        initialThrough={new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Kyiv' })} /></Suspense> : null}
    </AppModal></Stack>
}
