import { useEffect, useState, useSyncExternalStore } from 'react'
import { Button, Loader, NumberInput } from '@mantine/core'
import { LineChart } from '@mantine/charts'
import { BarChart3, Calculator, Package, ShoppingCart, Table2 } from 'lucide-react'
import { TableChip } from '../../../shared/ui/TableChip'
import type { ProductAnalytics } from '../../assortment/types'
import type { ReorderSuggestion } from '../procurementTypes'
import { calculateProcurementDecision } from '../procurementDecision'
import { procurementQuantityFormat as quantity } from '../procurementQuantityFormat'
import { ProcurementCostProof } from './ProcurementCostProof'
import { AnalyticsTabs } from '../../../shared/ui/analytics/AnalyticsControls'
import { AnalyticsSeriesChart } from '../../../shared/ui/analytics/AnalyticsSeriesChart'
import { getProductAnalyticsGeneration, loadProductAnalytics, subscribeProductAnalyticsGeneration } from './productAnalyticsResource'
import { formatSalesMonth, salesMetricValue, stockScenario, type SalesMetric } from './procurement-item-analytics-model'
import './procurement-item-analytics.css'

const amount = new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const urgencyLabels = { critical: 'Критично', high: 'Скоро', normal: 'За планом', none: 'Достатньо' }
const metricLabels: Record<SalesMetric, string> = { units: 'Кількість', revenue_eur: 'Виручка', order_count: 'Замовлення', avg_price_eur: 'Середня ціна' }
const tableMetrics: SalesMetric[] = ['units', 'revenue_eur', 'order_count', 'avg_price_eur']

type HistoryState = { key: string; data?: ProductAnalytics; error?: boolean }
export type ProcurementItemAnalyticsProps = {
  row: ReorderSuggestion
  selectedQty: number
  refreshKey?: number
  t: (key: string) => string
  onQuantityChange?: (qty: number) => void
  onAddToBasket?: (qty: number) => void
}

