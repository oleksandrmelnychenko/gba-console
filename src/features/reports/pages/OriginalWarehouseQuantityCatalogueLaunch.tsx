import { Button, Loader, Stack, Text } from '@mantine/core'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { getWarehouseQuantityCapability } from '../api/originalWarehouseQuantityApi'
import { isWarehouseQuantityCatalogueEntry, type WarehouseQuantityCapability } from '../data/originalWarehouseQuantity'
import type { ReportCatalogueEntry } from '../types'

const Panel = lazy(() => import('./OriginalWarehouseQuantityPanel').then(module => ({ default: module.OriginalWarehouseQuantityPanel })))
type CapabilityScope = { present: boolean; enabled: boolean; callerKey: string | null; attempt: number }
type CapabilityLoad = { scope: CapabilityScope; capability: WarehouseQuantityCapability | null; failed: boolean }

function useQuantityCapability(scope: CapabilityScope) {
  const [load, setLoad] = useState<CapabilityLoad | null>(null)
  useEffect(() => {
    if (!scope.present || !scope.enabled || !scope.callerKey) return
    const controller = new AbortController()
    getWarehouseQuantityCapability(controller.signal).then(capability => { if (!controller.signal.aborted) setLoad({ scope, capability, failed: false }) })
      .catch(() => { if (!controller.signal.aborted) setLoad({ scope, capability: null, failed: true }) })
    return () => controller.abort()
  }, [scope])
  return load?.scope === scope ? load : null
}

function QuantityCapabilityStatus({ current, enabled, callerKey, disabled, retry }: {
  current: CapabilityLoad | null; enabled: boolean; callerKey: string | null; disabled: boolean; retry: () => void
}) {
  const { t } = useI18n()
  return <>
    {!current && enabled && callerKey ? <Loader size="xs" aria-label={t('Перевірка періодної відомості')} /> : null}
    {enabled && !callerKey ? <Text size="xs">{t('Для формування потрібен чинний сеанс користувача.')}</Text> : null}
    {current?.failed ? <><Text size="xs">{t('Не вдалося перевірити періодну відомість.')}</Text><Button variant="subtle" disabled={disabled} onClick={retry}>{t('Повторити')}</Button></> : null}
  </>
}

function QuantityPeriodModal({ opened, enabled, disabled, capability, callerKey, scope, close }: {
  opened: boolean; enabled: boolean; disabled: boolean; capability: WarehouseQuantityCapability | null;
  callerKey: string | null; scope: CapabilityScope; close: () => void
}) {
  const { t } = useI18n()
  // Initial dates are explicit in the form; no server default to today's balances.
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Kyiv' })
  return <AppModal opened={opened && enabled && !!capability} title={t('Партії на складах: кількість за період')} size={1100}
    onClose={close} closeButtonProps={{ 'aria-label': t('Закрити відомість партій') }}>
    {opened && capability ? <Suspense fallback={<Loader size="sm" />}><Panel key={JSON.stringify(scope)} capability={capability} callerKey={callerKey}
      canGenerate={enabled && !disabled} initialFrom={`${today.slice(0, 7)}-01`} initialThrough={today} /></Suspense> : null}
  </AppModal>
}

export function OriginalWarehouseQuantityCatalogueLaunch({ report, worlds, enabled, disabled, callerKey }: {
  report: ReportCatalogueEntry; worlds: readonly string[]; enabled: boolean; disabled: boolean; callerKey: string | null
}) {
  const { t } = useI18n(); const [attempt, setAttempt] = useState(0); const [opened, setOpened] = useState(false)
  const present = isWarehouseQuantityCatalogueEntry(report, worlds)
  const scope = useMemo(() => ({ present, enabled, callerKey, attempt }), [present, enabled, callerKey, attempt])
  const current = useQuantityCapability(scope), capability = current?.capability ?? null
  if (!present) return null
  return <Stack gap={6}>
    <QuantityCapabilityStatus current={current} enabled={enabled} callerKey={callerKey} disabled={disabled} retry={() => setAttempt(n => n + 1)} />
    <Button variant="filled" disabled={!enabled || disabled || !capability?.Executable || !callerKey} onClick={() => setOpened(true)}>{t('Fenix · Кількість за період')}</Button>
    <Text size="xs" c="dimmed">{t('Початковий залишок, надходження, витрати та кінцевий залишок. Доступність усіх місячних даних перевіряється під час формування.')}</Text>
    <QuantityPeriodModal opened={opened} enabled={enabled} disabled={disabled} capability={capability} callerKey={callerKey} scope={scope} close={() => setOpened(false)} />
  </Stack>
}
