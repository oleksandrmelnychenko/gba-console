import { Alert, Card, Group, SimpleGrid, Stack, Text } from '@mantine/core'
import { CircleAlert } from 'lucide-react'
import { useEffect, useMemo, useReducer } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AgingBars, type AgingSeries } from '../../../shared/ui/charts/AgingBars'
import { TaskTypeDonut } from '../../../shared/ui/charts/TaskTypeDonut'
import { UrgencyDonut } from '../../../shared/ui/charts/UrgencyDonut'
import type { TaskTypeSliceInput, UrgencySliceInput } from '../../../shared/ui/charts/donutData'
import { getDashboard } from '../api/salesCockpitApi'
import type { CockpitDashboard, CockpitTaskType, CockpitUrgency } from '../types'

const URGENCY_LABEL: Record<CockpitUrgency, string> = {
  critical: 'Критично',
  high: 'Високий',
  normal: 'Звичайний',
  low: 'Низький',
}

const TASK_TYPE_LABEL: Record<CockpitTaskType, string> = {
  reorder_due: 'Час повторного замовлення',
  debt_followup: 'Контроль заборгованості',
  cross_sell: 'Крос-продаж',
  churn_winback: 'Повернення клієнта',
  new_client_activation: 'Активація нового клієнта',
}

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 0,
})

type DashboardState = {
  dashboard: CockpitDashboard | null
  error: string | null
  isLoading: boolean
}

type DashboardAction =
  | { type: 'failed'; error: string }
  | { type: 'loaded'; dashboard: CockpitDashboard }
  | { type: 'loading' }

const initialState: DashboardState = {
  dashboard: null,
  error: null,
  isLoading: true,
}

function dashboardReducer(state: DashboardState, action: DashboardAction): DashboardState {
  switch (action.type) {
    case 'failed':
      return { ...state, dashboard: null, error: action.error, isLoading: false }
    case 'loaded':
      return { ...state, dashboard: action.dashboard, error: null, isLoading: false }
    case 'loading':
      return { ...state, error: null, isLoading: true }
  }
}

export function CockpitDashboardPanel({ asOfDate, reloadKey }: { asOfDate?: string; reloadKey: number }) {
  const { t } = useI18n()
  const [state, dispatch] = useReducer(dashboardReducer, initialState)
  const { dashboard, error, isLoading } = state

  useEffect(() => {
    let cancelled = false

    async function loadDashboard() {
      dispatch({ type: 'loading' })

      try {
        const result = await getDashboard(asOfDate)

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

    void loadDashboard()

    return () => {
      cancelled = true
    }
  }, [asOfDate, reloadKey, t])

  const urgencyData = useMemo<UrgencySliceInput[]>(
    () =>
      (dashboard?.urgency_mix ?? []).map((item) => ({
        level: item.urgency,
        label: t(URGENCY_LABEL[item.urgency]),
        value: item.count,
      })),
    [dashboard?.urgency_mix, t],
  )

  const taskTypeData = useMemo<TaskTypeSliceInput[]>(
    () =>
      (dashboard?.task_type_mix ?? []).map((item) => ({
        type: item.type,
        label: t(TASK_TYPE_LABEL[item.type as CockpitTaskType] ?? item.type),
        value: item.count,
      })),
    [dashboard?.task_type_mix, t],
  )

  const agingData = useMemo(
    () =>
      (dashboard?.debt_aging ?? []).map((item) => ({
        bucket: item.bucket,
        amount: item.amount_eur,
      })),
    [dashboard?.debt_aging],
  )

  const agingSeries = useMemo<AgingSeries[]>(() => [{ name: 'amount', label: t('Сума, €'), color: 'orange.6' }], [t])

  const completedTotals = useMemo(() => {
    const byStatus = new Map((dashboard?.completed_vs_open ?? []).map((item) => [item.status, item.count]))

    return {
      open: byStatus.get('open') ?? 0,
      done: byStatus.get('done') ?? 0,
      dismissed: byStatus.get('dismissed') ?? 0,
    }
  }, [dashboard?.completed_vs_open])

  return (
    <Card className="app-section-card" withBorder radius="md">
      <Stack gap="md">
        <Text className="app-section-title" fw={600}>{t('Дашборд завдань')}</Text>

        {error && (
          <Alert color="orange" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
          <StatCard accent="danger" label={t('Сума під ризиком')} value={formatMoney(dashboard?.value_at_risk_eur ?? 0)} />
          <StatCard accent="info" label={t('Активні')} value={String(completedTotals.open)} />
          <StatCard accent="success" label={t('Виконано (місяць)')} value={String(completedTotals.done)} />
          <StatCard label={t('Відхилено (місяць)')} value={String(completedTotals.dismissed)} />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
          <Card className="cockpit-chart-card" padding="md" radius="md">
            <Stack align="center" gap="xs">
              <Text className="cockpit-subtitle">{t('За терміновістю')}</Text>
              <UrgencyDonut
                data={urgencyData}
                emptyLabel={t('Немає активних завдань')}
                isLoading={isLoading}
                loadingLabel={t('Завантаження')}
              />
            </Stack>
          </Card>

          <Card className="cockpit-chart-card" padding="md" radius="md">
            <Stack align="center" gap="xs">
              <Text className="cockpit-subtitle">{t('За типом завдання')}</Text>
              <TaskTypeDonut
                data={taskTypeData}
                emptyLabel={t('Немає активних завдань')}
                isLoading={isLoading}
                loadingLabel={t('Завантаження')}
              />
            </Stack>
          </Card>
        </SimpleGrid>

        <Card className="cockpit-chart-card" padding="md" radius="md">
          <Stack gap="xs">
            <Group justify="space-between" wrap="wrap">
              <Text className="cockpit-subtitle">{t('Старіння заборгованості')}</Text>
              <Text c="dimmed" size="xs">
                {t('Сума під ризиком')}: {formatMoney(dashboard?.value_at_risk_eur ?? 0)}
              </Text>
            </Group>
            <AgingBars
              bucketKey="bucket"
              data={agingData}
              emptyLabel={t('Заборгованості немає')}
              isLoading={isLoading}
              loadingLabel={t('Завантаження')}
              series={agingSeries}
              valueFormatter={formatMoney}
            />
          </Stack>
        </Card>
      </Stack>
    </Card>
  )
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className={`cockpit-metric${accent ? ` is-${accent}` : ''}`}>
      <span className="cockpit-metric-label">{label}</span>
      <span className="cockpit-metric-value">{value}</span>
    </div>
  )
}

function formatMoney(value: number): string {
  return `€${moneyFormatter.format(value)}`
}
