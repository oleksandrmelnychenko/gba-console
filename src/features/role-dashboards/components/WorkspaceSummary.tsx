import { ActionIcon, Alert, Badge, Skeleton, Text, Tooltip, UnstyledButton } from '@mantine/core'
import { ArrowUpRight, CircleAlert, RefreshCw } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import type { WorkspaceSummaryState } from '../hooks/useWorkspaceSummary'
import type { DashboardWorkspaceMetric } from '../types'
import { formatMetricValue } from '../utils/metricView'
import { MetricIcon } from './MetricIcon'
import { metricDrilldownRoute, metricTimeLabel } from '../utils/metricScope'
import { useI18n } from '../../../shared/i18n/useI18n'

export function WorkspaceSummary({
  state,
  toolbarTarget,
}: {
  state: WorkspaceSummaryState
  /** Page toolbar slot for the refresh status; `null` while it mounts, `undefined` when the page has no toolbar. */
  toolbarTarget?: HTMLElement | null
}) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { error, isRefreshing, reload, summary } = state

  const refreshStatus = (
    <div className="role-dashboard-refresh">
      <Text className="role-dashboard-updated" aria-live="polite">
        {summary?.generatedAtUtc ? `${t('Оновлено о')} ${formatUpdatedAt(summary.generatedAtUtc)}` : t('Оновлення…')}
      </Text>
      <Tooltip label={t('Оновити показники')}>
        <ActionIcon
          aria-label={t('Оновити показники')}
          color="gray"
          loading={isRefreshing}
          size={36}
          variant="default"
          onClick={reload}
        >
          <RefreshCw size={16} />
        </ActionIcon>
      </Tooltip>
    </div>
  )

  let content: ReactNode

  if (error && !summary) {
    content = <Alert color="red" icon={<CircleAlert size={16} />} variant="light">{error}</Alert>
  } else if (!summary) {
    content = (
      <div aria-busy="true" className="role-dashboard-kpi-grid" style={kpiColumns(4)}>
        {[0, 1, 2, 3].map((index) => (
          <div className="role-dashboard-kpi" key={index}>
            <Skeleton className="role-dashboard-kpi-icon" height={40} radius={10} width={40} />
            <span className="role-dashboard-kpi-body">
              <Skeleton height={10} radius="sm" width="62%" />
              <Skeleton height={22} mt={8} radius="sm" width="36%" />
            </span>
          </div>
        ))}
      </div>
    )
  } else if (summary.metrics.length === 0) {
    content = <Text className="role-dashboard-kpi-empty">{t('Показників для цього дашборда поки немає')}</Text>
  } else {
    content = (
      <div className="role-dashboard-kpi-grid" style={kpiColumns(summary.metrics.length)}>
        {summary.metrics.map((metric) => {
          const route = metricDrilldownRoute(summary, metric)
          return <MetricCard key={metric.key} metric={metric} onOpen={route ? () => navigate(route) : undefined} />
        })}
      </div>
    )
  }

  return (
    <section aria-label={t('Ключові показники')} className="role-dashboard-kpis">
      {toolbarTarget === undefined ? refreshStatus : toolbarTarget && createPortal(refreshStatus, toolbarTarget)}
      {error && summary && (
        <Alert className="role-dashboard-inline-alert" color="orange" icon={<CircleAlert size={16} />} variant="light">{error}</Alert>
      )}
      {content}
    </section>
  )
}

function MetricCard({ metric, onOpen }: { metric: DashboardWorkspaceMetric; onOpen?: () => void }) {
  const { t } = useI18n()
  const formatted = formatMetricValue(metric)
  const content = (
    <div className={`role-dashboard-kpi is-${metric.tone}${metric.hasData ? '' : ' is-empty'}`}>
      <span aria-hidden="true" className="role-dashboard-kpi-icon"><MetricIcon metric={metric} size={19} strokeWidth={1.9} /></span>
      <span className="role-dashboard-kpi-body">
        <Text className="role-dashboard-kpi-label" lineClamp={1} title={metric.label}>{metric.label}</Text>
        <Text size="xs" c="dimmed">{t(metricTimeLabel(metric))}</Text>
        <span className="role-dashboard-kpi-value">
          {metric.hasData ? formatted.value : t(formatted.value)}
          {formatted.unit && <span className="role-dashboard-kpi-unit">{formatted.unit}</span>}
        </span>
      </span>
      <span className="role-dashboard-kpi-aside">
        {onOpen && <ArrowUpRight aria-hidden="true" className="role-dashboard-kpi-open" size={16} />}
        {metric.hasData && metric.coveragePercent < 100 && (
          <Tooltip label={t('Охоплення даних')}>
            <Badge className="app-role-pill is-orange" size="xs" variant="light">{metric.coveragePercent}%</Badge>
          </Tooltip>
        )}
      </span>
    </div>
  )

  return onOpen ? (
    <UnstyledButton
      className="role-dashboard-kpi-button"
      aria-label={`${metric.label}: ${formatted.value} ${formatted.unit}`.trim()}
      onClick={onOpen}
    >
      {content}
    </UnstyledButton>
  ) : content
}

function kpiColumns(count: number): CSSProperties {
  return { '--role-dashboard-kpi-columns': Math.min(Math.max(count, 1), 5) } as CSSProperties
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit' }).format(date)
}
