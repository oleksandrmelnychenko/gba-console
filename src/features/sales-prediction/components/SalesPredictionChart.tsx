import { LineChart } from '@mantine/charts'
import { Card, Group, Loader, SimpleGrid, Stack, Text } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { SalesPredictionChartPoint } from '../types'
import './sales-prediction-chart.css'

type SalesPredictionChartProps = {
  color?: string
  data: SalesPredictionChartPoint[]
  isLoading?: boolean
  title: string
}

type PredictionSeries = {
  color: string
  data: SalesPredictionChartPoint[]
  label: string
  name: string
}

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})

export function SalesPredictionChart({
  color = 'orange.6',
  data,
  isLoading = false,
  title,
}: SalesPredictionChartProps) {
  const { t } = useI18n()
  const summary = getSummary(data)

  return (
    <Card className="sales-prediction-chart-card" withBorder radius="md" padding="md">
      <Stack gap="sm">
        <Group align="flex-start" justify="space-between" wrap="nowrap">
          <Text className="sales-prediction-chart-title">
            {title}
          </Text>
          {isLoading && <Loader size="xs" />}
        </Group>

        {isLoading && data.length === 0 ? (
          <ChartState label={t('Завантаження даних')} />
        ) : data.length === 0 ? (
          <ChartState label={t('Дані відсутні')} />
        ) : (
          <>
            <LineChart
              curveType="monotone"
              data={data}
              dataKey="month"
              h={260}
              series={[{ color, label: t('Сума продажів, EUR'), name: 'amount' }]}
              valueFormatter={formatMoney}
              withDots
              withLegend={false}
            />
            <PredictionSummary
              average={summary.average}
              peak={summary.peak}
              total={summary.total}
            />
          </>
        )}
      </Stack>
    </Card>
  )
}

export function SalesPredictionComparisonChart({
  isLoading = false,
  series,
  title,
}: {
  isLoading?: boolean
  series: PredictionSeries[]
  title: string
}) {
  const { t } = useI18n()
  const activeSeries = series.filter((item) => item.data.length > 0)
  const rows = buildComparisonRows(activeSeries)

  return (
    <Card className="sales-prediction-chart-card" withBorder radius="md" padding="md">
      <Stack gap="sm">
        <Group align="flex-start" justify="space-between" wrap="nowrap">
          <Text className="sales-prediction-chart-title">
            {title}
          </Text>
          {isLoading && <Loader size="xs" />}
        </Group>

        {isLoading && rows.length === 0 ? (
          <ChartState label={t('Завантаження даних')} />
        ) : rows.length === 0 ? (
          <ChartState label={t('Дані відсутні')} />
        ) : (
          <LineChart
            connectNulls={false}
            curveType="monotone"
            data={rows}
            dataKey="month"
            h={320}
            series={activeSeries.map((item) => ({
              color: item.color,
              label: item.label,
              name: item.name,
            }))}
            valueFormatter={formatMoney}
            withDots
            withLegend
          />
        )}
      </Stack>
    </Card>
  )
}

function PredictionSummary({ average, peak, total }: { average: number; peak: number; total: number }) {
  const { t } = useI18n()

  return (
    <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xs">
      <SummaryItem label={t('Разом')} value={formatMoney(total)} />
      <SummaryItem label={t('Середнє')} value={formatMoney(average)} />
      <SummaryItem label={t('Пік')} value={formatMoney(peak)} />
    </SimpleGrid>
  )
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={2}>
      <Text className="sales-prediction-summary-label">
        {label}
      </Text>
      <Text className="app-money sales-prediction-summary-value">
        {value}
      </Text>
    </Stack>
  )
}

function ChartState({ label }: { label: string }) {
  return (
    <Group align="center" h={220} justify="center">
      <Text className="sales-prediction-chart-state">
        {label}
      </Text>
    </Group>
  )
}

function buildComparisonRows(series: PredictionSeries[]): Array<Record<string, number | string | null>> {
  const months = new Set<string>()

  series.forEach((item) => {
    item.data.forEach((point) => {
      if (point.month) {
        months.add(point.month)
      }
    })
  })

  return Array.from(months).map((month) => {
    const row: Record<string, number | string | null> = { month }

    series.forEach((item) => {
      row[item.name] = item.data.find((point) => point.month === month)?.amount ?? null
    })

    return row
  })
}

function getSummary(data: SalesPredictionChartPoint[]): { average: number; peak: number; total: number } {
  const total = data.reduce((sum, point) => sum + point.amount, 0)
  const peak = data.reduce((max, point) => Math.max(max, point.amount), 0)

  return {
    average: data.length > 0 ? total / data.length : 0,
    peak,
    total,
  }
}

function formatMoney(value: number): string {
  return `${moneyFormatter.format(value)} EUR`
}
