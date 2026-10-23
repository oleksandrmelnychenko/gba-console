import { financialTotal } from '../financials'
import { Alert, Button, Card, Group, Text } from '@mantine/core'
import { AlertTriangle, BarChart3, Coins, ShoppingBag, Table2, Tag } from 'lucide-react'
import { useMemo, useState } from 'react'
import { AnalyticsTabs } from '../../../shared/ui/analytics/AnalyticsControls'
import { AnalyticsSeriesChart } from '../../../shared/ui/analytics/AnalyticsSeriesChart'
import { useI18n } from '../../../shared/i18n/useI18n'
import { TableChip } from '../../../shared/ui/TableChip'
import type { FinancialBasis, ProductAnalytics, ProductSalesSeriesPoint } from '../types'

const quantity = new Intl.NumberFormat('uk-UA', { maximumSignificantDigits: 15 })
const money = new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const monthFormat = new Intl.DateTimeFormat('uk-UA', { month: 'short', year: '2-digit', timeZone: 'UTC' })
const dateFormat = new Intl.DateTimeFormat('uk-UA', { timeZone: 'UTC' })
const metrics = [
  { value: 'units', label: 'Продано', icon: <BarChart3 size={15} /> },
  { value: 'order_count', label: 'Накладних', icon: <ShoppingBag size={15} /> },
  { value: 'revenue_eur', label: 'До повернень', icon: <Coins size={15} /> },
  { value: 'net_revenue_eur', label: 'Мінус повернення', icon: <Coins size={15} /> },
  { value: 'avg_price_eur', label: 'Середня ціна', icon: <Tag size={15} /> },
] as const

type Metric = typeof metrics[number]['value']
type Point = { month: string; label: string; complete: boolean; units: number | null; order_count: number | null; revenue_eur: number | null; net_revenue_eur: number | null; financial_basis?: FinancialBasis; avg_price_eur: number | null }
const signed = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null
const finite = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
const monthIndex = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? Number(value.slice(0, 4)) * 12 + Number(value.slice(5)) - 1 : null
const monthKey = (index: number) => `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}`
const formatMonth = (key: string) => monthFormat.format(new Date(`${key}-01T00:00:00Z`))
const sum = (points: Point[], metric: 'units' | 'order_count' | 'revenue_eur' | 'net_revenue_eur') => points.length && points.every(point => point[metric] !== null) ? points.reduce((total, point) => total + point[metric]!, 0) : null

function salesPoints(analytics: ProductAnalytics | null, months: number): Point[] {
  if (!analytics) return []
  const end = new Date(`${analytics.window.end_exclusive}T00:00:00Z`)
  if (!Number.isFinite(end.getTime())) return []
  end.setUTCDate(end.getUTCDate() - 1)
  const last = end.getUTCFullYear() * 12 + end.getUTCMonth()
  const earliest = monthIndex(analytics.effective_start.slice(0, 7)) ?? last - months + 1
  const first = Math.max(last - months + 1, earliest)
  const byMonth = new Map(analytics.sales_series.filter(point => monthIndex(point.month) !== null).map(point => [point.month, point]))
  return Array.from({ length: Math.max(0, last - first + 1) }, (_, offset) => {
    const month = monthKey(first + offset)
    const point: ProductSalesSeriesPoint | undefined = byMonth.get(month)
    return { month, label: formatMonth(month), complete: point?.is_complete === true,
      units: signed(point?.units), order_count: finite(point?.order_count), revenue_eur: signed(point?.revenue_eur), net_revenue_eur: signed(point?.net_revenue_eur), financial_basis: point?.financial_basis, avg_price_eur: signed(point?.avg_price_eur) }
  })
}

function salesTrend(points: Point[]) {
  const complete = points.filter(point => point.complete)
  const comparison = complete.slice(-6)
  const consecutive = comparison.length === 6 && comparison.every((point, index) => point.units !== null && (!index || monthIndex(point.month)! === monthIndex(comparison[index - 1].month)! + 1))
  if (!consecutive) return { label: 'Недостатньо історії для тренду', tone: 'neutral' as const }
  const previous = comparison.slice(0, 3).reduce((total, point) => total + point.units!, 0)
  const recent = comparison.slice(3).reduce((total, point) => total + point.units!, 0)
  if (previous === 0) return { label: recent > 0 ? 'Продажі відновилися' : 'Без продажів', tone: recent > 0 ? 'success' as const : 'neutral' as const }
  const change = Math.round((recent / previous - 1) * 100)
  return { label: `Тренд 3 міс.: ${change > 0 ? '+' : change < 0 ? '−' : ''}${Math.abs(change)}%`, tone: change < 0 ? 'danger' as const : change > 0 ? 'success' as const : 'neutral' as const }
}

