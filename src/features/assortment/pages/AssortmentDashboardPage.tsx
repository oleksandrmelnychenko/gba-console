import { Alert, Badge, Card, Group, Loader, Select, SimpleGrid, Stack, Table, Text } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useEffect, useMemo, type ReactNode } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AgingBars, type AgingSeries } from '../../../shared/ui/charts'
import {
  getAssortmentHealth,
  getAssortmentMargin,
  getAssortmentOverview,
  getAssortmentReturns,
  getAssortmentStock,
} from '../api/assortmentApi'
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

const integer = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 })
const number = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 1 })
const money = new Intl.NumberFormat('uk-UA', { currency: 'EUR', maximumFractionDigits: 0, style: 'currency' })

const BAND_OPTIONS = ['healthy', 'slow', 'overstock', 'understock', 'dead', 'order_to_demand']
const RATING_LIMIT = 10
const SORT_OPTIONS = [
  { value: 'health_asc', labelKey: 'Найнижче здоровʼя' },
  { value: 'frozen_eur', labelKey: 'Найбільший запас €' },
  { value: 'revenue', labelKey: 'Найбільша виручка' },
]

function healthColor(health: number): string {
  return health < 40 ? 'red' : health < 70 ? 'yellow' : 'green'
}

function pct(value: number | null): string {
  return value == null ? '—' : `${(value * 100).toFixed(0)}%`
}

function formatMoney(value: number | null | undefined): string {
  return money.format(value ?? 0)
}

