import { BarChart, DonutChart, Sparkline } from '@mantine/charts'
import {
  Alert,
  Badge,
  Card,
  Divider,
  Group,
  Loader,
  Progress,
  RingProgress,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { CircleAlert, Info } from 'lucide-react'
import { useEffect, useReducer } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { getClientSolvencyCharts, getClientSolvencyScore } from '../../api/clientSolvencyApi'
import type {
  Contribution,
  ForwardRisk,
  ForwardRiskBand,
  SolvencyCharts,
  SolvencyRating,
  SolvencyScore,
  SubFactor,
  SubFactors,
} from '../../solvencyTypes'

type SolvencyPanelProps = {
  clientNetId?: string
}

type SolvencyState = {
  charts: SolvencyCharts | null
  chartsError: string | null
  error: string | null
  isLoading: boolean
  score: SolvencyScore | null
}

type SolvencyAction =
  | { type: 'failed'; error: string }
  | { type: 'loaded'; charts: SolvencyCharts | null; chartsError: string | null; score: SolvencyScore }
  | { type: 'loading' }

const initialSolvencyState: SolvencyState = {
  charts: null,
  chartsError: null,
  error: null,
  isLoading: true,
  score: null,
}

function solvencyReducer(state: SolvencyState, action: SolvencyAction): SolvencyState {
  switch (action.type) {
    case 'failed':
      return { ...state, charts: null, chartsError: null, error: action.error, isLoading: false, score: null }
    case 'loaded':
      return {
        ...state,
        charts: action.charts,
        chartsError: action.chartsError,
        error: null,
        isLoading: false,
        score: action.score,
      }
    case 'loading':
      return { ...state, chartsError: null, error: null, isLoading: true }
  }
}

const RATING_COLOR: Record<SolvencyRating, string> = {
  A: 'green',
  B: 'teal',
  C: 'yellow',
  D: 'red',
}

const SUB_FACTOR_ORDER: { key: keyof SubFactors; label: string }[] = [
  { key: 'discipline', label: 'Платіжна дисципліна' },
  { key: 'debt_load', label: 'Боргове навантаження' },
  { key: 'activity', label: 'Активність' },
  { key: 'tenure', label: 'Тривалість співпраці' },
  { key: 'return_quality', label: 'Якість повернень' },
]

const GAUGE_ZONE_COLOR: Record<string, string> = {
  amber: 'yellow',
  green: 'green',
  over: 'orange',
  red: 'red',
}

export function SolvencyPanel({ clientNetId }: SolvencyPanelProps) {
  const { t } = useI18n()
  const [state, dispatch] = useReducer(solvencyReducer, initialSolvencyState)
  const { charts, chartsError, error, isLoading, score } = state

  const netId = clientNetId || ''

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function loadSolvency() {
      if (!netId) {
        return
      }

      dispatch({ type: 'loading' })

      try {
        const loadedScore = await getClientSolvencyScore(netId, controller.signal)

        let loadedCharts: SolvencyCharts | null = null
        let loadedChartsError: string | null = null

        if (loadedScore.applicable !== false && loadedScore.score != null) {
          try {
            loadedCharts = await getClientSolvencyCharts(loadedScore.client_id, controller.signal)
          } catch (chartsLoadError) {
            if (controller.signal.aborted) {
              return
            }
            loadedCharts = null
            loadedChartsError =
              chartsLoadError instanceof Error ? chartsLoadError.message : t('Графіки платоспроможності недоступні')
          }
        }

        if (!cancelled) {
          dispatch({ charts: loadedCharts, chartsError: loadedChartsError, score: loadedScore, type: 'loaded' })
        }
      } catch (loadError) {
        if (!cancelled && controller.signal.aborted) {
          return
        }

        if (!cancelled) {
          dispatch({
            error: loadError instanceof Error ? loadError.message : t('Дані недоступні'),
            type: 'failed',
          })
        }
      }
    }

    void loadSolvency()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [netId, t])

  if (!netId) {
    return (
      <Text c="dimmed" size="sm">
        {t('Дані недоступні')}
      </Text>
    )
  }

  if (isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader color="orange" size="sm" />
        <Text c="dimmed" size="sm">
          {t('Завантаження оцінки')}
        </Text>
      </Group>
    )
  }

  if (error || !score) {
    return (
      <Alert color="orange" icon={<CircleAlert size={18} />} title={t('Оцінка платоспроможності недоступна')} variant="light">
        {error || t('Дані недоступні')}
      </Alert>
    )
  }

  if (score.applicable === false || score.score == null) {
    return (
      <Alert color="gray" icon={<Info size={18} />} variant="light">
        {t('не покупець — оцінка платоспроможності незастосовна')}
      </Alert>
    )
  }

  return (
    <Stack gap="lg">
      <Card className="app-section-card" padding="lg" radius="md" withBorder>
        <Stack gap="lg">
          <ScoreHeader score={score} />
          {score.forward_risk && (
            <Group gap="xs">
              <Text c="dimmed" fw={600} size="sm">
                {t('Прогноз ризику (6 міс.)')}:
              </Text>
              <ForwardRiskBadge forwardRisk={score.forward_risk} />
            </Group>
          )}
          <Divider />
          {score.sub_factors ? (
            <SubFactorBars subFactors={score.sub_factors} />
          ) : (
            score.contributions &&
            score.contributions.length > 0 && (
              <ContributionsList contributions={score.contributions} />
            )
          )}
          <ScoreNotes score={score} />
        </Stack>
      </Card>
      {chartsError && (
        <Alert color="orange" icon={<CircleAlert size={18} />} variant="light">
          {chartsError}
        </Alert>
      )}
      {charts && <SolvencyChartsView charts={charts} />}
    </Stack>
  )
}

