import { ActionIcon, Alert, Badge, Card, Group, SimpleGrid, Skeleton, Stack, Text, Tooltip } from '@mantine/core'
import { CircleAlert, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useReducer, useState } from 'react'
import { AI_FLEET_SERVICES, getAiFleetServicesSnapshot } from '../../ai-fleet/api/aiFleetApi'
import type { AiFleetServiceStatus } from '../../ai-fleet/types'
import { useI18n } from '../../../shared/i18n/useI18n'

type SystemWorkspaceProps = {
  showDirectory?: boolean
}

export function SystemWorkspace({ showDirectory = false }: SystemWorkspaceProps) {
  const { t } = useI18n()
  const [statuses, setStatuses] = useState<AiFleetServiceStatus[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setLoading] = useState(true)
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

  return (
    <Stack gap="sm">
      <Group justify="space-between" wrap="nowrap">
        <Group gap="xs">
          <Text component="h2" className="app-section-title" fw={600}>
            {t(showDirectory ? 'AI та системні сервіси' : 'Стан системних сервісів')}
          </Text>
          <Badge
            className={`app-role-pill ${isLoading ? 'is-orange' : healthyCount === AI_FLEET_SERVICES.length ? 'is-green' : 'is-gray'}`}
            variant="light"
          >
            {isLoading ? t('Перевірка') : `${healthyCount}/${AI_FLEET_SERVICES.length}`}
          </Badge>
        </Group>
        <Tooltip label={t('Оновити')}>
          <ActionIcon aria-label={t('Оновити')} loading={isLoading} variant="subtle" onClick={() => reload()}>
            <RefreshCw size={17} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {error && (
        <Alert color="orange" icon={<CircleAlert size={16} />} variant="light">
          {error}
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
        {AI_FLEET_SERVICES.map((service) => {
          const status = statuses.find((item) => item.serviceId === service.id)
          const state = getCombinedState(status)

          return (
            <Card key={service.id} className="app-section-card role-dashboard-service" padding="sm" radius="md" withBorder>
              {isLoading && statuses.length === 0 ? (
                <Stack gap={7}>
                  <Skeleton height={13} radius="sm" width="42%" />
                  <Skeleton height={10} radius="sm" width="70%" />
                </Stack>
              ) : (
                <Group justify="space-between" wrap="nowrap">
                  <div>
                    <Text className="role-dashboard-service-name">{service.name}</Text>
                    <Text className="role-dashboard-service-source" lineClamp={1}>{service.source}</Text>
                  </div>
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
    </Stack>
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
