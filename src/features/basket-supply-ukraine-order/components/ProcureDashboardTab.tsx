import { procurementLoadError } from '../procurementLoadError'
import {
  Alert,
  Button,
  Card,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
} from '@mantine/core'
import {
  BarChart3,
  CircleAlert,
  Layers3,
  TrendingUp,
  FilterX,
  RefreshCw,
} from 'lucide-react'
import { useEffect, useMemo, useReducer, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import { AgingBars } from '../../../shared/ui/charts/AgingBars'
import { UrgencyDonut } from '../../../shared/ui/charts/UrgencyDonut'
import type { UrgencyLevel } from '../../../shared/ui/charts/chartTheme'
import type { UrgencySliceInput } from '../../../shared/ui/charts/donutData'
import { usePermissions } from '../../auth/usePermissions'
import { getSupplyDashboardSuppliers } from '../../supply-ukraine-orders/api/supplyUkraineOrdersApi'
import type { Client } from '../../supply-ukraine-orders/types'
import { getSupplyDashboardCharts } from '../api/procurementApi'
import { summarizeProcurementCharts } from '../procureDashboardModel'
import { procurementQuantityFormat as qtyFormatter } from '../procurementQuantityFormat'
import type {
  ProcurementCharts,
  ProcurementDemandSeries,
  ProcurementTopItem,
} from '../procurementTypes'
import { ProcurementProductCell } from './ProcurementProductCell'
import { ProcurementWorkspaceState } from './ProcurementWorkspaceState'
import { TableChip } from '../../../shared/ui/TableChip'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import { AnalyticsTabs } from '../../../shared/ui/analytics/AnalyticsControls'
import { AnalyticsSeriesChart } from '../../../shared/ui/analytics/AnalyticsSeriesChart'
import './procurement-dashboard.css'

type ProcureDashboardState = {
  charts: ProcurementCharts | null
  error: string | null
  isLoading: boolean
}

type ProcureDashboardAction =
  | { type: 'failed'; error: string }
  | { type: 'loaded'; charts: ProcurementCharts }
  | { type: 'loading' }

const initialState: ProcureDashboardState = {
  charts: null,
  error: null,
  isLoading: true,
}

function dashboardReducer(
  state: ProcureDashboardState,
  action: ProcureDashboardAction,
): ProcureDashboardState {
  switch (action.type) {
    case 'failed':
      return { ...state, error: action.error, isLoading: false }
    case 'loaded':
      return { charts: action.charts, error: null, isLoading: false }
    case 'loading':
      return { ...state, error: null, isLoading: true }
  }
}

const URGENCY_LABEL: Record<string, string> = {
  critical: 'Критична',
  high: 'Висока',
  normal: 'Звичайна',
  none: 'Достатньо',
  low: 'Достатньо',
}

const URGENCY_TO_LEVEL: Record<string, UrgencyLevel> = {
  critical: 'critical',
  high: 'high',
  normal: 'normal',
  none: 'low',
  low: 'low',
}

const countFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 0,
})
const snapshotDateFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

export function ProcureDashboardTab() {
  const { t } = useI18n()
  const { can, isLoading } = usePermissions()

  if (isLoading) {
    return <Text c="dimmed">{t('Завантаження')}</Text>
  }

  if (!can(PermissionKeys.SystemPages.SupplyDashboard.View)) {
    return (
      <Alert color="red" title={t('Доступ заборонено')} variant="light">
        {t('Недостатньо прав для перегляду дашборда постачання')}
      </Alert>
    )
  }

  return <ProcureDashboardTabContent />
}

