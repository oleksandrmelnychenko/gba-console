import { Button, Loader, Stack, Text } from '@mantine/core'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { getAmgDiscountReadiness } from '../api/originalAmgClientDiscountsApi'
import { isAmgDiscountCatalogueEntry, type AmgDiscountReadiness } from '../data/originalAmgClientDiscounts'
import type { ReportCatalogueEntry } from '../types'
import { WarehousePeriodCapabilityStatus } from './WarehousePeriodControls'
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
  const { t } = useI18n(), [attempt, setAttempt] = useState(0), [opened, setOpened] = useState(false)
  const present = isAmgDiscountCatalogueEntry(report, worlds)
  const scope = useMemo(() => ({ present, enabled, callerKey, attempt }), [present, enabled, callerKey, attempt]), current = useAmgReadiness(scope), readiness = current?.readiness ?? null
  if (!present) return null
  const allowed = enabled && !disabled && !!callerKey && !!readiness?.Executable
  return <Stack gap={6}><WarehousePeriodCapabilityStatus current={current} enabled={enabled} callerKey={callerKey} disabled={disabled} retry={() => setAttempt(n => n + 1)} />
    <Button disabled={!allowed} onClick={() => setOpened(true)}>{t('AMG · ОтчетПоСкидкам')}</Button>
    {!readiness?.Executable && current && !current.failed ? <Text size="sm" c="dimmed">{t('Повні синхронізовані дані AMG ще недоступні.')}</Text> : null}
    <AppModal opened={opened && allowed} title={t('AMG · ОтчетПоСкидкам')} size={1250} onClose={() => setOpened(false)} closeButtonProps={{ 'aria-label': t('Закрити звіт про знижки AMG') }}>
      {opened && allowed && readiness ? <Suspense fallback={<Loader size="sm" />}><Panel key={JSON.stringify(scope)} readiness={readiness} callerKey={callerKey} canGenerate={allowed}
        initialThrough={new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Kyiv' })} /></Suspense> : null}
    </AppModal></Stack>
}
