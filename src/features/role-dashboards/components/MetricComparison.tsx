import { Text } from '@mantine/core'
import type { DashboardMetricComparison, DashboardWorkspaceMetric } from '../types'
import { useI18n } from '../../../shared/i18n/useI18n'
import { formatMetricValue } from '../utils/metricView'

const percent = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, signDisplay: 'exceptZero' })
const displayDate = (value: string) => value.split('-').reverse().join('.')

export function MetricComparison({ metric }: { metric: DashboardWorkspaceMetric }) {
  const { t } = useI18n()
  const comparison = metric.comparison
  if (!comparison) return null
  const { interval, previous, change } = comparisonText(metric, comparison, t)
  return <span className="role-dashboard-comparison">
    <Text component="span" display="block" size="xs" c="dimmed">{t('Попередній період такої самої тривалості')}{interval}</Text>
    <Text component="span" display="block" size="xs">{t('Попереднє значення')}: {previous}</Text>
    {change && <Text component="span" display="block" size="xs">{t('Зміна')}: {change}</Text>}
    {comparison.unknownReason && <Text component="span" display="block" size="xs" c="orange">{t(comparison.unknownReason)}</Text>}
  </span>
}

function comparisonText(metric: DashboardWorkspaceMetric, comparison: DashboardMetricComparison, t: (text: string) => string) {
  const format = (value: number) => formatMetricValue({ ...metric, value, hasData: true })
  const previousValue = comparison.value === null ? null : format(comparison.value)
  const previous = previousValue ? `${previousValue.value} ${previousValue.unit}`.trim() : t('Немає даних')
  const end = comparison.to ? new Date(Date.parse(comparison.to) - 86400000).toISOString().slice(0, 10) : null
  const interval = comparison.from && end ? `: ${displayDate(comparison.from)} — ${displayDate(end)}` : ''
  let change: string | null = null
  if (comparison.value !== null && comparison.delta !== null && metric.hasData) {
    const delta = format(comparison.delta)
    const unit = metric.unit === '%' ? t('в.п.') : delta.unit
    change = `${comparison.delta > 0 ? '+' : ''}${delta.value} ${unit}`.trim()
    if (comparison.deltaPercent !== null && comparison.value !== 0) {
      const basis = metric.unit === '%' ? ` ${t('від попереднього')}` : ''
      change += ` (${percent.format(comparison.deltaPercent)}%${basis})`
    }
  }
  return { interval, previous, change }
}