function formatNumber(value: number | null | undefined): string {
  return value == null ? '—' : number.format(value)
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

  const bandData = useMemo(
    () =>
      Object.entries(overview?.overview.by_band ?? {}).map(([bucket, count]) => ({
        bucket,
        count: Number(count),
      })),
    [overview?.overview.by_band],
  )
  const bandSeries = useMemo<AgingSeries[]>(() => [{ name: 'count', label: t('SKU'), color: 'blue.6' }], [t])
  const marginSummary = margin?.summary
  const returnsSummary = returns?.summary
  const weightedMargin = getSummaryNumber(marginSummary, 'weighted_avg_margin_pct')
  const negativeMarginSkus = getSummaryNumber(marginSummary, 'negative_margin_skus')
  const overallReturnRate = getSummaryNumber(returnsSummary, 'overall_return_rate')

  return (
    <Stack gap="md">
      <Card withBorder radius="md" shadow="sm">
        <Group justify="space-between" wrap="wrap">
          <Text fw={700} size="xl">
            {t('Асортимент')}
          </Text>
          <Badge color="blue" variant="light">
            {t('SKU')}: {overview?.overview.total_skus ?? 0}
          </Badge>
        </Group>
        {error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} mt="sm" variant="light">
            {error}
          </Alert>
        )}
      </Card>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
        <StatCard label={t('Вартість запасів, €')} value={formatMoney(overview?.overview.total_eur_value)} />
        <StatCard label={t('Виручка, €')} value={formatMoney(overview?.overview.total_revenue_eur)} />
        <StatCard label={t('Середнє здоровʼя')} value={String(Math.round(overview?.overview.avg_health ?? 0))} />
        <StatCard label={t('Всього SKU')} value={integer.format(overview?.overview.total_skus ?? 0)} />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
        <StatCard label={t('Запаси у рейтингу')} value={formatMoney(stock?.total_eur_value)} />
        <StatCard label={t('Середня маржа')} value={pct(weightedMargin)} />
        <StatCard label={t('SKU з мінусовою маржею')} value={integer.format(negativeMarginSkus ?? 0)} />
        <StatCard label={t('Середній % повернень')} value={pct(overallReturnRate)} />
      </SimpleGrid>

      <Card radius="md" withBorder>
        <Stack gap="xs">
          <Text fw={600} size="sm">
            {t('Розподіл за бендом')}
          </Text>
          <AgingBars
            bucketKey="bucket"
            data={bandData}
            emptyLabel={t('Немає даних')}
            isLoading={isLoading}
            loadingLabel={t('Завантаження')}
            series={bandSeries}
          />
        </Stack>
      </Card>

      <Card radius="md" withBorder>
        <Stack gap="md">
          <Group justify="space-between" wrap="wrap">
            <Stack gap={2}>
              <Text fw={600} size="sm">
                {t('Рейтинги')}
              </Text>
              <Text c="dimmed" size="xs">
                {t('Топ позицій для асортиментних рішень')}
              </Text>
            </Stack>
            <Badge color="gray" variant="light">
              {t('Ліміт')}: {RATING_LIMIT}
            </Badge>
          </Group>

          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
            <RatingPanel title={t('Найнижче здоровʼя')}>
              <HealthRatingTable rows={rows.slice(0, RATING_LIMIT)} />
            </RatingPanel>
            <RatingPanel title={t('Найбільший заморожений запас')}>
              <StockRatingTable rows={stock?.rows ?? []} />
            </RatingPanel>
            <RatingPanel title={t('Найкраща маржа')}>
              <MarginRatingTable mode="leaders" rows={margin?.leaders ?? []} />
            </RatingPanel>
            <RatingPanel title={t('Найнижча маржа')}>
              <MarginRatingTable mode="laggards" rows={margin?.laggards ?? []} />
            </RatingPanel>
            <RatingPanel title={t('Проблемні повернення')}>
              <ReturnsRatingTable rows={returns?.high_returns ?? []} />
            </RatingPanel>
          </SimpleGrid>
        </Stack>
      </Card>

      <Card radius="md" withBorder>
        <Stack gap="md">
          <Group gap="sm">
            <Select
              clearable
              data={BAND_OPTIONS.map((b) => ({ value: b, label: t(b) }))}
              label={t('Бенд')}
              placeholder={t('Усі')}
              value={filters.band ?? null}
              w={200}
              onChange={(value) => setFilters({ ...filters, band: value ?? undefined })}
            />
            <Select
              data={SORT_OPTIONS.map((s) => ({ value: s.value, label: t(s.labelKey) }))}
              label={t('Сортування')}
              value={filters.sort ?? 'health_asc'}
              w={220}
              onChange={(value) => setFilters({ ...filters, sort: value ?? 'health_asc' })}
            />
          </Group>

          {isLoading ? (
            <Group justify="center" py="xl">
              <Loader />
              <Text c="dimmed" size="sm">
                {t('Завантаження')}
              </Text>
            </Group>
          ) : (
            <Table highlightOnHover striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('Товар')}</Table.Th>
                  <Table.Th>{t('Здоровʼя')}</Table.Th>
                  <Table.Th>{t('Бенд')}</Table.Th>
                  <Table.Th>ABC/XYZ</Table.Th>
                  <Table.Th>{t('Маржа %')}</Table.Th>
                  <Table.Th>{t('Покриття, дн.')}</Table.Th>
                  <Table.Th>{t('Запас, €')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((r) => (
                  <Table.Tr key={r.product_id}>
                    <Table.Td>{r.name ?? r.product_id}</Table.Td>
                    <Table.Td>
                      <Badge color={healthColor(r.health)} variant="light">
                        {integer.format(Math.round(r.health))}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{t(r.band)}</Table.Td>
                    <Table.Td>
                      {r.abc}/{r.xyz}
                    </Table.Td>
                    <Table.Td>{pct(r.margin_pct)}</Table.Td>
                    <Table.Td>{r.cover_days == null ? '—' : integer.format(Math.round(r.cover_days))}</Table.Td>
                    <Table.Td>{formatMoney(r.eur_value)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Stack>
      </Card>
    </Stack>
  )
}

function RatingPanel({ children, title }: { children: ReactNode; title: string }) {
  return (
    <Card padding="sm" radius="sm" withBorder>
      <Stack gap="xs">
        <Text fw={600} size="sm">
          {title}
        </Text>
        {children}
      </Stack>
    </Card>
  )
}

function HealthRatingTable({ rows }: { rows: AssortmentRow[] }) {
  const { t } = useI18n()

  return (
    <Table.ScrollContainer minWidth={520}>
      <Table highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('Товар')}</Table.Th>
            <Table.Th>{t('Здоровʼя')}</Table.Th>
            <Table.Th>{t('Бенд')}</Table.Th>
            <Table.Th>{t('Запас')}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.length === 0 ? (
            <EmptyTableRow colSpan={4} />
          ) : (
            rows.map((row) => (
              <Table.Tr key={row.product_id}>
                <ProductCell row={row} />
                <Table.Td>
                  <Badge color={healthColor(row.health)} variant="light">
                    {integer.format(Math.round(row.health))}
                  </Badge>
                </Table.Td>
                <Table.Td>{t(row.band)}</Table.Td>
                <Table.Td>{formatNumber(row.qty_on_hand)}</Table.Td>
              </Table.Tr>
            ))
          )}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}

function StockRatingTable({ rows }: { rows: AssortmentStockRow[] }) {
  const { t } = useI18n()

  return (
    <Table.ScrollContainer minWidth={560}>
      <Table highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('Товар')}</Table.Th>
            <Table.Th>{t('Запас, €')}</Table.Th>
            <Table.Th>{t('К-сть')}</Table.Th>
            <Table.Th>{t('Покриття')}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.length === 0 ? (
            <EmptyTableRow colSpan={4} />
          ) : (
            rows.map((row) => (
              <Table.Tr key={row.product_id}>
                <ProductCell row={row} />
                <Table.Td>{formatMoney(row.eur_value)}</Table.Td>
                <Table.Td>{formatNumber(row.qty_on_hand)}</Table.Td>
                <Table.Td>{row.cover_days == null ? '—' : integer.format(Math.round(row.cover_days))}</Table.Td>
              </Table.Tr>
            ))
          )}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}

function MarginRatingTable({ mode, rows }: { mode: 'leaders' | 'laggards'; rows: AssortmentMarginRow[] }) {
  const { t } = useI18n()

  return (
    <Table.ScrollContainer minWidth={600}>
      <Table highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('Товар')}</Table.Th>
            <Table.Th>{mode === 'leaders' ? t('Маржа, €') : t('Маржа %')}</Table.Th>
            <Table.Th>{t('Виручка')}</Table.Th>
            <Table.Th>{t('Здоровʼя')}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.length === 0 ? (
            <EmptyTableRow colSpan={4} />
          ) : (
            rows.map((row) => (
              <Table.Tr key={row.product_id}>
                <ProductCell row={row} />
                <Table.Td>{mode === 'leaders' ? formatMoney(row.margin_eur) : pct(row.margin_pct)}</Table.Td>
                <Table.Td>{formatMoney(row.revenue_eur)}</Table.Td>
                <Table.Td>{row.health == null ? '—' : integer.format(Math.round(row.health))}</Table.Td>
              </Table.Tr>
            ))
          )}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}

