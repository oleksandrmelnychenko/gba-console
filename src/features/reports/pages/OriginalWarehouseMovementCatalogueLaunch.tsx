import { Button, Stack, Text } from '@mantine/core'
import { useEffect, useMemo, useState } from 'react'
import { getMovementCapability, getMovementPublications } from '../api/originalWarehouseMovementApi'
import { isWarehouseMovementCatalogueEntry, type MovementCapability, type MovementPublication } from '../data/originalWarehouseMovement'
import type { ReportCatalogueEntry } from '../types'
export type MovementLaunch = { capability: MovementCapability; publications: MovementPublication[] }
export type OpenWarehouseMovement = (scope: MovementLaunch, report: ReportCatalogueEntry) => boolean
export function OriginalWarehouseMovementCatalogueLaunch({ report, worlds, enabled, disabled, callerKey, onOpen }: {
  report: ReportCatalogueEntry; worlds: readonly string[]; enabled: boolean; disabled: boolean; callerKey: string | null; onOpen?: OpenWarehouseMovement
}) {
  const present = isWarehouseMovementCatalogueEntry(report, worlds), [attempt, setAttempt] = useState(0)
  const scope = useMemo(() => ({ present, enabled, callerKey, attempt }), [present, enabled, callerKey, attempt])
  const [load, setLoad] = useState<{ scope: typeof scope; value: MovementLaunch | null; error: boolean } | null>(null)
  useEffect(() => {
    if (!present || !enabled || !callerKey || !onOpen) return
    const controller = new AbortController()
    Promise.all([getMovementCapability(controller.signal), getMovementPublications(controller.signal)])
      .then(([capability, publications]) => { if (!controller.signal.aborted) setLoad({ scope, value: { capability, publications }, error: false }) })
      .catch(() => { if (!controller.signal.aborted) setLoad({ scope, value: null, error: true }) })
    return () => controller.abort()
  }, [scope, present, enabled, callerKey, onOpen])
  const current = load?.scope === scope ? load : null
  if (!present || !enabled || !callerKey || !onOpen) return null
  return <Stack gap={4}>{current?.value?.publications.length ? <Button size="compact-sm" variant="default" disabled={disabled}
    onClick={event => { event.stopPropagation(); if (!disabled) onOpen(structuredClone(current.value!), report) }}>Рух товару за складськими документами</Button>
    : <Text size="xs" c="dimmed">{!current ? 'Перевіряємо опублікований рух товару…' : current.error ? 'Не вдалося перевірити опублікований рух товару.' : 'Рух товару: опублікованих даних ще немає.'}</Text>}
    {current?.error ? <Button variant="subtle" size="compact-xs" disabled={disabled} onClick={() => setAttempt(v => v + 1)}>Повторити перевірку руху</Button> : null}</Stack>
}
