import { Button, Stack } from '@mantine/core'
import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getManagementOrdersCapabilities } from '../api/managementOrdersApi'
import { isManagementOrdersCatalogueEntry, isManagementOrdersCapabilities, type ManagementOrdersCapabilities } from '../data/managementOrders'
import type { ReportCatalogueEntry } from '../types'
import { OriginalConstructorAvailability } from './OriginalConstructorAvailability'

export function ManagementOrdersCatalogueLaunch({ report, enabled, disabled, callerKey, onOpen }: {
  report: ReportCatalogueEntry; enabled: boolean; disabled: boolean; callerKey: string | null
  onOpen?: (capability: ManagementOrdersCapabilities) => boolean
}) {
  const { t } = useI18n(); const [attempt, setAttempt] = useState(0)
  const availableSource = isManagementOrdersCatalogueEntry(report), hasAction = Boolean(onOpen)
  const scope = useMemo(() => ({ enabled: enabled && hasAction, availableSource, attempt, callerKey }), [enabled, availableSource, attempt, callerKey, hasAction])
  const [load, setLoad] = useState<{ scope: typeof scope; capability: ManagementOrdersCapabilities | null; failed: boolean } | null>(null)
  useEffect(() => {
    if (!scope.enabled || !scope.availableSource || !scope.callerKey) return
    const controller = new AbortController()
    getManagementOrdersCapabilities(scope.callerKey, controller.signal).then(capability => {
      if (!isManagementOrdersCapabilities(capability)) throw new Error('Invalid capability')
      if (!controller.signal.aborted) setLoad({ scope, capability, failed: false })
    }).catch(() => { if (!controller.signal.aborted) setLoad({ scope, capability: null, failed: true }) })
    return () => controller.abort()
  }, [scope])
  if (!availableSource || !onOpen) return null
  const current = load?.scope === scope ? load : null
  const executable = current?.capability?.RuntimeImplemented === true
  return <Stack gap={6} role="group" aria-label={t('Оригінальні замовлення GBA')}>
    <OriginalConstructorAvailability enabled={enabled} pending={!current} failed={current?.failed === true}
      executable={executable} disabled={disabled} onRetry={() => setAttempt(value => value + 1)} />
    <Button type="button" variant="filled" disabled={!enabled || disabled || !executable}
      onClick={() => { if (enabled && !disabled && current?.capability?.RuntimeImplemented) onOpen(current.capability) }}>
      {t('Відкрити оригінальні замовлення')}
    </Button>
  </Stack>
}
