import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  RingProgress,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { CircleAlert, MapPin, RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { AiFeatureBadge } from '../../../shared/ai/AiFeatureBadge'
import { AiHistoryLineageNote } from '../../../shared/ai/AiHistoryLineageNote'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import {
  getAssortmentHealth,
  getAssortmentMargin,
  getAssortmentOverview,
  getAssortmentRegions,
  getAssortmentReturns,
  getAssortmentStock,
} from '../api/assortmentApi'
import { ProductCard } from '../components/ProductCard'
import type {
  AssortmentHealthParams,
  AssortmentMargin,
  AssortmentOverview,
  AssortmentRegionRow,
  AssortmentRegions,
  AssortmentReturns,
  AssortmentRow,
  AssortmentStock,
} from '../types'
import './assortment-dashboard.css'

const integer = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 })
const money = new Intl.NumberFormat('uk-UA', { currency: 'EUR', maximumFractionDigits: 0, style: 'currency' })

const RATING_LIMIT = 8
const REGION_LIMIT = 50
const REGION_WINDOW_DAYS = 365
const DEFAULT_ASSORTMENT_FILTERS: AssortmentHealthParams = {
  limit: 100,
  regionWindowDays: REGION_WINDOW_DAYS,
  sort: 'health_asc',
  stockedOnly: true,
}
const REGION_PERIOD_OPTIONS = [
  { value: '90', label: '90 днів' },
  { value: '180', label: '180 днів' },
  { value: '365', label: '365 днів' },
]

/* color paints the band bar/legend swatches (chart colors); pill is the
   app-role-pill variant (§4) for the same band rendered as a badge. */
const BAND_META: Record<string, { label: string; color: string; pill: string }> = {
  healthy: { label: 'Здорові', color: 'teal', pill: 'is-green' },
  slow: { label: 'Повільні', color: 'yellow', pill: 'is-yellow' },
  overstock: { label: 'Надлишок', color: 'blue', pill: 'is-orange' },
  understock: { label: 'Дефіцит', color: 'orange', pill: 'is-orange' },
  dead: { label: 'Мертві', color: 'red', pill: 'is-red' },
  order_to_demand: { label: 'Під замовлення', color: 'orange', pill: 'is-orange' },
}

const BAND_ORDER = ['healthy', 'slow', 'overstock', 'understock', 'order_to_demand', 'dead']

const SORT_OPTIONS = [
  { value: 'health_asc', label: 'Найнижче здоровʼя' },
  { value: 'frozen_eur', label: 'Найбільший запас €' },
  { value: 'revenue', label: 'Найбільша виручка' },
]
const REGIONAL_SORT_OPTIONS = [
  { value: 'regional_revenue', label: 'Виручка в регіоні' },
  { value: 'regional_units', label: 'Штуки в регіоні' },
]
const REGIONAL_SORT_VALUES = new Set(REGIONAL_SORT_OPTIONS.map((option) => option.value))
const STOCK_OPTIONS = [
  { value: 'stocked', label: 'Є на складі' },
  { value: 'all', label: 'Увесь асортимент' },
]

type BandSegment = {
  key: string
  label: string
  color: string
  count: number
  share: number
  eurValue: number | null
}

type SelectOption = {
  value: string
  label: string
}

function bandMeta(band: string): { label: string; color: string; pill: string } {
  return BAND_META[band] ?? { label: band, color: 'gray', pill: 'is-gray' }
}

function healthColor(health: number): string {
  return health < 40 ? 'red' : health < 70 ? 'yellow' : 'teal'
}

function healthPill(health: number): string {
  return health < 40 ? 'is-red' : health < 70 ? 'is-yellow' : 'is-green'
}

/* Missing values render blank everywhere (§5/§7.2) — never a dash, and never
   a fabricated zero (a green «0 €» is indistinguishable from real zero). */
function pct(value: number | null | undefined): string {
  return value == null ? '' : `${(value * 100).toFixed(0)}%`
}

function formatMoney(value: number | null | undefined): string {
  return value == null ? '' : money.format(value)
}

function formatInt(value: number | null | undefined): string {
  return value == null ? '' : integer.format(value)
}

function intCell(value: number | null | undefined): string {
  return value == null ? '' : integer.format(Math.round(value))
}

