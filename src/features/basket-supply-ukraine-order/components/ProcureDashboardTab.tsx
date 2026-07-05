import {
  ActionIcon,
  Alert,
  Badge,
  Card,
  Group,
  NumberInput,
  SimpleGrid,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core'
import { IconAlertCircle, IconRefresh } from '@tabler/icons-react'
import { useEffect, useMemo, useReducer, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import {
  AgingBars,
  ForecastLine,
  UrgencyDonut,
  type ForecastPoint,
  type UrgencyLevel,
  type UrgencySliceInput,
} from '../../../shared/ui/charts'
import { getProcurementCharts } from '../api/procurementApi'
import type {
  ProcurementCharts,
  ProcurementDemandSeries,
  ProcurementTopItem,
} from '../procurementTypes'

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
      return { charts: null, error: action.error, isLoading: false }
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
  const [state, dispatch] = useReducer(dashboardReducer, initialState)
  const [producerId, setProducerId] = useState<number | ''>('')
  const [topN, setTopN] = useState<number | ''>(15)
  const [appliedProducerId, setAppliedProducerId] = useState<number | ''>('')
  const [appliedTopN, setAppliedTopN] = useState<number>(15)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const { charts, error, isLoading } = state

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
    setAppliedProducerId(producerId)
    setAppliedTopN(typeof topN === 'number' && topN > 0 ? topN : 15)
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

  const totalSuggested = useMemo(
    () => (charts?.top_items ?? []).reduce((sum, item) => sum + item.suggested_qty, 0),
    [charts],
  )

  const topItemColumns = useMemo<Array<DataTableColumn<ProcurementTopItem>>>(
    () => [
      {
        id: 'product',
        header: t('Товар'),
        accessor: (item) => item.product_id,
        cell: (item) => `#${item.product_id}`,
        width: 120,
      },
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
        cell: (item) => qtyFormatter.format(item.suggested_qty),
        width: 150,
        align: 'right',
      },
      {
        id: 'onHand',
        header: t('В наявності'),
        accessor: (item) => item.on_hand,
        cell: (item) => qtyFormatter.format(item.on_hand),
        width: 140,
        align: 'right',
      },
      {
        id: 'reorderPoint',
        header: t('Точка замовлення'),
        accessor: (item) => item.reorder_point,
        cell: (item) => qtyFormatter.format(item.reorder_point),
        width: 160,
        align: 'right',
      },
    ],
    [t],
  )

  const toolbarRight = (
    <Tooltip label={t('Оновити')}>
      <ActionIcon
        aria-label={t('Оновити')}
        loading={isLoading}
        size="sm"
        variant="subtle"
        onClick={() => reload()}
      >
        <IconRefresh size={16} />
      </ActionIcon>
    </Tooltip>
  )

  return (
    <Stack gap="lg">
      <div className="app-filter-bar basket-supply-command-bar">
        <NumberInput
          allowDecimal={false}
          allowNegative={false}
          description={t('Порожньо — весь кошик')}
          label={t('Виробник (ID)')}
          min={0}
          onChange={(value) => setProducerId(typeof value === 'number' ? value : '')}
          placeholder={t('Весь кошик')}
          value={producerId}
          w={200}
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
        <Group gap="xs">
          <Tooltip label={t('Застосувати')}>
            <ActionIcon
              aria-label={t('Застосувати')}
              loading={isLoading}
              size="lg"
              variant="light"
              onClick={applyFilters}
            >
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </div>

      {error && (
        <Alert color="red" icon={<IconAlertCircle size={16} />} variant="light">
          {error}
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <Card className="app-section-card" padding="md" radius="md" withBorder>
          <Stack align="center" gap="xs">
            <Text className="app-section-title" fw={600} size="sm">
              {t('Терміновість поповнення')}
            </Text>
            <UrgencyDonut
              chartLabel={charts ? countFormatter.format(sumCount(urgencyData)) : undefined}
              data={urgencyData}
              emptyLabel={t('Даних не знайдено')}
              isLoading={isLoading}
              loadingLabel={t('Завантаження…')}
              valueFormatter={(value) => countFormatter.format(value)}
            />
          </Stack>
        </Card>

        <Card className="app-section-card" padding="md" radius="md" withBorder>
          <Stack gap="xs">
            <Group justify="space-between">
              <Text className="app-section-title" fw={600} size="sm">
                {t('Запас днів покриття')}
              </Text>
            </Group>
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
      </SimpleGrid>

      <Card className="app-section-card" padding="md" radius="md" withBorder>
        <Stack gap="md">
          <Text className="app-section-title" fw={600} size="sm">
            {t('Прогноз попиту')}
          </Text>
          {isLoading && <ForecastLine actualLabel="" data={[]} emptyLabel="" forecastLabel="" isLoading />}
          {!isLoading && (charts?.demand_series.length ?? 0) === 0 && (
            <Text c="dimmed" size="sm">
              {t('Даних не знайдено')}
            </Text>
          )}
          {!isLoading &&
            (charts?.demand_series ?? []).map((series) => (
              <Stack gap={4} key={series.product_id}>
                <Text c="dimmed" size="xs">
                  {t('Товар')} #{series.product_id}
                </Text>
                <ForecastLine
                  actualLabel={t('Факт')}
                  data={buildForecastPoints(series)}
                  emptyLabel={t('Даних не знайдено')}
                  forecastLabel={t('Прогноз')}
                  valueFormatter={(value) => qtyFormatter.format(value)}
                  withLegend
                />
              </Stack>
            ))}
        </Stack>
      </Card>

      <Card className="app-section-card" padding="md" radius="md" withBorder>
        <Stack gap="xs">
          <Group justify="space-between">
            <Text className="app-section-title" fw={600} size="sm">
              {t('Пріоритетні позиції')}
            </Text>
            <Text c="dimmed" size="xs">
              {t('Сумарно рекомендовано')}: {qtyFormatter.format(totalSuggested)}
            </Text>
          </Group>
          <DataTable
            columns={topItemColumns}
            data={charts?.top_items ?? []}
            emptyText={t('Даних не знайдено')}
            getRowId={(item) => String(item.product_id)}
            isLoading={isLoading}
            maxHeight={520}
            minWidth={720}
            tableId="basket-supply-ukraine-order-procure-top-items"
            toolbarRight={toolbarRight}
          />
        </Stack>
      </Card>
    </Stack>
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
