import { AreaChart } from '@mantine/charts'
import { Loader, Stack, Text } from '@mantine/core'
import { Activity, CheckCircle2 } from 'lucide-react'
import { useMemo } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { AiFleetObservation } from '../utils/aiFleetObservations'
import { buildAiFleetSessionSeries } from '../utils/aiFleetObservations'
import type {
  AiFleetAnalytics,
  AiFleetEffectiveState,
  AiFleetReadinessRow,
} from '../utils/aiFleetView'
import {
  AI_FLEET_WARMUP_DURATION_TARGET_MINUTES,
  AI_FLEET_WARMUP_STALE_HOURS,
} from '../utils/aiFleetView'
import './ai-fleet-analytics.css'
import { TableChip, type TableChipTone } from '../../../shared/ui/TableChip'

type AiFleetAnalyticsDashboardProps = {
  analytics: AiFleetAnalytics
  history: AiFleetObservation[]
  isLoading: boolean
}

type DistributionSegment = {
  label: string
  state: AiFleetEffectiveState
  value: number
}

type ThresholdBulletProps = {
  breachLabel: string
  label: string
  state: AiFleetEffectiveState
  threshold: number
  thresholdLabel: string
  unit: string
  value: number | null
}

const sessionTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

const compactNumberFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 1,
})

const STATE_SORT_WEIGHT: Record<AiFleetEffectiveState, number> = {
  fail: 4,
  pass: 0,
  unknown: 2,
  warning: 3,
}

const STATE_LABEL: Record<AiFleetEffectiveState, string> = {
  fail: 'Down',
  pass: 'OK',
  unknown: 'Немає даних',
  warning: 'Застаріло',
}

