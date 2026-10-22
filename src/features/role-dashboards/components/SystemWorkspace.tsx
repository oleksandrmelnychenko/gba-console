import { ActionIcon, Alert, Badge, Card, Group, Skeleton, Stack, Text, Tooltip } from '@mantine/core'
import {
  CircleAlert,
  CircleCheck,
  CircleHelp,
  CircleX,
  RefreshCw,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useReducer, useState } from 'react'
import { AI_FLEET_SERVICES, getAiFleetServicesSnapshot } from '../../ai-fleet/api/aiFleetApi'
import type { AiFleetServiceStatus } from '../../ai-fleet/types'
import {
  appendAiFleetObservation,
  buildAiFleetObservation,
  type AiFleetObservation,
} from '../../ai-fleet/utils/aiFleetObservations'
import {
  buildAiFleetAnalytics,
  buildAiFleetServiceViews,
  type AiFleetEffectiveState,
  type AiFleetReadinessRow,
} from '../../ai-fleet/utils/aiFleetView'
import { AiFleetAnalyticsDashboard } from '../../ai-fleet/components/AiFleetAnalyticsDashboard'
import { SyncSourceStatus } from './SyncSourceStatus'
import { useI18n } from '../../../shared/i18n/useI18n'
import { TableChip, type TableChipTone } from '../../../shared/ui/TableChip'

type SystemWorkspaceProps = {
  showDirectory?: boolean
}

type ServiceState = 'down' | 'healthy' | 'unknown' | 'warning'

type FleetState = ServiceState | 'loading' | 'warning'

const FLEET_STATE_VIEW: Record<Exclude<FleetState, 'loading'>, { icon: LucideIcon; label: string; pill: string }> = {
  down: { icon: CircleX, label: 'Є збої', pill: 'is-red' },
  healthy: { icon: CircleCheck, label: 'Норма', pill: 'is-green' },
  unknown: { icon: CircleHelp, label: 'Неповні дані', pill: 'is-gray' },
  warning: { icon: TriangleAlert, label: 'Увага', pill: 'is-orange' },
}

const fleetDateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: '2-digit',
})

const fleetTimeFormatter = new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit' })

const SERVICE_STATE_ORDER: Record<ServiceState, number> = {
  down: 0,
  unknown: 1,
  warning: 2,
  healthy: 3,
}

const CHECK_STATE_LABEL: Record<AiFleetEffectiveState, string> = {
  fail: 'Помилка',
  pass: 'Працює',
  unknown: 'Немає даних',
  warning: 'Застаріло',
}

const CHECK_STATE_TONE: Record<AiFleetEffectiveState, TableChipTone> = {
  fail: 'danger',
  pass: 'success',
  unknown: 'neutral',
  warning: 'warning',
}

const warmupAgeFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 1 })

