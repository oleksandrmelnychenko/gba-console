import { Button, Stack } from '@mantine/core'
import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getPlannedCashCapabilities } from '../api/plannedCashApi'
import { plannedCashCatalogueKind, isPlannedCashCapabilities, PLANNED_CASH_FORMS, type PlannedCashCapabilities } from '../data/plannedCash'
import type { ReportCatalogueEntry } from '../types'
import { OriginalConstructorAvailability } from './OriginalConstructorAvailability'

export function PlannedCashCatalogueLaunch({ report, enabled, disabled, callerKey, onOpen }: {
  report: ReportCatalogueEntry; enabled: boolean; disabled: boolean; callerKey: string | null; onOpen?: (capability: PlannedCashCapabilities) => boolean
}) {
  const { t } = useI18n(); const [attempt, setAttempt] = useState(0)
  const kind = plannedCashCatalogueKind(report), hasAction = Boolean(onOpen)
  const definition = kind ? report.Sources.find(source => source.World === 'fenix' && source.SourceId === PLANNED_CASH_FORMS[kind].SourceId)?.DefinitionSha256 : null
  const scope = useMemo(() => ({ definition, kind, enabled: enabled && hasAction, attempt, callerKey }), [definition, kind, enabled, hasAction, attempt, callerKey])
  const [load, setLoad] = useState<{ scope: typeof scope; capability: PlannedCashCapabilities | null; failed: boolean } | null>(null)
  useEffect(() => {
    if (!scope.enabled || !scope.kind || !scope.callerKey) return
    const controller = new AbortController()
    getPlannedCashCapabilities(scope.kind, scope.callerKey, controller.signal).then(capability => {
      if (!isPlannedCashCapabilities(capability) || capability.Kind !== scope.kind || !(scope.definition == null || scope.definition === capability.SourceIdentity.DefinitionSha256)) throw new Error('Invalid capability')
      if (!controller.signal.aborted) setLoad({ scope, capability, failed: false })
    }).catch(() => { if (!controller.signal.aborted) setLoad({ scope, capability: null, failed: true }) })
    return () => controller.abort()
  }, [scope])
  if (!kind || !onOpen) return null
  const current = load?.scope === scope ? load : null, executable = current?.capability?.RuntimeImplemented === true
  return <Stack gap={6} role="group" aria-label={t('Оригінальний звіт планування коштів GBA')}>
    <OriginalConstructorAvailability enabled={enabled} pending={!current} failed={current?.failed === true}
      executable={executable} disabled={disabled} onRetry={() => setAttempt(value => value + 1)} />
    <Button type="button" variant="filled" disabled={!enabled || disabled || !executable}
      onClick={() => { if (enabled && !disabled && current?.capability?.RuntimeImplemented) onOpen(current.capability) }}>{t('Відкрити звіт планування коштів')}</Button>
  </Stack>
}