function productName(row: Pick<AssortmentRow, 'name' | 'product_id'>): string {
  return row.name?.trim() || `Товар ID ${row.product_id}`
}

function productCode(row: Pick<AssortmentRow, 'product_id' | 'vendor_code'>): string {
  return row.vendor_code?.trim() || `ID ${row.product_id}`
}

function recommendationFor(row: AssortmentRow): { label: string; reason: string } {
  const reason = row.action_reasons?.find(Boolean) ?? ''

  switch (row.band) {
    case 'understock':
      return { label: 'Поповнити запас', reason: reason || 'Запас нижче розрахованої потреби' }
    case 'overstock':
      return { label: 'Зменшити запас', reason: reason || 'Запас перевищує поточний попит' }
    case 'slow':
      return { label: 'Прискорити продаж', reason: reason || 'Низька швидкість обігу' }
    case 'dead':
      return { label: 'Переглянути позицію', reason: reason || 'Товар не створює обороту' }
    case 'order_to_demand':
      return { label: 'Під замовлення', reason: reason || 'Закуповувати під підтверджений попит' }
    default:
      return { label: row.action_label || 'Контролювати', reason }
  }
}

function MoneyCell({ value }: { value: number | null | undefined }) {
  if (value == null) {
    return null
  }

  return <span className={`app-money${value < 0 ? ' is-negative' : ''}`}>{money.format(value)}</span>
}

/* Portal dropdowns need the orange selected-option override (§1 — no violet). */
const ASSORT_COMBOBOX_PROPS = {
  classNames: { dropdown: 'assort-select-dropdown' },
}

function regionName(region: AssortmentRegionRow): string {
  return region.region_name || `#${region.region_id}`
}

function isRegionalSort(sort: string | undefined): boolean {
  return sort ? REGIONAL_SORT_VALUES.has(sort) : false
}