export function AiFleetAnalyticsDashboard({
  analytics,
  history,
  isLoading,
}: AiFleetAnalyticsDashboardProps) {
  const { t } = useI18n()
  const chartData = useMemo(
    () => buildAiFleetSessionSeries(history).map((point) => ({
      ...point,
      time: sessionTimeFormatter.format(new Date(point.capturedAtMs)),
    })),
    [history],
  )
  const observedPoints = useMemo(
    () => chartData.filter((point) => point.total !== null),
    [chartData],
  )
  const matrixRows = useMemo(
    () => analytics.readinessRows.toSorted(compareReadinessRows),
    [analytics.readinessRows],
  )
  const rankedActions = useMemo(
    () => analytics.nextActions.toSorted((left, right) => {
      if (left.severity !== right.severity) {
        return left.severity === 'danger' ? -1 : 1
      }

      return left.serviceName.localeCompare(right.serviceName, 'uk')
    }),
    [analytics.nextActions],
  )
  const failedChecks = analytics.apiBreakdown.fail + analytics.warmupBreakdown.fail
  const warningChecks = analytics.apiBreakdown.warning + analytics.warmupBreakdown.warning
  const unknownChecks = analytics.apiBreakdown.unknown + analytics.warmupBreakdown.unknown
  const summaryState = failedChecks > 0
    ? 'fail'
    : warningChecks > 0
      ? 'warning'
      : unknownChecks > 0
        ? 'unknown'
        : 'pass'
  const summaryText = buildSummaryText(failedChecks, warningChecks, unknownChecks, t)

  return (
    <section
      aria-busy={isLoading}
      aria-labelledby="ai-fleet-analytics-title"
      className="ai-fleet-dashboard"
    >
      <header className="ai-fleet-dashboard__header">
        <Text component="h2" className="app-section-title" fw={600} id="ai-fleet-analytics-title">
          {t('Стан сервісів')}
        </Text>
        {isLoading ? (
          <span className="ai-fleet-dashboard__loading"><Loader size={12} />{t('Оновлюємо')}</span>
        ) : (
          <TableChip tone={stateTone(summaryState)} value={`${analytics.passedCheckCount}/${analytics.totalCheckCount} ${t('перевірок пройдено')}`} />
        )}
      </header>

      <div className="ai-fleet-dashboard__overview">
        <article className={`ai-fleet-dashboard__score-card is-${summaryState}`}>
          <Text className="ai-fleet-dashboard__eyebrow">{t('Пройдено перевірок')}</Text>
          <div
            aria-label={`${t('Пройдено перевірок')}: ${analytics.passedCheckCount} ${t('з')} ${analytics.totalCheckCount}`}
            className="ai-fleet-dashboard__score"
          >
            <strong>{analytics.passedCheckCount}</strong>
            <span>/{analytics.totalCheckCount}</span>
          </div>
          <Text className="ai-fleet-dashboard__score-label" size="xs">
            {t('API та ранкове оновлення')}
          </Text>
          <Text className="ai-fleet-dashboard__insight" size="sm">
            {summaryText}
          </Text>
        </article>

        <article className="ai-fleet-dashboard__card ai-fleet-dashboard__distribution-card">
          <div className="ai-fleet-dashboard__card-heading">
            <div>
              <Text className="app-section-title ai-fleet-dashboard__card-title" fw={600}>{t('Склад перевірок')}</Text>
            </div>
          </div>
          <Stack gap="md">
            <StateDistributionBar
              segments={[
                { label: t('OK'), state: 'pass', value: analytics.apiBreakdown.pass },
                { label: t('Down'), state: 'fail', value: analytics.apiBreakdown.fail },
                { label: t('Немає даних'), state: 'unknown', value: analytics.apiBreakdown.unknown },
              ]}
              title={t('Доступність API')}
              total={analytics.apiBreakdown.total}
            />
            <StateDistributionBar
              segments={[
                { label: t('Свіжий'), state: 'pass', value: analytics.warmupBreakdown.pass },
                { label: t('Застаріло'), state: 'warning', value: analytics.warmupBreakdown.warning },
                { label: t('Down'), state: 'fail', value: analytics.warmupBreakdown.fail },
                { label: t('Немає даних'), state: 'unknown', value: analytics.warmupBreakdown.unknown },
              ]}
              title={t('05:00 warmup')}
              total={analytics.warmupBreakdown.total}
            />
          </Stack>
        </article>
      </div>

      <div className="ai-fleet-dashboard__live-grid">
        <SessionTrendChart
          chartData={chartData}
          isLoading={isLoading}
          observedPointCount={observedPoints.length}
          totalChecks={analytics.totalCheckCount}
        />

        <article className="ai-fleet-dashboard__card ai-fleet-dashboard__sla-card">
          <div className="ai-fleet-dashboard__card-heading">
            <div>
              <Text className="app-section-title ai-fleet-dashboard__card-title" fw={600}>{t('Останнє оновлення')}</Text>
            </div>
          </div>
          <Stack gap="lg">
            <ThresholdBullet
              breachLabel={t('Перевищено')}
              label={t('Тривалість останньої 05:00 задачі')}
              state={analytics.operationDurationState}
              threshold={AI_FLEET_WARMUP_DURATION_TARGET_MINUTES}
              thresholdLabel={`${t('ліміт')} ${AI_FLEET_WARMUP_DURATION_TARGET_MINUTES} ${t('хв')}`}
              unit={t('хв')}
              value={analytics.operationDurationMinutes}
            />
            <ThresholdBullet
              breachLabel={t('Застаріло')}
              label={t('Вік останнього фінішу')}
              state={analytics.operationAgeState}
              threshold={AI_FLEET_WARMUP_STALE_HOURS}
              thresholdLabel={`${t('ліміт')} ${AI_FLEET_WARMUP_STALE_HOURS} ${t('год')}`}
              unit={t('год')}
              value={analytics.operationAgeHours}
            />
          </Stack>
        </article>
      </div>

      <div className="ai-fleet-dashboard__detail-grid">
        <ServiceMatrix rows={matrixRows} />
        <RankedActions actions={rankedActions} />
      </div>
    </section>
  )
}

