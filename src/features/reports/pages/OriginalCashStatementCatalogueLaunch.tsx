import { Button, Loader, Stack, Text } from '@mantine/core'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { WarehousePeriodCapabilityStatus } from './WarehousePeriodControls'
import { getOriginalCashCapability } from '../api/originalCashStatementApi'
import { cashCatalogueMatches, type CashCapability } from '../data/originalCashStatement'
import type { ReportCatalogueEntry } from '../types'

const Panel = lazy(() => import('./OriginalCashStatementPanel').then(module => ({ default: module.OriginalCashStatementPanel })))
type Scope = { matches: boolean; enabled: boolean; callerKey: string | null; attempt: number }
function useCashCapability(scope: Scope) {
  const [loaded, setLoaded] = useState<{ scope: Scope; capability: CashCapability | null; failed: boolean } | null>(null)
  useEffect(() => {
    if (!scope.matches || !scope.enabled || !scope.callerKey) return
    const controller = new AbortController()
    getOriginalCashCapability(controller.signal).then(capability => {
      if (!controller.signal.aborted) setLoaded({ scope, capability, failed: false })
    }).catch(() => { if (!controller.signal.aborted) setLoaded({ scope, capability: null, failed: true }) })
    return () => controller.abort()
  }, [scope])
  return loaded?.scope === scope ? loaded : null
}
function CashModal({ opened, scope, capability, disabled, close }: {
  opened: boolean; scope: Scope; capability: CashCapability | null; disabled: boolean; close: () => void
}) {
  const { t } = useI18n(), today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Kyiv' })
  return <AppModal opened={opened && scope.enabled && !!capability} title={t('Відомість коштів за період')} size={1250} onClose={close}>
    {opened && capability ? <Suspense fallback={<Loader size="sm" />}><Panel key={JSON.stringify(scope)} capability={capability}
      callerKey={scope.callerKey} canGenerate={scope.enabled && !disabled} initialFrom={`${today.slice(0, 7)}-01`} initialThrough={today} /></Suspense> : null}
  </AppModal>
}
export function OriginalCashStatementCatalogueLaunch({ report, worlds, enabled, disabled, callerKey }: {
  report: ReportCatalogueEntry; worlds: readonly string[]; enabled: boolean; disabled: boolean; callerKey: string | null
}) {
  const { t } = useI18n(), [opened, setOpened] = useState(false), [attempt, setAttempt] = useState(0)
  const matches = cashCatalogueMatches(report, worlds), scope = useMemo(() => ({ matches, enabled, callerKey, attempt }), [matches, enabled, callerKey, attempt])
  const current = useCashCapability(scope), capability = current?.capability ?? null
  if (!matches) return null
  return <Stack gap={6}>
    <WarehousePeriodCapabilityStatus current={current} enabled={enabled} callerKey={callerKey} disabled={disabled} retry={() => setAttempt(value => value + 1)} />
    <Button disabled={!enabled || disabled || !capability?.Executable || !callerKey} onClick={() => setOpened(true)}>{t('Fenix · відомість коштів за період')}</Button>
    <Text size="xs" c="dimmed">{t('Окрема форма оригіналу: банківський рахунок або каса, чотири відбори, два збережені грошові ресурси.')}</Text>
    <CashModal opened={opened} scope={scope} capability={capability} disabled={disabled} close={() => setOpened(false)} />
  </Stack>
}