function getSummaryNumber(summary: Record<string, unknown> | undefined, key: string): number | null {
  const value = summary?.[key]

  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function settledErrorMessage(result: PromiseSettledResult<unknown>, fallback: string): string | null {
  if (result.status === 'fulfilled') {
    return null
  }

  return result.reason instanceof Error ? result.reason.message : fallback
}

function useAssortmentColumns(t: (key: string) => string, hasRegion: boolean) {
  return useMemo<DataTableColumn<AssortmentRow>[]>(
    () => {
      const baseColumns: DataTableColumn<AssortmentRow>[] = [
        {
          id: 'product',
          header: t('Товар'),
          fill: true,
          minWidth: 280,
          accessor: (row) => row.vendor_code ?? row.name ?? row.product_id,
          cell: (row) => (
            <span className="assort-cell-product">
              <b>{productName(row)}</b>
              <span>{productCode(row)}</span>
            </span>
          ),
        },
        {
          id: 'health',
          header: t('Здоровʼя'),
          align: 'center',
          minWidth: 110,
          accessor: (row) => row.health,
          cell: (row) => (
            <Badge className={`app-role-pill ${healthPill(row.health)}`} variant="light">
              {integer.format(Math.round(row.health))}
            </Badge>
          ),
        },
        {
          id: 'band',
          header: t('Стан'),
          minWidth: 140,
          accessor: (row) => row.band,
          cell: (row) => {
            const meta = bandMeta(row.band)
            return (
              <Badge className={`app-role-pill ${meta.pill}`.trim()} variant="light">
                {meta.label}
              </Badge>
            )
          },
        },
        {
          id: 'abcxyz',
          header: 'ABC / XYZ',
          align: 'center',
          minWidth: 100,
          accessor: (row) => `${row.abc}${row.xyz}`,
          cell: (row) => (
            <span className="assort-cell-num">
              {row.abc}/{row.xyz}
            </span>
          ),
        },
        {
          id: 'margin',
          header: t('Маржа %'),
          align: 'right',
          minWidth: 110,
          accessor: (row) => row.margin_pct ?? -Infinity,
          cell: (row) => (
            <span className="assort-cell-num">{row.margin_pct == null ? '' : pct(row.margin_pct)}</span>
          ),
        },
        {
          id: 'cover',
          header: t('Покриття, дн.'),
          align: 'right',
          minWidth: 130,
          accessor: (row) => row.cover_days ?? -Infinity,
          cell: (row) => <span className="assort-cell-num">{intCell(row.cover_days)}</span>,
        },
        {
          id: 'eur',
          header: t('Запас, €'),
          align: 'right',
          minWidth: 130,
          accessor: (row) => row.eur_value,
          cell: (row) => <MoneyCell value={row.eur_value} />,
        },
        {
          id: 'action',
          header: t('Рекомендація'),
          minWidth: 220,
          accessor: (row) => recommendationFor(row).label,
          cell: (row) => {
            const recommendation = recommendationFor(row)

            return (
              <span className="assort-cell-action">
                <b>{recommendation.label}</b>
                {recommendation.reason && <span>{recommendation.reason}</span>}
              </span>
            )
          },
        },
      ]

      if (!hasRegion) {
        return baseColumns
      }

      return [
        ...baseColumns,
        {
          id: 'regionRevenue',
          header: t('Регіон, €'),
          align: 'right',
          minWidth: 130,
          accessor: (row) => row.regional_revenue_eur ?? 0,
          cell: (row) => <MoneyCell value={row.regional_revenue_eur} />,
        },
        {
          id: 'regionUnits',
          header: t('Регіон, шт.'),
          align: 'right',
          minWidth: 120,
          accessor: (row) => row.regional_units ?? 0,
          cell: (row) => <span className="assort-cell-num">{intCell(row.regional_units)}</span>,
        },
        {
          id: 'regionClients',
          header: t('Клієнти'),
          align: 'right',
          minWidth: 105,
          accessor: (row) => row.regional_client_count ?? 0,
          cell: (row) => <span className="assort-cell-num">{intCell(row.regional_client_count)}</span>,
        },
      ]
    },
    [hasRegion, t],
  )
}

export function AssortmentDashboardPage() {
  const { t } = useI18n()
  const [overview, setOverview] = useValueState<AssortmentOverview | null>(null)
  const [rows, setRows] = useValueState<AssortmentRow[]>([])
  const [stock, setStock] = useValueState<AssortmentStock | null>(null)
  const [margin, setMargin] = useValueState<AssortmentMargin | null>(null)
  const [returns, setReturns] = useValueState<AssortmentReturns | null>(null)
  const [regions, setRegions] = useValueState<AssortmentRegions | null>(null)
  const [filters, setFilters] = useValueState<AssortmentHealthParams>(DEFAULT_ASSORTMENT_FILTERS)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState<boolean>(true)
  const [selectedProductId, setSelectedProductId] = useValueState<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setError(null)
      setLoading(true)
      try {
        const [overviewResult, healthResult, regionsResult, stockResult, marginResult, returnsResult] = await Promise.allSettled([
          getAssortmentOverview(filters.asOfDate, controller.signal),
          getAssortmentHealth(filters, controller.signal),
          getAssortmentRegions(
            filters.asOfDate,
            filters.regionWindowDays ?? REGION_WINDOW_DAYS,
            REGION_LIMIT,
            controller.signal,
          ),
          getAssortmentStock(filters.asOfDate, RATING_LIMIT, controller.signal),
          getAssortmentMargin(filters.asOfDate, RATING_LIMIT, controller.signal),
          getAssortmentReturns(filters.asOfDate, undefined, RATING_LIMIT, controller.signal),
        ])

        if (!controller.signal.aborted) {
          const failures = [
            settledErrorMessage(overviewResult, t('Огляд асортименту недоступний')),
            settledErrorMessage(healthResult, t('Деталізація асортименту недоступна')),
            settledErrorMessage(regionsResult, t('Регіони недоступні')),
            settledErrorMessage(stockResult, t('Рейтинг запасів недоступний')),
            settledErrorMessage(marginResult, t('Рейтинг маржі недоступний')),
            settledErrorMessage(returnsResult, t('Рейтинг повернень недоступний')),
          ].filter((message): message is string => Boolean(message))

          if (overviewResult.status === 'fulfilled') {
            setOverview(overviewResult.value)
          }
          if (healthResult.status === 'fulfilled') {
            setRows(healthResult.value.tasks)
          }
          if (regionsResult.status === 'fulfilled') {
            setRegions(regionsResult.value)
          }
          if (stockResult.status === 'fulfilled') {
            setStock(stockResult.value)
          }
          if (marginResult.status === 'fulfilled') {
            setMargin(marginResult.value)
          }
          if (returnsResult.status === 'fulfilled') {
            setReturns(returnsResult.value)
          }

          setError(failures.length === 0 ? null : failures.join(' · '))
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити асортимент'))
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => controller.abort()
  }, [filters, setError, setLoading, setMargin, setOverview, setRegions, setReturns, setRows, setStock, t])

  const body = overview?.overview
  const marginSummary = margin?.summary
  const returnsSummary = returns?.summary
  const weightedMargin = getSummaryNumber(marginSummary, 'weighted_avg_margin_pct')
  const negativeMarginSkus = getSummaryNumber(marginSummary, 'negative_margin_skus')
  const knownMarginRevenue = getSummaryNumber(marginSummary, 'revenue_eur_known_margin')
  const negativeMarginRevenue = getSummaryNumber(marginSummary, 'eur_at_negative_margin')
  const overallReturnRate = getSummaryNumber(returnsSummary, 'overall_return_rate')
  const marginProfit = weightedMargin == null || knownMarginRevenue == null ? null : knownMarginRevenue * weightedMargin
  const avgHealth = Math.round(body?.avg_health ?? 0)
  const regionOptions = useMemo(
    () => (regions?.regions ?? []).map((region) => ({
      value: String(region.region_id),
      label: `${regionName(region)} · ${formatMoney(region.revenue_eur)}`,
    })),
    [regions?.regions],
  )
  const selectedRegion = useMemo(
    () => regions?.regions.find((region) => region.region_id === filters.regionId) ?? null,
    [filters.regionId, regions?.regions],
  )
  const sortOptions = filters.regionId == null ? SORT_OPTIONS : [...SORT_OPTIONS, ...REGIONAL_SORT_OPTIONS]

  const bandSegments = useMemo(() => {
    const counts = body?.by_band ?? {}
    const total = Object.values(counts).reduce((sum, value) => sum + Number(value), 0)
    const keys = [
      ...BAND_ORDER.filter((key) => key in counts),
      ...Object.keys(counts).filter((key) => !BAND_ORDER.includes(key)),
    ]

    return keys.map((key) => {
      const count = Number(counts[key] ?? 0)
      const meta = bandMeta(key)

      return {
        key,
        label: meta.label,
        color: meta.color,
        count,
        share: total > 0 ? count / total : 0,
        eurValue: stock?.bands?.[key]?.eur_value ?? null,
      }
    })
  }, [body?.by_band, stock?.bands])
  const visibleBandSegments = useMemo(
    () => bandSegments.reduce<typeof bandSegments>((items, segment) => {
      if (segment.count > 0) {
        items.push(segment)
      }

      return items
    }, []),
    [bandSegments],
  )

  const columns = useAssortmentColumns(t, filters.regionId != null)

  return (
    <Stack className="assort-dash" gap={6}>
      <div className="assort-dash__shell">
        <AssortmentHeader
          avgHealth={avgHealth}
          filters={filters}
          regionOptions={regionOptions}
          totalSkus={body?.total_skus}
          onFiltersChange={setFilters}
          onReset={() => setFilters(DEFAULT_ASSORTMENT_FILTERS)}
        />

        <div className="assort-dash__body">
          {overview && <AiHistoryLineageNote lineage={overview} />}
          {error && (
            <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
              {error}
            </Alert>
          )}

          <div className="assort-dash__overview">
            <AssortmentKpis
              body={body}
              knownMarginRevenue={knownMarginRevenue}
              marginProfit={marginProfit}
              negativeMarginSkus={negativeMarginSkus}
              negativeMarginRevenue={negativeMarginRevenue}
              overallReturnRate={overallReturnRate}
              weightedMargin={weightedMargin}
            />

            {selectedRegion && (
              <RegionSummary region={selectedRegion} windowDays={filters.regionWindowDays ?? REGION_WINDOW_DAYS} />
            )}

            <div className="assort-dash__insights">
              <AssortmentStructure
                avgHealth={avgHealth}
                bandSegments={bandSegments}
                body={body}
                visibleBandSegments={visibleBandSegments}
              />

              <AssortmentAttention
                margin={margin}
                returns={returns}
                rows={rows}
                stock={stock}
                onPick={setSelectedProductId}
              />
            </div>
          </div>

          <AssortmentDetailTable
            columns={columns}
            filters={filters}
            isLoading={isLoading}
            rows={rows}
            sortOptions={sortOptions}
            onFiltersChange={setFilters}
            onPick={setSelectedProductId}
          />
        </div>
      </div>

      <AppDrawer
        opened={selectedProductId != null}
        size="standard"
        title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Картка товару')}</span>}
        onClose={() => setSelectedProductId(null)}
      >
        {selectedProductId != null && (
          <ProductCard
            asOfDate={filters.asOfDate}
            productId={selectedProductId}
            regionId={filters.regionId}
            regionWindowDays={filters.regionWindowDays}
          />
        )}
      </AppDrawer>
    </Stack>
  )
}

function AssortmentHeader({
  avgHealth,
  filters,
  regionOptions,
  totalSkus,
  onFiltersChange,
  onReset,
}: {
  avgHealth: number
  filters: AssortmentHealthParams
  regionOptions: SelectOption[]
  totalSkus?: number
  onFiltersChange: (filters: AssortmentHealthParams) => void
  onReset: () => void
}) {
  const { t } = useI18n()

  return (
    <Card className="assort-dash__header" withBorder radius="md" padding={0}>
      <div className="app-filter-bar assort-dash__bar">
        <div className="assort-dash__summary">
          <Group gap="xs" wrap="nowrap">
            <Text className="app-section-title assort-dash__title">{t('Аналітика асортименту')}</Text>
            <AiFeatureBadge tooltip={t('AI-сервіс рейтингу асортименту')} />
          </Group>
          <Text className="assort-dash__subtitle">
            {totalSkus == null ? t('Стан запасів') : <><b>{formatInt(totalSkus)}</b> {t('товарних позицій')}</>}
            {' · '}
            {t('здоровʼя')} <b>{avgHealth}/100</b>
          </Text>
        </div>
        <div className="assort-dash__controls">
          <TextInput
            label={t('Дата зрізу')}
            type="date"
            value={filters.asOfDate ?? ''}
            w={160}
            onChange={(event) => onFiltersChange({ ...filters, asOfDate: event.currentTarget.value || undefined })}
          />
          <Select
            allowDeselect={false}
            comboboxProps={ASSORT_COMBOBOX_PROPS}
            data={REGION_PERIOD_OPTIONS.map((option) => ({ value: option.value, label: t(option.label) }))}
            label={t('Період регіонів')}
            value={String(filters.regionWindowDays ?? REGION_WINDOW_DAYS)}
            w={150}
            onChange={(value) => onFiltersChange({ ...filters, regionWindowDays: Number(value ?? REGION_WINDOW_DAYS) })}
          />
          <Select
            clearable
            comboboxProps={ASSORT_COMBOBOX_PROPS}
            data={regionOptions}
            disabled={regionOptions.length === 0}
            label={t('Регіон')}
            placeholder={t('Усі регіони')}
            searchable
            value={filters.regionId == null ? null : String(filters.regionId)}
            w={230}
            onChange={(value) => {
              const nextRegionId = value == null ? undefined : Number(value)
              onFiltersChange({
                ...filters,
                regionId: nextRegionId,
                sort: nextRegionId == null
                  ? (isRegionalSort(filters.sort) ? 'health_asc' : filters.sort ?? 'health_asc')
                  : (filters.regionId == null ? 'regional_revenue' : filters.sort ?? 'regional_revenue'),
              })
            }}
          />
          <Button
            className="assort-reset"
            color="gray"
            leftSection={<RotateCcw size={15} />}
            variant="subtle"
            onClick={onReset}
          >
            {t('Скинути')}
          </Button>
        </div>
      </div>
    </Card>
  )
}

function AssortmentKpis({
  body,
  knownMarginRevenue,
  marginProfit,
  negativeMarginSkus,
  negativeMarginRevenue,
  overallReturnRate,
  weightedMargin,
}: {
  body?: AssortmentOverview['overview']
  knownMarginRevenue: number | null
  marginProfit: number | null
  negativeMarginSkus: number | null
  negativeMarginRevenue: number | null
  overallReturnRate: number | null
  weightedMargin: number | null
}) {
  const { t } = useI18n()

  return (
    <SimpleGrid className="assort-kpis" cols={{ base: 1, sm: 2, lg: 4 }} spacing={0}>
      <KpiTile
        label={t('Вартість запасів')}
        sub={body?.total_skus == null ? undefined : `${t('Товарних позицій')}: ${formatInt(body.total_skus)}`}
        value={formatMoney(body?.total_eur_value)}
      />
      <KpiTile
        label={t('Оборот за 12 міс.')}
        sub={t('сумарна виручка продажів')}
        value={formatMoney(body?.total_revenue_eur)}
      />
      <KpiTile
        label={t('Валовий заробіток')}
        sub={
          weightedMargin == null
            ? t('маржа невідома')
            : `${t('маржа')} ${pct(weightedMargin)} · ${t('виручка')} ${formatMoney(knownMarginRevenue)}`
        }
        value={formatMoney(marginProfit)}
      />
      <KpiTile
        label={t('Ризики маржі та повернень')}
        sub={
          negativeMarginSkus
            ? `${formatInt(negativeMarginSkus)} ${t('позицій у мінусі')} · ${formatMoney(negativeMarginRevenue)}`
            : t('частка повернених одиниць')
        }
        value={pct(overallReturnRate)}
      />
    </SimpleGrid>
  )
}

function AssortmentStructure({
  avgHealth,
  bandSegments,
  body,
  visibleBandSegments,
}: {
  avgHealth: number
  bandSegments: BandSegment[]
  body?: AssortmentOverview['overview']
  visibleBandSegments: BandSegment[]
}) {
  const { t } = useI18n()

  return (
    <>
      <Card className="app-section-card assort-card assort-structure__stock" withBorder radius="md" padding={0}>
        <div className="assort-card__head">
          <span className="assort-card__title app-section-title">{t('Структура запасів за станом')}</span>
          <span className="assort-card__hint">
            {body?.total_skus == null ? '' : `${t('Товарних позицій')}: ${formatInt(body.total_skus)}`}
          </span>
        </div>
        <div className="band-bar">
          {visibleBandSegments.map((segment) => (
            <div
              key={segment.key}
              className="band-bar__seg"
              style={{
                flexGrow: segment.count,
                background: `var(--mantine-color-${segment.color}-5)`,
              }}
              title={`${segment.label}: ${segment.count}`}
            />
          ))}
        </div>
        <div className="band-legend">
          {bandSegments.map((segment) => (
            <div key={segment.key} className="band-legend__row">
              <span
                className="band-legend__swatch"
                style={{ background: `var(--mantine-color-${segment.color}-5)` }}
              />
              <span className="band-legend__label">{segment.label}</span>
              <span className="band-legend__count">{integer.format(segment.count)}</span>
              <span className="band-legend__value">
                {segment.eurValue == null ? '' : formatMoney(segment.eurValue)}
              </span>
            </div>
          ))}
          {bandSegments.length === 0 && <div className="rank-empty">{t('Немає даних')}</div>}
        </div>
      </Card>

      <Card className="app-section-card assort-card assort-structure__health" withBorder radius="md" padding={0}>
        <div className="assort-card__head">
          <span className="assort-card__title app-section-title">{t('Здоровʼя та структура')}</span>
        </div>
        <div className="assort-gauge">
          <RingProgress
            label={
              <Text ff="var(--font-mono)" fw={600} size="xl" ta="center">
                {avgHealth}
              </Text>
            }
            roundCaps
            sections={[{ value: avgHealth, color: healthColor(avgHealth) }]}
            size={106}
            thickness={10}
          />
          <span className="assort-gauge__caption">{t('середнє здоровʼя асортименту')}</span>
        </div>
        <div className="assort-mix">
          <MixGroup counts={body?.by_abc} title="ABC" />
          <MixGroup counts={body?.by_xyz} title="XYZ" />
        </div>
      </Card>
    </>
  )
}

type AttentionRow = Pick<AssortmentRow, 'name' | 'product_id' | 'vendor_code'>
type AttentionItem = {
  key: string
  label: string
  metric: string
  row: AttentionRow
  tone: string
}

function AssortmentAttention({
  margin,
  returns,
  rows,
  stock,
  onPick,
}: {
  margin: AssortmentMargin | null
  returns: AssortmentReturns | null
  rows: AssortmentRow[]
  stock: AssortmentStock | null
  onPick: (productId: number) => void
}) {
  const { t } = useI18n()
  const attentionItems = useMemo(() => {
    const items: AttentionItem[] = []
    const seen = new Set<number>()
    const frozenRows = stock?.rows ?? []
    const lowMarginRows = margin?.laggards ?? []
    const highReturnRows = returns?.high_returns ?? []

    function add(label: string, tone: string, row: AttentionRow | undefined, metric: string) {
      if (!row || seen.has(row.product_id)) {
        return
      }

      seen.add(row.product_id)
      items.push({ key: `${label}-${row.product_id}`, label, metric, row, tone })
    }

    rows.slice(0, 2).forEach((row) => add(t('Низьке здоровʼя'), healthPill(row.health), row, `${Math.round(row.health)}/100`))
    frozenRows.slice(0, 2).forEach((row) => add(t('Надлишок запасу'), 'is-orange', row, formatMoney(row.eur_value)))
    lowMarginRows.slice(0, 2).forEach((row) => add(t('Низька маржа'), 'is-yellow', row, pct(row.margin_pct)))
    highReturnRows.slice(0, 2).forEach((row) => add(t('Повернення'), 'is-red', row, pct(row.return_rate)))

    return items.slice(0, 5)
  }, [margin?.laggards, returns?.high_returns, rows, stock?.rows, t])

  return (
    <Card className="app-section-card assort-card assort-attention" withBorder radius="md" padding={0}>
      <div className="assort-card__head">
        <span className="assort-card__title app-section-title">{t('Потребують уваги')}</span>
        <span className="assort-card__hint">{t('відкрити картку товару')}</span>
      </div>
      <div className="assort-attention__list">
        {attentionItems.map((item) => (
          <button key={item.key} className="assort-attention__row" type="button" onClick={() => onPick(item.row.product_id)}>
            <Badge className={`app-role-pill ${item.tone}`} variant="light">{item.label}</Badge>
            <span className="assort-attention__product">
              <b>{productName(item.row)}</b>
              <span>{productCode(item.row)}</span>
            </span>
            <strong>{item.metric}</strong>
          </button>
        ))}
        {attentionItems.length === 0 && (
          <div className="assort-attention__empty">
            <b>{t('Критичних відхилень не знайдено')}</b>
            <span>{t('Перевірте повний перелік товарів нижче')}</span>
          </div>
        )}
      </div>
    </Card>
  )
}

function AssortmentDetailTable({
  columns,
  filters,
  isLoading,
  rows,
  sortOptions,
  onFiltersChange,
  onPick,
}: {
  columns: DataTableColumn<AssortmentRow>[]
  filters: AssortmentHealthParams
  isLoading: boolean
  rows: AssortmentRow[]
  sortOptions: SelectOption[]
  onFiltersChange: (filters: AssortmentHealthParams) => void
  onPick: (productId: number) => void
}) {
  const { t } = useI18n()
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)

  return (
    <Card className="app-section-card assort-table-card" withBorder radius="md" padding={0}>
      <div className="assort-card__head">
        <span className="assort-card__title app-section-title">{t('Деталізація асортименту')}</span>
        <Badge className="app-role-pill is-gray" variant="light">{formatInt(rows.length)}</Badge>
      </div>
      <div className="app-filter-bar assort-filter">
        <Group align="end" gap={10} wrap="nowrap" className="assort-filter-row">
          <Select
            clearable
            comboboxProps={ASSORT_COMBOBOX_PROPS}
            data={BAND_ORDER.map((key) => ({ value: key, label: bandMeta(key).label }))}
            label={t('Стан')}
            placeholder={t('Усі')}
            value={filters.band ?? null}
            w={200}
            onChange={(value) => onFiltersChange({ ...filters, band: value ?? undefined })}
          />
          <Select
            clearable
            comboboxProps={ASSORT_COMBOBOX_PROPS}
            data={['A', 'B', 'C']}
            label="ABC"
            placeholder={t('Усі')}
            value={filters.abc ?? null}
            w={108}
            onChange={(value) => onFiltersChange({ ...filters, abc: value ?? undefined })}
          />
          <Select
            clearable
            comboboxProps={ASSORT_COMBOBOX_PROPS}
            data={['X', 'Y', 'Z']}
            label="XYZ"
            placeholder={t('Усі')}
            value={filters.xyz ?? null}
            w={108}
            onChange={(value) => onFiltersChange({ ...filters, xyz: value ?? undefined })}
          />
          <Select
            allowDeselect={false}
            comboboxProps={ASSORT_COMBOBOX_PROPS}
            data={STOCK_OPTIONS.map((option) => ({ ...option, label: t(option.label) }))}
            label={t('Наявність')}
            value={filters.stockedOnly === false ? 'all' : 'stocked'}
            w={170}
            onChange={(value) => onFiltersChange({ ...filters, stockedOnly: value !== 'all' })}
          />
          <Select
            comboboxProps={ASSORT_COMBOBOX_PROPS}
            data={sortOptions.map((option) => ({ value: option.value, label: t(option.label) }))}
            label={t('Сортування')}
            value={filters.sort ?? 'health_asc'}
            w={210}
            onChange={(value) => onFiltersChange({ ...filters, sort: value ?? 'health_asc' })}
          />
          <div ref={setTableToolbarSlot} className="app-filter-table-toolbar-slot" />
        </Group>
      </div>
      <div className="assort-table-card__table">
        <DataTable
          columns={columns}
          data={rows}
          emptyText={
            isLoading
              ? t('Завантаження')
              : (
                  <span className="assort-table-empty">
                    <b>{t('За вибраними фільтрами товарів не знайдено')}</b>
                    <span>{t('Змініть стан, класифікацію або наявність')}</span>
                  </span>
                )
          }
          getRowId={(row) => String(row.product_id)}
          height="100%"
          isLoading={isLoading}
          layoutVersion="assortment-detail-2"
          loadingText={t('Завантаження')}
          minWidth={filters.regionId == null ? 1080 : 1440}
          showLayoutControls
          tableId="assortment-detail"
          toolbarPortalTarget={tableToolbarSlot}
          onRowClick={(row) => onPick(row.product_id)}
        />
      </div>
    </Card>
  )
}

