import { Alert, Badge, Card, Group, SimpleGrid, Stack, Text } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useEffect, useMemo, useReducer } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AgingBars, type AgingSeries } from '../../../shared/ui/charts'
import { getHeadDashboard } from '../api/salesCockpitApi'
import type { HeadDashboard, HeadTeamRow } from '../types'

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 0,
})

type ChartsState = {
  dashboard: HeadDashboard | null
  error: string | null
  isLoading: boolean
}

type ChartsAction =
  | { type: 'failed'; error: string }
  | { type: 'loaded'; dashboard: HeadDashboard }
  | { type: 'loading' }

const initialState: ChartsState = {
  dashboard: null,
  error: null,
  isLoading: true,
}

function chartsReducer(state: ChartsState, action: ChartsAction): ChartsState {
  switch (action.type) {
    case 'failed':
      return { ...state, dashboard: null, error: action.error, isLoading: false }
    case 'loaded':
      return { ...state, dashboard: action.dashboard, error: null, isLoading: false }
    case 'loading':
      return { ...state, error: null, isLoading: true }
  }
}

export function HeadDashboardChartsPanel({ reloadKey, rows }: { reloadKey: number; rows: HeadTeamRow[] }) {
  const { t } = useI18n()
  const [state, dispatch] = useReducer(chartsReducer, initialState)
  const { dashboard, error, isLoading } = state

  useEffect(() => {
    let cancelled = false

    async function loadCharts() {
      dispatch({ type: 'loading' })

      try {
        const result = await getHeadDashboard()

        if (!cancelled) {
          dispatch({ dashboard: result, type: 'loaded' })
        }
      } catch (loadError) {
        if (!cancelled) {
          dispatch({
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити дашборд'),
            type: 'failed',
          })
        }
      }
    }

    void loadCharts()

    return () => {
      cancelled = true
    }
  }, [reloadKey, t])

  const nameById = useMemo(() => {
    const map = new Map<number, string>()
    for (const row of rows) {
      map.set(row.manager_id, row.manager_name?.trim() || `#${row.manager_id}`)
    }
    return map
  }, [rows])

  const valueData = useMemo(
    () =>
      (dashboard?.teams ?? [])
        .toSorted((left, right) => right.value_at_risk_eur - left.value_at_risk_eur)
        .map((team) => ({
          manager: nameById.get(team.manager_id) ?? `#${team.manager_id}`,
          value: team.value_at_risk_eur,
        })),
    [dashboard?.teams, nameById],
  )

  const tasksData = useMemo(
    () =>
      (dashboard?.teams ?? [])
        .toSorted((left, right) => right.open_tasks - left.open_tasks)
        .map((team) => ({
          manager: nameById.get(team.manager_id) ?? `#${team.manager_id}`,
          open: team.open_tasks,
          critical: team.critical,
        })),
    [dashboard?.teams, nameById],
  )

  const valueSeries = useMemo<AgingSeries[]>(
    () => [{ name: 'value', label: t('Сума під ризиком, €'), color: 'red.6' }],
    [t],
  )

  const tasksSeries = useMemo<AgingSeries[]>(
    () => [
      { name: 'open', label: t('Активні'), color: 'blue.6' },
      { name: 'critical', label: t('Критичні'), color: 'red.6' },
    ],
    [t],
  )

  const escalatedCount = dashboard?.escalated_count ?? 0

  return (
    <Card withBorder radius="md" shadow="sm">
      <Stack gap="md">
        <Text fw={700} size="lg">
          {t('Дашборд команди')}
        </Text>

        {error && (
          <Alert color="orange" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <StatCard
            label={t('Сума під ризиком (відділ)')}
            value={formatMoney(dashboard?.total_value_at_risk_eur ?? 0)}
          />
          <Card withBorder radius="md" padding="md">
            <Text c="dimmed" size="xs" tt="uppercase">
              {t('Ескальовані задачі')}
            </Text>
            <Group gap="xs">
              <Text fw={700} size="lg">
                {escalatedCount}
              </Text>
              {escalatedCount > 0 && (
                <Badge color="red" variant="light">
                  {t('Потребують уваги')}
                </Badge>
              )}
            </Group>
          </Card>
        </SimpleGrid>

        <Card padding="md" radius="md" withBorder>
          <Stack gap="xs">
            <Text fw={600} size="sm">
              {t('Сума під ризиком за менеджером')}
            </Text>
            <AgingBars
              bucketKey="manager"
              data={valueData}
              emptyLabel={t('Дані відсутні')}
              isLoading={isLoading}
              loadingLabel={t('Завантаження')}
              series={valueSeries}
              valueFormatter={formatMoney}
            />
          </Stack>
        </Card>

        <Card padding="md" radius="md" withBorder>
          <Stack gap="xs">
            <Text fw={600} size="sm">
              {t('Завдання за менеджером')}
            </Text>
            <AgingBars
              bucketKey="manager"
              data={tasksData}
              emptyLabel={t('Дані відсутні')}
              isLoading={isLoading}
              loadingLabel={t('Завантаження')}
              series={tasksSeries}
              withLegend
            />
          </Stack>
        </Card>
      </Stack>
    </Card>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card withBorder radius="md" padding="md">
      <Text c="dimmed" size="xs" tt="uppercase">
        {label}
      </Text>
      <Text fw={700} size="lg">
        {value}
      </Text>
    </Card>
  )
}

function formatMoney(value: number): string {
  return `€${moneyFormatter.format(value)}`
}
