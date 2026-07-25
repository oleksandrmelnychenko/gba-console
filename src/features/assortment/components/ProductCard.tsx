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
  discount_or_redistribute: 'Знизити ціну або перемістити запас',
  dead_stock_review: 'Перевірити залишок без продажів',
  fix_margin: 'Переглянути ціну: маржа занадто низька',
  keep_push: 'Підтримувати продажі',
  margin_review: 'Перевірити ціну та маржу',
  monitor: 'Спостерігати за товаром',
  monitor_decline: 'Перевірити причину падіння продажів',
  quality_review: 'Перевірити повернення та якість',
  reorder_check: 'Перевірити потребу в дозамовленні',
  slow_mover_review: 'Вирішити, що робити з повільним запасом',
  to_order_candidate: 'Продавати під замовлення',
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
  dead_stock: 'Товар давно не продавався',
  declining_demand: 'Продажі знижуються',
  healthy_margin: 'Маржа на нормальному рівні',
  high_returns: 'Забагато повернень',
  negative_margin: 'Продажі приносять збиток',
  no_immediate_action: 'Термінових дій не потрібно',
  overstock: 'На складі більше, ніж потрібно',
  slow_mover: 'Товар продається повільно',
  strong_demand: 'Товар добре продається',
  strong_to_order_demand: 'Є попит, але немає запасу',
  understock: 'Запасу може не вистачити',
  unknown_margin: 'Недостатньо даних про маржу',
}

const COMPONENT_LABELS: Record<string, string> = {
  abc: 'Внесок у продажі',
  margin: 'Прибутковість',
  returns: 'Продажі без повернень',
  stability: 'Стабільність попиту',
  stock: 'Відповідність запасу попиту',
  trend: 'Динаміка продажів',
}

const CLASS_LABELS: Record<string, string> = {
  dead: 'без продажів',
  declining: 'продажі знижуються',
  growing: 'продажі зростають',
  healthy: 'запас відповідає попиту',
  mature: 'стабільний попит',
  new: 'новий товар',
  order_to_demand: 'під замовлення',
  overstock: 'надлишковий запас',
  slow: 'продається повільно',
  understock: 'запасу недостатньо',
  unknown: 'недостатньо даних',
}

const ABC_LABELS: Record<string, string> = {
  A: 'високий',
  B: 'середній',
  C: 'низький',
}

const XYZ_LABELS: Record<string, string> = {
  X: 'стабільний',
  Y: 'мінливий',
  Z: 'нерегулярний',
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
    return 'недостатньо даних'
  }

  return CLASS_LABELS[value] ?? 'недостатньо даних'
}

function formatScore(score: number | null | undefined): string {
  return score == null ? 'Немає даних' : `${integer.format(Math.round(score))}/100`
}

function formatPercent(value: number | null | undefined): string {
  return value == null ? 'Немає даних' : `${(value * 100).toFixed(1)}%`
}

function formatNullableNumber(value: number | null | undefined): string {
  return value == null ? 'Немає даних' : decimal.format(value)
}

function formatDays(value: number): string {
  const rounded = Math.round(value)
  const absolute = Math.abs(rounded)
  const lastTwoDigits = absolute % 100
  const lastDigit = absolute % 10
  const unit = lastTwoDigits >= 11 && lastTwoDigits <= 14
    ? 'днів'
    : lastDigit === 1
      ? 'день'
      : lastDigit >= 2 && lastDigit <= 4
        ? 'дні'
        : 'днів'

  return `${rounded} ${unit}`
}