function ProcureDashboardTabContent() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { can } = usePermissions()
  const canOpenConstructor = can(PermissionKeys.SystemPages.PurchaseCockpit.View)
  const [state, dispatch] = useReducer(dashboardReducer, initialState)
  const [suppliersError, setSuppliersError] = useState(false)
  const [producers, setProducers] = useState<Client[]>([])
  const [producerId, setProducerId] = useState<string | null>(null)
  const [topN, setTopN] = useState<number | ''>(15)
  const [appliedProducerId, setAppliedProducerId] = useState<number | null>(null)
  const [appliedTopN, setAppliedTopN] = useState<number>(15)
  const [tableToolbarTarget, setTableToolbarTarget] = useState<HTMLDivElement | null>(null)
  const [selectedForecastProductId, setSelectedForecastProductId] = useState<
    number | null
  >(null)
  const [mode, setMode] = useState('urgency')
  const [urgencyFilter, setUrgencyFilter] = useState<'all' | 'critical' | 'attention'>('all')
  const [detailProductId, setDetailProductId] = useState<number | null>(null)
  const [pageSize, setPageSize] = useState(20)
  const [pageSelection, setPageSelection] = useState({ page: 1, charts: null as ProcurementCharts | null })
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const { charts, error, isLoading } = state

  useEffect(() => {
    let cancelled = false

    getSupplyDashboardSuppliers()
      .then((loaded) => {
        if (!cancelled) {
          setProducers(loaded)
          setSuppliersError(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProducers([])
          setSuppliersError(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function loadCharts() {
      dispatch({ type: 'loading' })

      try {
        const loaded = await getSupplyDashboardCharts(
          {
            ...(typeof appliedProducerId === 'number' ? { producerId: appliedProducerId } : {}),
            topN: appliedTopN,
          },
          controller.signal,
        )

        if (!cancelled) {
          dispatch({ charts: loaded, type: 'loaded' })
        }
      } catch (loadError) {
        if (controller.signal.aborted) {
          return
        }

        if (!cancelled) {
          dispatch({
            error: procurementLoadError(loadError, t('Не вдалося завантажити дашборд постачання'), t),
            type: 'failed',
          })
        }
      }
    }

    void loadCharts()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [appliedProducerId, appliedTopN, reloadKey, t])

  function applyFilters() {
    setSelectedForecastProductId(null)
    setDetailProductId(null)
    setUrgencyFilter('all')
    setAppliedProducerId(producerId ? Number(producerId) : null)
    setAppliedTopN(normalizeTopN(topN))
    reload()
  }

  function resetFilters() {
    setSelectedForecastProductId(null)
    setDetailProductId(null)
    setUrgencyFilter('all')
    setProducerId(null)
    setTopN(15)
    setAppliedProducerId(null)
    setAppliedTopN(15)
    reload()
  }

  const urgencyData = useMemo<UrgencySliceInput[]>(
    () => buildUrgencySlices(charts, t),
    [charts, t],
  )

  const daysOfCoverData = useMemo(
    () =>
      (charts?.days_of_cover_hist ?? []).map((bucket) => ({
        bucket: bucket.bucket,
        [t('Позицій')]: bucket.count,
      })),
    [charts, t],
  )

  const summary = useMemo(() => summarizeProcurementCharts(charts), [charts])
  const producerOptions = useMemo(
    () =>
      producers.map((producer) => ({
        value: String(producer.Id),
        label: producer.FullName || producer.Name || producer.Code || String(producer.Id),
      })),
    [producers],
  )
  const draftProducerId = producerId ? Number(producerId) : null
  const normalizedTopN = normalizeTopN(topN)
  const hasDraftFilterChanges =
    draftProducerId !== appliedProducerId || normalizedTopN !== appliedTopN
  const hasAppliedFilters =
    typeof appliedProducerId === 'number' || appliedTopN !== 15
  const displayProducerId = charts ? charts.producer_id : appliedProducerId
  const selectedProducerName =
    producerOptions.find((option) => Number(option.value) === displayProducerId)?.label
  const activeScopeLabel =
    typeof displayProducerId === 'number'
      ? selectedProducerName || `${t('Постачальник')} ${displayProducerId}`
      : t('Усі постачальники')
  const snapshotLabel = formatSnapshotDate(charts?.as_of_date ?? null, t)
  const hasUrgencyData = urgencyData.some((slice) => slice.value > 0)
  const hasDaysOfCoverData = (charts?.days_of_cover_hist ?? []).some(
    (bucket) => bucket.count > 0,
  )
  const forecastSeries = useMemo(() => enrichDemandSeries(charts), [charts])
  const selectedForecastSeries =
    forecastSeries.find(
      (series) => series.product_id === selectedForecastProductId,
    ) ?? forecastSeries[0] ?? null
  const hasForecastData = forecastSeries.length > 0
  const hasTopItems = (charts?.top_items.length ?? 0) > 0
  const hasUsefulData =
    hasUrgencyData || hasDaysOfCoverData || hasForecastData || hasTopItems
  const hasProducerData = (charts?.top_items ?? []).some(
    (item) => item.producer_name || typeof item.producer_id === 'number',
  )

  const filteredItems = useMemo(() => (charts?.top_items ?? []).filter((item) =>
    urgencyFilter === 'critical' ? item.urgency === 'critical'
      : urgencyFilter === 'attention' ? ['critical', 'high'].includes(item.urgency) : true,
  ), [charts, urgencyFilter])
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize))
  const page = pageSelection.charts === charts ? Math.min(pageSelection.page, totalPages) : 1
  const detailItem = charts?.top_items.find((item) => item.product_id === detailProductId)
  const detailSeries = forecastSeries.find((series) => series.product_id === detailProductId)

  function selectUrgency(filter: typeof urgencyFilter) {
    setMode('urgency')
    setUrgencyFilter(filter)
    setPageSelection({ page: 1, charts })
  }

  const topItemColumns = useMemo<Array<DataTableColumn<ProcurementTopItem>>>(() => [
    {
      id: 'product', header: t('Товар'), accessor: (item) => item.product_name || item.vendor_code || item.product_id,
      cell: (item) => <ProcurementProductCell row={item} t={t} />, width: 300, fill: true,
    },
    ...(hasProducerData ? [{
      id: 'producer', header: t('Постачальник'), accessor: (item: ProcurementTopItem) => item.producer_name || item.producer_id || '',
      cell: (item: ProcurementTopItem) => <TableChip tone="document" value={item.producer_name || item.producer_id} />, width: 170,
    }] : []),
    {
      id: 'urgency', header: t('Терміновість'), accessor: (item) => item.urgency,
      cell: (item) => <TableChip value={t(URGENCY_LABEL[item.urgency] ?? item.urgency)} tone={item.urgency === 'critical' ? 'danger' : item.urgency === 'high' ? 'warning' : 'neutral'} />, width: 135,
    },
    ...([
      ['suggested_qty', 'Рекомендовано'], ['on_hand', 'В наявності'], ['reorder_point', 'Точка замовлення'],
    ] as const).map(([key, label]) => ({
      id: key, header: t(label), accessor: (item: ProcurementTopItem) => item[key],
      cell: (item: ProcurementTopItem) => <span className="procurement-dashboard__number">{qtyFormatter.format(item[key])}</span>,
      width: 145, align: 'right' as const,
    })),
    {
      id: 'shortage', header: t('Бракує до точки'), accessor: (item) => Math.max(0, item.reorder_point - item.on_hand),
      cell: (item) => <span className="procurement-dashboard__number">{qtyFormatter.format(Math.max(0, item.reorder_point - item.on_hand))}</span>, width: 135, align: 'right',
    },
  ], [hasProducerData, t])

  return (
    <Stack className="procurement-dashboard app-table-chips" gap={12}>
      <form className="app-filter-bar procurement-dashboard__toolbar" onSubmit={(event) => { event.preventDefault(); applyFilters() }}>
        <Select clearable searchable data={producerOptions} label={t('Постачальник')} placeholder={t('Усі постачальники')}
          value={producerId} onChange={setProducerId} className="procurement-dashboard__producer" />
        <NumberInput allowDecimal={false} allowNegative={false} label={t('Топ позицій')} min={1} max={100}
          className="procurement-dashboard__top-n" value={topN} onChange={(value) => setTopN(typeof value === 'number' ? value : '')} w={118} />
        <Button variant="default" color="gray" leftSection={<FilterX size={16} />} disabled={!hasAppliedFilters && !hasDraftFilterChanges}
          onClick={resetFilters} type="button">{t('Скинути фільтри')}</Button>
        <Button color="brand" leftSection={<RefreshCw size={16} />} loading={isLoading} type="submit">
          {hasDraftFilterChanges ? t('Застосувати') : t('Оновити')}
        </Button>
        <div className="procurement-dashboard__snapshot"><span>{snapshotLabel}</span><TableChip tone="document" value={activeScopeLabel} /></div>
      </form>
      <Text component="h1" className="app-section-title" fw={600} size="sm">{t('Дашборд постачання')}</Text>
      {error && <ProcurementWorkspaceState action={{ label: t('Повторити'), onClick: reload }}
        description={charts ? t('Показано попередній зріз. Не вдалося отримати актуальні дані.') : t('Сервіс закупівель тимчасово недоступний. Повторіть завантаження.')}
        surface title={error} tone="error" />}
      {suppliersError && <Text c="orange" size="sm">{t('Довідник постачальників недоступний. Це не означає, що постачальників немає.')}</Text>}
      {isLoading && !charts && <ProcurementWorkspaceState isLoading surface description="" title={t('Завантаження дашборда')} />}
      {!isLoading && !hasUsefulData && !error && <ProcurementWorkspaceState surface title={t('Даних для аналізу поки немає')}
        description={hasAppliedFilters ? t('Для вибраного постачальника даних немає.') : t('Немає даних про запаси та попит.')}
        action={hasAppliedFilters ? { label: t('Показати весь кошик'), onClick: resetFilters } : canOpenConstructor ? { label: t('Відкрити конструктор закупівель'), onClick: () => navigate('/basket-supply-ukraine-order/cockpit') } : undefined} />}
      {hasUsefulData && <>
        <Text size="sm" c="dimmed">{charts?.population
          ? `${t(charts.population.scope === 'needed_cart' ? 'Повний кошик позицій, що потребують поповнення' : 'Повний асортимент вибраного постачальника')}: ${charts.population.item_count} ${t('позицій')}, ${charts.population.unique_product_count} ${t('унікальних товарів')}. ${t('Рекомендовано загалом')}: ${qtyFormatter.format(charts.population.total_suggested_qty)}. ${t('Без вартості')}: ${charts.population.unpriced_item_count}. ${t('Не підтверджено для бюджету')}: ${charts.population.budget_ineligible_item_count}.`
          : t('Повний обсяг рекомендованої кількості та покриття вартості в цьому зрізі не надано.')}</Text>
        <Text size="sm" c="dimmed">{t('Зріз попиту')}: {charts?.as_of_date ?? '—'}. {t('Запаси й резерви — стан на момент розрахунку, не історичний залишок на цю дату. Перед замовленням перевірте актуальність у конструкторі.')}</Text>
        <Text size="sm" c="dimmed">{t('Бюджет')}: {charts?.population?.budget_eur == null ? t('не задано') : `${qtyFormatter.format(charts.population.budget_eur)} EUR`}. {t('Стан погодження не надходить із джерела. Рекомендація не є погодженим замовленням.')}</Text>
        <div className="procurement-dashboard__metrics" aria-label={t('Поточні показники')}>
          <DashboardMetric label={t('Всього позицій')} value={summary.totalPositions} active={mode === 'urgency' && urgencyFilter === 'all'} onClick={() => selectUrgency('all')} icon={<Layers3 size={16} />} />
          <DashboardMetric label={t('Критичні позиції')} value={summary.criticalPositions} active={mode === 'urgency' && urgencyFilter === 'critical'} onClick={() => selectUrgency('critical')} icon={<CircleAlert size={16} />} />
          <DashboardMetric label={t('Потребують уваги')} value={summary.attentionPositions} active={mode === 'urgency' && urgencyFilter === 'attention'} onClick={() => selectUrgency('attention')} icon={<BarChart3 size={16} />} />
          <article className="procurement-dashboard__metric"><span>{t('Рекомендовано в добірці')}</span><strong>{qtyFormatter.format(summary.totalSuggested)}</strong><small>{summary.topItems} {t('позицій')}</small></article>
        </div>
        <Card className="app-section-card procurement-dashboard__analysis" withBorder radius="md" padding={12}>
          <div className="procurement-dashboard__chart-toolbar">
            <AnalyticsTabs label={t('Режим аналітики')} value={mode} onChange={setMode} items={[
              { value: 'urgency', label: t('Терміновість'), icon: <CircleAlert size={16} /> },
              { value: 'coverage', label: t('Покриття'), icon: <Layers3 size={16} /> },
              { value: 'demand', label: t('Попит'), icon: <TrendingUp size={16} /> },
            ]} />
            {mode === 'demand' && hasForecastData && <Select aria-label={t('Товар для аналізу')} searchable allowDeselect={false}
              data={forecastSeries.map((series) => ({ value: String(series.product_id), label: [series.vendor_code, series.product_name || series.product_id].filter(Boolean).join(' · ') }))}
              value={String(selectedForecastSeries?.product_id)} onChange={(value) => setSelectedForecastProductId(value ? Number(value) : null)} className="procurement-dashboard__product-select" />}
          </div>
          {mode === 'urgency' && <section aria-label={t('Терміновість поповнення')} className="procurement-dashboard__distribution">
            <UrgencyDonut data={urgencyData} chartLabel={countFormatter.format(summary.totalPositions)} emptyLabel={t('Даних не знайдено')} size={208} thickness={30} valueFormatter={(value) => countFormatter.format(value)} />
            <div className="procurement-dashboard__legend">{urgencyData.map((slice) => <div key={slice.level}>
              <TableChip value={slice.label} tone={slice.level === 'critical' ? 'danger' : slice.level === 'high' ? 'warning' : 'neutral'} />
              <strong>{countFormatter.format(slice.value)}</strong>
              <span>{summary.totalPositions > 0 ? `${Math.round(slice.value / summary.totalPositions * 100)}%` : '—'}</span>
            </div>)}</div>
          </section>}
          {mode === 'coverage' && <section aria-label={t('Запас днів покриття')}><AgingBars height={240} bucketKey="bucket" data={daysOfCoverData} emptyLabel={t('Даних не знайдено')}
            series={[{ name: t('Позицій'), color: 'orange.6' }]} valueFormatter={(value) => countFormatter.format(value)} /></section>}
          {mode === 'demand' && (selectedForecastSeries ? <DemandChart series={selectedForecastSeries} t={t} /> : <div className="procurement-dashboard__empty">{t('Прогнозів попиту не знайдено')}</div>)}
        </Card>
      </>}
      {hasTopItems && <Card className="app-section-card procurement-dashboard__table" withBorder radius="md" padding={0}>
        <div className="procurement-dashboard__table-toolbar">
          <Text className="app-section-title" component="h2" fw={600} size="sm">{t('Пріоритетні позиції')}</Text>
          <TableChip value={`${filteredItems.length} / ${summary.topItems}`} />
          {urgencyFilter !== 'all' && <Button variant="subtle" color="gray" size="compact-xs" onClick={() => selectUrgency('all')}>
            {urgencyFilter === 'critical' ? t('Критичні в добірці') : t('Потребують уваги в добірці')} ×
          </Button>}
          <div className="procurement-dashboard__table-actions">
            <Paginator page={page} pageSize={pageSize} totalPages={totalPages} isLoading={isLoading}
              onPageChange={(value) => setPageSelection({ page: value, charts })}
              onPageSizeChange={(value) => { setPageSize(value); setPageSelection({ page: 1, charts }) }} />
            <div ref={setTableToolbarTarget} />
          </div>
        </div>
        <DataTable columns={topItemColumns} data={filteredItems} pagination={{ pageIndex: page - 1, pageSize }}
          defaultLayout={{ columnPinning: { left: ['product'] }, density: 'normal' }} distributeAvailableWidth
          emptyText={t('У добірці таких позицій немає')} getRowId={(item) => String(item.product_id)} isLoading={isLoading}
          layoutVersion={5} maxHeight={520} minWidth={hasProducerData ? 1130 : 960} showLayoutControls
          tableId="basket-supply-ukraine-order-procure-top-items" toolbarPortalTarget={tableToolbarTarget}
          onSortingChange={() => setPageSelection({ page: 1, charts })}
          onRowClick={(item) => setDetailProductId(item.product_id)} />
      </Card>}
      <AppDrawer opened={Boolean(detailItem)} position="right" size="compact" title={t('Аналітика товару')} onClose={() => setDetailProductId(null)}>
        {detailItem && <Stack className="procurement-dashboard__detail app-table-chips" gap="sm">
          <ProcurementProductCell row={detailItem} t={t} />
          <Group gap="xs"><TableChip tone="document" value={detailItem.producer_name || detailItem.producer_id} /><TableChip tone={detailItem.urgency === 'critical' ? 'danger' : detailItem.urgency === 'high' ? 'warning' : 'neutral'} value={t(URGENCY_LABEL[detailItem.urgency] ?? detailItem.urgency)} /></Group>
          <div className="procurement-dashboard__detail-metrics">{([
            ['В наявності', detailItem.on_hand], ['Точка замовлення', detailItem.reorder_point], ['Рекомендовано', detailItem.suggested_qty],
          ] as const).map(([label, value]) => <article key={label}><span>{t(label)}</span><strong>{qtyFormatter.format(value)}</strong></article>)}</div>
          <Text size="sm">{t('Дата розрахунку')}: {charts?.as_of_date ?? '—'}. {t('Історія попиту')}: {charts?.history_complete ? t('покриття повне') : t('покриття часткове')}.</Text>
          {detailItem.evidence ? <Stack gap={4}>
            <Text size="sm">{detailItem.evidence.reason}</Text>
            <Text size="sm">{t('Доступно')}: {qtyFormatter.format(detailItem.evidence.available)} · {t('У резерві')}: {qtyFormatter.format(detailItem.evidence.reserved)} · {t('В дорозі')}: {qtyFormatter.format(detailItem.evidence.on_order)}</Text>
            <Text size="sm">{t('Прогноз')}: {qtyFormatter.format(detailItem.evidence.forecast_units)} / {detailItem.evidence.forecast_horizon_days} {t('днів')} · {t('Метод')}: {detailItem.evidence.forecast_method}</Text>
            <Text size="sm">{t('Вартість позиції')}: {detailItem.evidence.line_cost_eur == null ? t('невідома') : `${qtyFormatter.format(detailItem.evidence.line_cost_eur)} EUR`}. {detailItem.evidence.budget_eligible ? t('Джерело вартості підтверджене для розрахунку бюджету.') : t('Вартість не підтверджена для розрахунку бюджету; потрібна перевірка закупівельником.')}</Text>
          </Stack> : <Text size="sm" c="dimmed">{t('Детальні джерела запасу, прогнозу та вартості для цього зрізу недоступні.')}</Text>}
          {detailSeries ? <DemandChart series={detailSeries} t={t} /> : <div className="procurement-dashboard__empty">{t('Прогнозу для цього товару немає')}</div>}
          {canOpenConstructor && <Button color="brand" disabled={Boolean(error) || isLoading} onClick={() => {
            const params = new URLSearchParams({ productId: String(detailItem.product_id) })
            const selectedProducerId = detailItem.producer_id ?? displayProducerId
            if (typeof selectedProducerId === 'number') params.set('producerId', String(selectedProducerId))
            navigate(`/basket-supply-ukraine-order/cockpit?${params.toString()}`)
          }}>{t('Відкрити в конструкторі')}</Button>}
        </Stack>}
      </AppDrawer>
    </Stack>
  )
}

function DashboardMetric({ label, value, active, onClick, icon }: {
  label: string; value: number; active: boolean; onClick: () => void; icon: React.ReactNode
}) {
  return <article><button className={`procurement-dashboard__metric${active ? ' is-active' : ''}`} type="button" aria-pressed={active} onClick={onClick}>
    <span>{icon}{label}</span><strong>{countFormatter.format(value)}</strong>
  </button></article>
}

function DemandChart({ series, t }: { series: ProcurementDemandSeries; t: (value: string) => string }) {
  return <AnalyticsSeriesChart points={series.points.map((point) => ({ label: point.period, actual: point.is_forecast ? null : point.units, forecast: point.is_forecast ? point.units : null }))}
    valueLabel={t('Кількість')} formatValue={(value) => qtyFormatter.format(value)} height={240} emptyLabel={t('Даних не знайдено')} />
}

function buildUrgencySlices(charts: ProcurementCharts | null, t: (value: string) => string): UrgencySliceInput[] {
  return (charts?.urgency_mix ?? []).flatMap((bucket) => {
    const level = URGENCY_TO_LEVEL[bucket.urgency]
    return level ? [{ label: t(URGENCY_LABEL[bucket.urgency] ?? bucket.urgency), level, value: bucket.count }] : []
  })
}

function enrichDemandSeries(charts: ProcurementCharts | null): ProcurementDemandSeries[] {
  const productsById = new Map((charts?.top_items ?? []).map((item) => [item.product_id, item]))
  return (charts?.demand_series ?? []).map((series) => {
    const product = productsById.get(series.product_id)
    return { ...series, image_url: series.image_url || product?.image_url, oe_number: series.oe_number || product?.oe_number,
      product_name: series.product_name || product?.product_name, vendor_code: series.vendor_code || product?.vendor_code }
  })
}

function normalizeTopN(value: number | ''): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.min(100, Math.max(1, Math.round(value))) : 15
}

function formatSnapshotDate(value: string | null, t: (value: string) => string): string {
  if (!value) return t('Поточний стан')
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : snapshotDateFormatter.format(date)
}
