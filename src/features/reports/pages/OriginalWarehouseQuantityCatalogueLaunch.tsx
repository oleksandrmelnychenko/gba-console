import { Button, Loader, Stack, Text } from '@mantine/core'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { getWarehouseQuantityCapability } from '../api/originalWarehouseQuantityApi'
import { isWarehouseQuantityCatalogueEntry, type WarehouseQuantityCapability } from '../data/originalWarehouseQuantity'
import type { ReportCatalogueEntry } from '../types'
const Panel = lazy(() => import('./OriginalWarehouseQuantityPanel').then(module => ({ default: module.OriginalWarehouseQuantityPanel })))
export function OriginalWarehouseQuantityCatalogueLaunch({ report, worlds, enabled, disabled, callerKey }: {
  report: ReportCatalogueEntry; worlds: readonly string[]; enabled: boolean; disabled: boolean; callerKey: string | null
}) {
  const { t } = useI18n(); const [attempt, setAttempt] = useState(0); const [opened, setOpened] = useState(false)
  const present = isWarehouseQuantityCatalogueEntry(report, worlds)
  const scope = useMemo(() => ({ present, enabled, callerKey, attempt }), [present, enabled, callerKey, attempt])
  const [load, setLoad] = useState<{ scope: typeof scope; capability: WarehouseQuantityCapability | null; failed: boolean } | null>(null)
  useEffect(() => {
    if (!scope.present || !scope.enabled || !scope.callerKey) return
    const controller = new AbortController()
    getWarehouseQuantityCapability(controller.signal).then(capability => { if (!controller.signal.aborted) setLoad({ scope, capability, failed: false }) })
      .catch(() => { if (!controller.signal.aborted) setLoad({ scope, capability: null, failed: true }) })
    return () => controller.abort()
  }, [scope])
  if (!present) return null
  const current = load?.scope === scope ? load : null, capability = current?.capability
  // Initial dates are explicit in the form; no server default to today's balances.
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Kyiv' })
  return <Stack gap={6}>
    {!current && enabled && callerKey ? <Loader size="xs" aria-label={t('Перевірка періодної відомості')} /> : null}
    {enabled && !callerKey ? <Text size="xs">{t('Для формування потрібен чинний сеанс користувача.')}</Text> : null}
    {current?.failed ? <><Text size="xs">{t('Не вдалося перевірити періодну відомість.')}</Text><Button variant="subtle" disabled={disabled} onClick={() => setAttempt(n => n + 1)}>{t('Повторити')}</Button></> : null}
    <Button variant="filled" disabled={!enabled || disabled || !capability?.Executable || !callerKey} onClick={() => setOpened(true)}>{t('Fenix · Кількість за період')}</Button>
    <Text size="xs" c="dimmed">{t('Початковий залишок, надходження, витрати та кінцевий залишок. Доступність усіх місячних даних перевіряється під час формування.')}</Text>
    <AppModal opened={opened && enabled && !!capability && current?.scope === scope} title={t('Партії на складах: кількість за період')} size={1100}
      onClose={() => setOpened(false)} closeButtonProps={{ 'aria-label': t('Закрити відомість партій') }}>
      {opened && capability ? <Suspense fallback={<Loader size="sm" />}><Panel key={JSON.stringify(scope)} capability={capability} callerKey={callerKey}
        canGenerate={enabled && !disabled} initialFrom={`${today.slice(0, 7)}-01`} initialThrough={today} /></Suspense> : null}
    </AppModal>
  </Stack>
}
