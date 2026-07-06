import {
  ActionIcon,
  Alert,
  Badge,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Tooltip,
} from '@mantine/core'
import { IconAlertCircle, IconRefresh } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getSalesGeography } from '../api/salesGeographyApi'
import { BubbleLegend } from '../components/BubbleLegend'
import { UkraineBubbleMap } from '../components/UkraineBubbleMap'
import { OBLAST_CENTROIDS } from '../data/oblastCentroids'
import type { GeographyMetric, OtherBucket, PlottedRegion, SalesRegionAggregate } from '../types'
import './sales-geography-page.css'

type SalesGeographyPeriodKey = 'all' | '12' | '24' | '36'

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

  return (
    <Stack className="sales-geography-page" gap={6}>
      <Card className="app-filter-card" withBorder radius="md" padding={0}>
        <div className="app-filter-bar sales-geography-toolbar">
          <div className="pill-tabs sales-geography-metric-tabs" role="tablist" aria-label={t('Метрика')}>
            {[
              { label: t('Продажі'), value: 'sales' },
              { label: t('Борг'), value: 'debt' },
            ].map((option) => (
              <button
                key={option.value}
                className={`pill-tab${metric === option.value ? ' is-active' : ''}`}
                role="tab"
                type="button"
                aria-selected={metric === option.value}
                onClick={() => setMetric(option.value as GeographyMetric)}
              >
                {option.label}
              </button>
            ))}
          </div>
          {metric === 'sales' ? (
            <div className="pill-tabs sales-geography-metric-tabs" role="tablist" aria-label={t('Період')}>
              {[
                { label: t('Весь час'), value: 'all' },
                { label: t('12 міс'), value: '12' },
                { label: t('24 міс'), value: '24' },
                { label: t('36 міс'), value: '36' },
              ].map((option) => (
                <button
                  key={option.value}
                  className={`pill-tab${period === option.value ? ' is-active' : ''}`}
                  role="tab"
                  type="button"
                  aria-selected={period === option.value}
                  onClick={() => setPeriod(option.value as SalesGeographyPeriodKey)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : (
            <Badge className="app-role-pill is-gray sales-geography-pill" variant="light">
              {t('Поточний стан')}
            </Badge>
          )}
          <div className="app-filter-actions sales-geography-actions">
            <Tooltip label={t('Оновити')}>
              <ActionIcon aria-label={t('Оновити')} loading={isLoading} size={34} variant="light" onClick={handleReload}>
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
          </div>
        </div>
      </Card>

      {error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {error}
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="md">
        <Card className="app-section-card sales-geography-map-card" padding="md" radius="md" withBorder>
          <Stack gap="md">
            <Group gap="xs">
              <Text className="app-section-title" fw={600} size="sm">
                {t('Карта')}
              </Text>
              <Badge className={METRIC_PILL_CLASS[metric]} variant="light">
                {metricLabel}
              </Badge>
              {metric === 'sales' && (
                <Badge className="app-role-pill is-gray sales-geography-pill" variant="light">
                  {periodLabel}
                </Badge>
              )}
            </Group>

            {isLoading && plotted.length === 0 ? (
              <GeographyMapSkeleton label={t('Завантаження карти')} />
            ) : plotted.length === 0 ? (
              <Card className="app-section-card" padding="xl" radius="md" withBorder>
                <Text c="dimmed" fw={600} ta="center">
                  {t('Немає даних для відображення')}
                </Text>
              </Card>
            ) : (
              <>
                <UkraineBubbleMap
                  formatCount={formatCount}
                  formatMoney={formatMoney}
                  metric={metric}
                  regions={plotted}
                />
                <Group justify="space-between" wrap="wrap">
                  <BubbleLegend
                    formatMoney={formatMoney}
                    maxValue={maxValue}
                    metric={metric}
                    scaleLabel={t('Масштаб (площа кола)')}
                  />
                  <Stack gap={2} ta="right">
                    <Text className="app-section-title" fw={600} size="xs">
                      {`Σ ${metricLabel}`}
                    </Text>
                    <Text className="sales-geography-total-value" fw={600} size="lg">
                      {formatMoney(totalValue)}
                    </Text>
                  </Stack>
                </Group>
              </>
            )}
          </Stack>
        </Card>

        <Card
          className="app-section-card sales-geography-rating-card"
          padding="md"
          radius="md"
          withBorder
        >
          <Stack gap="sm">
            <Group gap="xs">
              <Text className="app-section-title" fw={600} size="sm">
                {t('Рейтинг областей')}
              </Text>
              <Badge className="app-role-pill is-gray sales-geography-pill" variant="light">
                {plotted.length}
              </Badge>
            </Group>

            {plotted.length === 0 ? (
              isLoading ? (
                <GeographyRatingSkeleton label={t('Завантаження рейтингу')} />
              ) : (
                <Text c="dimmed" size="sm">
                  {t('Немає даних для відображення')}
                </Text>
              )
            ) : (
              <Table.ScrollContainer minWidth={280}>
                <Table className="sales-geography-rating-table" highlightOnHover verticalSpacing="xs">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t('Область')}</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>{metricLabel}</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>{t('Клієнти')}</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {plotted.map((region) => (
                      <Table.Tr key={region.code}>
                        <Table.Td>
                          <Group gap={6} wrap="nowrap">
                            <Badge className={METRIC_PILL_CLASS[metric]} size="sm" variant="light">
                              {region.code}
                            </Badge>
                            <Text size="sm">{region.name}</Text>
                          </Group>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <span className="sales-geography-money">{formatMoney(region.valueEur)}</span>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <span className="sales-geography-count">{countFormatter.format(region.clientCount)}</span>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}

            {other.count > 0 && (
              <Text className="sales-geography-other" size="xs">
                {`${t('Інше')}: ${other.count} ${t('кодів')} · ${formatMoney(other.valueEur)} · ${countFormatter.format(other.clientCount)} ${t('клієнтів')}`}
              </Text>
            )}
          </Stack>
        </Card>
      </SimpleGrid>
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

function GeographyMapSkeleton({ label }: { label: string }) {
  return (
    <div className="sales-geography-map-skeleton" aria-busy="true" aria-label={label}>
      <span className="sales-geography-map-skeleton-circle is-lg" />
      <span className="sales-geography-map-skeleton-circle is-md" />
      <span className="sales-geography-map-skeleton-circle is-sm" />
      <span className="sales-geography-skeleton-line" />
      <span className="sales-geography-skeleton-line is-short" />
    </div>
  )
}

function GeographyRatingSkeleton({ label }: { label: string }) {
  return (
    <div className="sales-geography-rating-skeleton" aria-busy="true" aria-label={label}>
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="sales-geography-rating-skeleton-row">
          <span className="sales-geography-skeleton-line is-code" />
          <span className="sales-geography-skeleton-line" />
          <span className="sales-geography-skeleton-line is-number" />
        </div>
      ))}
    </div>
  )
}
