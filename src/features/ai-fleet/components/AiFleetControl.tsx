import { DonutChart } from '@mantine/charts'
import { ActionIcon, Badge, Button, Group, Loader, Progress, SegmentedControl, SimpleGrid, Stack, Text, Tooltip } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { AlertTriangle, ClipboardCopy, Clock3, ExternalLink, Gauge, Play, RefreshCw, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useEffectEvent, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { AI_FLEET_SERVICES, getAiFleetServicesStatus, triggerAiFleetWarmup } from '../api/aiFleetApi'
import type { AiFleetOperationState, AiFleetServiceDefinition, AiFleetServiceStatus, AiFleetState, AiFleetWarmupState } from '../types'
import {
  buildAiFleetAnalytics,
  buildAiFleetDiagnosticText,
  buildAiFleetServiceViews,
  buildAiFleetSummary,
  type AiFleetAnalytics,
  type AiFleetReadinessRow,
  type AiFleetStateDistribution,
  type AiFleetServiceView,
} from '../utils/aiFleetView'
import './ai-fleet-control.css'

const AI_FLEET_REFRESH_MS = 30_000

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
  const navigate = useNavigate()
  const [opened, setOpened] = useState(false)
  const [isTriggering, setTriggering] = useState(false)
  const [filter, setFilter] = useState<'all' | 'issues'>('all')
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
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
      const statuses = await getAiFleetServicesStatus(signal)

      if (!signal?.aborted) {
        setState({ isLoading: false, statuses })
        setLastUpdated(Date.now())
      }
    } catch {
      if (!signal?.aborted) {
        setState({ isLoading: false, statuses: [] })
      }
    }
  }, [])
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
        size="70rem"
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
              <Badge color={summary.checked > 0 && summary.problemCount === 0 ? 'green' : 'orange'} variant="light">
                {summary.healthHealthy}/{summary.total} {t('health OK')}
              </Badge>
              {lastUpdatedLabel && (
                <Badge className="app-role-pill is-gray" variant="light">
                  {t('оновлено')}: {lastUpdatedLabel}
                </Badge>
              )}
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

          <AiFleetSummaryTiles summary={summary} />

          <AiFleetAnalyticsPanel analytics={analytics} isLoading={state.isLoading && state.statuses.length === 0} />

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

function AiFleetAnalyticsPanel({ analytics, isLoading }: { analytics: AiFleetAnalytics; isLoading: boolean }) {
  const { t } = useI18n()

  return (
    <div className="ai-fleet-analytics">
      <Group justify="space-between" wrap="wrap">
        <Group gap="xs" wrap="nowrap">
          <Gauge size={18} />
          <Text fw={700} size="sm">{t('Операційна аналітика AI')}</Text>
        </Group>
        <Badge color={analytics.totalReadinessPercent >= 90 ? 'green' : analytics.totalReadinessPercent >= 60 ? 'orange' : 'red'} variant="light">
          {t('Готовність')}: {analytics.totalReadinessPercent}%
        </Badge>
      </Group>

      <SimpleGrid cols={{ base: 1, md: 4 }} spacing="xs">
        <AiFleetMetric
          label={t('Тривалість 05:00 задачі')}
          tone={analytics.operationDurationMinutes !== null && analytics.operationDurationMinutes <= 30 ? 'success' : 'neutral'}
          value={formatDurationMinutes(analytics.operationDurationMinutes)}
        />
        <AiFleetMetric
          label={t('Вік останнього фінішу')}
          tone={analytics.operationAgeHours !== null && analytics.operationAgeHours <= 30 ? 'success' : 'danger'}
          value={formatHours(analytics.operationAgeHours)}
        />
        <AiFleetMetric
          label={t('Застарілий 05:00 статус')}
          tone={analytics.staleWarmupCount > 0 ? 'danger' : 'success'}
          value={String(analytics.staleWarmupCount)}
        />
        <AiFleetMetric
          label={t('Дії для перевірки')}
          tone={analytics.nextActions.some((action) => action.severity === 'danger') ? 'danger' : 'neutral'}
          value={String(analytics.nextActions.length)}
        />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
        <AiFleetDistributionChart
          distribution={analytics.healthDistribution}
          isLoading={isLoading}
          title={t('Розподіл health-статусів')}
          totalLabel={`${analytics.healthDistribution.healthy}/${analytics.healthDistribution.healthy + analytics.healthDistribution.down + analytics.healthDistribution.unknown}`}
        />
        <AiFleetDistributionChart
          distribution={analytics.warmupDistribution}
          isLoading={isLoading}
          title={t('Розподіл 05:00 статусів')}
          totalLabel={`${analytics.warmupDistribution.healthy}/${analytics.warmupDistribution.healthy + analytics.warmupDistribution.down + analytics.warmupDistribution.unknown}`}
        />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
        <AiFleetReadinessList rows={analytics.readinessRows} />
        <AiFleetNextActions actions={analytics.nextActions} />
      </SimpleGrid>
    </div>
  )
}

