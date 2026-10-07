import { Button, Loader, Stack, Text } from '@mantine/core'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { WarehousePeriodCapabilityStatus } from './WarehousePeriodControls'
import { getMoneyFlowCapability } from '../api/originalMoneyFlowAnalysisApi'
import { isMoneyFlowCatalogueEntry, type MoneyFlowCapability } from '../data/originalMoneyFlowAnalysis'
import type { ReportCatalogueEntry } from '../types'
const Panel = lazy(() => import('./OriginalMoneyFlowAnalysisPanel').then(module => ({ default: module.OriginalMoneyFlowAnalysisPanel })))
type Scope = { present: boolean; enabled: boolean; callerKey: string | null; attempt: number }
function useMoneyFlowCapability(scope: Scope) {
  const [loaded, setLoaded] = useState<{ scope: Scope; capability: MoneyFlowCapability | null; failed: boolean } | null>(null)
  useEffect(() => {
    if (!scope.present || !scope.enabled || !scope.callerKey) return
    const controller = new AbortController()
    getMoneyFlowCapability(controller.signal).then(capability => { if (!controller.signal.aborted) setLoaded({ scope, capability, failed: false }) })
      .catch(() => { if (!controller.signal.aborted) setLoaded({ scope, capability: null, failed: true }) })
    return () => controller.abort()
  }, [scope])
  return loaded?.scope === scope ? loaded : null
}
function MoneyFlowModal({ opened, scope, capability, disabled, close }: {
  opened: boolean; scope: Scope; capability: MoneyFlowCapability | null; disabled: boolean; close: () => void
}) {
  const { t } = useI18n(), today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Kyiv' })
  return <AppModal opened={opened && scope.enabled && !!capability} title={t('Аналіз руху коштів Fenix')} size={1400} onClose={close}
    closeButtonProps={{ 'aria-label': t('Закрити аналіз руху коштів') }}>
    {opened && capability ? <Suspense fallback={<Loader size="sm" />}><Panel key={JSON.stringify(scope)} capability={capability}
      callerKey={scope.callerKey} canGenerate={scope.enabled && !disabled} initialFrom={`${today.slice(0, 7)}-01`} initialThrough={today} /></Suspense> : null}
  </AppModal>
}
export function OriginalMoneyFlowAnalysisCatalogueLaunch({ report, worlds, enabled, disabled, callerKey }: {
  report: ReportCatalogueEntry; worlds: readonly string[]; enabled: boolean; disabled: boolean; callerKey: string | null
}) {
  const { t } = useI18n(), [opened, setOpened] = useState(false), [attempt, setAttempt] = useState(0)
  const present = isMoneyFlowCatalogueEntry(report, worlds), scope = useMemo(() => ({ present, enabled, callerKey, attempt }), [present, enabled, callerKey, attempt])
  const current = useMoneyFlowCapability(scope), capability = current?.capability ?? null
  if (!present) return null
  return <Stack gap={6}>
    <WarehousePeriodCapabilityStatus current={current} enabled={enabled} callerKey={callerKey} disabled={disabled} retry={() => setAttempt(value => value + 1)} />
    <Button disabled={!enabled || disabled || !capability?.Executable || !callerKey} onClick={() => setOpened(true)}>{t('Fenix · Аналіз руху коштів')}</Button>
    <Text size="xs" c="dimmed">{t('Оригінальна форма: організація → стаття; три незалежні відбори, шість показників і чотири початкові показники.')}</Text>
    <MoneyFlowModal opened={opened} scope={scope} capability={capability} disabled={disabled} close={() => setOpened(false)} />
  </Stack>
}