function scoreStatus(score: number | null): string {
  if (score === null) {
    return 'Недостатньо даних'
  }

  return score < 40 ? 'Потребує уваги' : score < 70 ? 'Середній рівень' : 'Добрий рівень'
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
        <Stat label={t('Залишок на складі')} value={formatNullableNumber(detail.qty_on_hand)} />
        <Stat label={t('Вартість залишку')} value={money.format(detail.eur_value)} />
        <Stat label={t('Маржа')} value={formatPercent(detail.margin_pct)} />
        <Stat
          label={t('Запасу вистачить')}
          value={detail.cover_days == null ? t('Немає даних') : formatDays(detail.cover_days)}
        />
      </SimpleGrid>

      <ProductSalesAnalytics analytics={analytics} error={analyticsError} />

      <SimpleGrid cols={{ base: 1, md: 3 }}>
        <ScoreCard
          description={t('Наскільки товар продається та чи відповідає запас попиту.')}
          label={t('Загальна оцінка товару')}
          score={detail.health}
          components={detail.health_components}
        />
        <ScoreCard
          description={t('Чи купують товар регулярно та як змінюються продажі.')}
          label={t('Попит на товар')}
          score={demandScore}
          components={detail.demand_components}
        />
        <ScoreCard
          description={t('Маржа, внесок у продажі та рівень повернень.')}
          label={t('Прибутковість і повернення')}
          score={marginScore}
          components={detail.margin_components}
        />
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
          {t('Загальна оцінка')}: {Math.round(detail.health)}/100
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
                {t('Що рекомендує система')}
              </Text>
              <Badge className={`app-role-pill ${ACTION_PILLS[actionLabel] ?? 'is-gray'}`} size="sm" variant="light">
                {t(ACTION_LABELS[actionLabel] ?? 'Перевірити товар')}
              </Badge>
            </Group>
            <Group gap={6}>
              {actionReasons.length === 0 ? (
                <Badge className="app-role-pill is-gray" size="xs" variant="light">
                  {t('Додаткових застережень немає')}
                </Badge>
              ) : (
                actionReasons.map((reason) => (
                  <Badge className="app-role-pill is-gray" key={reason} size="xs" variant="light">
                    {t(REASON_LABELS[reason] ?? 'Система знайшла сигнал, який потребує перевірки')}
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
          <Stat label={t('Продано за 12 місяців')} value={formatNullableNumber(detail.annual_units)} />
          <Stat label={t('Виручка за 12 місяців')} value={money.format(detail.revenue_eur)} />
          <Stat
            label={t('Собівартість одиниці')}
            value={detail.unit_cost_eur == null ? t('Немає даних') : preciseMoney.format(detail.unit_cost_eur)}
          />
          <Stat
            label={t('Середня ціна продажу')}
            value={detail.avg_price_eur == null ? t('Немає даних') : preciseMoney.format(detail.avg_price_eur)}
          />
        </SimpleGrid>
        <Group gap={6}>
          <Badge className="app-role-pill is-gray" variant="light">
            {t('Внесок у продажі')}: {t(ABC_LABELS[detail.abc] ?? 'недостатньо даних')} ({t('клас')} {detail.abc})
          </Badge>
          <Badge className="app-role-pill is-gray" variant="light">
            {t('Регулярність попиту')}: {t(XYZ_LABELS[detail.xyz] ?? 'недостатньо даних')} ({t('клас')} {detail.xyz})
          </Badge>
          <Badge className="app-role-pill is-gray" variant="light">
            {t('Стан запасу')}: {t(formatClass(detail.band))}
          </Badge>
          <Badge className="app-role-pill is-gray" variant="light">
            {t('Стадія попиту')}: {t(formatClass(detail.lifecycle))}
          </Badge>
          <Badge className="app-role-pill is-gray" variant="light">
            {detail.return_rate === 0
              ? t('Повернень не було')
              : `${t('Повернення')}: ${formatPercent(detail.return_rate)}`}
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
          {t('Доступні замінники')}
        </Text>
        {error ? (
          <Alert color="orange" icon={<CircleAlert size={16} />} variant="light">
            {error}
          </Alert>
        ) : (substitutes?.candidates ?? []).length === 0 ? (
          <Text c="dimmed" size="sm">
            {t('Замінників у наявності не знайдено.')}
          </Text>
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
          {t('Де купують товар')}
        </Text>
        {error ? (
          <Alert color="orange" icon={<CircleAlert size={16} />} variant="light">
            {error}
          </Alert>
        ) : (productRegions?.regions ?? []).length === 0 ? (
          <Text c="dimmed" size="sm">
            {t('За обраний період продажів у регіонах не було.')}
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
  description,
  label,
  score,
}: {
  components: Record<string, number> | undefined
  description: string
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
        <Stack gap={3}>
          <Text c="dimmed" size="xs">
            {description}
          </Text>
          <Text className={`assort-score-card__status ${scorePill(score)}`} size="xs">
            {t(scoreStatus(score))}
          </Text>
        </Stack>
        {entries.length === 0 ? (
          <Text c="dimmed" size="sm">
            {t('Недостатньо даних для детальної оцінки.')}
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
                    {integer.format(Math.round(entry.value * 100))}/100
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
