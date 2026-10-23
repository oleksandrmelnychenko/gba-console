import { Alert, Group, Text } from '@mantine/core'
import { Info } from 'lucide-react'
import { TableChip } from '../../../shared/ui/TableChip'
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
  const runStatus = status?.LastTerminalRun?.Status
  const runLabel = runStatus === 'Finished' ? 'Завершено' : runStatus === 'Failed' ? 'Помилка' : runStatus === 'Running' ? 'Виконується' : runStatus || 'Невідомо'
  const currentLabel = !status ? 'Невідомо' : !status.IsGlobalLockStatusAvailable ? 'Стан не підтверджено' : status.IsInProgress ? 'Виконується' : 'Немає активного запуску'
  return <section className="role-dashboard-sync" aria-label="Синхронізація 1С">
    <Group justify="space-between" gap={8}>
      <Text className="app-section-title" fw={600}>Синхронізація 1С</Text>
      <TableChip value={currentLabel} tone={!status || !status.IsGlobalLockStatusAvailable ? 'warning' : status.IsInProgress ? 'document' : 'neutral'} />
    </Group>
    {error && <Alert color="yellow">{error}</Alert>}
    <dl className="role-dashboard-sync__metrics">
      <div><dt>Успішний запуск</dt><dd>{displayInstant(evidence?.lastSuccess)}</dd></div>
      <div><dt>Останній результат</dt><dd><TableChip value={runLabel} tone={runStatus === 'Finished' ? 'success' : runStatus === 'Failed' ? 'danger' : 'neutral'} /><span>{displayInstant(status?.LastTerminalRun?.CompletedAtUtc)}</span></dd></div>
      <div><dt>Завершено етапів</dt><dd><TableChip value={evidence?.total == null ? 'Невідомо' : `${evidence.completed} / ${evidence.total}`} /></dd></div>
      <div><dt>Збоїв у сесії</dt><dd><TableChip value={evidence?.total == null ? 'Невідомо' : evidence.failed} tone={evidence?.failed ? 'danger' : 'neutral'} /></dd></div>
    </dl>
    {evidence?.failedStep && <Text size="xs" c="red">Етап збою: {evidence.failedStep}</Text>}
    <details className="role-dashboard-source-details">
      <summary><Info size={14} />Про дані</summary>
      {!evidence?.lastSuccess && <Text size="xs" c="dimmed">Підтвердженого успішного запуску в доступному журналі не надано.</Text>}
      <Text size="xs" c="dimmed">Затримка бізнес-джерела та загальна кількість помилок невідомі: статус запуску не містить підтвердженого часу останньої зміни у 1С або повного журналу помилок. Прогрів AI не є синхронізацією 1С.</Text>
    </details>
  </section>
}
