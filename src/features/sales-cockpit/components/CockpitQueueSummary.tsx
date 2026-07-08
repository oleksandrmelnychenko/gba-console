import { Badge, Card, Group, Stack, Text } from '@mantine/core'
import { Flame, ListChecks, Sparkles, Target, TrendingUp } from 'lucide-react'
import type { ReactNode } from 'react'
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
          <Group gap="xs" wrap="nowrap">
            <span className="cockpit-queue-summary__icon" aria-hidden="true">
              <Sparkles size={18} fill="currentColor" strokeWidth={0} />
            </span>
            <Stack gap={1}>
              <Text className="app-section-title" fw={700}>{t('AI черга менеджера')}</Text>
              <Text c="dimmed" size="xs">
                {t('Операційний зріз уже сформованих задач')}
              </Text>
            </Stack>
          </Group>
          <Badge color={isLoading ? 'gray' : 'violet'} leftSection={isLoading ? undefined : <ListChecks size={13} />} variant="light">
            {t('у поточному фільтрі')}: {visibleCount}
          </Badge>
        </Group>

        <div className="cockpit-queue-summary__grid">
          <QueueMetric
            accent="brand"
            icon={<ListChecks size={17} />}
            label={t('Активні задачі')}
            subLabel={`${t('сьогодні')}: ${insights.todayCount}`}
            value={String(insights.totalCount)}
          />
          <QueueMetric
            accent="danger"
            icon={<Flame size={17} />}
            label={t('Критичні / SLA')}
            subLabel={`${t('високий пріоритет')}: ${insights.highCount}`}
            value={`${insights.criticalCount} / ${insights.slaBreachedCount}`}
          />
          <QueueMetric
            accent="success"
            icon={<TrendingUp size={17} />}
            label={t('Очікувана цінність')}
            subLabel={`${t('weighted')}: ${formatMoney(insights.weightedValueEur)}`}
            value={formatMoney(insights.expectedValueEur)}
          />
          <QueueMetric
            accent="info"
            icon={<Target size={17} />}
            label={t('Шанс закриття')}
            subLabel={`${t('в роботі')}: ${insights.inProgressCount}`}
            value={insights.averageProbability === null ? '—' : formatPercent(insights.averageProbability)}
          />
        </div>

        <div className="cockpit-queue-priority">
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
            <Badge color={topTask.urgency === 'critical' ? 'red' : topTask.urgency === 'high' ? 'orange' : 'blue'} variant="light">
              {t(QUEUE_URGENCY_LABEL[topTask.urgency])}
            </Badge>
          )}
        </div>
      </Stack>
    </Card>
  )
}

function QueueMetric({
  accent,
  icon,
  label,
  subLabel,
  value,
}: {
  accent: 'brand' | 'danger' | 'info' | 'success'
  icon: ReactNode
  label: string
  subLabel: string
  value: string
}) {
  return (
    <div className={`cockpit-queue-metric is-${accent}`}>
      <span className="cockpit-queue-metric__icon" aria-hidden="true">
        {icon}
      </span>
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
