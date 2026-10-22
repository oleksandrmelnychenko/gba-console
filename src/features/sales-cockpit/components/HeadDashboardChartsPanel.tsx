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
  reloadKey,
  rows,
}: {
  reloadKey: number
  rows: HeadTeamRow[]
}) {
  const { t } = useI18n()
  const [state, dispatch] = useReducer(chartsReducer, initialState)
  const { dashboard, error, isLoading } = state

  useEffect(() => {
    let cancelled = false
    let requestInFlight = false

    async function loadCharts() {
      if (requestInFlight) return
      requestInFlight = true
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
      } finally {
        requestInFlight = false
      }
    }

    void loadCharts()
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadCharts()
    }, 60_000)

    return () => {
      window.clearInterval(interval)
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

  const hasCompleteTaskSplit = dashboard?.teams.every((team) => team.ai_active != null && team.manual_backlog != null) ?? false
  const tasksData = useMemo(
    () =>
      (dashboard?.teams ?? [])
        .toSorted((left, right) => right.open_tasks - left.open_tasks)
        .map((team) => ({
          manager: nameById.get(team.manager_id) ?? `#${team.manager_id}`,
          open: team.open_tasks,
          critical: team.critical,
          ...(team.ai_active != null && team.manual_backlog != null ? { ai: team.ai_active, manual: team.manual_backlog } : {}),
        })),
    [dashboard?.teams, nameById],
  )

  const valueSeries = useMemo<AgingSeries[]>(
    () => [{ name: 'value', label: t('Відомий прострочений борг, €'), color: 'red.6' }],
    [t],
  )

  const tasksSeries = useMemo<AgingSeries[]>(
    () => [
      { name: 'open', label: t('Активні'), color: 'blue.6' },
      { name: 'critical', label: t('Критичні'), color: 'red.6' },
      ...(hasCompleteTaskSplit ? [
        { name: 'ai', label: t('AI-рекомендації'), color: 'cyan.6' },
        { name: 'manual', label: t('Ручні завдання'), color: 'orange.6' },
      ] : []),
    ],
    [t, hasCompleteTaskSplit],
  )

  return (
    <section className="app-section-card cockpit-analytics-panel">
      <Stack gap={10}>
        <div className="cockpit-head-section-heading">
          <div>
            <Text className="app-section-title" component="h2" fw={600} size="sm">{t('Аналітика навантаження')}</Text>
            <Text c="dimmed" size="xs">{t('Ризик і активні задачі за менеджерами')}</Text>
          </div>
          {dashboard?.as_of && <Text size="xs" c="dimmed">{t('Поточний зріз')}: {dashboard.as_of}. {t('Це дата розрахунку, не підтвердження свіжості синхронізації.')}</Text>}
        </div>

        {error && (
          <Alert color="orange" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        )}
        {dashboard && (hasCompleteTaskSplit ? (
          <Text size="sm">{t('Усі активні, включно з відкладеними')}: {dashboard.teams.reduce((sum, team) => sum + team.open_tasks, 0)} · {t('AI-рекомендації')}: {dashboard.teams.reduce((sum, team) => sum + (team.ai_active ?? 0), 0)} · {t('Ручні завдання')}: {dashboard.teams.reduce((sum, team) => sum + (team.manual_backlog ?? 0), 0)}</Text>
        ) : <Text size="xs" c="dimmed">{t('Поділ активних завдань на AI та ручні недоступний.')}</Text>)}
        {(dashboard?.teams.reduce((sum, team) => sum + (team.debt_unknown_terms_count ?? 0), 0) ?? 0) > 0 && <Alert color="yellow">
          {t('Є документи без визначеного терміну оплати. Вони не входять до відомого простроченого боргу.')}
        </Alert>}
        {(dashboard?.teams.reduce((sum, team) => sum + (team.debt_unknown_date_count ?? 0), 0) ?? 0) > 0 && <Alert color="yellow">
          {t('Дата документа не визначена')}: {dashboard?.teams.reduce((sum, team) => sum + (team.debt_unknown_date_count ?? 0), 0)} · {formatMoney(dashboard?.teams.reduce((sum, team) => sum + (team.debt_unknown_date_eur ?? 0), 0) ?? 0)}. {t('Ці документи показано окремо від відомого простроченого боргу.')}
        </Alert>}

        <div className="cockpit-analytics-grid">
          <div className="cockpit-chart-card">
          <Stack gap="xs">
            <Text className="cockpit-subtitle">{t('Відомий прострочений борг за менеджером')}</Text>
            <AgingBars
              money
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
