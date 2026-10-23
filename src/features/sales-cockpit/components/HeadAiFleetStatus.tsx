import { Card, Group, Stack, Text, Tooltip } from '@mantine/core'
import { TableChip } from '../../../shared/ui/TableChip'
import { useEffect, useState } from 'react'
import { getAiFleetServiceStatus } from '../../ai-fleet/api/aiFleetApi'
import type { AiFleetServiceStatus, AiFleetState } from '../../ai-fleet/types'
import { useI18n } from '../../../shared/i18n/useI18n'

const NBA_SERVICE_ID = 'nba'
const REFRESH_INTERVAL_MS = 60_000
const cockpitAiDateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: '2-digit',
})

export function HeadAiFleetStatus() {
  const { t } = useI18n()
  const [status, setStatus] = useState<AiFleetServiceStatus | null>(null)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const [isLoading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    let interval: ReturnType<typeof setInterval> | null = null

    async function loadStatus() {
      setLoading(true)

      try {
        const result = await getAiFleetServiceStatus(NBA_SERVICE_ID, controller.signal)

        if (!controller.signal.aborted) {
          setStatus(result)
          setLastUpdated(Date.now())
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadStatus()
    interval = setInterval(() => {
      void loadStatus()
    }, REFRESH_INTERVAL_MS)

    return () => {
      controller.abort()
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [])

  const health = status?.health
  const warmup = status?.warmup
  const finishedAtLabel = formatDateTime(warmup?.lastFinishedAtUtc)

  return (
    <Card className="app-section-card cockpit-ai-status" withBorder radius="md" padding={0}>
      <Group align="center" justify="space-between" gap="md" wrap="wrap">
        <Stack gap={2}>
          <Text className="app-section-title" fw={700}>{t('Сервіс продажів')}</Text>

        </Stack>

        <Group gap="xs" wrap="wrap">
          <StateBadge
            label={t('API')}
            message={health?.message}
            state={isLoading && !health ? 'unknown' : health?.state ?? 'unknown'}
          />
          <StateBadge
            label="05:00"
            message={buildWarmupMessage(warmup?.message, warmup?.lastStartedAtUtc, warmup?.lastFinishedAtUtc, t)}
            state={isLoading && !warmup ? 'unknown' : warmup?.state ?? 'unknown'}
          />
          <Text className="cockpit-workday-asof">
            {finishedAtLabel ? `${t('Завершено')}: ${finishedAtLabel}` : t('05:00 ще не фіксувався')}
          </Text>
          <Text className="cockpit-workday-asof">
            {lastUpdated ? `${t('Перевірено')}: ${formatDateTime(new Date(lastUpdated).toISOString())}` : t('Оновлення…')}
          </Text>
        </Group>
      </Group>
    </Card>
  )
}

function StateBadge({
  label,
  message,
  state,
}: {
  label: string
  message?: string
  state: AiFleetState
}) {
  const { t } = useI18n()
  const tone = state === 'healthy' ? 'success' : state === 'down' ? 'danger' : 'neutral'
  const text = state === 'healthy' ? t('OK') : state === 'down' ? t('Down') : t('Немає даних')
  const badge = (
    <TableChip tone={tone} value={`${label}: ${text}`} />
  )

  if (!message) {
    return badge
  }

  return (
    <Tooltip label={message} multiline openDelay={250} w={280}>
      <span>{badge}</span>
    </Tooltip>
  )
}

function buildWarmupMessage(
  message: string | undefined,
  startedAt: string | undefined,
  finishedAt: string | undefined,
  t: (key: string) => string,
): string | undefined {
  const parts = [
    message,
    startedAt ? `${t('Старт')}: ${formatDateTime(startedAt)}` : undefined,
    finishedAt ? `${t('Фініш')}: ${formatDateTime(finishedAt)}` : undefined,
  ].filter(Boolean)

  return parts.length > 0 ? parts.join('\n') : undefined
}

function formatDateTime(value: string | undefined): string {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return cockpitAiDateTimeFormatter.format(date)
}
