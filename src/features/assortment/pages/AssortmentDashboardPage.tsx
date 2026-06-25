import {
  Alert,
  Badge,
  Card,
  RingProgress,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconArrowBackUp,
  IconBuildingWarehouse,
  IconHeartbeat,
  IconPercentage,
  IconReceipt2,
  IconSnowflake,
  IconTrendingDown,
  IconTrendingUp,
} from '@tabler/icons-react'
import { type ReactNode, useEffect, useMemo } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import {
  getAssortmentHealth,
  getAssortmentMargin,
  getAssortmentOverview,
  getAssortmentReturns,
  getAssortmentStock,
} from '../api/assortmentApi'
import { ProductCard } from '../components/ProductCard'
import type {
  AssortmentHealthParams,
  AssortmentMargin,
  AssortmentMarginRow,
  AssortmentOverview,
  AssortmentReturns,
  AssortmentRow,
  AssortmentStock,
  AssortmentStockRow,
} from '../types'
import './assortment-dashboard.css'

const integer = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 })
const money = new Intl.NumberFormat('uk-UA', { currency: 'EUR', maximumFractionDigits: 0, style: 'currency' })

const RATING_LIMIT = 8

const BAND_META: Record<string, { label: string; color: string }> = {
  healthy: { label: 'Здорові', color: 'teal' },
  slow: { label: 'Повільні', color: 'yellow' },
  overstock: { label: 'Надлишок', color: 'blue' },
  understock: { label: 'Дефіцит', color: 'orange' },
  dead: { label: 'Мертві', color: 'red' },
  order_to_demand: { label: 'Під замовлення', color: 'grape' },
}

const BAND_ORDER = ['healthy', 'slow', 'overstock', 'understock', 'order_to_demand', 'dead']

const SORT_OPTIONS = [
  { value: 'health_asc', label: 'Найнижче здоровʼя' },
  { value: 'frozen_eur', label: 'Найбільший запас €' },
  { value: 'revenue', label: 'Найбільша виручка' },
]

function bandMeta(band: string): { label: string; color: string } {
  return BAND_META[band] ?? { label: band, color: 'gray' }
}

function healthColor(health: number): string {
  return health < 40 ? 'red' : health < 70 ? 'yellow' : 'teal'
}

function pct(value: number | null | undefined): string {
  return value == null ? '—' : `${(value * 100).toFixed(0)}%`
}

function formatMoney(value: number | null | undefined): string {
  return money.format(value ?? 0)
}

function formatInt(value: number | null | undefined): string {
  return value == null ? '—' : integer.format(value)
}

