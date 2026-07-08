import { Badge, Card, Group, Stack, Text, Tooltip } from '@mantine/core'
import { CircleAlert, CircleCheck, Clock3, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
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
    <Card className="app-section-card cockpit-ai-status" withBorder radius="md" padding="md">
      <Group align="center" justify="space-between" gap="md" wrap="wrap">
        <Group align="center" gap="sm" wrap="nowrap">
          <span className="cockpit-ai-status__icon" aria-hidden="true">
            <Sparkles size={18} fill="currentColor" strokeWidth={0} />
          </span>
          <Stack gap={2}>
            <Text className="app-section-title" fw={700}>{t('AI флот продажів')}</Text>
            <Text c="dimmed" size="xs">
              {t('gba-nba готує задачі менеджерам, SLA і пріоритети для керівника')}
            </Text>
          </Stack>
        </Group>

        <Group gap="xs" wrap="wrap">
          <StateBadge
            icon={<CircleCheck size={13} />}
            label={t('Health')}
            message={health?.message}
            state={isLoading && !health ? 'unknown' : health?.state ?? 'unknown'}
          />
          <StateBadge
            icon={<Clock3 size={13} />}
            label="05:00"
            message={buildWarmupMessage(warmup?.message, warmup?.lastStartedAtUtc, warmup?.lastFinishedAtUtc, t)}
            state={isLoading && !warmup ? 'unknown' : warmup?.state ?? 'unknown'}
          />
          <Badge className="app-role-pill is-gray" variant="light">
            {finishedAtLabel ? `${t('фініш')} ${finishedAtLabel}` : t('05:00 ще не фіксувався')}
          </Badge>
          <Badge className="app-role-pill is-gray" variant="light">
            {lastUpdated ? relativeUpdatedLabel(lastUpdated, t) : t('оновлення')}
          </Badge>
        </Group>
      </Group>
    </Card>
  )
}

function StateBadge({
  icon,
  label,
  message,
  state,
}: {
  icon: ReactNode
  label: string
  message?: string
  state: AiFleetState
}) {
  const { t } = useI18n()
  const color = state === 'healthy' ? 'green' : state === 'down' ? 'red' : 'gray'
  const text = state === 'healthy' ? t('OK') : state === 'down' ? t('Down') : t('Немає даних')
  const badge = (
    <Badge color={color} leftSection={state === 'down' ? <CircleAlert size={13} /> : icon} variant="light">
      {label}: {text}
    </Badge>
  )

  if (!message) {
    return badge
  }

  return (
    <Tooltip label={message} multiline openDelay={250} w={280}>
      {badge}
    </Tooltip>
  )
}

function relativeUpdatedLabel(lastUpdated: number, t: (key: string, params?: Record<string, number>) => string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - lastUpdated) / 1_000))

  if (seconds < 5) {
    return t('щойно')
  }

  return t('{seconds} с тому', { seconds })
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