const FORWARD_RISK_COLOR: Record<ForwardRiskBand, string> = {
  high: 'orange',
  low: 'green',
  medium: 'yellow',
  very_high: 'red',
}

const FORWARD_RISK_LABEL: Record<ForwardRiskBand, string> = {
  high: 'високий',
  low: 'низький',
  medium: 'середній',
  very_high: 'дуже високий',
}

function ForwardRiskBadge({ forwardRisk }: { forwardRisk: ForwardRisk }) {
  const { t } = useI18n()
  const color = FORWARD_RISK_COLOR[forwardRisk.band] ?? 'gray'
  const label = FORWARD_RISK_LABEL[forwardRisk.band] ?? forwardRisk.band

  return (
    <Badge color={color} size="lg" variant="filled">
      {t(label)} · PD {formatPercent1(forwardRisk.pd)}
    </Badge>
  )
}

const CONTRIBUTION_LABELS: Record<string, string> = {
  credit_limit_eur: 'Кредитний ліміт',
  current_debt_eur: 'Поточний борг',
  debt_growth_3mo: 'Зростання боргу (3 міс.)',
  grace_days: 'Пільгові дні',
  has_credit_control: 'Кредитний контроль',
  limit_utilization: 'Використання ліміту',
  max_overdue_days: 'Макс. прострочення (днів)',
  months_with_debt_last12: 'Місяців з боргом (12 міс.)',
  n_open_debt_lines: 'Відкритих боргових позицій',
  new_debt_eur_3mo: 'Новий борг (3 міс.)',
  order_count_12mo: 'Кількість замовлень (12 міс.)',
  overdue_eur_1_30: 'Прострочено 1-30 днів',
  overdue_eur_31_60: 'Прострочено 31-60 днів',
  overdue_eur_61_90: 'Прострочено 61-90 днів',
  overdue_eur_91_180: 'Прострочено 91-180 днів',
  overdue_eur_180plus: 'Прострочено 180+ днів',
  pct_debt_180plus: 'Частка боргу 180+ днів',
  recency_days: 'Днів від останньої покупки',
  return_rate_12mo: 'Частка повернень (12 міс.)',
  tenure_months: 'Тривалість співпраці (міс.)',
  total_debt_eur: 'Загальний борг',
  turnover_eur_12mo: 'Оборот (12 міс.)',
}

function ContributionsList({ contributions }: { contributions: Contribution[] }) {
  const { t } = useI18n()

  const top = [...contributions]
    .filter((item) => Number.isFinite(item.points) && item.points !== 0)
    .sort((left, right) => Math.abs(right.points) - Math.abs(left.points))
    .slice(0, 6)

  if (top.length === 0) {
    return null
  }

  return (
    <Stack gap="sm">
      <Text fw={600} size="sm">
        {t('Чинники оцінки')}
      </Text>
      {top.map((item) => {
        const label = CONTRIBUTION_LABELS[item.feature] ?? item.feature
        const raisesRisk = item.points > 0
        return (
          <Group gap="xs" justify="space-between" key={item.feature} wrap="nowrap">
            <Text size="sm">{t(label)}</Text>
            <Badge color={raisesRisk ? 'red' : 'green'} size="sm" variant="light">
              {raisesRisk ? '+' : ''}
              {formatNumber(item.points)}
            </Badge>
          </Group>
        )
      })}
    </Stack>
  )
}

