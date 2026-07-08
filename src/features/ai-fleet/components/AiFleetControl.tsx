import { ActionIcon, Badge, Button, Group, Loader, Stack, Text, Tooltip } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { Clock3, Play, RefreshCw, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { AI_FLEET_SERVICES, getAiFleetServicesStatus, triggerAiFleetWarmup } from '../api/aiFleetApi'
import type { AiFleetOperationState, AiFleetServiceDefinition, AiFleetServiceStatus, AiFleetState, AiFleetWarmupState } from '../types'
import './ai-fleet-control.css'

type AiFleetLoadState = {
  isLoading: boolean
  statuses: AiFleetServiceStatus[]
}

const initialLoadState: AiFleetLoadState = {
  isLoading: false,
  statuses: [],
}

const aiFleetDateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: '2-digit',
})

// The AI marker: a filled sparkle cluster (one large + two small 4-point stars)
// in brand orange — the classic "AI" glyph.
function AiGlyph({ size }: { size: number }) {
  return <Sparkles className="ai-fleet-glyph" size={size} fill="currentColor" strokeWidth={0} />
}

export function AiFleetControl() {
  const { t } = useI18n()
  const [opened, setOpened] = useState(false)
  const [isTriggering, setTriggering] = useState(false)
  const [state, setState] = useState<AiFleetLoadState>(initialLoadState)
  const statusesByServiceId = useMemo(
    () => new Map(state.statuses.map((status) => [status.serviceId, status])),
    [state.statuses],
  )
  const operation = useMemo(
    () => state.statuses.find((status) => status.operation)?.operation,
    [state.statuses],
  )
  const healthyCount = state.statuses.filter((status) => status.health.state === 'healthy').length
  const checkedCount = state.statuses.length

  useEffect(() => {
    if (!opened) {
      return
    }

    const controller = new AbortController()

    async function loadStatuses() {
      setState((current) => ({ ...current, isLoading: true }))

      try {
        const statuses = await getAiFleetServicesStatus(controller.signal)

        if (!controller.signal.aborted) {
          setState({ isLoading: false, statuses })
        }
      } catch {
        if (!controller.signal.aborted) {
          setState({ isLoading: false, statuses: [] })
        }
      }
    }

    void loadStatuses()

    return () => controller.abort()
  }, [opened])

  async function reload() {
    setState((current) => ({ ...current, isLoading: true }))
    const statuses = await getAiFleetServicesStatus()
    setState({ isLoading: false, statuses })
  }

  async function runWarmup() {
    setTriggering(true)

    try {
      await triggerAiFleetWarmup()
      notifications.show({
        color: 'green',
        message: t('AI warmup поставлено в чергу. Статус оновиться після обробки.'),
        title: t('AI флот'),
      })
      await reload()
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : t('Не вдалося запустити AI warmup'),
        title: t('AI флот'),
      })
    } finally {
      setTriggering(false)
    }
  }

  return (
    <>
      <Tooltip label={t('AI флот')} openDelay={300}>
        <ActionIcon
          aria-label={t('AI флот')}
          className="console-header-action"
          size="lg"
          variant="subtle"
          onClick={() => setOpened(true)}
        >
          <AiGlyph size={22} />
        </ActionIcon>
      </Tooltip>

      <AppModal
        centered
        opened={opened}
        size="lg"
        title={
          <Group gap="xs" wrap="nowrap">
            <AiGlyph size={20} />
            <Text fw={700} style={{ fontFamily: 'var(--font-mono)' }}>{t('AI флот')}</Text>
          </Group>
        }
        onClose={() => setOpened(false)}
      >
        <Stack gap="sm">
          <Group justify="space-between" wrap="wrap">
            <Stack gap={2}>
              <Text size="sm" c="dimmed">
                {t('Сервіси, які підключені до AI-функцій консолі')}
              </Text>
              <Text size="xs" c="dimmed">
                {t('Health перевіряється наживо через gba-server; 05:00 читається з останнього AI warmup логу.')}
              </Text>
            </Stack>
            <Group gap="xs" wrap="nowrap">
              <Badge color={checkedCount > 0 && healthyCount === checkedCount ? 'green' : 'orange'} variant="light">
                {healthyCount}/{checkedCount || AI_FLEET_SERVICES.length} {t('healthy')}
              </Badge>
              <Tooltip label={t('Поставити AI warmup у чергу scheduler-а')}>
                <Button
                  color="violet"
                  leftSection={isTriggering ? <Loader size={14} /> : <Play size={14} />}
                  loading={isTriggering}
                  size="xs"
                  styles={{ label: { fontFamily: 'var(--font-mono)', letterSpacing: 0 } }}
                  variant="light"
                  onClick={runWarmup}
                >
                  {t('Запустити')}
                </Button>
              </Tooltip>
              <Button
                color={CREATE_ACTION_COLOR}
                leftSection={state.isLoading ? <Loader size={14} /> : <RefreshCw size={14} />}
                size="xs"
                styles={{ label: { fontFamily: 'var(--font-mono)', letterSpacing: 0 } }}
                variant="light"
                onClick={reload}
              >
                {t('Оновити')}
              </Button>
            </Group>
          </Group>

          <AiFleetOperationSummary operation={operation} />

          <Stack gap="xs">
            {AI_FLEET_SERVICES.map((service) => (
              <AiFleetServiceRow
                key={service.id}
                isLoading={state.isLoading && !statusesByServiceId.has(service.id)}
                service={service}
                status={statusesByServiceId.get(service.id)}
              />
            ))}
          </Stack>
        </Stack>
      </AppModal>
    </>
  )
}

