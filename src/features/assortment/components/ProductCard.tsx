import {
  Alert,
  Badge,
  Card,
  Group,
  Loader,
  Progress,
  SimpleGrid,
  Stack,
  Text,
} from '@mantine/core'
import { Brain, CircleAlert, Factory } from 'lucide-react'
import { useEffect } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getProduct, getProductAnalytics, getProductRegions, getProductSubstitutes } from '../api/assortmentApi'
import type { ProductAnalytics, ProductDetail, ProductRegions, ProductSubstitutes } from '../types'
import { ProductSalesAnalytics } from './ProductSalesAnalytics'
import './product-card.css'

const integer = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 })
const decimal = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 0 })
const money = new Intl.NumberFormat('uk-UA', { currency: 'EUR', maximumFractionDigits: 0, style: 'currency' })
const preciseMoney = new Intl.NumberFormat('uk-UA', {
  currency: 'EUR',
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: 'currency',
})

const ACTION_LABELS: Record<string, string> = {
  discount_or_redistribute: 'Знижка або перерозподіл',
  dead_stock_review: 'Розбір мертвого запасу',
  fix_margin: 'Виправити маржу',
  keep_push: 'Продовжувати продавати',
  margin_review: 'Перевірити маржу',
  monitor: 'Моніторинг',
  monitor_decline: 'Контроль падіння попиту',
  quality_review: 'Перевірити якість / повернення',
  reorder_check: 'Перевірити дозамовлення',
  slow_mover_review: 'Розбір повільного товару',
  to_order_candidate: 'Кандидат під замовлення',
}

const ACTION_PILLS: Record<string, string> = {
  discount_or_redistribute: 'is-orange',
  dead_stock_review: 'is-red',
  fix_margin: 'is-red',
  keep_push: 'is-green',
  margin_review: 'is-yellow',
  monitor: 'is-gray',
  monitor_decline: 'is-yellow',
  quality_review: 'is-orange',
  reorder_check: 'is-orange',
  slow_mover_review: 'is-yellow',
  to_order_candidate: 'is-green',
}

const REASON_LABELS: Record<string, string> = {
  dead_stock: 'немає живого попиту',
  declining_demand: 'попит падає',
  healthy_margin: 'маржа здорова',
  high_returns: 'високі повернення',
  negative_margin: 'відʼємна маржа',
  no_immediate_action: 'без негайної дії',
  overstock: 'надлишок запасу',
  slow_mover: 'повільний товар',
  strong_demand: 'сильний попит',
  strong_to_order_demand: 'сильний попит без складу',
  understock: 'дефіцит запасу',
  unknown_margin: 'маржа невідома',
}

const COMPONENT_LABELS: Record<string, string> = {
  abc: 'ABC',
  margin: 'Маржа',
  returns: 'Повернення',
  stability: 'Стабільність',
  stock: 'Запас',
  trend: 'Тренд',
}

const CLASS_LABELS: Record<string, string> = {
  dead: 'мертвий',
  declining: 'падає',
  growing: 'росте',
  healthy: 'здоровий',
  mature: 'стабільний',
  new: 'новий',
  order_to_demand: 'під замовлення',
  overstock: 'надлишок',
  slow: 'повільний',
  understock: 'дефіцит',
  unknown: 'невідомо',
}

function healthPill(health: number): string {
  return health < 40 ? 'is-red' : health < 70 ? 'is-yellow' : 'is-green'
}

function scorePill(score: number | null): string {
  if (score === null) {
    return 'is-gray'
  }

  return score < 40 ? 'is-red' : score < 70 ? 'is-yellow' : 'is-green'
}

function toNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item !== '') : []
}

function componentEntries(value: Record<string, number> | undefined): Array<{ key: string; value: number }> {
  if (!value) {
    return []
  }

  return Object.entries(value)
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, componentValue]) => ({ key, value: Math.max(0, Math.min(1, componentValue)) }))
}

function formatClass(value: unknown): string {
  if (typeof value !== 'string' || value === '') {
    return ''
  }

  return CLASS_LABELS[value] ?? value
}

function formatScore(score: number | null | undefined): string {
  return score == null ? '' : integer.format(Math.round(score))
}

function formatPercent(value: number | null | undefined): string {
  return value == null ? '' : `${(value * 100).toFixed(1)}%`
}

function formatNullableNumber(value: number | null | undefined): string {
  return value == null ? '' : decimal.format(value)
}