function ScoreHeader({ score }: { score: SolvencyScore }) {
  const { t } = useI18n()

  const ratingColor = score.rating ? RATING_COLOR[score.rating] : 'gray'
  const scoreValue = score.score ?? 0

  return (
    <Group align="center" gap="lg" wrap="wrap">
      <RingProgress
        label={
          <Stack align="center" gap={0}>
            <Text fw={700} size="xl">
              {scoreValue}
            </Text>
            <Text c="dimmed" size="xs">
              {t('зі 100')}
            </Text>
          </Stack>
        }
        roundCaps
        sections={[{ color: ratingColor, value: clampPercent(scoreValue) }]}
        size={120}
        thickness={12}
      />
      <Stack gap={4}>
        <Group gap="xs">
          <Title order={4} size="h4">
            {t('Платоспроможність')}
          </Title>
          <Badge color={ratingColor} size="lg" variant="filled">
            {score.rating}
          </Badge>
        </Group>
        {score.raw_score != null && (
          <Text c="dimmed" size="sm">
            {t('Базова оцінка')}: {formatNumber(score.raw_score)}
          </Text>
        )}
        {score.pd != null && (
          <Text c="dimmed" fw={600} size="sm">
            PD {formatPercent1(score.pd)}
          </Text>
        )}
        <Text c="dimmed" size="xs">
          {t('Версія моделі')}: {score.model_version}
        </Text>
      </Stack>
    </Group>
  )
}

function SubFactorBars({ subFactors }: { subFactors: SubFactors }) {
  const { t } = useI18n()

  return (
    <Stack gap="sm">
      <Text fw={600} size="sm">
        {t('Складові оцінки')}
      </Text>
      {SUB_FACTOR_ORDER.map(({ key, label }) => (
        <SubFactorRow factor={subFactors[key]} key={key} label={t(label)} />
      ))}
    </Stack>
  )
}

function SubFactorRow({ factor, label }: { factor: SubFactor; label: string }) {
  const { t } = useI18n()

  return (
    <Stack gap={2}>
      <Group justify="space-between" gap="xs">
        <Text size="sm">{label}</Text>
        <Text c="dimmed" size="xs">
          {formatNumber(factor.points)} {t('балів')} · {formatPercent(factor.weight)}
        </Text>
      </Group>
      <Progress color="orange" radius="xl" size="sm" value={clampPercent(factor.value * 100)} />
    </Stack>
  )
}

function ScoreNotes({ score }: { score: SolvencyScore }) {
  const { t } = useI18n()

  return (
    <Group gap="xs" wrap="wrap">
      {score.debt_load_source && (
        <Badge color="gray" size="sm" variant="light">
          {t('Джерело боргу')}: {translateDebtSource(t, score.debt_load_source)}
        </Badge>
      )}
      {score.window_months > 0 && (
        <Badge color="gray" size="sm" variant="light">
          {t('Вікно')}: {score.window_months} {t('міс.')}
        </Badge>
      )}
      {score.caps_applied.map((cap) => (
        <Badge color="orange" key={cap} size="sm" variant="light">
          {cap}
        </Badge>
      ))}
    </Group>
  )
}

