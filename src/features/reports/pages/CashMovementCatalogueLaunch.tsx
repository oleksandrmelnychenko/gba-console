import { Button, Stack } from '@mantine/core'
import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getCashMovementCapabilities } from '../api/cashMovementApi'
import { cashMovementCatalogueKind, type CashMovementCapabilities } from '../data/cashMovement'
import type { ReportCatalogueEntry } from '../types'
import { OriginalConstructorAvailability } from './OriginalConstructorAvailability'

export function CashMovementCatalogueLaunch({ report, enabled, disabled, callerKey, onOpen }: {
  report: ReportCatalogueEntry; enabled: boolean; disabled: boolean; callerKey: string | null
  onOpen: (capability: CashMovementCapabilities) => boolean
}) {
  const { t } = useI18n()
  const [attempt, setAttempt] = useState(0)
  const kind = cashMovementCatalogueKind(report)
  const scope = useMemo(() => ({ enabled, kind, attempt, callerKey }), [enabled, kind, attempt, callerKey])
  const [load, setLoad] = useState<{ scope: typeof scope; capability: CashMovementCapabilities | null; failed: boolean } | null>(null)
  useEffect(() => {
    if (!scope.enabled || !scope.kind) return
    const controller = new AbortController()
    getCashMovementCapabilities(scope.kind, controller.signal).then(capability => {
      if (!controller.signal.aborted) setLoad({ scope, capability, failed: false })
    }).catch(() => { if (!controller.signal.aborted) setLoad({ scope, capability: null, failed: true }) })
    return () => controller.abort()
  }, [scope])
  if (!kind) return null
  const current = load?.scope === scope ? load : null
  const executable = current?.capability?.Executable === true
  const label = kind === 'receipts' ? 'Відкрити надходження за квартал' : 'Відкрити виплати за місяць'
  return <Stack gap={6} role="group" aria-label={t('Рух коштів GBA')}>
    <OriginalConstructorAvailability enabled={enabled} pending={!current} failed={current?.failed === true}
      executable={executable} disabled={disabled} onRetry={() => setAttempt(value => value + 1)} />
    <Button type="button" variant="filled" disabled={!enabled || disabled || !executable}
      onClick={() => { if (enabled && !disabled && current?.capability?.Executable) onOpen(current.capability) }}>{t(label)}</Button>
  </Stack>
}
