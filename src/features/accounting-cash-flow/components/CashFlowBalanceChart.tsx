import { AreaChart } from '@mantine/charts'
import { Card, Group, Text } from '@mantine/core'
import { useMemo } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { AccountingCashFlowHeadItem } from '../types'

/**
 * Running-balance trajectory over the period. Plots CurrentBalance in the ledger
 * row order (which is chronological by FromDate) so the cash position trend is
 * visible at a glance above the ledger.
 */
export function CashFlowBalanceChart({
  items,
  formatMoney,
}: {
  items: AccountingCashFlowHeadItem[]
  formatMoney: (value?: number) => string
}) {
  const { t } = useI18n()

  const data = useMemo(
    () =>
      items
        .filter((item) => typeof item.CurrentBalance === 'number')
        .map((item, index) => ({
          balance: item.CurrentBalance as number,
          label: formatPointDate(item.FromDate) || String(index + 1),
        })),
    [items],
  )

  const lastBalance = data.length > 0 ? data[data.length - 1].balance : null

  if (data.length < 2) {
    return null
  }

  return (
    <Card className="app-section-card" withBorder radius="md" padding="md">
      <Group justify="space-between" align="baseline" mb="xs">
        <Text fw={600} size="sm">
          {t('Динаміка балансу')}
        </Text>
        {lastBalance != null && (
          <Text c={lastBalance < 0 ? 'red' : 'teal'} fw={700} size="sm">
            {formatMoney(lastBalance)}
          </Text>
        )}
      </Group>
      <AreaChart
        areaChartProps={{ margin: { bottom: 0, left: 10, right: 8, top: 4 } }}
        curveType="linear"
        data={data}
        dataKey="label"
        fillOpacity={0.18}
        gridAxis="y"
        h={170}
        series={[{ color: 'orange.6', label: t('Баланс'), name: 'balance' }]}
        tickLine="y"
        valueFormatter={(value) => formatMoney(value)}
        withDots={false}
        xAxisProps={{ minTickGap: 48 }}
        yAxisProps={{ tickMargin: 8, width: 78 }}
      />
    </Card>
  )
}

function formatPointDate(value?: string): string {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' })
}