function RegionSummary({ region, windowDays }: { region: AssortmentRegionRow; windowDays: number }) {
  const { t } = useI18n()

  return (
    <Card className="app-section-card assort-region" withBorder radius="md" padding={0}>
      <div className="assort-region__title">
        <span className="app-action-icon assort-region__icon">
          <MapPin size={18} />
        </span>
        <div>
          <span>{regionName(region)}</span>
          <small>
            {t('регіональний зріз за')} {formatInt(windowDays)} {t('днів')}
          </small>
        </div>
      </div>
      <div className="assort-region__metrics">
        <RegionMetric label={t('Виручка')} value={formatMoney(region.revenue_eur)} />
        <RegionMetric label={t('Штуки')} value={formatInt(region.units)} />
        <RegionMetric label={t('Клієнти')} value={formatInt(region.client_count)} />
        <RegionMetric label={t('Товарні позиції')} value={formatInt(region.product_count)} />
      </div>
    </Card>
  )
}

/* §7.2 metric: mono label with the orange dot + mono value, no boxes/strips. */
function RegionMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="assort-region__metric">
      <span className="app-section-title">{label}</span>
      <b>{value}</b>
    </div>
  )
}

/* §7.2 metric: gray mono label with the orange dot + a large mono value. */
function KpiTile({ label, sub, value }: { label: string; sub?: string; value: string }) {
  return (
    <Card className="app-section-card kpi-tile" withBorder radius="md" padding={0}>
      <span className="kpi-tile__label app-section-title">{label}</span>
      <span className="kpi-tile__value">{value}</span>
      {sub && <span className="kpi-tile__sub">{sub}</span>}
    </Card>
  )
}

function MixGroup({ counts, title }: { counts?: Record<string, number>; title: string }) {
  const entries = Object.entries(counts ?? {}).filter(([, value]) => Number(value) > 0)

  if (entries.length === 0) {
    return null
  }

  return (
    <div className="assort-mix__group">
      <span className="assort-mix__title">{title}</span>
      <div className="assort-mix__chips">
        {entries
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, value]) => (
            <span key={key} className="assort-mix__chip">
              {key} <b>{integer.format(Number(value))}</b>
            </span>
          ))}
      </div>
    </div>
  )
}
