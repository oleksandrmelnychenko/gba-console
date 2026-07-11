import { Alert, Stack, Text } from '@mantine/core'
import { CircleAlert } from 'lucide-react'
import { useEffect, useMemo, useReducer } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AgingBars, type AgingSeries } from '../../../shared/ui/charts/AgingBars'
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

export function HeadDashboardChartsPanel({
  asOfDate,
  reloadKey,
  rows,
}: {
  asOfDate?: string
  reloadKey: number
  rows: HeadTeamRow[]
}) {
  const { t } = useI18n()
  const [state, dispatch] = useReducer(chartsReducer, initialState)
  const { dashboard, error, isLoading } = state

  useEffect(() => {
    let cancelled = false

    async function loadCharts() {
      dispatch({ type: 'loading' })

      try {
        const result = await getHeadDashboard(asOfDate)

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
  }, [asOfDate, reloadKey, t])

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

  return (
    <section className="app-section-card cockpit-analytics-panel">
      <Stack gap="md">
        <div>
          <Text className="app-section-title" fw={600} size="sm">{t('Аналітика навантаження')}</Text>
          <Text c="dimmed" size="xs">{t('Ризик і активні задачі за менеджерами')}</Text>
        </div>

        {error && (
          <Alert color="orange" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <div className="cockpit-analytics-grid">
          <div className="cockpit-chart-card">
          <Stack gap="xs">
            <Text className="cockpit-subtitle">{t('Сума під ризиком за менеджером')}</Text>
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
          </div>

          <div className="cockpit-chart-card">
          <Stack gap="xs">
            <Text className="cockpit-subtitle">{t('Завдання за менеджером')}</Text>
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
          </div>
        </div>
      </Stack>
    </section>
  )
}

function formatMoney(value: number): string {
  return `€${moneyFormatter.format(value)}`
}