export function ProductCard({
  productId,
  asOfDate,
  regionId,
  regionWindowDays = 365,
}: {
  productId: number
  asOfDate?: string
  regionId?: number
  regionWindowDays?: number
}) {
  const { t } = useI18n()
  const [detail, setDetail] = useValueState<ProductDetail | null>(null)
  const [analytics, setAnalytics] = useValueState<ProductAnalytics | null>(null)
  const [subs, setSubs] = useValueState<ProductSubstitutes | null>(null)
  const [productRegions, setProductRegions] = useValueState<ProductRegions | null>(null)
  const [error, setError] = useValueState<string | null>(null)
  const [analyticsError, setAnalyticsError] = useValueState<string | null>(null)
  const [subsError, setSubsError] = useValueState<string | null>(null)
  const [regionsError, setRegionsError] = useValueState<string | null>(null)
  const [loading, setLoading] = useValueState<boolean>(true)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setError(null)
      setAnalyticsError(null)
      setSubsError(null)
      setRegionsError(null)
      setDetail(null)
      setAnalytics(null)
      setSubs(null)
      setProductRegions(null)

      try {
        const d = await getProduct(productId, asOfDate, controller.signal)

        if (!controller.signal.aborted) {
          setDetail(d)
        }

        if (d.found && !controller.signal.aborted) {
          const [substitutesResult, regionsResult, analyticsResult] = await Promise.allSettled([
            getProductSubstitutes(productId, asOfDate, 20, controller.signal),
            getProductRegions(productId, asOfDate, regionWindowDays, 8, controller.signal),
            getProductAnalytics(productId, asOfDate, 12, controller.signal),
          ])

          if (!controller.signal.aborted) {
            if (substitutesResult.status === 'fulfilled') {
              setSubs(substitutesResult.value)
            } else {
              setSubsError(
                substitutesResult.reason instanceof Error ? substitutesResult.reason.message : t('Замінники недоступні'),
              )
            }

            if (regionsResult.status === 'fulfilled') {
              setProductRegions(regionsResult.value)
            } else {
              setRegionsError(
                regionsResult.reason instanceof Error ? regionsResult.reason.message : t('Регіональний попит недоступний'),
              )
            }

            if (analyticsResult.status === 'fulfilled') {
              setAnalytics(analyticsResult.value)
            } else {
              setAnalyticsError(
                analyticsResult.reason instanceof Error
                  ? analyticsResult.reason.message
                  : t('Динаміка продажів недоступна'),
              )
            }
          }
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити товар'))
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => controller.abort()
  }, [
    productId,
    asOfDate,
    regionWindowDays,
    setAnalytics,
    setAnalyticsError,
    setDetail,
    setError,
    setLoading,
    setProductRegions,
    setRegionsError,
    setSubs,
    setSubsError,
    t,
  ])

  if (loading) {
    return (
      <Group aria-live="polite" justify="center" py="xl" role="status">
        <Loader aria-hidden="true" />
        <Text size="sm">{t('Завантаження аналітики товару…')}</Text>
      </Group>
    )
  }
  if (!detail?.found) {
    if (error) {
      return (
        <Card withBorder>
          <Alert color="orange" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        </Card>
      )
    }

    // found:false is the honest state for a product with no sales history AND no stock
    // (e.g. a catalog item never sold / not in the assortment) — show its identity and the
    // reason instead of a bare dead-end, so the buyer knows it's «no signals», not an error.
    return (
      <Card withBorder>
        <Stack gap={6}>
          <Text className="assort-product-hero__name">{detail?.name ?? `ID ${detail?.product_id ?? ''}`}</Text>
          {detail?.vendor_code && (
            <Text c="dimmed" size="sm">
              {detail.vendor_code}
            </Text>
          )}
          <Alert color="gray" icon={<CircleAlert size={18} />} variant="light">
            {t('Товар ще не продавався і відсутній на складі — немає сигналів для аналітики')}
          </Alert>
        </Stack>
      </Card>
    )
  }

  const demandScore = toNumber(detail.demand_score)
  const marginScore = toNumber(detail.margin_score)
  const actionLabel = typeof detail.action_label === 'string' ? detail.action_label : 'monitor'
  const actionReasons = toStringArray(detail.action_reasons)
  const producerId = toNumber(detail.primary_producer_id)
  const producerName = typeof detail.primary_producer_name === 'string' ? detail.primary_producer_name : ''

  return (
    <Stack gap="md">
      <ProductHero detail={detail} producerId={producerId} producerName={producerName} t={t} />
      <ProductAiAction actionLabel={actionLabel} actionReasons={actionReasons} t={t} />

      <SimpleGrid cols={{ base: 2, md: 4 }}>
        <Stat label={t('Запас')} value={formatNullableNumber(detail.qty_on_hand)} />
        <Stat label={t('Вартість запасу')} value={money.format(detail.eur_value)} />
        <Stat label={t('Маржа %')} value={formatPercent(detail.margin_pct)} />
        <Stat label={t('Покриття, дн.')} value={detail.cover_days == null ? '' : String(Math.round(detail.cover_days))} />
      </SimpleGrid>

      <ProductSalesAnalytics analytics={analytics} error={analyticsError} />

      <SimpleGrid cols={{ base: 1, md: 3 }}>
        <ScoreCard label={t('Health')} score={detail.health} components={detail.health_components} />
        <ScoreCard label={t('Попит')} score={demandScore} components={detail.demand_components} />
        <ScoreCard label={t('Маржа / якість')} score={marginScore} components={detail.margin_components} />
      </SimpleGrid>

      <CommercialProfile detail={detail} t={t} />
      <SubstitutesPanel error={subsError} substitutes={subs} t={t} />
      <RegionsPanel error={regionsError} productRegions={productRegions} regionId={regionId} t={t} />
    </Stack>
  )
}

