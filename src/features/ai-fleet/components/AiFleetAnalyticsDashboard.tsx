import { AreaChart } from '@mantine/charts'
import { Badge, Group, Loader, Stack, Text } from '@mantine/core'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Clock3,
  Gauge,
  XCircle,
} from 'lucide-react'
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
import { Orb } from '../../../shared/ui/orb/Orb'

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

const STATE_ICON_PROPS = {
  'aria-hidden': true,
  size: 13,
  strokeWidth: 2.2,
} as const

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
        <Group gap="xs" wrap="nowrap">
          <Gauge aria-hidden="true" size={19} />
          <div>
            <Text fw={700} id="ai-fleet-analytics-title" size="sm">
              {t('Операційна аналітика AI')}
            </Text>
            <Text c="dimmed" size="xs">
              {t('Snapshot стану флоту та live-спостереження цієї вкладки')}
            </Text>
          </div>
        </Group>
        {isLoading ? (
          <Badge color="gray" leftSection={<Loader size={11} />} variant="light">
            {t('Оновлюємо')}
          </Badge>
        ) : (
          <Badge color={stateColor(summaryState)} variant="light">
            {analytics.passedCheckCount}/{analytics.totalCheckCount} {t('перевірок пройдено')}
          </Badge>
        )}
      </header>

      <div className="ai-fleet-dashboard__overview">
        <article className={`ai-fleet-dashboard__score-card is-${summaryState}`}>
          <Text className="ai-fleet-dashboard__eyebrow">{t('Флот зараз')}</Text>
          <div
            aria-label={`${t('Пройдено перевірок')}: ${analytics.passedCheckCount} ${t('з')} ${analytics.totalCheckCount}`}
            className="ai-fleet-dashboard__score"
          >
            <strong>{analytics.passedCheckCount}</strong>
            <span>/{analytics.totalCheckCount}</span>
          </div>
          <Text className="ai-fleet-dashboard__score-label" size="xs">
            {t('контрольних API та 05:00 перевірок')}
          </Text>
          <Text className="ai-fleet-dashboard__insight" size="sm">
            {summaryText}
          </Text>
        </article>

        <article className="ai-fleet-dashboard__card ai-fleet-dashboard__distribution-card">
          <div className="ai-fleet-dashboard__card-heading">
            <div>
              <Text className="ai-fleet-dashboard__card-title">{t('Склад перевірок')}</Text>
              <Text c="dimmed" size="xs">{t('Кількість станів без усереднення у відсоток')}</Text>
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
              <Text className="ai-fleet-dashboard__card-title">{t('Пороги операції')}</Text>
              <Text c="dimmed" size="xs">{t('Факт проти контрольного ліміту')}</Text>
            </div>
            <Clock3 aria-hidden="true" size={17} />
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
          <Text className="ai-fleet-dashboard__sla-note" c="dimmed" size="xs">
            {t('Вертикальна риска — контрольний ліміт. Значення праворуч від неї потребує уваги.')}
          </Text>
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
        <b>{total} {t('сервісів')}</b>
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
          <Text className="ai-fleet-dashboard__card-title">
            {t('Динаміка перевірок')} · {totalChecks}
          </Text>
          <Text c="dimmed" size="xs">{t('Спостереження лише в цій вкладці — не uptime і не SLA')}</Text>
        </div>
        <Badge color="gray" variant="light">
          {observedPointCount} {t('знімків')}
        </Badge>
      </div>

      {observedPointCount < 2 ? (
        <div aria-live="polite" className="ai-fleet-dashboard__collecting">
          {isLoading && observedPointCount === 0 ? <Orb size={24} variant="thinking" /> : <Activity aria-hidden="true" size={23} />}
          <Text fw={650} size="sm">{t('Збираємо live-історію')}</Text>
          <Text c="dimmed" size="xs">
            {observedPointCount}/2 {t('знімків. Графік зʼявиться після наступного успішного оновлення.')}
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
            fillOpacity={0.14}
            gridAxis="y"
            h={230}
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

      <figcaption className="ai-fleet-dashboard__figure-caption">
        {observedPointCount >= 2 && firstTime && lastTime
          ? `${observedPointCount} ${t('знімків')}: ${firstTime}–${lastTime}. ${accessibleSummary}`
          : t('Потрібні щонайменше два успішні live-знімки.')}
      </figcaption>
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
          <Text className="ai-fleet-dashboard__card-title">{t('Матриця сервісів')}</Text>
          <Text c="dimmed" size="xs">{t('Критичні та застарілі стани показані першими')}</Text>
        </div>
      </div>
      <div
        aria-label={t('Прокручувана матриця станів AI-сервісів')}
        className="ai-fleet-matrix-scroll"
        role="region"
        tabIndex={0}
      >
        <table className="ai-fleet-matrix">
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
                    <span className="ai-fleet-matrix__service">{row.serviceName}</span>
                    <small>{row.source}</small>
                  </th>
                  <td><CheckStatePill label={t(STATE_LABEL[row.healthCheckState])} state={row.healthCheckState} /></td>
                  <td><CheckStatePill label={t(STATE_LABEL[row.warmupCheckState])} state={row.warmupCheckState} /></td>
                  <td>{formatWarmupAge(row.warmupAgeHours, t)}</td>
                  <td>
                    <b className={`ai-fleet-matrix__checks is-${rowState(row)}`}>
                      {passedChecks}/2
                    </b>
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
  return (
    <span className={`ai-fleet-check-state is-${state}`}>
      <StateIcon state={state} />
      {label}
    </span>
  )
}

function StateIcon({ state }: { state: AiFleetEffectiveState }) {
  if (state === 'pass') {
    return <CheckCircle2 {...STATE_ICON_PROPS} />
  }

  if (state === 'warning') {
    return <AlertTriangle {...STATE_ICON_PROPS} />
  }

  if (state === 'fail') {
    return <XCircle {...STATE_ICON_PROPS} />
  }

  return <CircleHelp {...STATE_ICON_PROPS} />
}

function RankedActions({ actions }: { actions: AiFleetAnalytics['nextActions'] }) {
  const { t } = useI18n()

  return (
    <article className="ai-fleet-dashboard__card ai-fleet-dashboard__actions-card">
      <div className="ai-fleet-dashboard__card-heading">
        <div>
          <Text className="ai-fleet-dashboard__card-title">{t('Що перевірити далі')}</Text>
          <Text c="dimmed" size="xs">{t('Пріоритет: падіння, потім застарілі або неповні дані')}</Text>
        </div>
        {actions.length > 0 ? <Badge color="orange" variant="light">{actions.length}</Badge> : null}
      </div>

      {actions.length === 0 ? (
        <div className="ai-fleet-dashboard__actions-empty">
          <CheckCircle2 aria-hidden="true" size={20} />
          <Text size="sm">{t('Дій для перевірки немає')}</Text>
        </div>
      ) : (
        <ol className="ai-fleet-dashboard__actions-list">
          {actions.map((action, index) => (
            <li className={`is-${action.severity}`} key={`${action.serviceId}-${action.message}`}>
              <span className="ai-fleet-dashboard__action-rank" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div>
                <Text fw={650} size="xs">{action.serviceName}</Text>
                <Text size="xs">{t(action.message)}</Text>
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

function stateColor(state: AiFleetEffectiveState): string {
  if (state === 'pass') {
    return 'teal'
  }

  if (state === 'warning') {
    return 'orange'
  }

  if (state === 'fail') {
    return 'red'
  }

  return 'gray'
}

function buildSummaryText(
  failedChecks: number,
  warningChecks: number,
  unknownChecks: number,
  t: (key: string) => string,
): string {
  if (failedChecks > 0) {
    return `${failedChecks} ${t('перевірок не проходять. Почніть із критичних дій нижче.')}`
  }

  if (warningChecks > 0) {
    return `${warningChecks} ${t('warmup-статусів застаріли, хоча API можуть бути доступними.')}`
  }

  if (unknownChecks > 0) {
    return `${unknownChecks} ${t('перевірок не мають повної телеметрії.')}`
  }

  return t('Усі отримані API та 05:00 перевірки проходять.')
}

function formatWarmupAge(value: number | null, t: (key: string) => string): string {
  return value === null
    ? t('Немає часу')
    : `${compactNumberFormatter.format(value)} ${t('год')}`
}