function getSummaryNumber(summary: Record<string, unknown> | undefined, key: string): number | null {
  const value = summary?.[key]

  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function AssortmentDashboardPage() {
  const { t } = useI18n()
  const [overview, setOverview] = useValueState<AssortmentOverview | null>(null)
  const [rows, setRows] = useValueState<AssortmentRow[]>([])
  const [stock, setStock] = useValueState<AssortmentStock | null>(null)
  const [margin, setMargin] = useValueState<AssortmentMargin | null>(null)
  const [returns, setReturns] = useValueState<AssortmentReturns | null>(null)
  const [filters, setFilters] = useValueState<AssortmentHealthParams>({
    sort: 'health_asc',
    limit: 100,
    stockedOnly: true,
  })
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState<boolean>(true)
  const [selectedProductId, setSelectedProductId] = useValueState<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setError(null)
      setLoading(true)
      try {
        const [ov, health, stockRating, marginRating, returnsRating] = await Promise.all([
          getAssortmentOverview(filters.asOfDate),
          getAssortmentHealth(filters),
          getAssortmentStock(filters.asOfDate, RATING_LIMIT),
          getAssortmentMargin(filters.asOfDate, RATING_LIMIT),
          getAssortmentReturns(filters.asOfDate, undefined, RATING_LIMIT),
        ])
        if (!controller.signal.aborted) {
          setOverview(ov)
          setRows(health.tasks)
          setStock(stockRating)
          setMargin(marginRating)
          setReturns(returnsRating)
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
  }, [filters, setError, setLoading, setMargin, setOverview, setReturns, setRows, setStock, t])

  const body = overview?.overview
  const marginSummary = margin?.summary
  const returnsSummary = returns?.summary
  const weightedMargin = getSummaryNumber(marginSummary, 'weighted_avg_margin_pct')
  const negativeMarginSkus = getSummaryNumber(marginSummary, 'negative_margin_skus')
  const overallReturnRate = getSummaryNumber(returnsSummary, 'overall_return_rate')
  const avgHealth = Math.round(body?.avg_health ?? 0)

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

  const columns = useMemo<DataTableColumn<AssortmentRow>[]>(
    () => [
      {
        id: 'product',
        header: t('Товар'),
        fill: true,
        minWidth: 240,
        accessor: (row) => row.vendor_code ?? row.name ?? row.product_id,
        cell: (row) => (
          <span className="assort-cell-product">
            <b>{row.vendor_code || `#${row.product_id}`}</b>
            <span>{row.name || `ID ${row.product_id}`}</span>
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
          <Badge color={healthColor(row.health)} variant="light">
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
            <Badge color={meta.color} variant="light">
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
          <Text fw={600} size="sm">
            {row.abc}/{row.xyz}
          </Text>
        ),
      },
      {
        id: 'margin',
        header: t('Маржа %'),
        align: 'right',
        minWidth: 110,
        accessor: (row) => row.margin_pct ?? -Infinity,
        cell: (row) => pct(row.margin_pct),
      },
      {
        id: 'cover',
        header: t('Покриття, дн.'),
        align: 'right',
        minWidth: 130,
        accessor: (row) => row.cover_days ?? -Infinity,
        cell: (row) => (row.cover_days == null ? '—' : integer.format(Math.round(row.cover_days))),
      },
      {
        id: 'eur',
        header: t('Запас, €'),
        align: 'right',
        minWidth: 130,
        accessor: (row) => row.eur_value,
        cell: (row) => formatMoney(row.eur_value),
      },
    ],
    [t],
  )

  return (
    <Stack className="assort-dash" gap="md">
      <Card className="app-section-card assort-dash__header" withBorder radius="md" padding={0}>
        <div>
          <Text className="assort-dash__title">{t('Аналітика асортименту')}</Text>
          <Text className="assort-dash__subtitle">
            {t('Стан запасів')} · {formatInt(body?.total_skus)} SKU · {t('середнє здоровʼя')} {avgHealth}
          </Text>
        </div>
        <div className="assort-dash__controls">
          <TextInput
            label={t('Станом на')}
            type="date"
            value={filters.asOfDate ?? ''}
            w={170}
            onChange={(event) => setFilters({ ...filters, asOfDate: event.currentTarget.value || undefined })}
          />
          <Select
            data={SORT_OPTIONS.map((option) => ({ value: option.value, label: t(option.label) }))}
            label={t('Сортування')}
            value={filters.sort ?? 'health_asc'}
            w={210}
            onChange={(value) => setFilters({ ...filters, sort: value ?? 'health_asc' })}
          />
        </div>
      </Card>

      {error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {error}
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
        <KpiTile
          color="violet"
          icon={<IconBuildingWarehouse size={22} />}
          label={t('Вартість запасів')}
          sub={`${formatInt(body?.total_skus)} SKU`}
          value={formatMoney(body?.total_eur_value)}
        />
        <KpiTile
          color="teal"
          icon={<IconReceipt2 size={22} />}
          label={t('Річна виручка')}
          value={formatMoney(body?.total_revenue_eur)}
        />
        <KpiTile
          color="blue"
          icon={<IconPercentage size={22} />}
          label={t('Середня маржа')}
          sub={negativeMarginSkus ? `${formatInt(negativeMarginSkus)} ${t('у мінусі')}` : undefined}
          value={pct(weightedMargin)}
        />
        <KpiTile
          color="orange"
          icon={<IconArrowBackUp size={22} />}
          label={t('Повернення')}
          value={pct(overallReturnRate)}
        />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="md">
        <Card className="app-section-card assort-card" withBorder radius="md" padding={0} style={{ gridColumn: 'span 2' }}>
          <div className="assort-card__head">
            <span className="assort-card__title">{t('Структура запасів за станом')}</span>
            <span className="assort-card__hint">{formatInt(body?.total_skus)} SKU</span>
          </div>
          <div className="band-bar">
            {bandSegments
              .filter((segment) => segment.count > 0)
              .map((segment) => (
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

        <Card className="app-section-card assort-card" withBorder radius="md" padding={0}>
          <div className="assort-card__head">
            <span className="assort-card__title">{t('Здоровʼя та структура')}</span>
          </div>
          <div className="assort-gauge">
            <RingProgress
              label={
                <Text fw={700} size="xl" ta="center">
                  {avgHealth}
                </Text>
              }
              roundCaps
              sections={[{ value: avgHealth, color: healthColor(avgHealth) }]}
              size={150}
              thickness={12}
            />
            <span className="assort-gauge__caption">{t('середнє здоровʼя асортименту')}</span>
          </div>
          <div className="assort-mix">
            <MixGroup counts={body?.by_abc} title="ABC" />
            <MixGroup counts={body?.by_xyz} title="XYZ" />
          </div>
        </Card>
      </SimpleGrid>

      <Card className="app-section-card assort-card" withBorder radius="md" padding={0}>
        <div className="assort-card__head">
          <span className="assort-card__title">{t('Рейтинги')}</span>
          <span className="assort-card__hint">
            {t('Топ')} {RATING_LIMIT} · {t('клікни для деталей')}
          </span>
        </div>
        <div className="rank-grid">
          <RankList
            color="red"
            empty={t('Немає даних')}
            icon={<IconHeartbeat size={16} />}
            metric={(row) => integer.format(Math.round(row.health))}
            rows={rows.slice(0, RATING_LIMIT)}
            title={t('Найнижче здоровʼя')}
            onPick={setSelectedProductId}
          />
          <RankList
            color="cyan"
            empty={t('Немає даних')}
            icon={<IconSnowflake size={16} />}
            metric={(row: AssortmentStockRow) => formatMoney(row.eur_value)}
            rows={stock?.rows ?? []}
            title={t('Заморожений запас')}
            onPick={setSelectedProductId}
          />
          <RankList
            color="teal"
            empty={t('Немає даних')}
            icon={<IconTrendingUp size={16} />}
            metric={(row: AssortmentMarginRow) => formatMoney(row.margin_eur)}
            rows={margin?.leaders ?? []}
            title={t('Найкраща маржа')}
            onPick={setSelectedProductId}
          />
          <RankList
            color="orange"
            empty={t('Немає даних')}
            icon={<IconTrendingDown size={16} />}
            metric={(row: AssortmentMarginRow) => pct(row.margin_pct)}
            rows={margin?.laggards ?? []}
            title={t('Найнижча маржа')}
            onPick={setSelectedProductId}
          />
          <RankList
            color="grape"
            empty={t('Немає даних')}
            icon={<IconArrowBackUp size={16} />}
            metric={(row: AssortmentMarginRow) => pct(row.return_rate ?? null)}
            rows={returns?.high_returns ?? []}
            title={t('Проблемні повернення')}
            onPick={setSelectedProductId}
          />
        </div>
      </Card>

      <Card className="app-section-card assort-table-card" withBorder radius="md" padding={0}>
        <div className="assort-card__head">
          <span className="assort-card__title">{t('Деталізація асортименту')}</span>
          <span className="assort-card__hint">{formatInt(rows.length)}</span>
        </div>
        <div className="assort-filter">
          <Select
            clearable
            data={BAND_ORDER.map((key) => ({ value: key, label: bandMeta(key).label }))}
            label={t('Стан')}
            placeholder={t('Усі')}
            value={filters.band ?? null}
            w={200}
            onChange={(value) => setFilters({ ...filters, band: value ?? undefined })}
          />
          <Select
            data={SORT_OPTIONS.map((option) => ({ value: option.value, label: t(option.label) }))}
            label={t('Сортування')}
            value={filters.sort ?? 'health_asc'}
            w={210}
            onChange={(value) => setFilters({ ...filters, sort: value ?? 'health_asc' })}
          />
        </div>
        <DataTable
          columns={columns}
          data={rows}
          emptyText={isLoading ? t('Завантаження') : t('Немає даних')}
          getRowId={(row) => String(row.product_id)}
          isLoading={isLoading}
          layoutVersion="assortment-detail-1"
          loadingText={t('Завантаження')}
          maxHeight="calc(100vh - 320px)"
          minWidth={820}
          tableId="assortment-detail"
          onRowClick={(row) => setSelectedProductId(row.product_id)}
        />
      </Card>

      <AppDrawer
        opened={selectedProductId != null}
        size="standard"
        title={t('Картка товару')}
        onClose={() => setSelectedProductId(null)}
      >
        {selectedProductId != null && (
          <ProductCard asOfDate={filters.asOfDate} productId={selectedProductId} />
        )}
      </AppDrawer>
    </Stack>
  )
}

function KpiTile({
  color,
  icon,
  label,
  sub,
  value,
}: {
  color: string
  icon: ReactNode
  label: string
  sub?: string
  value: string
}) {
  return (
    <Card className="app-section-card kpi-tile" withBorder radius="md" padding={0}>
      <ThemeIcon className="kpi-tile__icon" color={color} size={42} variant="light">
        {icon}
      </ThemeIcon>
      <div className="kpi-tile__body">
        <span className="kpi-tile__label">{label}</span>
        <span className="kpi-tile__value">{value}</span>
        {sub && <span className="kpi-tile__sub">{sub}</span>}
      </div>
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

type RankRow = { product_id: number; vendor_code?: string | null; name?: string | null }

function RankList<T extends RankRow>({
  color,
  empty,
  icon,
  metric,
  rows,
  title,
  onPick,
}: {
  color: string
  empty: string
  icon: ReactNode
  metric: (row: T) => string
  rows: T[]
  title: string
  onPick: (productId: number) => void
}) {
  return (
    <div className="rank-list">
      <div className="rank-list__head">
        <ThemeIcon color={color} radius="sm" size={26} variant="light">
          {icon}
        </ThemeIcon>
        <span className="rank-list__title">{title}</span>
      </div>
      {rows.length === 0 ? (
        <div className="rank-empty">{empty}</div>
      ) : (
        rows.map((row, index) => (
          <button
            key={row.product_id}
            className="rank-row"
            type="button"
            onClick={() => onPick(row.product_id)}
          >
            <span className="rank-row__rank">{index + 1}</span>
            <span className="rank-row__body">
              <span className="rank-row__code">{row.vendor_code || `#${row.product_id}`}</span>
              <span className="rank-row__name">{row.name || `ID ${row.product_id}`}</span>
            </span>
            <span className="rank-row__metric">{metric(row)}</span>
          </button>
        ))
      )}
    </div>
  )
}
