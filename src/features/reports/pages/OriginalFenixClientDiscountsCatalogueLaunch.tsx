import { Button, Loader, Stack, Text } from '@mantine/core'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { getFenixDiscountReadiness } from '../api/originalFenixClientDiscountsApi'
import { isFenixDiscountCatalogueEntry, type FenixDiscountReadiness } from '../data/originalFenixClientDiscounts'
import type { ReportCatalogueEntry } from '../types'
import { WarehousePeriodCapabilityStatus } from './WarehousePeriodControls'
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
  const { t } = useI18n(), [attempt, setAttempt] = useState(0), [opened, setOpened] = useState(false)
  const present = isFenixDiscountCatalogueEntry(report, worlds)
  const scope = useMemo(() => ({ present, enabled, callerKey, attempt }), [present, enabled, callerKey, attempt]), current = useFenixReadiness(scope), readiness = current?.readiness ?? null
  if (!present) return null
  const allowed = enabled && !disabled && !!callerKey && !!readiness?.Executable
  return <Stack gap={6}><WarehousePeriodCapabilityStatus current={current} enabled={enabled} callerKey={callerKey} disabled={disabled} retry={() => setAttempt(n => n + 1)} />
    <Button disabled={!allowed} onClick={() => setOpened(true)}>{t('FENIX · ОтчетПоСкидкам')}</Button>
    {!readiness?.Executable && current && !current.failed ? <Text size="sm" c="dimmed">{t('Повні синхронізовані дані FENIX ще недоступні.')}</Text> : null}
    <AppModal opened={opened && allowed} title={t('FENIX · ОтчетПоСкидкам')} size={1250} onClose={() => setOpened(false)} closeButtonProps={{ 'aria-label': t('Закрити звіт про знижки FENIX') }}>
      {opened && allowed && readiness ? <Suspense fallback={<Loader size="sm" />}><Panel key={JSON.stringify(scope)} readiness={readiness} callerKey={callerKey} canGenerate={allowed}
        initialThrough={new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Kyiv' })} /></Suspense> : null}
    </AppModal></Stack>
}
