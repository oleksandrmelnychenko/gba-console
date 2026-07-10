import { ActionIcon, Alert, Badge, Button, Group, Loader, SegmentedControl, Stack, Text, Tooltip } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { AlertTriangle, ClipboardCopy, Clock3, ExternalLink, Play, RefreshCw, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useEffectEvent, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { AI_FLEET_SERVICES, getAiFleetServicesSnapshot, triggerAiFleetWarmup } from '../api/aiFleetApi'
import type { AiFleetOperationState, AiFleetServiceDefinition, AiFleetServiceStatus, AiFleetState, AiFleetWarmupState } from '../types'
import {
  buildAiFleetAnalytics,
  buildAiFleetDiagnosticText,
  buildAiFleetServiceViews,
  buildAiFleetSummary,
  type AiFleetServiceView,
} from '../utils/aiFleetView'
import {
  appendAiFleetObservation,
  buildAiFleetObservation,
  type AiFleetObservation,
} from '../utils/aiFleetObservations'
import { AiFleetAnalyticsDashboard } from './AiFleetAnalyticsDashboard'
import './ai-fleet-control.css'

const AI_FLEET_REFRESH_MS = 30_000

type AiFleetLoadState = {
  isLoading: boolean
  loadError?: string
  statuses: AiFleetServiceStatus[]
  telemetryError?: string
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

export function AiFleetControl({ canRunWarmup = false }: { canRunWarmup?: boolean }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [opened, setOpened] = useState(false)
  const [isTriggering, setTriggering] = useState(false)
  const [filter, setFilter] = useState<'all' | 'issues'>('all')
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const [observations, setObservations] = useState<AiFleetObservation[]>([])
  const [state, setState] = useState<AiFleetLoadState>(initialLoadState)
  const serviceRows = useMemo(() => buildAiFleetServiceViews(AI_FLEET_SERVICES, state.statuses), [state.statuses])
  const summary = useMemo(() => buildAiFleetSummary(serviceRows), [serviceRows])
  const visibleRows = useMemo(
    () => (filter === 'issues' ? serviceRows.filter((row) => row.isProblem) : serviceRows),
    [filter, serviceRows],
  )
  const operation = useMemo(
    () => state.statuses.find((status) => status.operation)?.operation,
    [state.statuses],
  )
  const analytics = useMemo(() => buildAiFleetAnalytics(serviceRows, operation), [operation, serviceRows])
  const lastUpdatedLabel = lastUpdated ? aiFleetDateTimeFormatter.format(new Date(lastUpdated)) : ''

  const loadStatuses = useCallback(async (signal?: AbortSignal) => {
    setState((current) => ({ ...current, isLoading: true }))

    try {
      const snapshot = await getAiFleetServicesSnapshot(signal)

      if (!signal?.aborted) {
        const capturedAtMs = Date.now()

        if (!snapshot.telemetryError) {
          const snapshotRows = buildAiFleetServiceViews(AI_FLEET_SERVICES, snapshot.statuses, capturedAtMs)
          const snapshotOperation = snapshot.statuses.find((status) => status.operation)?.operation
          const snapshotAnalytics = buildAiFleetAnalytics(snapshotRows, snapshotOperation, capturedAtMs)

          setObservations((current) => appendAiFleetObservation(
            current,
            buildAiFleetObservation(snapshotAnalytics, capturedAtMs),
          ))
        }

        setState((current) => ({
          isLoading: false,
          statuses: snapshot.telemetryError
            ? preserveWarmupTelemetry(snapshot.statuses, current.statuses)
            : snapshot.statuses,
          telemetryError: snapshot.telemetryError,
        }))
        setLastUpdated(capturedAtMs)
      }
    } catch (error) {
      if (!signal?.aborted) {
        setState((current) => ({
          ...current,
          isLoading: false,
          loadError: error instanceof Error ? error.message : t('Не вдалося оновити AI флот'),
        }))
      }
    }
  }, [t])
  const loadStatusesFromEffect = useEffectEvent((signal: AbortSignal) => {
    void loadStatuses(signal)
  })

  useEffect(() => {
    if (!opened) {
      return
    }

    const controller = new AbortController()
    const initialLoad = setTimeout(() => {
      loadStatusesFromEffect(controller.signal)
    }, 0)

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadStatusesFromEffect(controller.signal)
      }
    }, AI_FLEET_REFRESH_MS)

    return () => {
      controller.abort()
      clearTimeout(initialLoad)
      clearInterval(interval)
    }
  }, [opened])

  async function reload() {
    await loadStatuses()
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

  function openServiceRoute(route: string) {
    setOpened(false)
    navigate(route)
  }

  async function copyDiagnostic(row: AiFleetServiceView) {
    try {
      await navigator.clipboard.writeText(buildAiFleetDiagnosticText(row, operation))
      notifications.show({
        color: 'green',
        message: t('Діагностику AI-сервісу скопійовано'),
        title: t('AI флот'),
      })
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : t('Не вдалося скопіювати діагностику'),
        title: t('AI флот'),
      })
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
        size="78rem"
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
                {t('Доступність API перевіряється наживо через gba-server; 05:00 читається з останнього AI warmup логу.')}
              </Text>
            </Stack>
            <Group gap="xs" wrap="wrap">
              <Badge color={summary.total > 0 && summary.healthHealthy === summary.total ? 'green' : 'orange'} variant="light">
                {summary.healthHealthy}/{summary.total} {t('API доступні')}
              </Badge>
              {lastUpdatedLabel && (
                <Badge className="app-role-pill is-gray" variant="light">
                  {t('оновлено')}: {lastUpdatedLabel}
                </Badge>
              )}
              {canRunWarmup ? (
                <Tooltip label={t('Поставити AI warmup у чергу scheduler-а')}>
                  <Button
                    color={CREATE_ACTION_COLOR}
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
              ) : null}
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

          {state.loadError ? (
            <Alert color="red" icon={<AlertTriangle size={17} />} title={t('Не вдалося оновити AI флот')}>
              {state.loadError}
            </Alert>
          ) : null}

          {state.telemetryError ? (
            <Alert color="orange" icon={<AlertTriangle size={17} />} title={t('Статус 05:00 не оновлено')}>
              <Stack gap={2}>
                <Text size="sm">{state.telemetryError}</Text>
                <Text size="sm">
                  {t('Показано актуальну доступність API та останню успішну warmup telemetry, якщо вона була.')}
                </Text>
              </Stack>
            </Alert>
          ) : null}

          <AiFleetOperationSummary operation={operation} />

          <AiFleetAnalyticsDashboard
            analytics={analytics}
            history={observations}
            isLoading={state.isLoading && state.statuses.length === 0}
          />

          <Group justify="space-between" wrap="wrap">
            <SegmentedControl
              data={[
                { label: t('Усі сервіси'), value: 'all' },
                { label: `${t('Проблемні')} (${summary.problemCount})`, value: 'issues' },
              ]}
              size="xs"
              value={filter}
              onChange={(value) => setFilter(value as 'all' | 'issues')}
            />
            <Text c="dimmed" size="xs">
              {t('Автооновлення кожні')} {AI_FLEET_REFRESH_MS / 1000} {t('сек.')}
            </Text>
          </Group>

          <Stack gap="xs">
            {visibleRows.map((row) => (
              <AiFleetServiceRow
                key={row.service.id}
                isLoading={state.isLoading && !row.status}
                row={row}
                onCopyDiagnostic={copyDiagnostic}
                onOpenRoute={openServiceRoute}
              />
            ))}
            {visibleRows.length === 0 && (
              <div className="ai-fleet-empty">
                <Text c="dimmed" size="sm">{t('Проблемних AI-сервісів немає')}</Text>
              </div>
            )}
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
          {t('Останній 05:00 job')}: {operationStateLabel(state, t)}
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
  row,
  onCopyDiagnostic,
  onOpenRoute,
}: {
  isLoading: boolean
  row: AiFleetServiceView
  onCopyDiagnostic: (row: AiFleetServiceView) => void
  onOpenRoute: (route: string) => void
}) {
  const { t } = useI18n()
  const { service, status } = row
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
                label={t('API')}
                message={health?.message}
                state={health?.state ?? 'unknown'}
              />
              <StatusBadge
                label="05:00"
                message={warmupMessage}
                state={warmup?.state ?? 'unknown'}
              />
              <Tooltip label={`${service.location}. ${service.description}`} multiline openDelay={250} w={280}>
                <Badge
                  aria-label={`${t('Де')}: ${service.location}`}
                  color="gray"
                  size="sm"
                  tabIndex={0}
                  variant="outline"
                >
                  {t('де')}
                </Badge>
              </Tooltip>
              <Tooltip label={t('Скопіювати діагностику')}>
                <ActionIcon aria-label={t('Скопіювати діагностику')} size="sm" variant="light" onClick={() => onCopyDiagnostic(row)}>
                  <ClipboardCopy size={15} />
                </ActionIcon>
              </Tooltip>
              {row.primaryRoute && (
                <Tooltip label={t('Відкрити модуль')}>
                  <ActionIcon
                    aria-label={t('Відкрити модуль')}
                    size="sm"
                    variant="light"
                    onClick={() => row.primaryRoute && onOpenRoute(row.primaryRoute)}
                  >
                    <ExternalLink size={15} />
                  </ActionIcon>
                </Tooltip>
              )}
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
    <Badge
      aria-label={message ? `${label}: ${stateLabel(state, t)}. ${message}` : undefined}
      color={color}
      size="sm"
      tabIndex={message ? 0 : undefined}
      variant="light"
    >
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

function operationStateLabel(state: AiFleetState, t: (key: string) => string): string {
  if (state === 'healthy') {
    return t('Завершено')
  }

  if (state === 'down') {
    return t('З помилкою')
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

function preserveWarmupTelemetry(
  statuses: AiFleetServiceStatus[],
  previousStatuses: AiFleetServiceStatus[],
): AiFleetServiceStatus[] {
  if (previousStatuses.length === 0) {
    return statuses
  }

  const previousByService = new Map(previousStatuses.map((status) => [status.serviceId, status]))

  return statuses.map((status) => {
    const previous = previousByService.get(status.serviceId)

    if (!previous) {
      return status
    }

    return {
      ...status,
      operation: previous.operation,
      warmup: previous.warmup,
    }
  })
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
