import { BarChart, DonutChart } from '@mantine/charts'
import { MONEY_AXIS_TICK } from '../../../../shared/ui/charts/chartTheme'
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
  Tooltip,
} from '@mantine/core'
import { CircleAlert, Info } from 'lucide-react'
import { Fragment, useEffect, useReducer } from 'react'
import { AiFeatureBadge } from '../../../../shared/ai/AiFeatureBadge'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { getClientSolvencyCharts, getClientSolvencyScore } from '../../api/clientSolvencyApi'
import './solvency-panel.css'
import type {
  Contribution,
  GaugeChart,
  Risk90d,
  Risk90dBand,
  SolvencyCharts,
  SolvencyRating,
  SolvencyScore,
  SubFactor,
  SubFactors,
  UnconvertedDebt,
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

const nativeAmountFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
const countFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 })
const eurFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

const utilizationFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 1,
})

const GAUGE_OVER_LIMIT_TEXT_COLOR = 'orange.7'

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

        if (
          loadedScore.applicable !== false
          && loadedScore.score != null
          && loadedScore.data_sufficiency !== 'insufficient'
        ) {
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
    return <Group role="status" gap="xs" py="md"><Loader size="sm" color="orange" /><Text size="sm" c="dimmed">{t('Завантаження оцінки')}</Text></Group>
  }

  if (error || !score) {
    return (
      <Alert color="orange" icon={<CircleAlert size={18} />} title={t('Оцінка платоспроможності недоступна')} variant="light">
        {error || t('Дані недоступні')}
      </Alert>
    )
  }

  if (score.applicable === false) {
    return (
      <Alert color="gray" icon={<Info size={18} />} variant="light">
        {t('не покупець — оцінка платоспроможності незастосовна')}
      </Alert>
    )
  }

  if (score.data_sufficiency === 'insufficient') {
    return (
      <Alert color="gray" icon={<Info size={18} />} variant="light">
        {t('Недостатньо даних для оцінки — у доступних даних від')}{' '}
        {formatIsoDate(score.source_history_start)}{' '}
        {t('немає продажів, боргу або ненульових кредитних умов')}
      </Alert>
    )
  }

  if (score.score == null) {
    return (
      <Alert color="orange" icon={<CircleAlert size={18} />} variant="light">
        {t('Оцінка платоспроможності недоступна')}
      </Alert>
    )
  }

  return (
    <Stack className="client-solvency" gap="sm">
      <Card className="app-section-card" padding="lg" radius="md" withBorder>
        <Stack gap="sm">
          <ScoreHeader score={score} />
          {score.policy_reason && (
            <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
              {score.policy_reason}
            </Alert>
          )}
          <Group className="client-solvency-risk" align="center" gap="xs" wrap="wrap">
            <Text c="dimmed" fw={600} size="sm">
              {t('Контроль боргу на 90 днів')}:
            </Text>
            {score.risk_90d ? (
              <Risk90dSummary risk={score.risk_90d} />
            ) : (
              <Text c="dimmed" size="sm">
                {t('контроль ще не розрахований')}
              </Text>
            )}
          </Group>
          <UnconvertedDebtAlert rows={score.unconverted_debt?.length ? score.unconverted_debt : charts?.unconverted_debt} />
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

const RISK_90D_COLOR: Record<Risk90dBand, string> = {
  critical: 'red',
  high: 'orange',
  low: 'green',
  medium: 'yellow',
}

const RISK_90D_LABEL: Record<Risk90dBand, string> = {
  critical: 'критичний',
  high: 'високий',
  low: 'низький',
  medium: 'під наглядом',
}

const RISK_90D_REASON: Record<Risk90d['reason_code'], string> = {
  already_90_plus: 'Борг уже прострочений понад 90 днів',
  current_debt: 'Є відкритий борг',
  no_debt: 'Відкритого боргу немає',
  will_cross_90_days: 'Якщо не сплатити, борг перейде 90 днів прострочення',
}

const TOTAL_DEBT_HINT =
  'Загальний борг: усі відкриті борги клієнта за всіма договорами, зокрема ще не прострочені й давні. EUR з ПДВ за курсом на сьогодні.'

const RISK_90D_AMOUNT_LABEL: Record<Risk90d['reason_code'], string> = {
  already_90_plus: 'прострочено понад 90 днів',
  current_debt: 'загальний борг',
  no_debt: 'загальний борг',
  will_cross_90_days: 'прострочено від 1 до 90 днів',
}

const RISK_90D_AMOUNT_HINT: Record<Risk90d['reason_code'], string> = {
  already_90_plus:
    'Лише частина боргу, прострочена понад 90 днів після договірного терміну оплати. Усі договори клієнта, EUR з ПДВ за курсом на сьогодні.',
  current_debt: TOTAL_DEBT_HINT,
  no_debt: TOTAL_DEBT_HINT,
  will_cross_90_days:
    'Лише частина боргу, прострочена від 1 до 90 днів після договірного терміну оплати. Усі договори клієнта, EUR з ПДВ за курсом на сьогодні.',
}

const PAYMENT_DISCIPLINE_LABEL: Record<string, string> = {
  current: 'борги в межах терміну, документів',
  overdue: 'прострочені борги, документів',
  settled: 'продажі без відкритого боргу за 12 міс., документів',
}

type Risk90dAmount = { hint: string; key: string; label: string; value: number }

function risk90dAmounts(risk: Risk90d): Risk90dAmount[] | null {
  const total = risk.total_debt_eur
  const within = risk.overdue_1_90_eur
  const beyond = risk.overdue_91_plus_eur
  if (typeof total !== 'number' || typeof within !== 'number' || typeof beyond !== 'number') {
    return null
  }

  const parts: Risk90dAmount[] = []
  if (total > 0) {
    parts.push({ hint: TOTAL_DEBT_HINT, key: 'total', label: 'загальний борг', value: total })
  }
  if (within > 0) {
    parts.push({ hint: RISK_90D_AMOUNT_HINT.will_cross_90_days, key: 'within', label: 'прострочено 1–90 днів', value: within })
  }
  if (beyond > 0) {
    parts.push({
      hint: RISK_90D_AMOUNT_HINT.already_90_plus,
      key: 'beyond',
      label: within > 0 ? 'понад 90 днів' : 'прострочено понад 90 днів',
      value: beyond,
    })
  }

  return parts
}

function UnconvertedDebtAlert({ rows }: { rows: UnconvertedDebt[] | null | undefined }) {
  const { t } = useI18n()
  if (!rows || rows.length === 0) {
    return null
  }

  return (
    <Alert className="client-solvency-unconverted" color="yellow" icon={<CircleAlert size={18} />} variant="light">
      {t('Борг без курсу до EUR не входить до жодної суми в EUR')}:{' '}
      {rows
        .map((row) => `${nativeAmountFormatter.format(row.amount)} ${row.currency ?? t('валюта невідома')} (${row.lines} ${t('док.')})`)
        .join(' · ')}
    </Alert>
  )
}

function outsideWindowCaption(lines: number, months: number): string {
  const lastTwo = lines % 100
  const last = lines % 10
  const noun = lastTwo >= 11 && lastTwo <= 14
    ? 'документів'
    : last === 1 ? 'документ' : last >= 2 && last <= 4 ? 'документи' : 'документів'

  return `ще ${countFormatter.format(lines)} ${noun} боргу за продажами, старшими за ${months} міс.`
}

function Risk90dSummary({ risk }: { risk: Risk90d }) {
  const { t } = useI18n()
  const color = RISK_90D_COLOR[risk.band] ?? 'gray'
  const label = RISK_90D_LABEL[risk.band] ?? risk.band
  const reason = RISK_90D_REASON[risk.reason_code] ?? risk.reason_code
  const amounts = risk90dAmounts(risk)

  return (
    <Group gap="xs" wrap="wrap">
      <Badge color={color} size="md" variant="light">
        {t(label)}
      </Badge>
      <Text size="sm">
        {t(reason)}
        {amounts
          ? amounts.map((part) => (
              <Fragment key={part.key}>
                {' · '}
                <Tooltip label={t(part.hint)} multiline w={320} withArrow>
                  <span className="client-solvency-risk-amount">
                    {t(part.label)}{' '}
                    <span className="app-money">{formatEur(part.value)}</span>
                  </span>
                </Tooltip>
              </Fragment>
            ))
          : risk.exposure_eur > 0 && (
              <>
                {' · '}
                <Tooltip label={t(RISK_90D_AMOUNT_HINT[risk.reason_code] ?? TOTAL_DEBT_HINT)} multiline w={320} withArrow>
                  <span className="client-solvency-risk-amount">
                    {t(RISK_90D_AMOUNT_LABEL[risk.reason_code] ?? RISK_90D_AMOUNT_LABEL.current_debt)}:{' '}
                    <span className="app-money">{formatEur(risk.exposure_eur)}</span>
                  </span>
                </Tooltip>
              </>
            )}
      </Text>
    </Group>
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
      <Text className="client-section-title" fw={600} size="sm">
        {t('Чинники оцінки')}
      </Text>
      <div className="client-solvency-factors">
        {top.map((item) => {
          const label = CONTRIBUTION_LABELS[item.feature] ?? item.feature
          const raisesRisk = item.points > 0
          return (
            <Group gap="xs" className="client-solvency-factor" justify="space-between" key={item.feature} wrap="nowrap">
              <Text size="sm">{t(label)}</Text>
              <Badge color={raisesRisk ? 'red' : 'green'} size="sm" variant="light">
                {raisesRisk ? '+' : ''}
                {formatNumber(item.points)}
              </Badge>
            </Group>
          )
        })}
      </div>
    </Stack>
  )
}

function ScoreHeader({ score }: { score: SolvencyScore }) {
  const { t } = useI18n()

  const ratingColor = score.rating ? RATING_COLOR[score.rating] : 'gray'
  const scoreValue = score.score ?? 0

  return (
    <Group align="center" gap="sm" wrap="wrap">
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
        size={88}
        thickness={8}
      />
      <Stack gap={4}>
        <Group gap="xs">
          <Text className="client-section-title" fw={600}>
            {t('Платоспроможність')}
          </Text>
          <AiFeatureBadge tooltip={t('AI-модель платоспроможності')} />
          <Badge color={ratingColor} size="md" variant="light">
            {score.rating}
          </Badge>
        </Group>
        {score.raw_score != null && (
          <Text c="dimmed" size="sm">
            {t('Базова оцінка')}: {formatNumber(score.raw_score)}
          </Text>
        )}
        {score.pd != null && (
          <Badge color="blue" variant="light" size="md">
            PD {formatPercent1(score.pd)}
          </Badge>
        )}
      </Stack>
    </Group>
  )
}

function SubFactorBars({ subFactors }: { subFactors: SubFactors }) {
  const { t } = useI18n()

  return (
    <Stack gap="sm">
      <Text className="client-section-title" fw={600} size="sm">
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
          {t('Вікно операцій')}: {score.window_months} {t('міс.')}
        </Badge>
      )}
      <Badge color="blue" size="sm" variant="light">
        {t('Дані з')}: {formatIsoDate(score.source_history_start)}
      </Badge>
      {!score.history_complete && (
        <Badge color="yellow" size="sm" variant="light">
          {t('Неповне вікно операцій')}
        </Badge>
      )}
      {score.caps_applied.filter((cap) => cap !== score.policy_reason_code).map((cap) => (
        <Badge color="orange" key={cap} size="sm" variant="light">
          {SOLVENCY_CAP_LABEL[cap] ?? cap}
        </Badge>
      ))}
    </Group>
  )
}

