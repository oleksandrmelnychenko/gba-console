import { Button, Stack } from '@mantine/core'
import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getManagementBalanceCapabilities } from '../api/managementBalanceApi'
import { managementBalanceCatalogueKind, MANAGEMENT_BALANCE_DEFINITIONS, isManagementBalanceCapabilities, type ManagementBalanceCapabilities } from '../data/managementBalance'
import type { ReportCatalogueEntry } from '../types'
import { OriginalConstructorAvailability } from './OriginalConstructorAvailability'

export function ManagementBalanceCatalogueLaunch({ report, enabled, disabled, callerKey, onOpen }: {
  report: ReportCatalogueEntry; enabled: boolean; disabled: boolean; callerKey: string | null
  onOpen: (capability: ManagementBalanceCapabilities) => boolean
}) {
  const { t } = useI18n(); const [attempt, setAttempt] = useState(0)
  const kind = managementBalanceCatalogueKind(report)
  const availableSource = kind !== null
  const scope = useMemo(() => ({ enabled, availableSource, kind, attempt, callerKey }), [enabled, availableSource, kind, attempt, callerKey])
  const [load, setLoad] = useState<{ scope: typeof scope; capability: ManagementBalanceCapabilities | null; failed: boolean } | null>(null)
  useEffect(() => {
    if (!scope.enabled || !scope.availableSource || !scope.callerKey || !scope.kind) return
    const kind = scope.kind, controller = new AbortController()
    getManagementBalanceCapabilities(kind, scope.callerKey, controller.signal).then(capability => {
      if (!isManagementBalanceCapabilities(capability, kind)) throw new Error('Invalid capability')
      if (!controller.signal.aborted) setLoad({ scope, capability, failed: false })
    }).catch(() => { if (!controller.signal.aborted) setLoad({ scope, capability: null, failed: true }) })
    return () => controller.abort()
  }, [scope])
  if (!kind) return null
  const definition = MANAGEMENT_BALANCE_DEFINITIONS[kind]
  const current = load?.scope === scope ? load : null
  const executable = current?.capability?.RuntimeImplemented === true
  return <Stack gap={6} role="group" aria-label={definition.ReportName}>
    <OriginalConstructorAvailability enabled={enabled} pending={!current} failed={current?.failed === true}
      executable={executable} disabled={disabled} onRetry={() => setAttempt(value => value + 1)} />
    <Button type="button" variant="filled" disabled={!enabled || disabled || !executable}
      onClick={() => { if (enabled && !disabled && current?.capability?.RuntimeImplemented) onOpen(current.capability) }}>
      {t(kind === 'monthlyReceivables' ? 'Відкрити місячну дебіторку' : 'Відкрити квартальну управлінську кредиторку')}
    </Button>
  </Stack>
}