function StateDistributionBar({
  segments,
  title,
  total,
}: {
  segments: DistributionSegment[]
  title: string
  total: number
}) {
  const { t } = useI18n()
  const description = segments
    .map((segment) => `${segment.label}: ${segment.value}`)
    .join(', ')

  return (
    <figure className="ai-fleet-distribution">
      <figcaption className="ai-fleet-distribution__caption">
        <span>{title}</span>
        <TableChip value={`${total} ${t('сервісів')}`} />
      </figcaption>
      <div
        aria-label={`${title}. ${description}`}
        className="ai-fleet-distribution__bar"
        role="img"
      >
        {segments.map((segment) => segment.value > 0 ? (
          <span
            aria-hidden="true"
            className={`ai-fleet-distribution__segment is-${segment.state}`}
            key={segment.state}
            style={{ flexGrow: segment.value }}
            title={`${segment.label}: ${segment.value}`}
          />
        ) : null)}
      </div>
      <div className="ai-fleet-distribution__legend" aria-hidden="true">
        {segments.map((segment) => (
          <span key={segment.state}>
            <i className={`is-${segment.state}`} />
            {segment.label} <b>{segment.value}</b>
          </span>
        ))}
      </div>
    </figure>
  )
}

function SessionTrendChart({
  chartData,
  isLoading,
  observedPointCount,
  totalChecks,
}: {
  chartData: Array<{
    capturedAtMs: number
    fail: number | null
    pass: number | null
    time: string
    total: number | null
    unknown: number | null
    warning: number | null
  }>
  isLoading: boolean
  observedPointCount: number
  totalChecks: number
}) {
  const { t } = useI18n()
  const realPoints = chartData.filter((point) => point.total !== null)
  const firstTime = realPoints.at(0)?.time
  const lastTime = realPoints.at(-1)?.time
  const chartSummary = realPoints.at(-1)
  const chartMaximum = realPoints.reduce(
    (maximum, point) => Math.max(maximum, point.total ?? 0),
    Math.max(totalChecks, 1),
  )
  const accessibleSummary = chartSummary
    ? `${t('Останнє спостереження')}: ${chartSummary.pass ?? 0} ${t('OK')}, ${chartSummary.warning ?? 0} ${t('застаріло')}, ${chartSummary.fail ?? 0} ${t('Down')}, ${chartSummary.unknown ?? 0} ${t('без даних')}.`
    : t('Спостережень ще немає.')

  return (
    <figure className="ai-fleet-dashboard__card ai-fleet-dashboard__trend-card">
      <div className="ai-fleet-dashboard__card-heading">
        <div>
          <Text className="app-section-title ai-fleet-dashboard__card-title" fw={600}>
            {t('Динаміка перевірок')} · {totalChecks}
          </Text>
          <Text c="dimmed" size="xs">{t('Поточна сесія')}</Text>
        </div>
        <TableChip value={`${t('Знімки')}: ${observedPointCount}`} />
      </div>

      {observedPointCount < 2 ? (
        <div aria-live="polite" className="ai-fleet-dashboard__collecting">
          {isLoading && observedPointCount === 0 ? <Loader size={20} color="gray" /> : <Activity aria-hidden="true" size={23} />}
          <Text fw={650} size="sm">{t('Очікуємо наступне оновлення')}</Text>
          <Text c="dimmed" size="xs">
            {observedPointCount}/2 {t('знімків для графіка')}
          </Text>
        </div>
      ) : (
        <div
          aria-label={`${t('Динаміка перевірок у цій вкладці')}. ${accessibleSummary}`}
          className="ai-fleet-dashboard__chart"
          role="img"
        >
          <AreaChart
            aria-hidden="true"
            areaChartProps={{ margin: { bottom: 0, left: 0, right: 8, top: 8 } }}
            areaProps={{ isAnimationActive: false }}
            connectNulls={false}
            curveType="linear"
            data={chartData}
            dataKey="time"
            fillOpacity={0.04}
            gridAxis="y"
            h={190}
            series={[
              { color: 'teal.6', label: t('OK'), name: 'pass' },
              { color: 'orange.6', label: t('Застаріло'), name: 'warning' },
              { color: 'red.6', label: t('Down'), name: 'fail' },
              { color: 'gray.5', label: t('Немає даних'), name: 'unknown' },
            ]}
            tickLine="y"
            tooltipAnimationDuration={0}
            type="stacked"
            valueFormatter={(value) => `${value} ${t('перевірок')}`}
            withDots={false}
            withGradient={false}
            xAxisProps={{ minTickGap: 42 }}
            yAxisProps={{
              allowDecimals: false,
              domain: [0, chartMaximum],
              tickFormatter: (value: number) => String(value),
              tickMargin: 8,
              width: 28,
            }}
          />
          <div className="ai-fleet-session-legend" aria-hidden="true">
            <span><i className="is-pass" />{t('OK')}</span>
            <span><i className="is-warning" />{t('Застаріло')}</span>
            <span><i className="is-fail" />{t('Down')}</span>
            <span><i className="is-unknown" />{t('Немає даних')}</span>
          </div>
        </div>
      )}

      {observedPointCount >= 2 && firstTime && lastTime && (
        <figcaption className="ai-fleet-dashboard__figure-caption">
          {firstTime}–{lastTime}
        </figcaption>
      )}
    </figure>
  )
}

