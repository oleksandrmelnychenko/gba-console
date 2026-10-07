import { Button, Loader, Stack, Text } from '@mantine/core'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { WarehousePeriodCapabilityStatus } from './WarehousePeriodControls'
import { AppModal } from '../../../shared/ui/AppModal'
import { getLotAnalysisCapability } from '../api/originalLotBalanceAnalysisApi'
import { isLotAnalysisCatalogueEntry, type LotAnalysisCapability } from '../data/originalLotBalanceAnalysis'
import type { ReportCatalogueEntry } from '../types'

const Panel = lazy(() => import('./OriginalLotBalanceAnalysisPanel').then(module => ({ default: module.OriginalLotBalanceAnalysisPanel })))
type CapabilityScope = { present: boolean; enabled: boolean; callerKey: string | null; attempt: number }
type CapabilityLoad = { scope: CapabilityScope; capability: LotAnalysisCapability | null; failed: boolean }

function useLotAnalysisCapability(scope: CapabilityScope) {
  const [load, setLoad] = useState<CapabilityLoad | null>(null)
  useEffect(() => {
    if (!scope.present || !scope.enabled || !scope.callerKey) return
    const controller = new AbortController()
    getLotAnalysisCapability(controller.signal).then(capability => { if (!controller.signal.aborted) setLoad({ scope, capability, failed: false }) })
      .catch(() => { if (!controller.signal.aborted) setLoad({ scope, capability: null, failed: true }) })
    return () => controller.abort()
  }, [scope])
  return load?.scope === scope ? load : null
}

function LotAnalysisModal({ opened, enabled, disabled, capability, callerKey, scope, close }: {
  opened: boolean; enabled: boolean; disabled: boolean; capability: LotAnalysisCapability | null;
  callerKey: string | null; scope: CapabilityScope; close: () => void
}) {
  const { t } = useI18n()
  // Initial dates are explicit in the form; no server default to today's balances.
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Kyiv' })
  return <AppModal opened={opened && enabled && !!capability} title={t('Аналіз залишків партій')} size={1250}
    onClose={close} closeButtonProps={{ 'aria-label': t('Закрити аналіз залишків партій') }}>
    {opened && capability ? <Suspense fallback={<Loader size="sm" />}><Panel key={JSON.stringify(scope)} capability={capability} callerKey={callerKey}
      canGenerate={enabled && !disabled} initialFrom={today} initialThrough={today} /></Suspense> : null}
  </AppModal>
}

export function OriginalLotBalanceAnalysisCatalogueLaunch({ report, worlds, enabled, disabled, callerKey }: {
  report: ReportCatalogueEntry; worlds: readonly string[]; enabled: boolean; disabled: boolean; callerKey: string | null
}) {
  const { t } = useI18n(); const [attempt, setAttempt] = useState(0); const [opened, setOpened] = useState(false)
  const present = isLotAnalysisCatalogueEntry(report, worlds)
  const scope = useMemo(() => ({ present, enabled, callerKey, attempt }), [present, enabled, callerKey, attempt])
  const current = useLotAnalysisCapability(scope), capability = current?.capability ?? null
  if (!present) return null
  return <Stack gap={6}>
    <WarehousePeriodCapabilityStatus current={current} enabled={enabled} callerKey={callerKey} disabled={disabled} retry={() => setAttempt(n => n + 1)} />
    <Button variant="filled" disabled={!enabled || disabled || !capability?.Executable || !callerKey} onClick={() => setOpened(true)}>{t('Fenix · Аналіз залишків партій')}</Button>
    <Text size="xs" c="dimmed">{t('Початкові й кінцеві залишки партій без продажів за явний період; вартість включає ПДВ.')}</Text>
    <LotAnalysisModal opened={opened} enabled={enabled} disabled={disabled} capability={capability} callerKey={callerKey} scope={scope} close={() => setOpened(false)} />
  </Stack>
}
