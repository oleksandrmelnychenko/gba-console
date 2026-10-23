import { Alert, Badge, Button, Card, Group, SegmentedControl, Stack, Text, Tooltip } from '@mantine/core'
import { CircleAlert, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { ChartLoading } from '../../../shared/ui/charts/ChartState'
import { getSalesGeography } from '../api/salesGeographyApi'
import { BubbleLegend } from '../components/BubbleLegend'
import { GeographyAmount } from '../components/GeographyAmount'
import { GeographyContext } from '../components/GeographyContext'
import { UkraineBubbleMap } from '../components/UkraineBubbleMap'
import { splitGeographyRegions, formatGeographyMoney } from '../data/salesGeographyPresentation'
import type { GeographyMetric, GeographyRegion, SalesGeographySummary } from '../types'
import './sales-geography-page.css'

type SalesGeographyPeriodKey = 'all' | '12' | '24' | '36'
const RATING_TABLE_DEFAULT_LAYOUT = { density: 'compact' } satisfies DataTableDefaultLayout
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
  const [summary, setSummary] = useState<SalesGeographySummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setLoading] = useState(true)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    async function load() {
      setLoading(true)
      try {
        const result = await getSalesGeography(
          { metric, ...(metric === 'sales' ? getPeriodParams(period) : {}) },
          controller.signal,
        )
        if (active) {
          setSummary(result)
          setError(null)
        }
      } catch (loadError) {
        if (active) {
          setSummary(null)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити карту'))
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
      controller.abort()
    }
  }, [metric, period, reloadKey, t])

  const { regions, plotted, other } = useMemo(() => splitGeographyRegions(summary?.Rows ?? []), [summary])
  const maxValue = useMemo(() => plotted.reduce((max, row) => Math.max(max, Math.abs(row.valueEur ?? 0)), 0), [plotted])
  const formatCount = useCallback((count: number) => `${countFormatter.format(count)} ${t('клієнтів')}`, [t])
  const metricLabel = metric === 'sales' ? t('Продажі мінус повернення') : t('Поточний борг')
  const periodLabel = period === 'all' ? t('Уся наявна історія') : `${period} ${t('міс')}`
  const ready = !isLoading && !error && summary !== null
  const ratingColumns = useMemo<DataTableColumn<GeographyRegion>[]>(
    () => [
      {
        id: 'region',
        header: t('Регіон'),
        accessor: (row) => row.name,
        cell: (row) => (
          <Group gap={6} wrap="nowrap">
            <span className="sales-geography-region-code">{row.code === 'unassigned' ? '—' : row.code}</span>
            <Text fw={600} size="sm" title={t(row.name)} truncate>
              {t(row.name)}
            </Text>
          </Group>
        ),
        minWidth: 180,
        fill: true,
      },
      {
        id: 'value',
        header: metricLabel,
        accessor: (row) => row.valueEur,
        cell: (row) => <GeographyAmount value={row.valueEur} known={row.knownValueEur} />,
        align: 'right',
        width: 170,
        minWidth: 150,
      },
      {
        id: 'clients',
        header: t('Клієнти'),
        accessor: (row) => row.clientCount,
        cell: (row) => <span className="sales-geography-count">{countFormatter.format(row.clientCount)}</span>,
        align: 'right',
        width: 100,
        minWidth: 90,
      },
    ],
    [metricLabel, t],
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
                  { label: t('Уся наявна історія'), value: 'all' },
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
              <Button
                aria-label={t('Оновити')}
                color="gray"
                loading={isLoading}
                variant="default"
                onClick={reload}
                className="sales-geography-toolbar-caption-action"
                title={t('Оновити')}
                leftSection={<RefreshCw size={18} />}
              >
                {t('Оновити')}
              </Button>
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
        {ready && <GeographyContext summary={summary} />}
        <Card className="app-section-card sales-geography-summary" component="dl" padding={0} radius="md" withBorder>
          <div className="sales-geography-metric">
            <dt>{metric === 'sales' ? t('Продажі мінус повернення') : t('Увесь поточний борг')}</dt>
            <dd>{ready && <GeographyAmount value={summary.TotalEur} known={summary.KnownTotalEur} />}</dd>
          </div>
          <div className="sales-geography-metric">
            <dt>{t('Клієнти')}</dt>
            <dd>{ready && countFormatter.format(summary.ClientCount)}</dd>
          </div>
          <div className="sales-geography-metric">
            <dt>{t('Регіони на карті')}</dt>
            <dd>{ready && plotted.length}</dd>
          </div>
          <div className="sales-geography-metric">
            <dt>{t('Поза картою')}</dt>
            <dd>{ready && <GeographyAmount value={other.valueEur} known={other.knownValueEur} />}</dd>
          </div>
        </Card>
        <div className="sales-geography-workspace">
          <Card className="app-section-card sales-geography-map-card" padding={0} radius="md" withBorder>
            <div className="sales-geography-section-heading">
              <Text className="app-section-title" component="h2" fw={600} size="sm">
                {t('Карта України')}
              </Text>
              <Badge className={METRIC_PILL_CLASS[metric]} variant="light">
                {metricLabel}
              </Badge>
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
                  formatMoney={formatGeographyMoney}
                  metric={metric}
                  regions={plotted}
                />
              )}
            </div>
            {ready && maxValue > 0 && (
              <BubbleLegend
                formatMoney={formatGeographyMoney}
                maxValue={maxValue}
                metric={metric}
                scaleLabel={t('Площа кола — модуль відомої суми')}
              />
            )}
            {ready && plotted.length > 0 && (
              <Text className="sales-geography-map-note" size="xs">
                {t('Червоне коло — від’ємний результат. Порожнє пунктирне коло — сума не визначена.')}
              </Text>
            )}
          </Card>
          <Card className="app-section-card sales-geography-rating-card" padding={0} radius="md" withBorder>
            <div className="sales-geography-section-heading">
              <Text className="app-section-title" component="h2" fw={600} size="sm">
                {t('Усі регіони')}
              </Text>
              <Badge className="app-role-pill is-gray sales-geography-pill" variant="light">
                {ready ? regions.length : ''}
              </Badge>
            </div>
            <div className="sales-geography-rating-body">
              <DataTable
                columns={ratingColumns}
                data={regions}
                defaultLayout={RATING_TABLE_DEFAULT_LAYOUT}
                emptyText={t('Немає даних для відображення')}
                getRowId={(row) => row.code}
                height="100%"
                isLoading={isLoading}
                minWidth={450}
                showLayoutControls
                tableId="sales-geography-rating"
                toolbarPortalTarget={tableToolbarSlot}
              />
            </div>
            {ready && other.count > 0 && (
              <Text className="sales-geography-other" size="xs">
                {t('Поза картою')}: <GeographyAmount value={other.valueEur} known={other.knownValueEur} />
                {` · ${countFormatter.format(other.clientCount)} ${t('клієнтів')} · ${t('Кодів')}: ${other.count}`}
              </Text>
            )}
          </Card>
        </div>
      </div>
    </Stack>
  )
}

function getPeriodParams(period: SalesGeographyPeriodKey): { period: 'all' } | { months: number } {
  return period === 'all' ? { period: 'all' } : { months: Number(period) }
}
