import { Badge, Card, Group, Stack, Text } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { CockpitTaskInsights } from '../utils/taskInsights'
import type { CockpitUrgency } from '../types'

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 0,
})

const QUEUE_URGENCY_LABEL: Record<CockpitUrgency, string> = {
  critical: 'Критично',
  high: 'Високий',
  normal: 'Звичайний',
  low: 'Низький',
}

export function CockpitQueueSummary({
  insights,
  isLoading,
  visibleCount,
}: {
  insights: CockpitTaskInsights
  isLoading: boolean
  visibleCount: number
}) {
  const { t } = useI18n()
  const topTask = insights.topTask

  return (
    <Card className="app-section-card cockpit-queue-summary" withBorder radius="md">
      <Stack gap="md">
        <Group justify="space-between" gap="sm" wrap="wrap">
          <Stack gap={1}>
            <Text className="app-section-title" fw={600} size="sm">{t('AI черга менеджера')}</Text>
            <Text c="dimmed" size="xs">
              {t('Операційний зріз уже сформованих задач')}
            </Text>
          </Stack>
          <Badge className={`app-role-pill ${isLoading ? 'is-gray' : 'is-orange'}`} variant="light">
            {t('у поточному фільтрі')}: {visibleCount}
          </Badge>
        </Group>

        <div className={`cockpit-queue-priority${topTask ? '' : ' is-empty'}`}>
          <Stack gap={3}>
            <Text c="dimmed" size="xs" fw={650}>
              {t('Перший AI-пріоритет')}
            </Text>
            <Text className="cockpit-queue-priority__title">
              {topTask?.title?.trim() || t('Немає активного пріоритету')}
            </Text>
            <Text c="dimmed" size="xs">
              {topTask?.client_name?.trim() || topTask?.reason?.trim() || t('AI черга порожня')}
            </Text>
          </Stack>
          {topTask?.urgency && (
            <Badge
              className={`app-role-pill ${topTask.urgency === 'critical' ? 'is-red' : topTask.urgency === 'high' ? 'is-orange' : ''}`.trim()}
              variant="light"
            >
              {t(QUEUE_URGENCY_LABEL[topTask.urgency])}
            </Badge>
          )}
        </div>

        <div className="cockpit-queue-summary__grid">
          <QueueMetric
            accent="brand"
            label={t('Активні задачі')}
            subLabel={`${t('сьогодні')}: ${insights.todayCount}`}
            value={String(insights.totalCount)}
          />
          <QueueMetric
            accent="danger"
            label={t('Критичні / SLA')}
            subLabel={`${t('високий пріоритет')}: ${insights.highCount}`}
            value={`${insights.criticalCount} / ${insights.slaBreachedCount}`}
          />
          <QueueMetric
            accent="success"
            label={t('Очікувана цінність')}
            subLabel={`${t('weighted')}: ${formatMoney(insights.weightedValueEur)}`}
            value={formatMoney(insights.expectedValueEur)}
          />
          <QueueMetric
            accent="info"
            label={t('Шанс закриття')}
            subLabel={`${t('в роботі')}: ${insights.inProgressCount}`}
            value={insights.averageProbability === null ? '—' : formatPercent(insights.averageProbability)}
          />
        </div>
      </Stack>
    </Card>
  )
}

function QueueMetric({
  accent,
  label,
  subLabel,
  value,
}: {
  accent: 'brand' | 'danger' | 'info' | 'success'
  label: string
  subLabel: string
  value: string
}) {
  return (
    <div className={`cockpit-queue-metric is-${accent}`}>
      <span className="cockpit-queue-metric__label">{label}</span>
      <span className="cockpit-queue-metric__value">{value}</span>
      <span className="cockpit-queue-metric__sub">{subLabel}</span>
    </div>
  )
}

function formatMoney(value: number): string {
  return `€${moneyFormatter.format(value)}`
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}
