import { Button, Stack } from '@mantine/core'
import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getEmployeeGrossProfitCapabilities } from '../api/employeeGrossProfitApi'
import { isEmployeeGrossProfitCatalogueEntry, type EmployeeGrossProfitCapabilities } from '../data/employeeGrossProfit'
import type { ReportCatalogueEntry } from '../types'
import { OriginalConstructorAvailability } from './OriginalConstructorAvailability'

export function EmployeeGrossProfitCatalogueLaunch({ report, enabled, disabled, callerKey, onOpen }: {
  report: ReportCatalogueEntry
  enabled: boolean
  disabled: boolean
  callerKey: string | null
  onOpen: (capability: EmployeeGrossProfitCapabilities) => boolean
}) {
  const { t } = useI18n()
  const [attempt, setAttempt] = useState(0)
  const availableSource = isEmployeeGrossProfitCatalogueEntry(report)
  const scope = useMemo(() => ({ enabled, availableSource, attempt, callerKey }), [enabled, availableSource, attempt, callerKey])
  const [load, setLoad] = useState<{ scope: typeof scope; capability: EmployeeGrossProfitCapabilities | null; failed: boolean } | null>(null)
  useEffect(() => {
    if (!scope.enabled || !scope.availableSource || !scope.callerKey) return
    const controller = new AbortController()
    getEmployeeGrossProfitCapabilities(controller.signal).then(capability => {
      if (!controller.signal.aborted) setLoad({ scope, capability, failed: false })
    }).catch(() => {
      if (!controller.signal.aborted) setLoad({ scope, capability: null, failed: true })
    })
    return () => controller.abort()
  }, [scope])
  if (!availableSource) return null
  const current = load?.scope === scope ? load : null
  const executable = current?.capability?.RuntimeImplemented === true
  return <Stack gap={6} role="group" aria-label={t('Прибуток на співробітника GBA')}>
    <OriginalConstructorAvailability enabled={enabled && Boolean(callerKey)} pending={!current} failed={current?.failed === true}
      executable={executable} disabled={disabled} onRetry={() => setAttempt(value => value + 1)} />
    <Button type="button" variant="filled" disabled={!enabled || disabled || !callerKey || !executable}
      onClick={() => { if (enabled && callerKey && !disabled && current?.capability?.RuntimeImplemented) onOpen(current.capability) }}>
      {t('Відкрити прибуток на співробітника')}
    </Button>
  </Stack>
}