export function ProductSalesAnalytics({ analytics, error }: { analytics: ProductAnalytics | null; error: string | null }) {
  const { t } = useI18n()
  const [months, setMonths] = useState('12')
  const [metric, setMetric] = useState<Metric>('units')
  const [table, setTable] = useState(false)
  const points = useMemo(() => salesPoints(analytics, Number(months)), [analytics, months])
  const allPoints = useMemo(() => salesPoints(analytics, 12), [analytics])
  const trend = salesTrend(allPoints)
  const units = sum(points, 'units')
  const basis = points.map(point => point.financial_basis)
  const exactBasis = basis.length > 0 && basis.every((row): row is FinancialBasis => row !== undefined) ? basis : null
  const revenue = exactBasis ? financialTotal(exactBasis, false) : sum(points, 'revenue_eur')
  const netRevenue = exactBasis ? financialTotal(exactBasis, true) : null
  const knownNetRevenue = exactBasis ? financialTotal(exactBasis.map(row => ({ ...row, unresolved_amount_count: 0 })), true) : null
  const totals: Record<Metric, number | null> = { units, order_count: sum(points, 'order_count'), revenue_eur: revenue, net_revenue_eur: netRevenue,
    avg_price_eur: units !== null && units > 0 && revenue !== null ? revenue / units : null }
  const isMoney = metric.endsWith('eur')
  const formatValue = (value: number) => (isMoney ? money : quantity).format(value)
  const hasData = points.some(point => metrics.some(item => point[item.value] !== null))
  const partial = points.some(point => !point.complete && metrics.some(item => point[item.value] !== null))
  const missing = points.some(point => metrics.slice(0, 3).some(item => point[item.value] === null))
  const end = analytics ? new Date(`${analytics.window.end_exclusive}T00:00:00Z`) : null
  if (end) end.setUTCDate(end.getUTCDate() - 1)

  if (error) return <Alert color="gray" icon={<AlertTriangle size={17} />} title={t('Динаміка продажів недоступна')} variant="outline">{error}</Alert>

  return <Card className="assort-sales-analytics" radius="md" withBorder>
    <div className="assort-sales-toolbar">
      <Text component="h2" className="app-section-title" fw={600} size="sm">{t('Продажі')}</Text>
      <Group gap={6}>
        <AnalyticsTabs label={t('Період продажів')} value={months} onChange={setMonths} items={['3', '6', '12'].map(value => ({ value, label: `${value} ${t('міс.')}` }))} />
        <Button size="compact-xs" variant={table ? 'filled' : 'default'} color={table ? 'brand' : 'gray'} aria-pressed={table} leftSection={<Table2 size={14} />} onClick={() => setTable(!table)}>{t('Дані')}</Button>
      </Group>
    </div>
    {!hasData ? <div className="assort-sales-empty">{t('За вибраний період немає даних продажів.')}</div> : <>
      <div className="assort-sales-metrics">
        <AnalyticsTabs label={t('Показник продажів')} value={metric} onChange={value => setMetric(value as Metric)} items={metrics.map(item => ({ ...item, label: t(item.label), valueLabel: <>{totals[item.value] === null ? '—' : (item.value === 'units' || item.value === 'order_count' ? quantity : money).format(totals[item.value]!)}{item.value.endsWith('eur') && <> <TableChip tone="source" value="EUR" /></>}</> }))} />
      </div>
      <div className="assort-sales-context">
        <span>{analytics && points[0] ? dateFormat.format(new Date(`${analytics.effective_start > `${points[0].month}-01` ? analytics.effective_start : `${points[0].month}-01`}T00:00:00Z`)) : '—'} — {end ? dateFormat.format(end) : '—'} · {t('Київ')}</span>
        {netRevenue === null && <TableChip value={knownNetRevenue === null ? t('Сума після повернень не визначена') : `${t('Відома частина')}: ${money.format(knownNetRevenue)} EUR`} tone="warning" title={t('Потрібне підтвердження суми повернень; невідомі значення не замінено нулями.')} />}
        <TableChip value={t(trend.label)} tone={trend.tone} title={t('Останні 3 завершені місяці проти попередніх 3; неповні місяці не враховано.')} />
        {partial && <TableChip value={t('Неповний місяць')} tone="neutral" title={`${t('Дані враховано по')} ${end && Number.isFinite(end.getTime()) ? dateFormat.format(end) : '—'}. ${t('Неповні місяці не враховано в тренді.')}`} />}
        {missing && <TableChip value={t('Неповні дані')} tone="warning" title={t('Відсутні значення не замінено нулями.')} />}
      </div>
      {table ? <div className="assort-sales-table"><table className="app-static-table"><thead><tr><th>{t('Місяць')}</th>{metrics.map(item => <th key={item.value}>{t(item.label)}{item.value.endsWith('eur') ? ', EUR' : ''}</th>)}</tr></thead><tbody>{[...points].reverse().map(point => <tr key={point.month}><td>{point.label}{!point.complete && <TableChip value={t('неповний')} />}</td>{metrics.map(item => <td key={item.value}>{point[item.value] === null ? '—' : (item.value.endsWith('eur') ? money : quantity).format(point[item.value]!)}</td>)}</tr>)}</tbody></table></div>
        : <AnalyticsSeriesChart points={points.map(point => ({ label: `${point.label}${point.complete ? '' : ` · ${t('неповний')}`}`, actual: point[metric] }))} valueLabel={`${t(metrics.find(item => item.value === metric)!.label)}${isMoney ? ', EUR' : ''}`} formatValue={formatValue} height={200} emptyLabel={t('За вибраний період немає даних продажів.')} />}
    </>}
  </Card>
}
