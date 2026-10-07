import { Button, Loader, Stack, Text } from '@mantine/core'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { WarehousePeriodCapabilityStatus } from './WarehousePeriodControls'
import { getOriginalPlannedCapability } from '../api/originalPlannedCashApi'
import { plannedCatalogueVariant, plannedDefinitions, type PlannedCapability, type PlannedVariant } from '../data/originalPlannedCash'
import type { ReportCatalogueEntry } from '../types'
const Panel = lazy(() => import('./OriginalPlannedCashPanel').then(module => ({ default: module.OriginalPlannedCashPanel })))
type Scope = { variant: PlannedVariant | null; enabled: boolean; callerKey: string | null; attempt: number }
function useCapability(scope: Scope) {
  const [load, setLoad] = useState<{ scope: Scope; capability: PlannedCapability | null; failed: boolean } | null>(null)
  useEffect(() => {
    if (!scope.variant || !scope.enabled || !scope.callerKey) return
    const controller = new AbortController()
    getOriginalPlannedCapability(scope.variant, controller.signal).then(capability => { if (!controller.signal.aborted) setLoad({ scope, capability, failed: false }) })
      .catch(() => { if (!controller.signal.aborted) setLoad({ scope, capability: null, failed: true }) })
    return () => controller.abort()
  }, [scope])
  return load?.scope === scope ? load : null
}
function PlannedModal({ opened, enabled, disabled, current, scope, close }: { opened: boolean; enabled: boolean; disabled: boolean;
  current: PlannedCapability | null; scope: Scope; close: () => void }) {
  const { t } = useI18n(), today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Kyiv' })
  return <AppModal opened={opened && enabled && !!current} title={t(current ? plannedDefinitions[current.Variant].title : 'План коштів')} size={1250} onClose={close}>
    {opened && current ? <Suspense fallback={<Loader size="sm" />}><Panel key={JSON.stringify(scope)} capability={current} callerKey={scope.callerKey}
      canGenerate={enabled && !disabled} initialFrom={`${today.slice(0, 7)}-01`} initialThrough={today} /></Suspense> : null}
  </AppModal>
}
export function OriginalPlannedCashCatalogueLaunch({ report, worlds, enabled, disabled, callerKey }: {
  report: ReportCatalogueEntry; worlds: readonly string[]; enabled: boolean; disabled: boolean; callerKey: string | null
}) {
  const { t } = useI18n(), [opened, setOpened] = useState(false), [attempt, setAttempt] = useState(0)
  const variant = plannedCatalogueVariant(report, worlds), scope = useMemo(() => ({ variant, enabled, callerKey, attempt }), [variant, enabled, callerKey, attempt])
  const current = useCapability(scope), capability = current?.capability ?? null
  if (!variant) return null
  return <Stack gap={6}><WarehousePeriodCapabilityStatus current={current} enabled={enabled} callerKey={callerKey} disabled={disabled} retry={() => setAttempt(value => value + 1)} />
    <Button disabled={!enabled || disabled || !capability?.Executable || !callerKey} onClick={() => setOpened(true)}>{t(`Fenix · ${plannedDefinitions[variant].title} за період`)}</Button>
    <Text size="xs" c="dimmed">{t('Окрема форма оригіналу з початковим залишком і рухами; готовність усіх місяців та реквізитів перевіряється під час формування.')}</Text>
    <PlannedModal opened={opened} enabled={enabled} disabled={disabled} current={capability} scope={scope} close={() => setOpened(false)} />
  </Stack>
}