const SOLVENCY_CAP_LABEL: Record<string, string> = {
  utilization_hard_40: 'Перевищення кредитного ліміту',
  utilization_soft_60: 'Високе завантаження ліміту',
  blocked_half: 'Клієнт заблокований',
  current_sev180_pd_floor: 'Прострочка понад 180 днів',
  hopeless_debt_role: 'Група безнадійної заборгованості',
  overdue_90_plus: 'Прострочка понад 90 днів',
  overdue_30_plus: 'Прострочка понад 30 днів',
}

function formatIsoDate(value: string): string {
  const [year, month, day] = value.split('-')
  return `${day}.${month}.${year}`
}

function SolvencyChartsView({ charts }: { charts: SolvencyCharts }) {
  const { t } = useI18n()

  const gauge = charts.limit_utilization_gauge
  const gaugeState = resolveGaugeState(gauge)
  const gaugeZone = utilizationZone(gauge.value, gauge.threshold_soft, gauge.threshold_hard)
  const gaugeDebtLine = gaugeState === 'value' ? formatGaugeDebtLine(t, gauge) : null

  const donutData = charts.payment_discipline_donut.reduce<Array<{ color: string; name: string; value: number }>>(
    (items, slice, index) => {
      if (slice.count > 0) {
        items.push({
          color: DONUT_COLORS[index % DONUT_COLORS.length],
          name: t(PAYMENT_DISCIPLINE_LABEL[slice.label] ?? slice.label),
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

  const turnoverData = charts.turnover_trend.map((point) => ({
    оборот: round2(point.turnover_eur),
    період: point.period,
  }))

  return (
    <Stack gap="sm">
      <SimpleGrid className="client-solvency-charts-grid" cols={{ base: 1, md: 2 }} spacing="sm">
        <Card className="app-section-card" padding="md" radius="md" withBorder>
          <Stack gap="sm">
            <Text className="client-section-title" fw={600} size="sm">
              {t('Використання ліміту')}
            </Text>
            {gaugeState === 'value' && gauge.value != null ? (
              <>
                <Text
                  c={gaugeZone === 'over' ? GAUGE_OVER_LIMIT_TEXT_COLOR : undefined}
                  className="client-solvency-value"
                  data-gauge-zone={gaugeZone}
                  fw={700}
                  size="xl"
                >
                  {formatUtilizationPercent(gauge.value)}
                </Text>
                <Progress
                  aria-label={t('Використання ліміту')}
                  color={GAUGE_ZONE_COLOR[gaugeZone]}
                  radius="xl"
                  size={8}
                  value={clampPercent(gauge.value * 100)}
                />
                {gaugeDebtLine ? (
                  <Text className="client-solvency-gauge-debt" size="xs">
                    {gaugeDebtLine}
                  </Text>
                ) : null}
                {gaugeDebtLine ? (
                  <Text c="dimmed" size="xs">
                    {t('Суми у валюті договору, з ПДВ: борг за всіма договорами клієнта в цій валюті проти ліміту одного договору. Це не загальний борг у EUR.')}
                  </Text>
                ) : null}
                <Text c="dimmed" size="xs">
                  {t('Поріг')}: {formatPercent(gauge.threshold_soft)} / {formatPercent(gauge.threshold_hard)}
                </Text>
              </>
            ) : (
              <Text
                c="dimmed"
                className={gaugeState === 'unknown' ? 'client-solvency-value' : undefined}
                data-gauge-state={gaugeState}
                fw={gaugeState === 'unknown' ? 700 : undefined}
                py={gaugeState === 'unknown' ? undefined : 'md'}
                size={gaugeState === 'unknown' ? 'xl' : 'sm'}
              >
                {gaugeState === 'no_limit'
                  ? t('Ліміт не встановлено')
                  : gaugeState === 'not_applicable'
                    ? t('не покупець — оцінка платоспроможності незастосовна')
                    : '—'}
              </Text>
            )}
          </Stack>
        </Card>

        <Card className="app-section-card" padding="md" radius="md" withBorder>
          <Stack gap="sm">
            <Text className="client-section-title" fw={600} size="sm">
              {t('Платіжна дисципліна')}
            </Text>
            {donutData.length > 0 ? (
              <DonutChart data={donutData} size={112} thickness={14} withTooltip />
            ) : (
              <Text c="dimmed" py="md" size="sm">
                {t('Дані відсутні')}
              </Text>
            )}
            {(charts.donut_outside_window_lines ?? 0) > 0 && (
              <Text c="dimmed" className="client-solvency-donut-outside" size="xs">
                {outsideWindowCaption(charts.donut_outside_window_lines ?? 0, charts.window_months)}
              </Text>
            )}
          </Stack>
        </Card>
      </SimpleGrid>

      <Card className="app-section-card" padding="md" radius="md" withBorder>
        <Stack gap="xs">
          <Text className="client-section-title" fw={600} size="sm">
            {t('Прострочені рахунки, документів')}
          </Text>
          <Text c="dimmed" size="xs">
            {t('Відкриті боргові документи за днями після договірного терміну оплати.')}
          </Text>
          {agingData.length > 0 ? (
            <BarChart
              data={agingData}
              dataKey="бакет"
              h={200}
              series={[{ color: 'orange.6', name: 'кількість' }]}
              yAxisProps={{ allowDecimals: false }}
            />
          ) : (
            <Text c="dimmed" size="sm">
              {t('Дані відсутні')}
            </Text>
          )}
        </Stack>
      </Card>

      <SimpleGrid className="client-solvency-charts-grid" cols={{ base: 1, md: 2 }} spacing="sm">
        <Card className="app-section-card" padding="md" radius="md" withBorder>
          <Stack gap="xs">
            <Text className="client-section-title" fw={600} size="sm">
              {t('Динаміка оцінки')}
            </Text>
            <Text c="dimmed" size="sm">
              {charts.score_sparkline_reason}
            </Text>
          </Stack>
        </Card>

        <Card className="app-section-card" padding="md" radius="md" withBorder>
          <Stack gap="xs">
            <Text className="client-section-title" fw={600} size="sm">
              {t('Оборот, EUR з ПДВ')}
            </Text>
            <Text c="dimmed" size="xs">
              {t('Проведені продажі за місяцями за курсом на дату продажу; повернення не віднято.')}
            </Text>
            {turnoverData.length > 0 ? (
              <BarChart
                classNames={{ tooltipItemData: 'app-money' }}
                data={turnoverData}
                dataKey="період"
                h={120}
                series={[{ color: 'teal.6', name: 'оборот' }]}
                yAxisProps={{ tick: MONEY_AXIS_TICK }}
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

type GaugeState = 'no_limit' | 'not_applicable' | 'unknown' | 'value'

function resolveGaugeState(gauge: GaugeChart): GaugeState {
  if (gauge.status === 'no_limit' || gauge.status === 'not_applicable') {
    return gauge.status
  }

  if (gauge.value != null && Number.isFinite(gauge.value)) {
    return 'value'
  }

  return gauge.label === 'no_credit_limit' ? 'no_limit' : 'unknown'
}

function formatUtilizationPercent(ratio: number): string {
  return `${utilizationFormatter.format(ratio * 100)}\u00a0%`
}

function formatGaugeDebtLine(t: (value: string) => string, gauge: GaugeChart): string | null {
  const debt = gauge.debt_amount
  const limit = gauge.limit_amount
  if (debt == null || limit == null || !Number.isFinite(debt) || !Number.isFinite(limit)) {
    return null
  }

  return `${t('борг')} ${eurFormatter.format(debt)} ${t('із ліміту')} ${eurFormatter.format(limit)}`
}

function utilizationZone(value: number | null, soft: number, hard: number): string {
  if (value == null || !Number.isFinite(value)) {
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

const percent1Formatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 1, minimumFractionDigits: 1 })

function formatPercent1(value: number): string {
  if (!Number.isFinite(value)) {
    return '-'
  }

  return `${percent1Formatter.format(value * 100)}\u00a0%`
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '-'
  }

  return percent1Formatter.format(value)
}

function formatEur(value: number): string {
  if (!Number.isFinite(value)) {
    return '-'
  }

  return `${eurFormatter.format(value)} EUR`
}

function round2(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.round(value * 100) / 100
}
