import {
  ActionIcon,
  Alert,
  Badge,
  Card,
  Group,
  Loader,
  SegmentedControl,
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

const TRAILING_MONTHS = 12

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 0,
})

const countFormatter = new Intl.NumberFormat('uk-UA')

const METRIC_BADGE_COLOR: Record<GeographyMetric, string> = {
  sales: 'teal',
  debt: 'orange',
}

const METRIC_PILL_CLASS: Record<GeographyMetric, string> = {
  sales: 'app-role-pill is-green sales-geography-pill',
  debt: 'app-role-pill is-orange sales-geography-pill',
}

export function SalesGeographyPage() {
  const { t } = useI18n()
  const [metric, setMetric] = useState<GeographyMetric>('sales')
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
        const result = await getSalesGeography({ metric, months: TRAILING_MONTHS })

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
  }, [metric, reloadKey, setAggregates, setError, t])

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

  return (
    <Stack className="cockpit-page" gap="md">
      <Group align="center" className="sales-geography-toolbar" justify="space-between" wrap="wrap">
        <Group gap="sm">
          <SegmentedControl
            color={METRIC_BADGE_COLOR[metric]}
            data={[
              { label: t('Продажі'), value: 'sales' },
              { label: t('Борг'), value: 'debt' },
            ]}
            value={metric}
            onChange={(value) => setMetric(value as GeographyMetric)}
          />
          <Badge className="app-role-pill is-gray sales-geography-pill" variant="light">
            {t('12 міс')}
          </Badge>
        </Group>
        <Tooltip label={t('Оновити')}>
          <ActionIcon aria-label={t('Оновити')} loading={isLoading} variant="subtle" onClick={handleReload}>
            <IconRefresh size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {error}
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="md">
        <Card className="app-section-card" padding="md" radius="md" style={{ gridColumn: 'span 1' }} withBorder>
          <Stack gap="md">
            <Group gap="xs">
              <Text className="app-section-title" fw={600} size="sm">
                {t('Карта')}
              </Text>
              <Badge className={METRIC_PILL_CLASS[metric]} variant="light">
                {metricLabel}
              </Badge>
            </Group>

            {isLoading && plotted.length === 0 ? (
              <Group justify="center" py="xl">
                <Loader />
                <Text c="dimmed" size="sm">
                  {t('Завантаження карти')}
                </Text>
              </Group>
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
          className="app-section-card"
          padding="md"
          radius="md"
          style={{ gridColumn: 'span 1' }}
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
              <Text c="dimmed" size="sm">
                {t('Немає даних для відображення')}
              </Text>
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