export function SystemWorkspace({ showDirectory = false }: SystemWorkspaceProps) {
  const { t } = useI18n()
  const [statuses, setStatuses] = useState<AiFleetServiceStatus[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setLoading] = useState(true)
  const [observations, setObservations] = useState<AiFleetObservation[]>([])
  const [checkedAtMs, setCheckedAtMs] = useState<number | null>(null)
  const [reloadKey, reload] = useReducer((value: number) => value + 1, 0)

  useEffect(() => {
    const controller = new AbortController()
    let requestInFlight = false

    async function load() {
      if (requestInFlight) {
        return
      }

      requestInFlight = true
      setLoading(true)

      try {
        const snapshot = await getAiFleetServicesSnapshot(controller.signal)

        if (!controller.signal.aborted) {
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

          setStatuses(snapshot.statuses)
          setCheckedAtMs(snapshot.telemetryError ? null : capturedAtMs)
          setError(snapshot.telemetryError ?? null)
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setStatuses([])
          setCheckedAtMs(null)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити стан сервісів'))
        }
      } finally {
        requestInFlight = false

        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void load()

    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void load()
      }
    }, 60_000)

    return () => {
      window.clearInterval(refreshTimer)
      controller.abort()
    }
  }, [reloadKey, t])

  const serviceRows = useMemo(
    () => buildAiFleetServiceViews(AI_FLEET_SERVICES, statuses),
    [statuses],
  )
  const operation = useMemo(
    () => statuses.find((status) => status.operation)?.operation,
    [statuses],
  )
  const analytics = useMemo(
    () => buildAiFleetAnalytics(serviceRows, operation),
    [operation, serviceRows],
  )
  const statusRows = useMemo(
    () => analytics.readinessRows
      .map((row) => ({ row, state: getCombinedState(row) }))
      .toSorted((left, right) => SERVICE_STATE_ORDER[left.state] - SERVICE_STATE_ORDER[right.state]
        || left.row.serviceName.localeCompare(right.row.serviceName, 'uk')),
    [analytics.readinessRows],
  )

  if (showDirectory) {
    return (
      <Stack className="role-dashboard-ai-analytics" gap={6}>
        <SyncSourceStatus />
        {error && (
          <Alert color="orange" icon={<CircleAlert size={16} />} variant="light">
            {error}
          </Alert>
        )}
        {error ? (
          <Text c="dimmed" size="sm">{t('Поточна аналітика недоступна: перевірку телеметрії не завершено.')}</Text>
        ) : (
          <AiFleetAnalyticsDashboard
            analytics={analytics}
            history={observations}
            isLoading={isLoading && statuses.length === 0}
          />
        )}
      </Stack>
    )
  }

  const totalCount = AI_FLEET_SERVICES.length
  const healthyCount = statusRows.filter((item) => item.state === 'healthy').length
  const downCount = statusRows.filter((item) => item.state === 'down').length
  const unknownCount = statusRows.filter((item) => item.state === 'unknown').length
  const isInitialLoad = isLoading && statuses.length === 0 && !error
  const fleetState: FleetState = isInitialLoad
    ? 'loading'
    : downCount > 0
      ? 'down'
      : error || unknownCount > 0 ? 'unknown' : analytics.staleWarmupCount > 0 ? 'warning' : 'healthy'
  const fleetView = fleetState === 'loading' ? null : FLEET_STATE_VIEW[fleetState]
  const segments: Array<{ count: number; label: string; state: ServiceState }> = [
    { count: healthyCount, label: t('Працюють'), state: 'healthy' },
    { count: downCount, label: t('З помилкою'), state: 'down' },
    { count: unknownCount, label: t('Без телеметрії'), state: 'unknown' },
    { count: statusRows.filter((item) => item.state === 'warning').length, label: t('Застаріло'), state: 'warning' },
  ]
  const lastWarmupMs = statuses.reduce<number | null>((latest, status) => {
    const finishedMs = status.warmup.lastFinishedAtUtc ? Date.parse(status.warmup.lastFinishedAtUtc) : Number.NaN
    return Number.isNaN(finishedMs) || (latest !== null && latest >= finishedMs) ? latest : finishedMs
  }, null)
  const oldestWarmupHours = analytics.readinessRows.reduce<number | null>(
    (oldest, row) => row.warmupAgeHours === null || (oldest !== null && oldest >= row.warmupAgeHours) ? oldest : row.warmupAgeHours,
    null,
  )
  const fleetNote = error
    ? t('Перевірку телеметрії не завершено. Поточну готовність усіх сервісів не підтверджено.')
    : downCount > 0
    ? `${downCount} ${t('з')} ${totalCount} ${t('сервісів не відповідають — вони першими в таблиці.')}`
    : unknownCount > 0
      ? `${unknownCount} ${t('з')} ${totalCount} ${t('сервісів без повної телеметрії.')}`
      : analytics.staleWarmupCount > 0
        ? `${t('Ранковий прогрів застарів у')} ${analytics.staleWarmupCount} ${t('з')} ${totalCount} ${t('сервісів.')}`
        : t('Усі сервіси доступні, прогрів свіжий.')

  return (
    <Card className="app-section-card role-dashboard-system-card" withBorder padding={0} radius="md">
      <Group className="role-dashboard-section-head" justify="space-between" wrap="nowrap">
        <div className="role-dashboard-section-copy">
          <Text component="h2" className="app-section-title" fw={600}>
            {t('Стан системних сервісів')}
          </Text>
          <Text className="role-dashboard-section-subtitle">
            {t('Доступність API та ранковий прогрів AI-сервісів')}
          </Text>
        </div>
        <Tooltip label={t('Оновити')}>
          <ActionIcon aria-label={t('Оновити')} color="gray" loading={isLoading} size={34} variant="light" onClick={() => reload()}>
            <RefreshCw size={17} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <div className="role-dashboard-system-body">
        <SyncSourceStatus />
        <Text size="sm" c="dimmed">{t("Доступність API й прогрів не підтверджують якість моделі або свіжість бізнес-даних. Режим fallback і ізоляція DEV/QA цими перевірками не визначаються; сервіс може бути спільним.")}</Text>
        {error && (
          <Alert color="orange" icon={<CircleAlert size={16} />} variant="light">
            {error}
          </Alert>
        )}

        <div className="role-dashboard-system-grid">
          <article className={`role-dashboard-fleet is-${fleetState}`} aria-busy={isInitialLoad}>
            <Text className="role-dashboard-fleet-eyebrow">{t('Готовність флоту')}</Text>
            {isInitialLoad ? (
              <Stack gap={10} mt={10}>
                <Skeleton height={34} radius="sm" width="46%" />
                <Skeleton height={12} radius="xl" />
                <Skeleton height={10} radius="sm" width="80%" />
              </Stack>
            ) : (
              <>
                <div className="role-dashboard-fleet-score">
                  <strong>{healthyCount}</strong>
                  <span>/{totalCount}</span>
                  {fleetView && (
                    <Badge className={`app-role-pill ${fleetView.pill}`} variant="light">{t(fleetView.label)}</Badge>
                  )}
                </div>
                <Text className="role-dashboard-fleet-caption">{t('сервісів працюють')}</Text>
                <div
                  aria-label={`${t('Готовність флоту')}: ${segments.map((segment) => `${segment.label} ${segment.count}`).join(', ')}`}
                  className="role-dashboard-fleet-bar"
                  role="img"
                >
                  {segments.map((segment) => segment.count > 0 ? (
                    <span
                      aria-hidden="true"
                      className={`role-dashboard-fleet-segment is-${segment.state}`}
                      key={segment.state}
                      style={{ flexGrow: segment.count }}
                    />
                  ) : null)}
                </div>
                <ul className="role-dashboard-fleet-legend">
                  {segments.map((segment) => (
                    <li className={`is-${segment.state}${segment.count > 0 ? ' has-value' : ''}`} key={segment.state}>
                      <i aria-hidden="true" />
                      <span>{segment.label}</span>
                      <b>{segment.count}</b>
                    </li>
                  ))}
                </ul>
                <dl className="role-dashboard-fleet-facts">
                  <div>
                    <dt>{t('Найсвіжіший прогрів')}</dt>
                    <dd>{lastWarmupMs === null ? '—' : fleetDateTimeFormatter.format(lastWarmupMs)}</dd>
                  </div>
                  <div>
                    <dt>{t('Вік найстарішого прогріву')}</dt>
                    <dd>{oldestWarmupHours === null ? '—' : `${warmupAgeFormatter.format(oldestWarmupHours)} ${t('год')}`}</dd>
                  </div>
                  <div>
                    <dt>{t('Перевірено')}</dt>
                    <dd>{checkedAtMs === null ? '—' : fleetTimeFormatter.format(checkedAtMs)}</dd>
                  </div>
                </dl>
                {fleetView && (
                  <p className={`role-dashboard-fleet-note is-${fleetState}`} role="status">
                    <fleetView.icon aria-hidden="true" size={16} strokeWidth={2} />
                    <span>{fleetNote}</span>
                  </p>
                )}
              </>
            )}
          </article>

          <div
            aria-label={t('Стан системних сервісів')}
            className="role-dashboard-service-table-scroll"
            role="region"
            tabIndex={0}
          >
            <table className="app-static-table role-dashboard-service-table">
              <thead>
                <tr>
                  <th scope="col">{t('Сервіс')}</th>
                  <th scope="col">{t('API')}</th>
                  <th scope="col">{t('Прогрів 05:00')}</th>
                  <th className="app-table-cell-number" scope="col">{t('Свіжість')}</th>
                </tr>
              </thead>
              <tbody>
                {isInitialLoad
                  ? AI_FLEET_SERVICES.map((service) => (
                    <tr key={service.id}>
                      <th scope="row"><Skeleton height={12} radius="sm" width="60%" /></th>
                      <td><Skeleton height={18} radius="xl" width={72} /></td>
                      <td><Skeleton height={18} radius="xl" width={72} /></td>
                      <td><Skeleton height={12} ml="auto" radius="sm" width={40} /></td>
                    </tr>
                  ))
                  : statusRows.map(({ row, state }) => (
                    <ServiceStatusRow
                      key={row.serviceId}
                      row={row}
                      state={state}
                      status={statuses.find((status) => status.serviceId === row.serviceId)}
                    />
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Card>
  )
}

function ServiceStatusRow({
  row,
  state,
  status,
}: {
  row: AiFleetReadinessRow
  state: ServiceState
  status: AiFleetServiceStatus | undefined
}) {
  const { t } = useI18n()

  return (
    <tr className={`is-${state}`}>
      <th scope="row">
        <span className="role-dashboard-service-cell">
          <span aria-hidden="true" className={`role-dashboard-service-dot is-${state}`} />
          <span className="role-dashboard-service-copy">
            <span className="role-dashboard-service-name">{row.serviceName}</span>
            <span className="role-dashboard-service-source">{row.source}</span>
          </span>
        </span>
      </th>
      <td>
        <TableChip
          title={status?.health.message}
          tone={CHECK_STATE_TONE[row.healthCheckState]}
          value={t(CHECK_STATE_LABEL[row.healthCheckState])}
        />
      </td>
      <td>
        <TableChip
          title={status?.warmup.message}
          tone={CHECK_STATE_TONE[row.warmupCheckState]}
          value={t(CHECK_STATE_LABEL[row.warmupCheckState])}
        />
      </td>
      <td className="app-table-cell-number">
        {row.warmupAgeHours === null ? '—' : `${warmupAgeFormatter.format(row.warmupAgeHours)} ${t('год')}`}
      </td>
    </tr>
  )
}

function getCombinedState(row: AiFleetReadinessRow): ServiceState {
  if (row.healthCheckState === 'fail' || row.warmupCheckState === 'fail') {
    return 'down'
  }

  if (row.healthCheckState === 'unknown' || row.warmupCheckState === 'unknown') return 'unknown'
  return row.healthCheckState === 'warning' || row.warmupCheckState === 'warning' ? 'warning' : 'healthy'
}
