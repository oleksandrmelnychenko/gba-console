import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core'
import { CircleAlert, FilterX, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useReducer, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AiFeatureBadge } from '../../../shared/ai/AiFeatureBadge'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import { AgingBars } from '../../../shared/ui/charts/AgingBars'
import { ForecastLine } from '../../../shared/ui/charts/ForecastLine'
import { UrgencyDonut } from '../../../shared/ui/charts/UrgencyDonut'
import type { UrgencyLevel } from '../../../shared/ui/charts/chartTheme'
import type { UrgencySliceInput } from '../../../shared/ui/charts/donutData'
import type { ForecastPoint } from '../../../shared/ui/charts/forecastData'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { getSupplyOrderSuppliers } from '../../supply-ukraine-orders/api/supplyUkraineOrdersApi'
import type { Client } from '../../supply-ukraine-orders/types'
import { getProcurementCharts } from '../api/procurementApi'
import { summarizeProcurementCharts } from '../procureDashboardModel'
import type {
  ProcurementCharts,
  ProcurementDemandSeries,
  ProcurementTopItem,
} from '../procurementTypes'
import { ProcurementProductCell } from './ProcurementProductCell'
import { ProcurementWorkspaceState } from './ProcurementWorkspaceState'

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

const qtyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
})

const countFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 0,
})

