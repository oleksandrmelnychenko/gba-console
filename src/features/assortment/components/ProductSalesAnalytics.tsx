import { AreaChart, BarChart } from '@mantine/charts'
import { Alert, Badge, Card, Group, SimpleGrid, Stack, Text } from '@mantine/core'
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { useMemo } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { ProductAnalytics, ProductSalesSeriesPoint } from '../types'

type ProductSalesAnalyticsProps = {
  analytics: ProductAnalytics | null
  error: string | null
}

type ProductSalesChartPoint = {
  isComplete: boolean
  label: string
  month: string
  orders: number
  revenue: number
  units: number
}

type SalesTrend =
  | { kind: 'insufficient-history' }
  | { kind: 'no-sales' }
  | { kind: 'percentage'; percent: number }
  | { kind: 'resumed' }

const integerFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 })
const decimalFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 1 })
const euroFormatter = new Intl.NumberFormat('uk-UA', {
  currency: 'EUR',
  maximumFractionDigits: 0,
  style: 'currency',
})
const preciseEuroFormatter = new Intl.NumberFormat('uk-UA', {
  currency: 'EUR',
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: 'currency',
})
const compactEuroFormatter = new Intl.NumberFormat('uk-UA', {
  currency: 'EUR',
  maximumFractionDigits: 1,
  notation: 'compact',
  style: 'currency',
})
const monthFormatter = new Intl.DateTimeFormat('uk-UA', { month: 'short', year: '2-digit' })
const dateFormatter = new Intl.DateTimeFormat('uk-UA')

export function ProductSalesAnalytics({ analytics, error }: ProductSalesAnalyticsProps) {
  const { t } = useI18n()
  const points = useMemo(
    () => normalizeSalesSeries(analytics?.sales_series ?? []),
    [analytics?.sales_series],
  )
  const summary = useMemo(() => summarizeSales(points), [points])

  if (error) {
    return (
      <Alert color="orange" icon={<AlertTriangle aria-hidden="true" size={17} />} title={t('Динаміка продажів недоступна')} variant="light">
        {error}
      </Alert>
    )
  }

  if (!analytics || points.length === 0) {
    return (
      <Card className="assort-sales-analytics" radius="md" withBorder>
        <Text className="app-section-title" fw={600} size="sm">{t('Динаміка продажів')}</Text>
        <Text c="dimmed" mt="xs" size="sm">{t('За вибраний період немає даних продажів.')}</Text>
      </Card>
    )
  }

  const partialMonth = points.some((point) => !point.isComplete)

  return (
    <Card className="assort-sales-analytics" radius="md" withBorder>
      <Stack gap="md">
        <Group align="flex-start" justify="space-between" wrap="wrap">
          <Stack gap={2}>
            <Text className="app-section-title" fw={600} size="sm">{t('Фактична динаміка продажів')}</Text>
            <Text c="dimmed" size="xs">
              {t('Щомісячні продажі з валідних замовлень; залишок на складі не історизується.')}
            </Text>
          </Stack>
          <Badge color="gray" variant="light">
            {analytics.window.months} {t('міс.')}
          </Badge>
        </Group>

        <SalesInsight trend={summary.trend} />

        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
          <SalesStat label={t('Продано, факт')} value={decimalFormatter.format(summary.units)} suffix={t('шт.')} />
          <SalesStat label={t('Замовлень')} value={integerFormatter.format(summary.orders)} />
          <SalesStat label={t('Виручка, факт')} value={euroFormatter.format(summary.revenue)} />
          <SalesStat
            label={t('Сер. ціна, факт')}
            value={summary.averagePrice === null ? '—' : preciseEuroFormatter.format(summary.averagePrice)}
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
          <figure className="assort-sales-chart">
            <figcaption>
              <span>{t('Продані одиниці')}</span>
              <small>{t('по місяцях')}</small>
            </figcaption>
            <div
              aria-label={`${t('Продані одиниці по місяцях')}. ${buildAccessibleSeries(points, 'units', t('шт.'))}`}
              role="img"
            >
              <BarChart
                barProps={{ isAnimationActive: false, radius: [4, 4, 0, 0] }}
                data={points}
                dataKey="label"
                gridAxis="y"
                h={220}
                maxBarWidth={28}
                series={[{ color: 'teal.6', label: t('Продано'), name: 'units' }]}
                tickLine="y"
                tooltipAnimationDuration={0}
                valueFormatter={(value) => `${decimalFormatter.format(value)} ${t('шт.')}`}
                xAxisProps={{ minTickGap: 18 }}
                yAxisProps={{ allowDecimals: false, tickFormatter: (value: number) => integerFormatter.format(value), width: 34 }}
              />
            </div>
          </figure>

          <figure className="assort-sales-chart">
            <figcaption>
              <span>{t('Фактична виручка')}</span>
              <small>EUR</small>
            </figcaption>
            <div
              aria-label={`${t('Фактична виручка по місяцях')}. ${buildAccessibleSeries(points, 'revenue', 'EUR')}`}
              role="img"
            >
              <AreaChart
                areaProps={{ isAnimationActive: false }}
                connectNulls={false}
                curveType="linear"
                data={points}
                dataKey="label"
                fillOpacity={0.12}
                gridAxis="y"
                h={220}
                series={[{ color: 'orange.6', label: t('Виручка'), name: 'revenue' }]}
                tickLine="y"
                tooltipAnimationDuration={0}
                valueFormatter={(value) => euroFormatter.format(value)}
                withDots={false}
                withGradient={false}
                xAxisProps={{ minTickGap: 18 }}
                yAxisProps={{ tickFormatter: (value: number) => compactEuroFormatter.format(value), width: 54 }}
              />
            </div>
          </figure>
        </SimpleGrid>

        <Text c="dimmed" className="assort-sales-analytics__caption" size="xs">
          {partialMonth
            ? `* ${t('Останній місяць періоду неповний і не входить у порівняння тренду; дані до')} ${formatDate(analytics.window.end_exclusive)}, ${t('не включно')}. `
            : ''}
          {t('Запас і покриття — поточний зріз, а не історичний ряд.')}
        </Text>
      </Stack>
    </Card>
  )
}