function ReturnsRatingTable({ rows }: { rows: AssortmentMarginRow[] }) {
  const { t } = useI18n()

  return (
    <Table.ScrollContainer minWidth={600}>
      <Table highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('Товар')}</Table.Th>
            <Table.Th>{t('% повернень')}</Table.Th>
            <Table.Th>{t('Повернено')}</Table.Th>
            <Table.Th>{t('Продано')}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.length === 0 ? (
            <EmptyTableRow colSpan={4} />
          ) : (
            rows.map((row) => (
              <Table.Tr key={row.product_id}>
                <ProductCell row={row} />
                <Table.Td>{pct(row.return_rate ?? null)}</Table.Td>
                <Table.Td>{formatNumber(row.returned_units)}</Table.Td>
                <Table.Td>{formatNumber(row.annual_units)}</Table.Td>
              </Table.Tr>
            ))
          )}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}

function ProductCell({
  row,
}: {
  row: {
    name?: string | null
    product_id: number
    vendor_code?: string | null
  }
}) {
  return (
    <Table.Td>
      <Stack gap={0}>
        <Text fw={600} size="sm">
          {row.vendor_code || `#${row.product_id}`}
        </Text>
        <Text c="dimmed" lineClamp={1} size="xs">
          {row.name || `ID ${row.product_id}`}
        </Text>
      </Stack>
    </Table.Td>
  )
}

function EmptyTableRow({ colSpan }: { colSpan: number }) {
  const { t } = useI18n()

  return (
    <Table.Tr>
      <Table.Td colSpan={colSpan}>
        <Text c="dimmed" py="md" size="sm" ta="center">
          {t('Немає даних')}
        </Text>
      </Table.Td>
    </Table.Tr>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card padding="md" radius="md" withBorder>
      <Text c="dimmed" size="xs" tt="uppercase">
        {label}
      </Text>
      <Text fw={700} size="lg">
        {value}
      </Text>
    </Card>
  )
}