function AiFleetDistributionChart({
  distribution,
  isLoading,
  title,
  totalLabel,
}: {
  distribution: AiFleetStateDistribution
  isLoading: boolean
  title: string
  totalLabel: string
}) {
  const { t } = useI18n()
  const data = [
    { color: 'green.6', name: t('OK'), value: distribution.healthy },
    { color: 'red.6', name: t('Down'), value: distribution.down },
    { color: 'gray.5', name: t('Немає даних'), value: distribution.unknown },
  ].filter((item) => item.value > 0)

  return (
    <div className="ai-fleet-chart-panel">
      <Text className="ai-fleet-panel-title">{title}</Text>
      {isLoading ? (
        <div className="ai-fleet-chart-loading">
          <Loader size="sm" />
        </div>
      ) : (
        <DonutChart
          chartLabel={totalLabel}
          data={data}
          size={150}
          thickness={24}
          valueFormatter={(value) => `${value} ${t('сервісів')}`}
          withLabels={false}
          withTooltip
        />
      )}
      <div className="ai-fleet-chart-legend">
        {data.map((item) => (
          <span key={item.name}>
            {item.name}: <b>{item.value}</b>
          </span>
        ))}
      </div>
    </div>
  )
}

function AiFleetReadinessList({ rows }: { rows: AiFleetReadinessRow[] }) {
  const { t } = useI18n()

  return (
    <div className="ai-fleet-chart-panel">
      <Group justify="space-between" wrap="nowrap">
        <Text className="ai-fleet-panel-title">{t('Готовність сервісів')}</Text>
        <Text c="dimmed" size="xs">{t('health + 05:00')}</Text>
      </Group>
      <Stack gap={8}>
        {rows.map((row) => (
          <div className="ai-fleet-readiness-row" key={row.serviceId}>
            <Group justify="space-between" gap="xs" wrap="nowrap">
              <Stack gap={0} className="ai-fleet-readiness-row__name">
                <Text fw={650} size="xs">{row.serviceName}</Text>
                <Text c="dimmed" size="xs">
                  {row.source} · {row.warmupAgeHours === null ? t('05:00 без часу') : `05:00 ${formatHours(row.warmupAgeHours)}`}
                </Text>
              </Stack>
              <Badge color={readinessColor(row)} variant="light">
                {row.readinessPercent}%
              </Badge>
            </Group>
            <Progress color={readinessColor(row)} radius="xl" size="sm" value={row.readinessPercent} />
          </div>
        ))}
      </Stack>
    </div>
  )
}

function AiFleetNextActions({ actions }: { actions: AiFleetAnalytics['nextActions'] }) {
  const { t } = useI18n()

  return (
    <div className="ai-fleet-chart-panel">
      <Text className="ai-fleet-panel-title">{t('Що перевірити далі')}</Text>
      {actions.length === 0 ? (
        <div className="ai-fleet-actions-empty">
          <Text c="dimmed" size="sm">{t('Критичних дій немає')}</Text>
        </div>
      ) : (
        <Stack gap={8}>
          {actions.map((action) => (
            <div className={`ai-fleet-action is-${action.severity}`} key={`${action.serviceId}-${action.message}`}>
              <AlertTriangle size={16} />
              <Stack gap={1}>
                <Text fw={650} size="xs">{action.serviceName}</Text>
                <Text size="xs">{t(action.message)}</Text>
              </Stack>
            </div>
          ))}
        </Stack>
      )}
    </div>
  )
}

function AiFleetSummaryTiles({ summary }: { summary: ReturnType<typeof buildAiFleetSummary> }) {
  const { t } = useI18n()

  return (
    <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xs">
      <AiFleetMetric label={t('Health OK')} value={`${summary.healthHealthy}/${summary.total}`} />
      <AiFleetMetric
        label={t('05:00 warmup OK')}
        tone={summary.warmupDown > 0 ? 'danger' : 'success'}
        value={`${summary.warmupHealthy}/${summary.total}`}
      />
      <AiFleetMetric
        label={t('Потребують уваги')}
        tone={summary.problemCount > 0 ? 'danger' : 'success'}
        value={String(summary.problemCount)}
      />
    </SimpleGrid>
  )
}

function AiFleetMetric({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'danger' | 'neutral' | 'success' }) {
  return (
    <div className={`ai-fleet-metric is-${tone}`}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
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

function formatDurationMinutes(value: number | null): string {
  if (value === null) {
    return '—'
  }

  return `${value} хв`
}

function formatHours(value: number | null): string {
  if (value === null) {
    return '—'
  }

  if (value < 1) {
    return '<1 год'
  }

  return `${value.toLocaleString('uk-UA', { maximumFractionDigits: 1 })} год`
}

function readinessColor(row: AiFleetReadinessRow): string {
  if (row.healthState === 'down' || row.warmupState === 'down' || row.readinessPercent < 50) {
    return 'red'
  }

  if (row.isStaleWarmup || row.readinessPercent < 100) {
    return 'orange'
  }

  return 'green'
}
