import { ActionIcon, Alert, Badge, Card, Group, Loader, SimpleGrid, Stack, Text, Tooltip, UnstyledButton } from '@mantine/core'
import { CircleAlert, RefreshCw } from 'lucide-react'
import { useEffect, useReducer, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDashboardWorkspaceSummary } from '../api/dashboardWorkspacesApi'
import type {
  DashboardWorkspaceKey,
  DashboardWorkspaceMetric,
  DashboardWorkspacePeriod,
  DashboardWorkspaceSummary,
} from '../types'
import { useI18n } from '../../../shared/i18n/useI18n'

export function WorkspaceSummary({
  period,
  workspaceKey,
}: {
  period: DashboardWorkspacePeriod
  workspaceKey: DashboardWorkspaceKey
}) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [summary, setSummary] = useState<DashboardWorkspaceSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setRefreshing] = useState(false)
  const [reloadKey, reload] = useReducer((value: number) => value + 1, 0)

  useEffect(() => {
    const controller = new AbortController()
    let requestInFlight = false

    async function load(reset: boolean) {
      if (requestInFlight) {
        return
      }

      requestInFlight = true
      setRefreshing(true)
      setError(null)

      if (reset) {
        setSummary(null)
      }

      try {
        const loaded = await getDashboardWorkspaceSummary(workspaceKey, period, controller.signal)

        if (!controller.signal.aborted) {
          setSummary(loaded)
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити показники'))
        }
      } finally {
        requestInFlight = false

        if (!controller.signal.aborted) {
          setRefreshing(false)
        }
      }
    }

    void load(true)

    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void load(false)
      }
    }, getRefreshInterval(workspaceKey))

    return () => {
      window.clearInterval(refreshTimer)
      controller.abort()
    }
  }, [period, reloadKey, t, workspaceKey])

  if (error && !summary) {
    return <Alert color="red" icon={<CircleAlert size={16} />} variant="light">{error}</Alert>
  }

  if (!summary) {
    return <Group justify="center" py="md"><Loader size="sm" /></Group>
  }

  return (
    <Stack gap={6}>
      {error && (
        <Alert color="orange" icon={<CircleAlert size={16} />} variant="light">{error}</Alert>
      )}
      <Group justify="space-between">
        <Text className="app-section-title" fw={700}>{t('Ключові показники')}</Text>
        <Group gap={4} wrap="nowrap">
          {summary.generatedAtUtc && (
            <Text c="dimmed" size="xs">{t('Оновлено')}: {formatUpdatedAt(summary.generatedAtUtc)}</Text>
          )}
          <Tooltip label={t('Оновити показники')}>
            <ActionIcon
              aria-label={t('Оновити показники')}
              loading={isRefreshing}
              size="sm"
              variant="subtle"
              onClick={() => reload()}
            >
              <RefreshCw size={15} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
      <SimpleGrid cols={{ base: 1, xs: 2, md: 3, xl: 5 }} spacing="sm">
        {summary.metrics.map((metric) => {
          const route = metric.route
          return <MetricCard key={metric.key} metric={metric} onOpen={route ? () => navigate(route) : undefined} />
        })}
      </SimpleGrid>
    </Stack>
  )
}

function MetricCard({ metric, onOpen }: { metric: DashboardWorkspaceMetric; onOpen?: () => void }) {
  const content = (
    <Card className={`role-dashboard-kpi is-${metric.tone}`} padding="sm" radius="sm" withBorder>
      <Text c="dimmed" lineClamp={2} size="xs">{metric.label}</Text>
      <Group align="flex-end" gap="xs" justify="space-between" wrap="nowrap">
        <Text className="role-dashboard-kpi-value" fw={750}>{formatMetricValue(metric)}</Text>
        {metric.hasData && metric.coveragePercent < 100 && (
          <Badge color="orange" size="xs" variant="light">{metric.coveragePercent}%</Badge>
        )}
      </Group>
    </Card>
  )

  return onOpen ? (
    <UnstyledButton className="role-dashboard-kpi-button" onClick={onOpen}>{content}</UnstyledButton>
  ) : content
}

function formatMetricValue(metric: DashboardWorkspaceMetric): string {
  if (!metric.hasData) {
    return 'Немає даних'
  }

  if (metric.unit === 'EUR' || metric.unit === 'UAH') {
    return new Intl.NumberFormat('uk-UA', {
      currency: metric.unit,
      maximumFractionDigits: 2,
      style: 'currency',
    }).format(metric.value)
  }

  return new Intl.NumberFormat('uk-UA', {
    maximumFractionDigits: metric.unit === 'qty' ? 2 : 0,
  }).format(metric.value)
}

function getRefreshInterval(workspaceKey: DashboardWorkspaceKey): number {
  return workspaceKey === 'accounting' || workspaceKey === 'finance' || workspaceKey === 'executive'
    ? 300_000
    : 60_000
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit' }).format(date)
}
