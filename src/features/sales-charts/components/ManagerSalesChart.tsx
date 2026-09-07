import { BarChart } from '@mantine/charts'
import { useI18n } from '../../../shared/i18n/useI18n'
import { ChartLoading } from '../../../shared/ui/charts/ChartState'
import { MONEY_AXIS_TICK } from '../../../shared/ui/charts/chartTheme'
import { formatMoney } from '../money'
import { SalesChartEmpty, SalesChartPanel } from './SalesChartPanel'

export function ManagerSalesChart({
  data,
  detailCount,
  detailLabel,
  isLoading,
}: {
  data: { manager: string; total: number }[]
  detailCount: number
  detailLabel: string
  isLoading: boolean
}) {
  const { t } = useI18n()
  const total = data.reduce((sum, item) => sum + item.total, 0)
  const hasSales = data.some((item) => item.total !== 0)

  return (
    <SalesChartPanel
      title={t('Продано по менеджерах')}
      metrics={[
        { label: t('Продано за період'), value: isLoading ? '' : formatMoney(total), money: true },
        { label: t('Учасників звіту'), value: isLoading ? '' : data.length },
        { label: detailLabel, value: isLoading ? '' : detailCount },
      ]}
    >
      {isLoading ? (
        <ChartLoading height={96} label={t('Завантаження даних')} />
      ) : hasSales ? (
        <div className="sales-chart-plot">
          <BarChart
            classNames={{ tooltipItemData: 'app-money' }}
            data={data}
            dataKey="manager"
            h={220}
            maxBarWidth={44}
            series={[{ color: 'orange.6', label: t('Продано'), name: 'total' }]}
            tickLine="none"
            valueFormatter={formatMoney}
            withLegend={false}
            yAxisProps={{ tick: MONEY_AXIS_TICK }}
          />
        </div>
      ) : (
        <SalesChartEmpty
          title={t('За цей період продажів немає')}
          description={t('Оберіть інший діапазон дат або змініть фільтри.')}
        />
      )}
    </SalesChartPanel>
  )
}