type ProductCardTranslate = (key: string) => string

function ProductHero({
  detail,
  producerId,
  producerName,
  t,
}: {
  detail: ProductDetail
  producerId: number | null
  producerName: string
  t: ProductCardTranslate
}) {
  return (
    <Card className="assort-product-hero" radius="md" withBorder>
      <Group align="flex-start" justify="space-between" wrap="nowrap">
        <Stack gap={6} miw={0}>
          <Stack gap={2}>
            <Text className="assort-product-hero__name">{detail.name ?? detail.product_id}</Text>
            <Text className="assort-product-hero__code">{detail.vendor_code || `ID ${detail.product_id}`}</Text>
          </Stack>
          {producerId !== null && (
            <Group gap={6} wrap="nowrap">
              <Factory size={14} />
              <Text c="dimmed" size="xs" truncate>
                {producerName || `#${producerId}`}
              </Text>
            </Group>
          )}
        </Stack>
        <Badge className={`app-role-pill ${healthPill(detail.health)}`} variant="light">
          {t('Здоровʼя')}: {Math.round(detail.health)}
        </Badge>
      </Group>
    </Card>
  )
}

function ProductAiAction({
  actionLabel,
  actionReasons,
  t,
}: {
  actionLabel: string
  actionReasons: string[]
  t: ProductCardTranslate
}) {
  return (
    <Card className="assort-ai-action" radius="md" withBorder>
      <Group align="flex-start" justify="space-between" wrap="nowrap">
        <Group align="flex-start" gap="sm" wrap="nowrap">
          <Brain className="assort-ai-action__icon" size={20} />
          <Stack gap={8}>
            <Group gap="xs">
              <Text className="app-section-title" fw={600} size="sm">
                {t('AI-рішення по товару')}
              </Text>
              <Badge className={`app-role-pill ${ACTION_PILLS[actionLabel] ?? 'is-gray'}`} size="sm" variant="light">
                {t(ACTION_LABELS[actionLabel] ?? actionLabel)}
              </Badge>
            </Group>
            <Group gap={6}>
              {actionReasons.length === 0 ? (
                <Badge className="app-role-pill is-gray" size="xs" variant="light">
                  {t('без окремих причин')}
                </Badge>
              ) : (
                actionReasons.map((reason) => (
                  <Badge className="app-role-pill is-gray" key={reason} size="xs" variant="light">
                    {t(REASON_LABELS[reason] ?? reason)}
                  </Badge>
                ))
              )}
            </Group>
          </Stack>
        </Group>
      </Group>
    </Card>
  )
}

function CommercialProfile({ detail, t }: { detail: ProductDetail; t: ProductCardTranslate }) {
  return (
    <Card radius="md" withBorder>
      <Stack gap="sm">
        <Text className="app-section-title" fw={600} size="sm">
          {t('Комерційний профіль')}
        </Text>
        <SimpleGrid cols={{ base: 2, md: 4 }}>
          <Stat label={t('Продажі за 12 міс.')} value={formatNullableNumber(detail.annual_units)} />
          <Stat label={t('Оціночна виручка')} value={money.format(detail.revenue_eur)} />
          <Stat label={t('Собівартість / шт.')} value={detail.unit_cost_eur == null ? '' : preciseMoney.format(detail.unit_cost_eur)} />
          <Stat label={t('Сер. ціна продажу')} value={detail.avg_price_eur == null ? '' : preciseMoney.format(detail.avg_price_eur)} />
        </SimpleGrid>
        <Group gap={6}>
          <Badge className="app-role-pill is-gray" variant="light">
            ABC {detail.abc}
          </Badge>
          <Badge className="app-role-pill is-gray" variant="light">
            XYZ {detail.xyz}
          </Badge>
          <Badge className="app-role-pill is-gray" variant="light">
            {t('Стан')}: {t(formatClass(detail.band))}
          </Badge>
          <Badge className="app-role-pill is-gray" variant="light">
            {t('Цикл')}: {t(formatClass(detail.lifecycle))}
          </Badge>
          <Badge className="app-role-pill is-gray" variant="light">
            {t('Повернення')}: {formatPercent(detail.return_rate)}
          </Badge>
        </Group>
      </Stack>
    </Card>
  )
}

