import {
  ActionIcon,
  Alert,
  Badge,
  Card,
  Group,
  SegmentedControl,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core'
import { CircleAlert, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { ChartLoading } from '../../../shared/ui/charts/ChartState'
import { getSalesGeography } from '../api/salesGeographyApi'
import { BubbleLegend } from '../components/BubbleLegend'
import { UkraineBubbleMap } from '../components/UkraineBubbleMap'
import { OBLAST_CENTROIDS } from '../data/oblastCentroids'
import type { GeographyMetric, OtherBucket, PlottedRegion, SalesRegionAggregate } from '../types'
import './sales-geography-page.css'

type SalesGeographyPeriodKey = 'all' | '12' | '24' | '36'

const RATING_TABLE_DEFAULT_LAYOUT = { density: 'compact' } satisfies DataTableDefaultLayout

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 0,
})

const countFormatter = new Intl.NumberFormat('uk-UA')

const METRIC_PILL_CLASS: Record<GeographyMetric, string> = {
  sales: 'app-role-pill is-green sales-geography-pill',
  debt: 'app-role-pill is-orange sales-geography-pill',
}

export function SalesGeographyPage() {
  const { t } = useI18n()
  const [metric, setMetric] = useState<GeographyMetric>('sales')
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)
  const [period, setPeriod] = useState<SalesGeographyPeriodKey>('all')
  const [aggregates, setAggregates] = useValueState<SalesRegionAggregate[]>([])
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useState(true)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)

  useEffect(() => {
    let active = true

    async function load() {
      if (active) {
        setLoading(true)
      }

      try {
        const result = await getSalesGeography({
          metric,
          ...(metric === 'sales' ? getPeriodParams(period) : {}),
        })

        if (active) {
          setAggregates(result)
          setError(null)
        }
      } catch (loadError) {
        if (!active) {
          return
        }

        setAggregates([])
        setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити карту'))
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [metric, period, reloadKey, setAggregates, setError, t])

  const { plotted, other } = useMemo(() => splitAggregates(aggregates), [aggregates])

  const totalValue = useMemo(
    () => plotted.reduce((sum, region) => sum + region.valueEur, 0) + other.valueEur,
    [plotted, other.valueEur],
  )
  const totalClients = useMemo(() => aggregates.reduce((sum, row) => sum + row.ClientCount, 0), [aggregates])
  const maxValue = useMemo(() => plotted.reduce((max, region) => Math.max(max, region.valueEur), 0), [plotted])

  const formatMoney = useCallback((value: number) => `€${moneyFormatter.format(value)}`, [])
  const formatCount = useCallback(
    (count: number) => `${countFormatter.format(count)} ${t('клієнтів')}`,
    [t],
  )

  const handleReload = useCallback(() => {
    reload()
  }, [])

  const metricLabel = metric === 'sales' ? t('Продажі') : t('Борг')
  const periodLabel =
    period === 'all'
      ? t('Весь час')
      : `${period} ${t('міс')}`
  const ratingColumns = useMemo<DataTableColumn<PlottedRegion>[]>(
    () => [
      {
        id: 'region',
        header: t('Область'),
        accessor: (region) => region.name,
        cell: (region) => (
          <Group gap={6} wrap="nowrap">
            <span className="sales-geography-region-code">{region.code}</span>
            <Text fw={600} size="sm" title={region.name} truncate>{region.name}</Text>
          </Group>
        ),
        minWidth: 180,
        fill: true,
      },
      {
        id: 'value',
        header: metricLabel,
        accessor: (region) => region.valueEur,
        cell: (region) => (
          <span className="app-money">{formatMoney(region.valueEur)}</span>
        ),
        align: 'right',
        width: 130,
      },
      {
        id: 'clients',
        header: t('Клієнти'),
        accessor: (region) => region.clientCount,
        cell: (region) => (
          <span className="sales-geography-count">
            {countFormatter.format(region.clientCount)}
          </span>
        ),
        align: 'right',
        minWidth: 112,
        width: 112,
      },
    ],
    [formatMoney, metricLabel, t],
  )

  return (
    <Stack className="sales-geography-page" gap={6}>
      <Card className="app-filter-card sales-geography-filter-card" withBorder radius="md" padding={0}>
        <div className="app-filter-bar sales-geography-toolbar">
          <div className="app-filter-field sales-geography-filter-field">
            <span className="app-filter-label">{t('Метрика')}</span>
            <SegmentedControl
              aria-label={t('Метрика')}
              data={[
                { label: t('Продажі'), value: 'sales' },
                { label: t('Борг'), value: 'debt' },
              ]}
              value={metric}
              onChange={(value) => setMetric(value as GeographyMetric)}
            />
          </div>
          <div className="app-filter-field sales-geography-filter-field">
            <span className="app-filter-label">{t('Період')}</span>
            {metric === 'sales' ? (
              <SegmentedControl
                aria-label={t('Період')}
                data={[
                  { label: t('Весь час'), value: 'all' },
                  { label: t('12 міс'), value: '12' },
                  { label: t('24 міс'), value: '24' },
                  { label: t('36 міс'), value: '36' },
                ]}
                value={period}
                onChange={(value) => setPeriod(value as SalesGeographyPeriodKey)}
              />
            ) : (
              <div className="sales-geography-current-period">
                <Text size="xs">{t('Поточний стан')}</Text>
              </div>
            )}
          </div>
          <div className="app-filter-actions sales-geography-actions">
            <Tooltip label={t('Оновити')}>
              <ActionIcon
                aria-label={t('Оновити')}
                color="gray"
                loading={isLoading}
                size={34}
                variant="light"
                onClick={handleReload}
              >
                <RefreshCw size={18} />
              </ActionIcon>
            </Tooltip>
          </div>
          <div ref={setTableToolbarSlot} className="app-filter-table-toolbar-slot" />
        </div>
      </Card>

      <div className="sales-geography-content">
        {error && (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <Card className="app-section-card sales-geography-summary" component="dl" padding={0} radius="md" withBorder>
          <div className="sales-geography-metric">
            <dt>{metric === 'sales' ? t('Продажі за період') : t('Поточний борг')}</dt>
            <dd className="app-money">{isLoading || error ? '' : formatMoney(totalValue)}</dd>
          </div>
          <div className="sales-geography-metric">
            <dt>{t('Клієнти')}</dt>
            <dd>{isLoading || error ? '' : countFormatter.format(totalClients)}</dd>
          </div>
          <div className="sales-geography-metric">
            <dt>{t('Регіони на карті')}</dt>
            <dd>{isLoading || error ? '' : plotted.length}</dd>
          </div>
          <div className="sales-geography-metric">
            <dt>{t('Поза картою')}</dt>
            <dd className="app-money">{isLoading || error ? '' : formatMoney(other.valueEur)}</dd>
          </div>
        </Card>

        <div className="sales-geography-workspace">
          <Card className="app-section-card sales-geography-map-card" padding={0} radius="md" withBorder>
            <div className="sales-geography-section-heading">
              <Text className="app-section-title" component="h2" fw={600} size="sm">
                {t('Карта України')}
              </Text>
              <Badge className={METRIC_PILL_CLASS[metric]} variant="light">{metricLabel}</Badge>
              <Badge className="app-role-pill is-gray sales-geography-pill" variant="light">
                {metric === 'sales' ? periodLabel : t('Поточний стан')}
              </Badge>
            </div>
            <div className="sales-geography-map-stage">
              {isLoading ? (
                <div className="sales-geography-map-state" role="status">
                  <ChartLoading height={280} label={t('Завантаження карти')} />
                </div>
              ) : plotted.length === 0 ? (
                <div className="sales-geography-map-state" role="status">
                  <Text size="sm">{t('Немає даних для відображення')}</Text>
                </div>
              ) : (
                <UkraineBubbleMap
                  formatCount={formatCount}
                  formatMoney={formatMoney}
                  metric={metric}
                  regions={plotted}
                />
              )}
            </div>
            {!isLoading && plotted.length > 0 && (
              <BubbleLegend
                formatMoney={formatMoney}
                maxValue={maxValue}
                metric={metric}
                scaleLabel={t('Масштаб (площа кола)')}
              />
            )}
          </Card>

          <Card className="app-section-card sales-geography-rating-card" padding={0} radius="md" withBorder>
            <div className="sales-geography-section-heading">
              <Text className="app-section-title" component="h2" fw={600} size="sm">
                {t('Рейтинг областей')}
              </Text>
              <Badge className="app-role-pill is-gray sales-geography-pill" variant="light">
                {plotted.length}
              </Badge>
            </div>
            <div className="sales-geography-rating-body">
              <DataTable
                columns={ratingColumns}
                data={plotted}
                defaultLayout={RATING_TABLE_DEFAULT_LAYOUT}
                emptyText={t('Немає даних для відображення')}
                getRowId={(region) => region.code}
                height="100%"
                isLoading={isLoading}
                minWidth={422}
                showLayoutControls
                tableId="sales-geography-rating"
                toolbarPortalTarget={tableToolbarSlot}
              />
            </div>
            {other.count > 0 && !isLoading && (
              <Text className="sales-geography-other" size="xs">
                {t('Поза картою')}: <span className="app-money">{formatMoney(other.valueEur)}</span>
                { ` · ${countFormatter.format(other.clientCount)} ${t('клієнтів')} · ${t('Кодів')}: ${other.count}`}
              </Text>
            )}
          </Card>
        </div>
      </div>
    </Stack>
  )
}

function getPeriodParams(period: SalesGeographyPeriodKey): { period: 'all' } | { months: number } {
  if (period === 'all') {
    return { period: 'all' }
  }

  return { months: Number(period) }
}

// Join aggregates to the centroid table. Known oblast codes become plotted bubbles
// (preserving the ValueEur-desc order from the backend); everything else (foreign /
// occupied noise) collapses into a single «Інше» bucket.
function splitAggregates(aggregates: SalesRegionAggregate[]): { plotted: PlottedRegion[]; other: OtherBucket } {
  const plotted: PlottedRegion[] = []
  const other: OtherBucket = { count: 0, valueEur: 0, clientCount: 0 }

  for (const row of aggregates) {
    const centroid = OBLAST_CENTROIDS[row.RegionCode]

    if (centroid) {
      plotted.push({
        code: row.RegionCode,
        name: centroid.name,
        lat: centroid.lat,
        lng: centroid.lng,
        valueEur: row.ValueEur,
        clientCount: row.ClientCount,
      })
    } else {
      other.count += 1
      other.valueEur += row.ValueEur
      other.clientCount += row.ClientCount
    }
  }

  return { plotted, other }
}