export function ProcureDashboardTab() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [state, dispatch] = useReducer(dashboardReducer, initialState)
  const [producers, setProducers] = useState<Client[]>([])
  const [producerId, setProducerId] = useState<string | null>(null)
  const [topN, setTopN] = useState<number | ''>(15)
  const [appliedProducerId, setAppliedProducerId] = useState<number | null>(null)
  const [appliedTopN, setAppliedTopN] = useState<number>(15)
  const [tableToolbarTarget, setTableToolbarTarget] = useState<HTMLDivElement | null>(null)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const { charts, error, isLoading } = state

  useEffect(() => {
    let cancelled = false

    getSupplyOrderSuppliers()
      .then((loaded) => {
        if (!cancelled) {
          setProducers(loaded)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProducers([])
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
        const loaded = await getProcurementCharts(
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
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити дашборд'),
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
    setAppliedProducerId(producerId ? Number(producerId) : null)
    setAppliedTopN(normalizeTopN(topN))
    reload()
  }

  function resetFilters() {
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
  const selectedProducerName =
    producerOptions.find((option) => Number(option.value) === appliedProducerId)?.label
  const activeScopeLabel =
    typeof appliedProducerId === 'number'
      ? selectedProducerName || `${t('Виробник')} ${appliedProducerId}`
      : t('Весь кошик')
  const snapshotLabel = formatSnapshotDate(charts?.as_of_date ?? null, t)
  const hasUrgencyData = urgencyData.some((slice) => slice.value > 0)
  const hasDaysOfCoverData = (charts?.days_of_cover_hist ?? []).some(
    (bucket) => bucket.count > 0,
  )
  const hasForecastData = (charts?.demand_series.length ?? 0) > 0
  const hasTopItems = (charts?.top_items.length ?? 0) > 0
  const hasUsefulData =
    hasUrgencyData || hasDaysOfCoverData || hasForecastData || hasTopItems
  const hasProducerData = (charts?.top_items ?? []).some(
    (item) => item.producer_name || typeof item.producer_id === 'number',
  )

  const topItemColumns = useMemo<Array<DataTableColumn<ProcurementTopItem>>>(
    () => {
      const columns: Array<DataTableColumn<ProcurementTopItem>> = [
        {
          id: 'product',
          header: t('Товар'),
          accessor: (item) => item.product_name || item.vendor_code || item.product_id,
          cell: (item) => <ProcurementProductCell row={item} t={t} />,
          width: 320,
          fill: true,
        },
      ]

      if (hasProducerData) {
        columns.push({
          id: 'producer',
          header: t('Виробник'),
          accessor: (item) => item.producer_name || item.producer_id || '',
          cell: (item) => (
            <div className="procure-table-entity-cell">
              <span className="procure-table-entity-cell__primary">
                {item.producer_name || item.producer_id || ''}
              </span>
              {item.producer_name && typeof item.producer_id === 'number' ? (
                <span className="procure-table-entity-cell__meta">
                  <span>{t('ID')}</span>
                  <strong>{item.producer_id}</strong>
                </span>
              ) : null}
            </div>
          ),
          width: 190,
        })
      }

      columns.push(
        {
          id: 'urgency',
          header: t('Терміновість'),
          accessor: (item) => item.urgency,
          cell: (item) => (
            <Badge className={urgencyPillClass(item.urgency)} size="sm" variant="light">
              {t(URGENCY_LABEL[item.urgency] ?? item.urgency)}
            </Badge>
          ),
          width: 150,
        },
        {
          id: 'suggested',
          header: t('Рекомендовано'),
          accessor: (item) => item.suggested_qty,
          cell: (item) => (
            <span className="procure-dashboard__table-number">
              {qtyFormatter.format(item.suggested_qty)}
            </span>
          ),
          width: 150,
          align: 'right',
        },
        {
          id: 'onHand',
          header: t('В наявності'),
          accessor: (item) => item.on_hand,
          cell: (item) => (
            <span className="procure-dashboard__table-number">
              {qtyFormatter.format(item.on_hand)}
            </span>
          ),
          width: 140,
          align: 'right',
        },
        {
          id: 'reorderPoint',
          header: t('Точка замовлення'),
          accessor: (item) => item.reorder_point,
          cell: (item) => (
            <span className="procure-dashboard__table-number">
              {qtyFormatter.format(item.reorder_point)}
            </span>
          ),
          width: 160,
          align: 'right',
        },
        {
          id: 'shortage',
          header: t('Бракує до точки'),
          accessor: (item) => Math.max(0, item.reorder_point - item.on_hand),
          cell: (item) => (
            <span className="procure-dashboard__table-number">
              {qtyFormatter.format(Math.max(0, item.reorder_point - item.on_hand))}
            </span>
          ),
          width: 130,
          align: 'right',
        },
      )

      return columns
    },
    [hasProducerData, t],
  )

  return (
    <Stack className="procure-dashboard" gap={6}>
      <Card
        className="app-data-card basket-supply-primary-card procure-dashboard__shell"
        padding={0}
        radius="md"
        withBorder
      >
        <form
          className="app-filter-bar basket-supply-command-bar procure-dashboard__toolbar"
          onSubmit={(event) => {
            event.preventDefault()
            applyFilters()
          }}
        >
          <Select
            clearable
            data={producerOptions}
            label={t('Виробник')}
            placeholder={t('Весь кошик')}
            searchable
            value={producerId}
            w={280}
            onChange={setProducerId}
          />
          <NumberInput
            allowDecimal={false}
            allowNegative={false}
            label={t('Топ позицій')}
            min={1}
            onChange={(value) => setTopN(typeof value === 'number' ? value : '')}
            value={topN}
            w={140}
          />
          <div className="app-filter-actions">
            <Tooltip label={t('Скинути фільтри')}>
              <ActionIcon
                aria-label={t('Скинути фільтри')}
                disabled={!hasAppliedFilters && !hasDraftFilterChanges}
                onClick={resetFilters}
                size={34}
                type="button"
                variant="default"
              >
                <FilterX size={17} />
              </ActionIcon>
            </Tooltip>
            <div
              className="app-filter-table-toolbar-slot"
              ref={setTableToolbarTarget}
            />
            <Button
              color={CREATE_ACTION_COLOR}
              leftSection={<RefreshCw size={16} />}
              loading={isLoading}
              type="submit"
            >
              {hasDraftFilterChanges ? t('Застосувати') : t('Оновити')}
            </Button>
          </div>
        </form>

        <Stack className="procure-dashboard__content" gap={6}>
          <section
            aria-labelledby="procure-dashboard-title"
            className="procure-dashboard__intro"
          >
            <div className="procure-dashboard__intro-copy">
              <Group gap="xs" wrap="nowrap">
                <Text
                  className="app-section-title"
                  fw={600}
                  id="procure-dashboard-title"
                  size="sm"
                >
                  {t('Дашборд постачання')}
                </Text>
                <AiFeatureBadge tooltip={t('AI-сервіс закупівель')} />
              </Group>
              <Text className="procure-dashboard__description">
                {t(
                  'Оперативний зріз потреби: від критичних залишків до кількості, яку варто замовити.',
                )}
              </Text>
            </div>
            <div className="procure-dashboard__snapshot">
              <span>{t('Зріз даних')}</span>
              <strong>{snapshotLabel}</strong>
              <small>{activeScopeLabel}</small>
            </div>
          </section>

          {error && (
            <Alert color="red" icon={<CircleAlert size={16} />} variant="light">
              {error}
            </Alert>
          )}

          <Card className="app-section-card procure-dashboard__summary" padding="md" radius="md" withBorder>
            <div className="procure-dashboard__metrics">
              <DashboardMetric
                hint={t('у вибраному зрізі')}
                isLoading={isLoading && !charts}
                label={t('Всього позицій')}
                value={countFormatter.format(summary.totalPositions)}
              />
              <DashboardMetric
                hint={formatUkrainianCount(
                  summary.criticalPositions,
                  [t('критична позиція'), t('критичні позиції'), t('критичних позицій')],
                )}
                isLoading={isLoading && !charts}
                label={t('Потребують уваги')}
                tone="danger"
                value={countFormatter.format(summary.attentionPositions)}
              />
              <DashboardMetric
                hint={formatUkrainianCount(
                  summary.topItems,
                  [t('пріоритетна позиція'), t('пріоритетні позиції'), t('пріоритетних позицій')],
                )}
                isLoading={isLoading && !charts}
                label={t('Рекомендовано замовити')}
                tone="brand"
                value={qtyFormatter.format(summary.totalSuggested)}
              />
              <DashboardMetric
                hint={t('товарів із часовим рядом')}
                isLoading={isLoading && !charts}
                label={t('Прогнозів попиту')}
                tone="model"
                value={countFormatter.format(summary.forecastProducts)}
              />
            </div>
          </Card>

          {isLoading && !charts ? (
            <ProcurementWorkspaceState
              description={t('Збираємо залишки, прогноз попиту та рекомендації до замовлення.')}
              isLoading
              surface
              title={t('Готуємо оперативний зріз')}
            />
          ) : null}

          {!isLoading && !hasUsefulData && !error ? (
            <ProcurementWorkspaceState
              action={
                hasAppliedFilters
                  ? {
                      label: t('Показати весь кошик'),
                      onClick: resetFilters,
                    }
                  : {
                      label: t('Відкрити конструктор закупівель'),
                      onClick: () => navigate('/basket-supply-ukraine-order/cockpit'),
                    }
              }
              description={
                hasAppliedFilters
                  ? t('Для вибраного виробника немає дефіцитів або прогнозних позицій. Скиньте фільтр, щоб повернутися до загального зрізу.')
                  : t('У загальному зрізі немає дефіцитів або прогнозних позицій. Поточний запас покриває розраховану потребу.')
              }
              facts={[
                { label: t('Зріз'), value: snapshotLabel },
                { label: t('Область'), value: activeScopeLabel },
              ]}
              surface
              title={t('Даних для аналізу поки немає')}
            />
          ) : null}

          {hasUsefulData && (hasUrgencyData || hasDaysOfCoverData) ? (
            <SimpleGrid
              className="procure-dashboard__chart-grid"
              cols={{ base: 1, md: hasUrgencyData && hasDaysOfCoverData ? 2 : 1 }}
              spacing={6}
            >
              {hasUrgencyData ? (
                <Card
                  className="app-section-card procure-dashboard__panel"
                  padding="md"
                  radius="md"
                  withBorder
                >
                  <Stack gap={10}>
                    <DashboardPanelHeader
                      subtitle={t('Швидко показує, де замовлення не можна відкладати.')}
                      title={t('Терміновість поповнення')}
                    />
                    <div className="procure-dashboard__urgency-layout">
                      <UrgencyDonut
                        chartLabel={
                          charts
                            ? countFormatter.format(sumCount(urgencyData))
                            : undefined
                        }
                        data={urgencyData}
                        emptyLabel={t('Даних не знайдено')}
                        isLoading={isLoading}
                        loadingLabel={t('Завантаження…')}
                        size={176}
                        thickness={26}
                        valueFormatter={(value) => countFormatter.format(value)}
                      />
                      <div
                        aria-label={t('Розподіл за терміновістю')}
                        className="procure-dashboard__urgency-legend"
                      >
                        {urgencyData.map((slice) => (
                          <div
                            className="procure-dashboard__urgency-row"
                            key={slice.level}
                          >
                            <span
                              aria-hidden="true"
                              className={`procure-dashboard__urgency-dot is-${slice.level}`}
                            />
                            <span>{slice.label}</span>
                            <strong>{countFormatter.format(slice.value)}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Stack>
                </Card>
              ) : null}

              {hasDaysOfCoverData ? (
                <Card
                  className="app-section-card procure-dashboard__panel"
                  padding="md"
                  radius="md"
                  withBorder
                >
                  <Stack gap={10}>
                    <DashboardPanelHeader
                      subtitle={t('Розподіл позицій за прогнозованим запасом у днях.')}
                      title={t('Запас днів покриття')}
                    />
                    <AgingBars
                      bucketKey="bucket"
                      data={daysOfCoverData}
                      emptyLabel={t('Даних не знайдено')}
                      isLoading={isLoading}
                      loadingLabel={t('Завантаження…')}
                      series={[{ name: t('Позицій'), color: 'orange.6' }]}
                      valueFormatter={(value) => countFormatter.format(value)}
                    />
                  </Stack>
                </Card>
              ) : null}
            </SimpleGrid>
          ) : null}

          {hasForecastData ? (
            <Card
              className="app-section-card procure-dashboard__panel"
              padding="md"
              radius="md"
              withBorder
            >
              <Stack gap={10}>
                <Group align="flex-start" justify="space-between" wrap="wrap">
                  <DashboardPanelHeader
                    subtitle={t('Факт і модель попиту для позицій у фокусі.')}
                    title={t('Прогноз попиту')}
                  />
                  <Badge className="app-role-pill is-gray" variant="light">
                    {formatUkrainianCount(
                      summary.forecastProducts,
                      [t('товар'), t('товари'), t('товарів')],
                    )}
                  </Badge>
                </Group>
                {isLoading && (
                  <ForecastLine
                    actualLabel=""
                    data={[]}
                    emptyLabel=""
                    forecastLabel=""
                    isLoading
                  />
                )}
                {!isLoading &&
                  (charts?.demand_series ?? []).map((series) => (
                  <article
                    className="procure-dashboard__forecast-series"
                    key={series.product_id}
                  >
                    <div className="procure-dashboard__forecast-head">
                      <ProcurementProductCell row={series} t={t} />
                    </div>
                      <ForecastLine
                        actualColor="gray.6"
                        actualLabel={t('Факт')}
                        data={buildForecastPoints(series)}
                        emptyLabel={t('Даних не знайдено')}
                        forecastColor="orange.6"
                        forecastLabel={t('Прогноз')}
                        height={210}
                        valueFormatter={(value) => qtyFormatter.format(value)}
                        withLegend
                      />
                    </article>
                  ))}
              </Stack>
            </Card>
          ) : null}

          {hasTopItems ? (
            <Card
              className="app-section-card procure-dashboard__panel"
              padding="md"
              radius="md"
              withBorder
            >
              <Stack gap={10}>
                <Group align="flex-start" justify="space-between" wrap="wrap">
                  <DashboardPanelHeader
                    subtitle={t('Позиції, які першими мають перейти в план закупівлі.')}
                    title={t('Пріоритетні позиції')}
                  />
                  <Badge className="app-role-pill is-orange" variant="light">
                    {formatUkrainianCount(
                      summary.topItems,
                      [t('позиція'), t('позиції'), t('позицій')],
                    )}
                  </Badge>
                </Group>
                <DataTable
                columns={topItemColumns}
                data={charts?.top_items ?? []}
                defaultLayout={{
                  columnPinning: { left: ['product'] },
                  density: 'compact',
                }}
                  distributeAvailableWidth
                  emptyText={t('Даних не знайдено')}
                  getRowId={(item) => String(item.product_id)}
                  isLoading={isLoading}
                layoutVersion={4}
                maxHeight={520}
                minWidth={hasProducerData ? 1180 : 980}
                  showLayoutControls
                  tableId="basket-supply-ukraine-order-procure-top-items"
                  toolbarPortalTarget={tableToolbarTarget}
                />
              </Stack>
            </Card>
          ) : null}
        </Stack>
      </Card>
    </Stack>
  )
}

type DashboardMetricProps = {
  hint: string
  isLoading: boolean
  label: string
  tone?: 'brand' | 'danger' | 'model'
  value: string
}

function DashboardMetric({
  hint,
  isLoading,
  label,
  tone,
  value,
}: DashboardMetricProps) {
  return (
    <article
      className={`procure-dashboard__metric${tone ? ` is-${tone}` : ''}`}
    >
      <span className="procure-dashboard__metric-label">{label}</span>
      <strong className="procure-dashboard__metric-value">
        {isLoading ? '—' : value}
      </strong>
      <span className="procure-dashboard__metric-hint">{hint}</span>
    </article>
  )
}

function DashboardPanelHeader({
  subtitle,
  title,
}: {
  subtitle: string
  title: string
}) {
  return (
    <div className="procure-dashboard__panel-heading">
      <Text className="app-section-title" fw={600} size="sm">
        {title}
      </Text>
      <Text c="dimmed" size="xs">
        {subtitle}
      </Text>
    </div>
  )
}

function buildUrgencySlices(
  charts: ProcurementCharts | null,
  t: (value: string) => string,
): UrgencySliceInput[] {
  if (!charts) {
    return []
  }

  return charts.urgency_mix
    .map((bucket) => {
      const level = URGENCY_TO_LEVEL[bucket.urgency]

      if (!level) {
        return null
      }

      return {
        label: t(URGENCY_LABEL[bucket.urgency] ?? bucket.urgency),
        level,
        value: bucket.count,
      }
    })
    .filter((slice): slice is UrgencySliceInput => slice !== null)
}

function buildForecastPoints(series: ProcurementDemandSeries): ForecastPoint[] {
  return series.points.map((point) => ({
    forecast: point.is_forecast,
    period: point.period,
    value: point.units,
  }))
}

function sumCount(slices: UrgencySliceInput[]): number {
  return slices.reduce((sum, slice) => sum + slice.value, 0)
}

function normalizeTopN(value: number | ''): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return 15
  }

  return Math.max(1, Math.round(value))
}

function formatSnapshotDate(
  value: string | null,
  t: (value: string) => string,
): string {
  if (!value) {
    return t('Поточний стан')
  }

  const date = new Date(`${value}T00:00:00`)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function formatUkrainianCount(
  value: number,
  forms: readonly [one: string, few: string, many: string],
): string {
  const absoluteValue = Math.abs(Math.trunc(value))
  const mod100 = absoluteValue % 100
  const mod10 = absoluteValue % 10
  const form =
    mod100 >= 11 && mod100 <= 14
      ? forms[2]
      : mod10 === 1
        ? forms[0]
        : mod10 >= 2 && mod10 <= 4
          ? forms[1]
          : forms[2]

  return `${countFormatter.format(value)} ${form}`
}

function urgencyPillClass(urgency: string): string {
  const level = URGENCY_TO_LEVEL[urgency]

  if (level === 'critical') {
    return 'app-role-pill is-red'
  }

  if (level === 'high') {
    return 'app-role-pill is-orange'
  }

  if (level === 'normal') {
    return 'app-role-pill is-yellow'
  }

  return 'app-role-pill is-gray'
}