function ThresholdBullet({
  breachLabel,
  label,
  state,
  threshold,
  thresholdLabel,
  unit,
  value,
}: ThresholdBulletProps) {
  const { t } = useI18n()
  const scaleMaximum = threshold / 0.75
  const valuePosition = value === null
    ? 0
    : Math.min(100, Math.max(0, (value / scaleMaximum) * 100))
  const valueLabel = value === null
    ? t('Немає даних')
    : `${compactNumberFormatter.format(value)} ${unit}`
  const stateLabel = state === 'unknown'
    ? t('Немає даних')
    : state === 'pass'
      ? t('У межах')
      : breachLabel

  return (
    <div className="ai-fleet-threshold">
      <div className="ai-fleet-threshold__heading">
        <span>{label}</span>
        <b className={`is-${state}`}>{valueLabel}</b>
      </div>
      <div
        aria-label={`${label}: ${valueLabel}. ${thresholdLabel}. ${stateLabel}.`}
        className="ai-fleet-threshold__visual"
        role="img"
      >
        <div className="ai-fleet-threshold__track">
          {value !== null ? (
            <span
              aria-hidden="true"
              className={`ai-fleet-threshold__fill is-${state}`}
              style={{ width: `${valuePosition}%` }}
            />
          ) : null}
          <span aria-hidden="true" className="ai-fleet-threshold__target" />
          {value !== null ? (
            <span
              aria-hidden="true"
              className={`ai-fleet-threshold__marker is-${state}`}
              style={{ left: `${valuePosition}%` }}
            />
          ) : null}
        </div>
      </div>
      <div className="ai-fleet-threshold__scale" aria-hidden="true">
        <span>0</span>
        <span>{thresholdLabel}</span>
        <b className={`is-${state}`}>{stateLabel}</b>
      </div>
    </div>
  )
}