function SolvencyChartsView({ charts }: { charts: SolvencyCharts }) {
  const { t } = useI18n()

  const gauge = charts.limit_utilization_gauge
  const utilizationPercent = Number.isFinite(gauge.value) ? clampPercent(gauge.value * 100) : 0
  const gaugeZone = utilizationZone(gauge.value, gauge.threshold_soft, gauge.threshold_hard)

  const donutData = charts.payment_discipline_donut.reduce<Array<{ color: string; name: string; value: number }>>(
    (items, slice, index) => {
      if (slice.count > 0) {
        items.push({
          color: DONUT_COLORS[index % DONUT_COLORS.length],
          name: t(slice.label),
          value: slice.count,
        })
      }

      return items
    },
    [],
  )

  const agingData = charts.open_invoice_aging_bars.map((bar) => ({
    бакет: bar.bucket,
    кількість: bar.count,
  }))

  const sparklineData = charts.score_sparkline.map((point) => point.score)

  const turnoverData = charts.turnover_trend.map((point) => ({
    дохід: round2(point.turnover_eur),
    період: point.period,
  }))

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <Card className="app-section-card" padding="md" radius="md" withBorder>
          <Stack align="center" gap="xs">
            <Text fw={600} size="sm">
              {t('Використання ліміту')}
            </Text>
            <RingProgress
              label={
                <Text fw={700} ta="center">
                  {utilizationPercent.toFixed(0)}%
                </Text>
              }
              roundCaps
              sections={[{ color: GAUGE_ZONE_COLOR[gaugeZone], value: utilizationPercent }]}
              size={140}
              thickness={14}
            />
            <Text c="dimmed" size="xs">
              {t('Поріг')}: {formatPercent(gauge.threshold_soft)} / {formatPercent(gauge.threshold_hard)}
            </Text>
          </Stack>
        </Card>

        <Card className="app-section-card" padding="md" radius="md" withBorder>
          <Stack align="center" gap="xs">
            <Text fw={600} size="sm">
              {t('Платіжна дисципліна')}
            </Text>
            {donutData.length > 0 ? (
              <DonutChart data={donutData} size={140} thickness={20} withTooltip />
            ) : (
              <Text c="dimmed" py="md" size="sm">
                {t('Дані відсутні')}
              </Text>
            )}
          </Stack>
        </Card>
      </SimpleGrid>

      <Card className="app-section-card" padding="md" radius="md" withBorder>
        <Stack gap="xs">
          <Text fw={600} size="sm">
            {t('Прострочені рахунки')}
          </Text>
          {agingData.length > 0 ? (
            <BarChart
              data={agingData}
              dataKey="бакет"
              h={200}
              series={[{ color: 'orange.6', name: 'кількість' }]}
            />
          ) : (
            <Text c="dimmed" size="sm">
              {t('Дані відсутні')}
            </Text>
          )}
        </Stack>
      </Card>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <Card className="app-section-card" padding="md" radius="md" withBorder>
          <Stack gap="xs">
            <Text fw={600} size="sm">
              {t('Динаміка оцінки')}
            </Text>
            {sparklineData.length > 0 ? (
              <Sparkline color="orange.6" curveType="linear" data={sparklineData} fillOpacity={0.2} h={80} w="100%" />
            ) : (
              <Text c="dimmed" size="sm">
                {t('Дані відсутні')}
              </Text>
            )}
          </Stack>
        </Card>

        <Card className="app-section-card" padding="md" radius="md" withBorder>
          <Stack gap="xs">
            <Text fw={600} size="sm">
              {t('Оборот, EUR')}
            </Text>
            {turnoverData.length > 0 ? (
              <BarChart
                data={turnoverData}
                dataKey="період"
                h={120}
                series={[{ color: 'teal.6', name: 'дохід' }]}
              />
            ) : (
              <Text c="dimmed" size="sm">
                {t('Дані відсутні')}
              </Text>
            )}
          </Stack>
        </Card>
      </SimpleGrid>
    </Stack>
  )
}

const DONUT_COLORS = ['green.6', 'teal.6', 'yellow.6', 'orange.6', 'red.6', 'gray.6']

function translateDebtSource(t: (value: string) => string, source: string): string {
  if (source === 'debt_table') {
    return t('таблиця боргу')
  }

  if (source === 'live_proxy') {
    return t('розрахунок')
  }

  return source
}

function utilizationZone(value: number, soft: number, hard: number): string {
  if (!Number.isFinite(value)) {
    return 'green'
  }

  if (value > hard) {
    return 'over'
  }

  if (value >= hard) {
    return 'red'
  }

  if (value >= soft) {
    return 'amber'
  }

  return 'green'
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.min(100, Math.max(0, value))
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) {
    return '-'
  }

  return `${(value * 100).toFixed(0)}%`
}

function formatPercent1(value: number): string {
  if (!Number.isFinite(value)) {
    return '-'
  }

  return `${(value * 100).toFixed(1)}%`
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '-'
  }

  return value.toFixed(1)
}

function round2(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.round(value * 100) / 100
}
