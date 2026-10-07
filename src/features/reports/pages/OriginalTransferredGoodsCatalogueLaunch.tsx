import { Button, Loader, Stack, Text } from '@mantine/core'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { WarehousePeriodCapabilityStatus } from './WarehousePeriodControls'
import { AppModal } from '../../../shared/ui/AppModal'
import { getTransferredCapability } from '../api/originalTransferredGoodsApi'
import { isTransferredCatalogueEntry, type TransferredCapability } from '../data/originalTransferredGoods'
import type { ReportCatalogueEntry } from '../types'

const Panel = lazy(() => import('./OriginalTransferredGoodsPanel').then(module => ({ default: module.OriginalTransferredGoodsPanel })))
type CapabilityScope = { present: boolean; enabled: boolean; callerKey: string | null; attempt: number }
type CapabilityLoad = { scope: CapabilityScope; capability: TransferredCapability | null; failed: boolean }

function useTransferredCapability(scope: CapabilityScope) {
  const [load, setLoad] = useState<CapabilityLoad | null>(null)
  useEffect(() => {
    if (!scope.present || !scope.enabled || !scope.callerKey) return
    const controller = new AbortController()
    getTransferredCapability(controller.signal).then(capability => { if (!controller.signal.aborted) setLoad({ scope, capability, failed: false }) })
      .catch(() => { if (!controller.signal.aborted) setLoad({ scope, capability: null, failed: true }) })
    return () => controller.abort()
  }, [scope])
  return load?.scope === scope ? load : null
}

function TransferredPeriodModal({ opened, enabled, disabled, capability, callerKey, scope, close }: {
  opened: boolean; enabled: boolean; disabled: boolean; capability: TransferredCapability | null;
  callerKey: string | null; scope: CapabilityScope; close: () => void
}) {
  const { t } = useI18n()
  // Initial dates are explicit in the form; no server default to today's balances.
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Kyiv' })
  return <AppModal opened={opened && enabled && !!capability} title={t('Відомість партій переданих товарів')} size={1250}
    onClose={close} closeButtonProps={{ 'aria-label': t('Закрити відомість переданих товарів') }}>
    {opened && capability ? <Suspense fallback={<Loader size="sm" />}><Panel key={JSON.stringify(scope)} capability={capability} callerKey={callerKey}
      canGenerate={enabled && !disabled} initialFrom={`${today.slice(0, 7)}-01`} initialThrough={today} /></Suspense> : null}
  </AppModal>
}

export function OriginalTransferredGoodsCatalogueLaunch({ report, worlds, enabled, disabled, callerKey }: {
  report: ReportCatalogueEntry; worlds: readonly string[]; enabled: boolean; disabled: boolean; callerKey: string | null
}) {
  const { t } = useI18n(); const [attempt, setAttempt] = useState(0); const [opened, setOpened] = useState(false)
  const present = isTransferredCatalogueEntry(report, worlds)
  const scope = useMemo(() => ({ present, enabled, callerKey, attempt }), [present, enabled, callerKey, attempt])
  const current = useTransferredCapability(scope), capability = current?.capability ?? null
  if (!present) return null
  return <Stack gap={6}>
    <WarehousePeriodCapabilityStatus current={current} enabled={enabled} callerKey={callerKey} disabled={disabled} retry={() => setAttempt(n => n + 1)} />
    <Button variant="filled" disabled={!enabled || disabled || !capability?.Executable || !callerKey} onClick={() => setOpened(true)}>{t('Fenix · Партії переданих товарів')}</Button>
    <Text size="xs" c="dimmed">{t('Початковий залишок, надходження, витрати та кінцевий залишок. Доступність усіх місячних даних перевіряється під час формування.')}</Text>
    <TransferredPeriodModal opened={opened} enabled={enabled} disabled={disabled} capability={capability} callerKey={callerKey} scope={scope} close={() => setOpened(false)} />
  </Stack>
}