function SubstitutesPanel({
  error,
  substitutes,
  t,
}: {
  error: string | null
  substitutes: ProductSubstitutes | null
  t: ProductCardTranslate
}) {
  return (
    <Card radius="md" withBorder>
      <Stack gap="xs">
        <Text className="app-section-title" fw={600} size="sm">
          {t('Замінники')} ({substitutes?.in_stock_count ?? 0} {t('в наявності')})
        </Text>
        {error ? (
          <Alert color="orange" icon={<CircleAlert size={16} />} variant="light">
            {error}
          </Alert>
        ) : (
          (substitutes?.candidates ?? []).map((candidate) => (
            <Group key={candidate.product_id} justify="space-between">
              <Text c="gray.8" fw={600} size="sm">
                {candidate.name ?? candidate.product_id}
              </Text>
              <Badge className={`app-role-pill ${healthPill(candidate.health)}`} variant="light">
                {Math.round(candidate.health)}
              </Badge>
            </Group>
          ))
        )}
      </Stack>
    </Card>
  )
}

function RegionsPanel({
  error,
  productRegions,
  regionId,
  t,
}: {
  error: string | null
  productRegions: ProductRegions | null
  regionId?: number
  t: ProductCardTranslate
}) {
  return (
    <Card radius="md" withBorder>
      <Stack gap="xs">
        <Text className="app-section-title" fw={600} size="sm">
          {t('Попит за регіонами')}
        </Text>
        {error ? (
          <Alert color="orange" icon={<CircleAlert size={16} />} variant="light">
            {error}
          </Alert>
        ) : (productRegions?.regions ?? []).length === 0 ? (
          <Text c="dimmed" size="sm">
            {t('Немає даних')}
          </Text>
        ) : (
          (productRegions?.regions ?? []).map((region) => {
            const isSelected = region.region_id === regionId
            return (
              <Group key={region.region_id} justify="space-between" wrap="nowrap">
                <Stack gap={0} miw={0}>
                  {/* Selection reads as the orange accent (§6), not extra weight. */}
                  <Text
                    c={isSelected ? undefined : 'gray.8'}
                    fw={isSelected ? 600 : 500}
                    size="sm"
                    style={isSelected ? { color: 'var(--brand-orange)' } : undefined}
                    truncate
                  >
                    {region.region_name || `#${region.region_id}`}
                  </Text>
                  <Text c="dimmed" size="xs">
                    <b className="assort-meta-num">{integer.format(region.regional_order_count)}</b>{' '}
                    {t('замовлень')} ·{' '}
                    <b className="assort-meta-num">{integer.format(region.regional_client_count)}</b>{' '}
                    {t('клієнтів')}
                  </Text>
                </Stack>
                <Stack align="flex-end" gap={0}>
                  <Text className="app-money" size="sm">
                    {money.format(region.regional_revenue_eur)}
                  </Text>
                  <Text c="dimmed" size="xs">
                    <b className="assort-meta-num">{integer.format(region.regional_units)}</b> {t('шт.')}
                  </Text>
                </Stack>
              </Group>
            )
          })
        )}
      </Stack>
    </Card>
  )
}

function ScoreCard({
  components,
  label,
  score,
}: {
  components: Record<string, number> | undefined
  label: string
  score: number | null
}) {
  const { t } = useI18n()
  const entries = componentEntries(components)

  return (
    <Card className="assort-score-card" radius="md" withBorder>
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap">
          <Text className="app-section-title" fw={600} size="sm">
            {label}
          </Text>
          <Badge className={`app-role-pill ${scorePill(score)}`} variant="light">
            {formatScore(score)}
          </Badge>
        </Group>
        {entries.length === 0 ? (
          <Text c="dimmed" size="sm">
            {t('Немає деталізації')}
          </Text>
        ) : (
          <Stack gap={8}>
            {entries.map((entry) => (
              <div className="assort-score-row" key={entry.key}>
                <Group justify="space-between" wrap="nowrap">
                  <Text c="gray.7" size="xs">
                    {t(COMPONENT_LABELS[entry.key] ?? entry.key)}
                  </Text>
                  <Text className="assort-score-row__value" size="xs">
                    {integer.format(Math.round(entry.value * 100))}
                  </Text>
                </Group>
                <Progress color={entry.value < 0.4 ? 'red' : entry.value < 0.7 ? 'yellow' : 'teal'} radius="xl" size={6} value={entry.value * 100} />
              </div>
            ))}
          </Stack>
        )}
      </Stack>
    </Card>
  )
}

/* §7.2 metric: gray mono label with the orange dot + a large mono value —
   no boxes around each number. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="assort-stat__label app-section-title">{label}</span>
      <span className="assort-stat__value">{value}</span>
    </div>
  )
}