function SalesInsight({ trend }: { trend: SalesTrend }) {
  const { t } = useI18n()

  if (trend.kind === 'insufficient-history') {
    return (
      <div className="assort-sales-insight is-neutral">
        <Minus aria-hidden="true" size={16} />
        <Text size="xs">{t('Для надійного тренду потрібно щонайменше шість завершених місяців.')}</Text>
      </div>
    )
  }

  if (trend.kind === 'resumed') {
    return (
      <div className="assort-sales-insight is-positive">
        <ArrowUpRight aria-hidden="true" size={16} />
        <Text size="xs">
          {t('Продажі відновилися: останні 3 завершені місяці мають попит після нульових попередніх 3 місяців.')}
        </Text>
      </div>
    )
  }

  if (trend.kind === 'no-sales') {
    return (
      <div className="assort-sales-insight is-neutral">
        <Minus aria-hidden="true" size={16} />
        <Text size="xs">{t('У шести останніх завершених місяцях продажів не було.')}</Text>
      </div>
    )
  }

  const trendPercent = trend.percent
  const isGrowing = trendPercent > 0
  const isDeclining = trendPercent < 0
  const Icon = isGrowing ? ArrowUpRight : isDeclining ? ArrowDownRight : Minus
  const tone = isGrowing ? 'positive' : isDeclining ? 'negative' : 'neutral'
  const direction = isGrowing ? t('вище') : isDeclining ? t('нижче') : t('без змін')

  return (
    <div className={`assort-sales-insight is-${tone}`}>
      <Icon aria-hidden="true" size={16} />
      <Text size="xs">
        {t('Середні продажі останніх 3 завершених місяців')} {direction}{' '}
        {isGrowing || isDeclining ? <b>{Math.abs(trendPercent)}%</b> : null}{' '}
        {t('проти попередніх 3 місяців')}.
      </Text>
    </div>
  )
}

function SalesStat({ label, suffix, value }: { label: string; suffix?: string; value: string }) {
  return (
    <div className="assort-sales-stat">
      <span>{label}</span>
      <b>{value}{suffix ? <small> {suffix}</small> : null}</b>
    </div>
  )
}

function normalizeSalesSeries(series: ProductSalesSeriesPoint[]): ProductSalesChartPoint[] {
  return series.flatMap((point) => {
    if (!/^\d{4}-\d{2}$/.test(point.month)) {
      return []
    }

    const units = toFiniteNonNegative(point.units)
    const orders = toFiniteNonNegative(point.order_count)
    const revenue = toFiniteNonNegative(point.revenue_eur)

    if (units === null || orders === null || revenue === null) {
      return []
    }

    return [{
      isComplete: point.is_complete,
      label: `${formatMonth(point.month)}${point.is_complete ? '' : '*'}`,
      month: point.month,
      orders,
      revenue,
      units,
    }]
  })
}

function summarizeSales(points: ProductSalesChartPoint[]) {
  const units = points.reduce((total, point) => total + point.units, 0)
  const orders = points.reduce((total, point) => total + point.orders, 0)
  const revenue = points.reduce((total, point) => total + point.revenue, 0)
  const averagePrice = units > 0 ? revenue / units : null
  const complete = points.filter((point) => point.isComplete)
  const recent = complete.slice(-3)
  const previous = complete.slice(-6, -3)
  const recentAverage = average(recent.map((point) => point.units))
  const previousAverage = average(previous.map((point) => point.units))
  let trend: SalesTrend

  if (recent.length !== 3 || previous.length !== 3) {
    trend = { kind: 'insufficient-history' }
  } else if (previousAverage === 0) {
    trend = recentAverage > 0 ? { kind: 'resumed' } : { kind: 'no-sales' }
  } else {
    trend = {
      kind: 'percentage',
      percent: Math.round(((recentAverage / previousAverage) - 1) * 100),
    }
  }

  return { averagePrice, orders, revenue, trend, units }
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length
}

function toFiniteNonNegative(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

function formatMonth(month: string): string {
  return monthFormatter.format(new Date(`${month}-01T00:00:00Z`)).replace('.', '')
}

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`)

  return Number.isNaN(date.getTime())
    ? value
    : dateFormatter.format(date)
}

function buildAccessibleSeries(
  points: ProductSalesChartPoint[],
  key: 'revenue' | 'units',
  unit: string,
): string {
  return points.map((point) => `${point.month}: ${decimalFormatter.format(point[key])} ${unit}`).join(', ')
}