function AiFleetOperationSummary({ operation }: { operation?: AiFleetOperationState }) {
  const { t } = useI18n()
  const state = operation?.state ?? 'unknown'
  const color = state === 'healthy' ? 'green' : state === 'down' ? 'red' : 'gray'

  return (
    <div className="ai-fleet-operation">
      <Group gap="xs" wrap="wrap">
        <Badge color={color} leftSection={<Clock3 size={13} />} variant="light">
          {t('Останній 05:00 job')}: {stateLabel(state, t)}
        </Badge>
        <Badge className="app-role-pill is-gray" variant="light">
          {t('старт')}: {formatDateTime(operation?.lastStartedAtUtc) || '—'}
        </Badge>
        <Badge className="app-role-pill is-gray" variant="light">
          {t('фініш')}: {formatDateTime(operation?.lastFinishedAtUtc) || '—'}
        </Badge>
      </Group>
      {operation?.logFilePath && (
        <Text c="dimmed" size="xs">
          {t('Лог')}: {operation.logFilePath}
        </Text>
      )}
    </div>
  )
}

function AiFleetServiceRow({
  isLoading,
  service,
  status,
}: {
  isLoading: boolean
  service: AiFleetServiceDefinition
  status?: AiFleetServiceStatus
}) {
  const { t } = useI18n()
  const health = status?.health
  const warmup = status?.warmup
  const warmupMessage = buildWarmupMessage(warmup, service, t)

  return (
    <div className="ai-fleet-row">
      <Group align="flex-start" justify="space-between" gap="sm" wrap="nowrap">
        <Stack gap={3} className="ai-fleet-row__main">
          <Group gap="xs" wrap="wrap">
            <Text fw={700} size="sm">{service.name}</Text>
            <Badge className="app-role-pill is-gray" size="xs" variant="light">{service.source}</Badge>
          </Group>
          <Text c="dimmed" size="xs">{service.location}</Text>
          <Text size="sm">{service.description}</Text>
        </Stack>

        <Group gap={6} justify="flex-end" wrap="wrap" className="ai-fleet-row__statuses">
          {isLoading ? (
            <Loader size="xs" />
          ) : (
            <>
              <StatusBadge
                label={t('Health')}
                message={health?.message}
                state={health?.state ?? 'unknown'}
              />
              <StatusBadge
                label="05:00"
                message={warmupMessage}
                state={warmup?.state ?? 'unknown'}
              />
              <Tooltip label={`${service.location}. ${service.description}`} multiline openDelay={250} w={280}>
                <Badge color="gray" size="sm" variant="outline">{t('де')}</Badge>
              </Tooltip>
            </>
          )}
        </Group>
      </Group>
    </div>
  )
}

function StatusBadge({ label, message, state }: { label: string; message?: string; state: AiFleetState }) {
  const { t } = useI18n()
  const color = state === 'healthy' ? 'green' : state === 'down' ? 'red' : 'gray'
  const badge = (
    <Badge color={color} size="sm" variant="light">
      {label}: {stateLabel(state, t)}
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

function stateLabel(state: AiFleetState, t: (key: string) => string): string {
  if (state === 'healthy') {
    return t('OK')
  }

  if (state === 'down') {
    return t('Down')
  }

  return t('Немає даних')
}

function buildWarmupMessage(
  warmup: AiFleetWarmupState | undefined,
  service: AiFleetServiceDefinition,
  t: (key: string) => string,
): string {
  const parts = [
    warmup?.message,
    warmup?.lastStartedAtUtc ? `${t('Старт')}: ${formatDateTime(warmup.lastStartedAtUtc)}` : undefined,
    warmup?.lastFinishedAtUtc ? `${t('Фініш')}: ${formatDateTime(warmup.lastFinishedAtUtc)}` : undefined,
    `${t('Де')}: ${service.location}`,
    service.description,
  ].filter(Boolean)

  return parts.join('\n')
}

function formatDateTime(value: string | undefined): string {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return aiFleetDateTimeFormatter.format(date)
}