function ServiceMatrix({ rows }: { rows: AiFleetReadinessRow[] }) {
  const { t } = useI18n()

  return (
    <article className="ai-fleet-dashboard__card ai-fleet-dashboard__matrix-card">
      <div className="ai-fleet-dashboard__card-heading">
        <div>
          <Text className="app-section-title ai-fleet-dashboard__card-title" fw={600}>{t('Сервіси')}</Text>
        </div>
      </div>
      <div
        aria-label={t('Прокручувана матриця станів AI-сервісів')}
        className="ai-fleet-matrix-scroll"
        role="region"
        tabIndex={0}
      >
        <table className="app-static-table ai-fleet-matrix">
          <caption className="ai-fleet-visually-hidden">
            {t('Стан API, 05:00 warmup, свіжість та кількість пройдених перевірок для кожного AI-сервісу')}
          </caption>
          <thead>
            <tr>
              <th scope="col">{t('Сервіс')}</th>
              <th scope="col">{t('API')}</th>
              <th scope="col">{t('05:00')}</th>
              <th scope="col">{t('Свіжість')}</th>
              <th scope="col">{t('Перевірки')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const passedChecks = Number(row.healthCheckState === 'pass') + Number(row.warmupCheckState === 'pass')

              return (
                <tr key={row.serviceId}>
                  <th scope="row">
                    <span className="ai-fleet-matrix__service"><TableChip tone="document" value={row.serviceName} /></span>
                    <small>{row.source}</small>
                  </th>
                  <td><CheckStatePill label={t(STATE_LABEL[row.healthCheckState])} state={row.healthCheckState} /></td>
                  <td><CheckStatePill label={t(STATE_LABEL[row.warmupCheckState])} state={row.warmupCheckState} /></td>
                  <td>{formatWarmupAge(row.warmupAgeHours, t)}</td>
                  <td>
                    <TableChip tone={stateTone(rowState(row))} value={`${passedChecks}/2`} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </article>
  )
}

function CheckStatePill({ label, state }: { label: string; state: AiFleetEffectiveState }) {
  return <TableChip value={label} tone={stateTone(state)} />
}

function RankedActions({ actions }: { actions: AiFleetAnalytics['nextActions'] }) {
  const { t } = useI18n()

  const groups = new Map<string, {
    message: string
    severity: 'danger' | 'warning'
    services: Map<string, string>
  }>()
  for (const action of actions) {
    const key = `${action.severity}:${action.message}`
    let group = groups.get(key)
    if (!group) {
      group = { message: action.message, severity: action.severity, services: new Map() }
      groups.set(key, group)
    }
    group.services.set(action.serviceId, action.serviceName)
  }

  return (
    <article className="ai-fleet-dashboard__card ai-fleet-dashboard__actions-card">
      <div className="ai-fleet-dashboard__card-heading">
        <div>
          <Text className="app-section-title ai-fleet-dashboard__card-title" fw={600}>{t('Потребує уваги')}</Text>
        </div>
        {actions.length > 0 ? <TableChip value={actions.length} /> : null}
      </div>

      {actions.length === 0 ? (
        <div className="ai-fleet-dashboard__actions-empty">
          <CheckCircle2 aria-hidden="true" size={20} />
          <Text size="sm">{t('Дій для перевірки немає')}</Text>
        </div>
      ) : (
        <ol className="ai-fleet-dashboard__actions-list">
          {[...groups.entries()].map(([key, group]) => (
            <li key={key}>
              <TableChip value={t(group.severity === 'danger' ? 'Помилка' : 'Увага')} tone={group.severity === 'danger' ? 'danger' : 'warning'} />
              <div>
                <Text size="xs">{t(group.message)}</Text>
                <div className="ai-fleet-dashboard__affected-services">
                  {[...group.services.entries()].map(([id, name]) => (
                    <TableChip key={id} tone="document" value={name} />
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </article>
  )
}

function compareReadinessRows(left: AiFleetReadinessRow, right: AiFleetReadinessRow): number {
  const severityDifference = rowSeverity(right) - rowSeverity(left)

  if (severityDifference !== 0) {
    return severityDifference
  }

  const ageDifference = (right.warmupAgeHours ?? -1) - (left.warmupAgeHours ?? -1)

  return ageDifference !== 0
    ? ageDifference
    : left.serviceName.localeCompare(right.serviceName, 'uk')
}

function rowSeverity(row: AiFleetReadinessRow): number {
  return Math.max(
    STATE_SORT_WEIGHT[row.healthCheckState],
    STATE_SORT_WEIGHT[row.warmupCheckState],
  )
}

function rowState(row: AiFleetReadinessRow): AiFleetEffectiveState {
  return STATE_SORT_WEIGHT[row.healthCheckState] >= STATE_SORT_WEIGHT[row.warmupCheckState]
    ? row.healthCheckState
    : row.warmupCheckState
}

function stateTone(state: AiFleetEffectiveState): TableChipTone {
  return { pass: 'success', warning: 'warning', fail: 'danger', unknown: 'neutral' }[state] as TableChipTone
}

function buildSummaryText(
  failedChecks: number,
  warningChecks: number,
  unknownChecks: number,
  t: (key: string) => string,
): string {
  if (failedChecks > 0) {
    return `${failedChecks} ${t('перевірок з помилкою')}`
  }

  if (warningChecks > 0) {
    return `${warningChecks} ${t('застарілих ранкових оновлень')}`
  }

  if (unknownChecks > 0) {
    return `${unknownChecks} ${t('перевірок без даних')}`
  }

  return t('Усі перевірки пройдено')
}

function formatWarmupAge(value: number | null, t: (key: string) => string): string {
  return value === null
    ? t('Немає часу')
    : `${compactNumberFormatter.format(value)} ${t('год')}`
}
