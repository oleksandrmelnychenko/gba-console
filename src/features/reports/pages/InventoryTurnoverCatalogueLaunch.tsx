import { Button, Stack } from '@mantine/core'
import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getInventoryTurnoverCapabilities } from '../api/inventoryTurnoverApi'
import { isInventoryTurnoverCatalogueEntry, isInventoryTurnoverCapabilities, INVENTORY_TURNOVER_CATALOGUE_SOURCE, type InventoryTurnoverCapabilities } from '../data/inventoryTurnover'
import type { ReportCatalogueEntry } from '../types'
import { OriginalConstructorAvailability } from './OriginalConstructorAvailability'

export function InventoryTurnoverCatalogueLaunch({ report, enabled, disabled, callerKey, onOpen }: {
  report: ReportCatalogueEntry; enabled: boolean; disabled: boolean; callerKey: string | null
  onOpen?: (capability: InventoryTurnoverCapabilities) => boolean
}) {
  const { t } = useI18n(); const [attempt, setAttempt] = useState(0)
  const availableSource = isInventoryTurnoverCatalogueEntry(report), hasAction = Boolean(onOpen)
  const definition = report.Sources.find(source => source.World === 'fenix' && source.SourceId === INVENTORY_TURNOVER_CATALOGUE_SOURCE.SourceId)?.DefinitionSha256
  const scope = useMemo(() => ({ definition, enabled: enabled && hasAction, availableSource, attempt, callerKey }), [enabled, availableSource, attempt, callerKey, hasAction, definition])
  const [load, setLoad] = useState<{ scope: typeof scope; capability: InventoryTurnoverCapabilities | null; failed: boolean } | null>(null)
  useEffect(() => {
    if (!scope.enabled || !scope.availableSource || !scope.callerKey) return
    const controller = new AbortController()
    getInventoryTurnoverCapabilities(scope.callerKey, controller.signal).then(capability => {
      if (!isInventoryTurnoverCapabilities(capability) || !(scope.definition == null || scope.definition === capability.SourceIdentity.DefinitionSha256)) throw new Error('Invalid capability')
      if (!controller.signal.aborted) setLoad({ scope, capability, failed: false })
    }).catch(() => { if (!controller.signal.aborted) setLoad({ scope, capability: null, failed: true }) })
    return () => controller.abort()
  }, [scope])
  if (!availableSource || !onOpen) return null
  const current = load?.scope === scope ? load : null
  const executable = current?.capability?.RuntimeImplemented === true
  return <Stack gap={6} role="group" aria-label={t('Оригінальний звіт оборачуваності запасів GBA')}>
    <OriginalConstructorAvailability enabled={enabled} pending={!current} failed={current?.failed === true}
      executable={executable} disabled={disabled} onRetry={() => setAttempt(value => value + 1)} />
    <Button type="button" variant="filled" disabled={!enabled || disabled || !executable}
      onClick={() => { if (enabled && !disabled && current?.capability?.RuntimeImplemented) onOpen(current.capability) }}>
      {t('Відкрити звіт оборачуваності запасів')}
    </Button>
  </Stack>
}
