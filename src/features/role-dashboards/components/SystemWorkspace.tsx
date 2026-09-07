import { ActionIcon, Alert, Badge, Card, Group, Progress, SimpleGrid, Skeleton, Stack, Text, Tooltip } from '@mantine/core'
import { CircleAlert, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useReducer, useState } from 'react'
import { AI_FLEET_SERVICES, getAiFleetServicesSnapshot } from '../../ai-fleet/api/aiFleetApi'
import type { AiFleetServiceStatus } from '../../ai-fleet/types'
import {
  appendAiFleetObservation,
  buildAiFleetObservation,
  type AiFleetObservation,
} from '../../ai-fleet/utils/aiFleetObservations'
import { buildAiFleetAnalytics, buildAiFleetServiceViews } from '../../ai-fleet/utils/aiFleetView'
import { AiFleetAnalyticsDashboard } from '../../ai-fleet/components/AiFleetAnalyticsDashboard'
import { useI18n } from '../../../shared/i18n/useI18n'

type SystemWorkspaceProps = {
  showDirectory?: boolean
}

export function SystemWorkspace({ showDirectory = false }: SystemWorkspaceProps) {
  const { t } = useI18n()
  const [statuses, setStatuses] = useState<AiFleetServiceStatus[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setLoading] = useState(true)
  const [observations, setObservations] = useState<AiFleetObservation[]>([])
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
      setError(null)

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
          setError(snapshot.telemetryError ?? null)
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
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

  const healthyCount = useMemo(
    () => statuses.filter((status) => status.health.state === 'healthy' && status.warmup.state === 'healthy').length,
    [statuses],
  )
  const serviceStates = useMemo(
    () => AI_FLEET_SERVICES.map((service) => getCombinedState(statuses.find((status) => status.serviceId === service.id))),
    [statuses],
  )
  const downCount = serviceStates.filter((state) => state === 'down').length
  const unknownCount = serviceStates.filter((state) => state === 'unknown').length
  const readinessPercent = Math.round((healthyCount / AI_FLEET_SERVICES.length) * 100)
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

  if (showDirectory) {
    return (
      <Stack className="role-dashboard-ai-analytics" gap={6}>
        {error && (
          <Alert color="orange" icon={<CircleAlert size={16} />} variant="light">
            {error}
          </Alert>
        )}
        <AiFleetAnalyticsDashboard
          analytics={analytics}
          history={observations}
          isLoading={isLoading && statuses.length === 0}
        />
      </Stack>
    )
  }

  return (
    <Card className="app-section-card role-dashboard-system-card" withBorder padding={0} radius="md">
      <Group className="role-dashboard-section-head" justify="space-between" wrap="nowrap">
        <Group gap="sm" wrap="nowrap">
          <div className="role-dashboard-section-copy">
            <Text component="h2" className="app-section-title" fw={600}>
              {t(showDirectory ? 'AI та системні сервіси' : 'Стан системних сервісів')}
            </Text>
            <Text className="role-dashboard-section-subtitle">
              {t('Доступність і готовність робочих модулів')}
            </Text>
          </div>
          <Badge
            className={`app-role-pill ${isLoading ? 'is-orange' : healthyCount === AI_FLEET_SERVICES.length ? 'is-green' : 'is-gray'}`}
            variant="light"
          >
            {isLoading ? t('Перевірка') : `${healthyCount}/${AI_FLEET_SERVICES.length}`}
          </Badge>
        </Group>
        <Tooltip label={t('Оновити')}>
          <ActionIcon aria-label={t('Оновити')} color="gray" loading={isLoading} size={34} variant="light" onClick={() => reload()}>
            <RefreshCw size={17} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <div className="role-dashboard-system-body">
        {error && (
          <Alert color="orange" icon={<CircleAlert size={16} />} variant="light">
            {error}
          </Alert>
        )}

        <div className="role-dashboard-health-strip">
          <div className="role-dashboard-health-stat is-healthy">
            <Text className="role-dashboard-health-label">{t('Працюють')}</Text>
            <Text className="role-dashboard-health-value">{healthyCount}</Text>
          </div>
          <div className="role-dashboard-health-stat is-down">
            <Text className="role-dashboard-health-label">{t('З помилкою')}</Text>
            <Text className="role-dashboard-health-value">{downCount}</Text>
          </div>
          <div className="role-dashboard-health-stat is-unknown">
            <Text className="role-dashboard-health-label">{t('Без телеметрії')}</Text>
            <Text className="role-dashboard-health-value">{unknownCount}</Text>
          </div>
          <div className="role-dashboard-health-progress">
            <Group justify="space-between" gap="sm" wrap="nowrap">
              <Text className="role-dashboard-health-label">{t('Готовність флоту')}</Text>
              <Text className="role-dashboard-health-percent">{readinessPercent}%</Text>
            </Group>
            <Progress
              aria-label={t('Готовність флоту')}
              color={downCount > 0 ? 'red' : healthyCount === AI_FLEET_SERVICES.length ? 'green' : 'orange'}
              radius="xl"
              size={5}
              value={readinessPercent}
            />
          </div>
        </div>

        <SimpleGrid className="role-dashboard-service-grid" cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
          {AI_FLEET_SERVICES.map((service) => {
            const status = statuses.find((item) => item.serviceId === service.id)
            const state = getCombinedState(status)

            return (
              <Card key={service.id} className={`role-dashboard-service is-${state}`} padding="sm" radius="md" withBorder>
                {isLoading && statuses.length === 0 ? (
                  <Stack gap={7}>
                    <Skeleton height={13} radius="sm" width="42%" />
                    <Skeleton height={10} radius="sm" width="70%" />
                  </Stack>
                ) : (
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap="sm" wrap="nowrap">
                      <span aria-hidden="true" className={`role-dashboard-service-dot is-${state}`} />
                      <div>
                        <Text className="role-dashboard-service-name">{service.name}</Text>
                        <Text className="role-dashboard-service-source" lineClamp={1}>{service.source}</Text>
                      </div>
                    </Group>
                    <Badge
                      className={`app-role-pill ${state === 'healthy' ? 'is-green' : state === 'down' ? 'is-red' : 'is-gray'}`}
                      size="sm"
                      variant="light"
                    >
                      {t(state === 'healthy' ? 'Працює' : state === 'down' ? 'Помилка' : 'Немає даних')}
                    </Badge>
                  </Group>
                )}
              </Card>
            )
          })}
        </SimpleGrid>
      </div>
    </Card>
  )
}

function getCombinedState(status: AiFleetServiceStatus | undefined): 'down' | 'healthy' | 'unknown' {
  if (!status) {
    return 'unknown'
  }

  if (status.health.state === 'down' || status.warmup.state === 'down') {
    return 'down'
  }

  return status.health.state === 'healthy' && status.warmup.state === 'healthy' ? 'healthy' : 'unknown'
}
