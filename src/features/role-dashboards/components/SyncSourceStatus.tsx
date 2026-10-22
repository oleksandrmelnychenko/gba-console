import { Alert, Card, Stack, Text } from '@mantine/core'
import { useEffect, useState } from 'react'
import { describeSyncSource } from './syncSourceEvidence'
import { getSyncStatus } from '../../header-actions/api/syncApi'
import type { DataSyncStatus } from '../../header-actions/types'

const formatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Kyiv' })
function displayInstant(value?: string | null) {
  if (!value || !/(Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) return 'Невідомо'
  return formatter.format(new Date(value))
}
export function SyncSourceStatus() {
  const [status, setStatus] = useState<DataSyncStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    let pending = false
    async function load() {
      if (pending) return
      pending = true
      try {
        const next = await getSyncStatus()
        if (!cancelled) { setStatus(next); setError(null) }
      } catch (failure) {
        if (!cancelled) { setStatus(null); setError(failure instanceof Error ? failure.message : 'Статус синхронізації недоступний') }
      } finally { pending = false }
    }
    void load()
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load() }, 30_000)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [])
  const evidence = status ? describeSyncSource(status) : null
  return <Card withBorder radius="md" padding="sm"><Stack gap={4}>
    <Text fw={600}>Синхронізація джерела 1С</Text>
    {error && <Alert color="orange">{error}</Alert>}
    <Text size="sm">Стан: {!status ? 'Невідомо' : !status.IsGlobalLockStatusAvailable ? 'Не підтверджено: недоступна перевірка блокування' : status.IsInProgress ? 'Виконується' : 'Активного запуску не виявлено'}</Text>
    <Text size="sm">Останній підтверджений успішний запуск: {displayInstant(evidence?.lastSuccess)}.</Text>
    {!evidence?.lastSuccess && <Text size="xs" c="dimmed">Підтвердженого успішного запуску в доступному журналі не надано.</Text>}
    <Text size="sm">Останній результат: {status?.LastTerminalRun?.Status ?? 'Невідомо'} · завершення: {displayInstant(status?.LastTerminalRun?.CompletedAtUtc)}</Text>
    <Text size="sm">Прогрес сесії: {evidence?.total == null ? 'Невідомо' : `${evidence.completed} / ${evidence.total} завершених етапів`} · невдалих етапів цієї сесії: {evidence?.total == null ? 'Невідомо' : evidence.failed}</Text>
    {evidence?.failedStep && <Text size="sm" c="red">Етап збою: {evidence.failedStep}</Text>}
    <Text size="xs" c="dimmed">Затримка бізнес-джерела та загальна кількість помилок невідомі: статус запуску не містить підтвердженого часу останньої зміни у 1С або повного журналу помилок. Прогрів AI не є синхронізацією 1С.</Text>
  </Stack></Card>
}
