import { LineChart } from '@mantine/charts'
import { Card, Stack, Text } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { SalesPredictionChartPoint } from '../types'

export function SalesPredictionChart({ data, title }: { data: SalesPredictionChartPoint[]; title: string }) {
  const { t } = useI18n()

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="sm">
        <Text fw={600} size="sm">
          {title}
        </Text>
        {data.length === 0 ? (
          <Text c="dimmed" size="sm">
            {t('Немає даних для прогнозу')}
          </Text>
        ) : (
          <LineChart
            curveType="linear"
            data={data}
            dataKey="month"
            h={300}
            series={[{ color: 'violet.6', label: t('Сума продажів, EUR'), name: 'amount' }]}
          />
        )}
      </Stack>
    </Card>
  )
}