export function ProcurementItemAnalytics({ row, selectedQty, t, onQuantityChange, onAddToBasket, refreshKey = 0 }: ProcurementItemAnalyticsProps) {
  const [tab, setTab] = useState('sales')
  const [metric, setMetric] = useState<SalesMetric>('units')
  const [months, setMonths] = useState('12')
  const [table, setTable] = useState(false)
  const [retry, setRetry] = useState(0)
  const [history, setHistory] = useState<HistoryState | null>(null)
  const generation = useSyncExternalStore(subscribeProductAnalyticsGeneration, getProductAnalyticsGeneration, getProductAnalyticsGeneration)
  const requestKey = `${row.product_id}:${months}:${retry}:${refreshKey}:${generation}`
  useEffect(() => {
    let current = true
    loadProductAnalytics(row.product_id, Number(months))
      .then((data) => { if (current) setHistory({ key: requestKey, data }) })
      .catch(() => { if (current) setHistory({ key: requestKey, error: true }) })
    return () => { current = false }
  }, [row.product_id, months, requestKey])
  const loaded = history?.key === requestKey ? history : null
  const series = loaded?.data?.sales_series ?? []
  const decision = calculateProcurementDecision(row, selectedQty)
  const scenario = stockScenario(row, selectedQty)
  const isMoney = metric === 'revenue_eur' || metric === 'avg_price_eur'
  const formatValue = (value: number) => (isMoney ? amount : quantity).format(value)
  const partial = series.some((point) => !point.is_complete)

  return (
    <article className="procurement-item-analytics app-table-chips" aria-label={t('Аналітика товару')}>
      <div className="procurement-item-analytics__overview">
      <header className="procurement-item-analytics__header">
        <div className="procurement-item-analytics__identity">
          <strong title={row.product_name ?? undefined}>{row.product_name || row.vendor_code || `#${row.product_id}`}</strong>
          <TableChip tone="product" value={row.vendor_code} />
          <TableChip tone="document" value={row.producer_name} />
        </div>
        <div className="procurement-item-analytics__chips">
          <TableChip tone={row.urgency === 'critical' ? 'danger' : row.urgency === 'high' ? 'warning' : 'neutral'} value={t(urgencyLabels[row.urgency])} />
          {tab === 'sales' && partial && <TableChip tone="warning" value={t('Є неповні місяці')} />}
          {selectedQty !== row.suggested_qty && <TableChip tone="warning" value={t('Змінено вручну')} />}
        </div>
      </header>
      <div className="procurement-item-analytics__metrics">
        <Metric label={t('Доступно')} value={quantity.format(row.inventory.available)} />
        <Metric label={t('Покриття, дн.')} value={row.days_of_cover === null ? '—' : quantity.format(row.days_of_cover)} />
        <Metric label={t('Рекомендовано')} value={quantity.format(row.suggested_qty)} />
        <Metric label={t('Оцінка партії')} value={decision.selectedCostEur === null ? '—' : amount.format(decision.selectedCostEur)} currency />
      </div>
      </div>
      <div className="procurement-item-analytics__navigation">
      <AnalyticsTabs label={t('Аналітика товару')} value={tab} onChange={setTab} items={[
        { value: 'sales', label: t('Продажі'), icon: <BarChart3 size={15} /> },
        { value: 'stock', label: t('Запас і поставка'), icon: <Package size={15} /> },
        { value: 'calculation', label: t('Розрахунок'), icon: <Calculator size={15} /> },
      ]} />
      {tab === 'sales' && <div className="procurement-item-analytics__toolbar">
          <AnalyticsTabs label={t('Показник продажів')} value={metric} onChange={(value) => setMetric(value as SalesMetric)} items={Object.entries(metricLabels).map(([value, label]) => ({ value, label: t(label) }))} />
          <div className="procurement-item-analytics__controls">
            <AnalyticsTabs label={t('Період продажів')} value={months} onChange={setMonths} items={['3', '6', '12'].map((value) => ({ value, label: `${value} ${t('міс.')}` }))} />
            <Button size="compact-xs" variant={table ? 'filled' : 'default'} color={table ? 'brand' : 'gray'} leftSection={<Table2 size={14} />} aria-pressed={table} onClick={() => setTable(!table)}>{t('Дані')}</Button>
          </div>
        </div>}
      </div>
      {tab === 'sales' && <section className="procurement-item-analytics__panel" aria-label={t('Продажі')}>
        {!loaded ? <div role="status" className="procurement-item-analytics__state"><Loader size="xs" />{t('Завантаження історії…')}</div>
          : loaded.error ? <div role="alert" className="procurement-item-analytics__state">{t('Не вдалося завантажити продажі')}<Button size="compact-xs" variant="default" onClick={() => setRetry((value) => value + 1)}>{t('Повторити')}</Button></div>
            : series.length === 0 ? <div className="procurement-item-analytics__state">{t('За цей період даних немає')}</div>
              : <>
                {table ? <div className="procurement-item-analytics__table-wrap"><table className="app-static-table">
                  <thead><tr><th>{t('Місяць')}</th><th>{t('Кількість')}</th><th>{t('Виручка, EUR')}</th><th>{t('Замовлення')}</th><th>{t('Середня ціна, EUR')}</th></tr></thead>
                  <tbody>{[...series].reverse().map((point) => <tr key={point.month}><td>{formatSalesMonth(point.month)} {!point.is_complete && <TableChip tone="warning" value={t('неповний')} />}</td>{tableMetrics.map((metric) => {
                    const value = salesMetricValue(point, metric)
                    const formatter = metric === 'revenue_eur' || metric === 'avg_price_eur' ? amount : quantity
                    return <td key={metric}>{value === null ? '—' : formatter.format(value)}</td>
                  })}</tr>)}</tbody>
                </table></div> : <AnalyticsSeriesChart points={series.map((point) => ({ label: `${formatSalesMonth(point.month)}${point.is_complete ? '' : ` · ${t('неповний')}`}`, actual: salesMetricValue(point, metric) }))} valueLabel={`${t(metricLabels[metric])}${isMoney ? ', EUR' : ''}`} formatValue={formatValue} height={220} emptyLabel={t('За цей період даних немає')} />}
              </>}
      </section>}
      {tab === 'stock' && <section className="procurement-item-analytics__panel" aria-label={t('Запас і поставка')}>
        <div className="procurement-item-analytics__facts">
          <Metric label={t('На складі')} value={quantity.format(row.inventory.on_hand)} />
          <Metric label={t('У резерві')} value={quantity.format(row.inventory.reserved)} />
          <Metric label={t('У дорозі')} value={quantity.format(row.inventory.on_order)} />
          <Metric label={t('Поставка, дн.')} value={decision.leadTimeDays === null ? '—' : quantity.format(decision.leadTimeDays)} />
        </div>
        <div className="procurement-item-analytics__scenario-label"><span>{t('Прогноз запасу')}</span><TableChip tone="neutral" value={t('Сценарій')} /></div>
        {scenario.length ? <LineChart h={220} data={scenario} dataKey="day" xAxisProps={{ type: 'number', domain: [0, 'dataMax'], allowDuplicatedCategory: false }} xAxisLabel={t('дні')} series={[{ name: 'withoutOrder', label: t('Без замовлення'), color: 'gray.5' }, { name: 'withOrder', label: t('З обраною партією'), color: 'orange.6' }]} withDots={false} curveType="linear" withLegend valueFormatter={(value) => quantity.format(value)} /> : <div className="procurement-item-analytics__state">{t('Недостатньо історії для прогнозу запасу')}</div>}
      </section>}
      {tab === 'calculation' && <section className="procurement-item-analytics__panel" aria-label={t('Розрахунок')}>
        <div className="procurement-item-analytics__facts procurement-item-analytics__facts--calculation">
          <Metric label={t('Цільовий рівень')} value={quantity.format(decision.orderUpTo)} />
          <Metric label={t('Позиція зараз')} value={quantity.format(row.inventory.position)} />
          <Metric label={t('Точка замовлення')} value={quantity.format(row.reorder_point)} />
          <Metric label={t('Страховий запас')} value={quantity.format(row.safety_stock)} />
          <Metric label={t('Попит на час поставки')} value={quantity.format(decision.leadDemand)} />
          <Metric label={t('Мінімальне замовлення')} value={row.moq === null ? '—' : quantity.format(row.moq)} />
          <Metric label={t('Кратність')} value={row.order_multiple === null ? '—' : quantity.format(row.order_multiple)} />
          <Metric label={t('Середній попит за день')} value={quantity.format(row.forecast.mean_daily)} />
        </div>
        <details className="procurement-item-analytics__details"><summary>{t('Обґрунтування вартості')}</summary><ProcurementCostProof compact item={row} /></details>
      </section>}
      {onAddToBasket && <footer className="procurement-item-analytics__footer">
        <label className="procurement-item-analytics__quantity"><span>{t('Замовити')}</span><NumberInput aria-label={t('Кількість до кошика')} min={0} hideControls value={selectedQty} onChange={(value) => { if (value !== '' && Number.isFinite(Number(value))) onQuantityChange?.(Math.max(0, Number(value))) }} /></label>
        <strong>{decision.selectedCostEur === null ? '—' : amount.format(decision.selectedCostEur)}</strong><TableChip tone="source" value="EUR" />
        <Button size="compact-sm" color="orange" leftSection={<ShoppingCart size={15} />} disabled={selectedQty <= 0} onClick={() => onAddToBasket(selectedQty)}>{t('У кошик')}</Button>
      </footer>}
    </article>
  )
}

function Metric({ label, value, currency = false }: { label: string; value: string; currency?: boolean }) {
  return <div className="procurement-item-analytics__metric"><span>{label}</span><div><strong>{value}</strong>{currency && <TableChip tone="source" value="EUR" />}</div></div>
}
