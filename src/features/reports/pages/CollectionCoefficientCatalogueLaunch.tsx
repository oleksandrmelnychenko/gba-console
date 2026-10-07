import { Button, Stack } from '@mantine/core'
import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getCollectionCoefficientCapabilities } from '../api/collectionCoefficientApi'
import { isCollectionCoefficientCatalogueEntry, type CollectionCoefficientCapabilities } from '../data/collectionCoefficient'
import type { ReportCatalogueEntry } from '../types'
import { OriginalConstructorAvailability } from './OriginalConstructorAvailability'

export function CollectionCoefficientCatalogueLaunch({ report, enabled, disabled, onOpen }: {
  report: ReportCatalogueEntry
  enabled: boolean
  disabled: boolean
  onOpen: (capability: CollectionCoefficientCapabilities) => boolean
}) {
  const { t } = useI18n()
  const [attempt, setAttempt] = useState(0)
  const availableSource = isCollectionCoefficientCatalogueEntry(report)
  const scope = useMemo(() => ({ enabled, availableSource, attempt }), [enabled, availableSource, attempt])
  const [load, setLoad] = useState<{ scope: typeof scope; capability: CollectionCoefficientCapabilities | null; failed: boolean } | null>(null)
  useEffect(() => {
    if (!scope.enabled || !scope.availableSource) return
    const controller = new AbortController()
    getCollectionCoefficientCapabilities(controller.signal).then(capability => {
      if (!controller.signal.aborted) setLoad({ scope, capability, failed: false })
    }).catch(() => {
      if (!controller.signal.aborted) setLoad({ scope, capability: null, failed: true })
    })
    return () => controller.abort()
  }, [scope])
  if (!availableSource) return null
  const current = load?.scope === scope ? load : null
  const executable = current?.capability?.Executable === true
  return <Stack gap={6} role="group" aria-label={t('Оригінальний конструктор коефіцієнта інкасації')}>
    <OriginalConstructorAvailability enabled={enabled} pending={!current} failed={current?.failed === true}
      executable={executable} disabled={disabled} onRetry={() => setAttempt(value => value + 1)} />
    <Button type="button" variant="filled" disabled={!enabled || disabled || !executable}
      onClick={() => { if (enabled && !disabled && current?.capability?.Executable) onOpen(current.capability) }}>
      {t('Відкрити оригінальний конструктор')}
    </Button>
  </Stack>
}
