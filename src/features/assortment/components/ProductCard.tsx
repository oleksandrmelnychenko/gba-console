import { financialPeriod } from '../financials'
import { ACTION_LABELS, REASON_LABELS } from '../assortmentLabels'
import {
  Alert,
  Card,
  Button,
  Group,
  Loader,
  Progress,
  SimpleGrid,
  Stack,
  Text,
} from '@mantine/core'
import { CircleAlert, Factory, Package } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { TableChip, type TableChipTone } from '../../../shared/ui/TableChip'
import { getProduct, getProductAnalytics, getProductRegions, getProductSubstitutes } from '../api/assortmentApi'
import type { ProductAnalytics, ProductDetail, ProductRegions, ProductSubstitutes } from '../types'
import { ProductSalesAnalytics } from './ProductSalesAnalytics'
import './product-card.css'

const integer = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 })
const decimal = new Intl.NumberFormat('uk-UA', { maximumSignificantDigits: 15 })
const money = new Intl.NumberFormat('uk-UA', { currency: 'EUR', maximumFractionDigits: 0, style: 'currency' })
const preciseMoney = new Intl.NumberFormat('uk-UA', {
  currency: 'EUR',
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: 'currency',
})



const ACTION_TONES: Record<string, TableChipTone> = {
  discount_or_redistribute: 'warning',
  dead_stock_review: 'danger',
  fix_margin: 'danger',
  keep_push: 'success',
  margin_review: 'warning',
  monitor: 'neutral',
  monitor_decline: 'warning',
  quality_review: 'warning',
  reorder_check: 'warning',
  slow_mover_review: 'warning',
  to_order_candidate: 'success',
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

function healthTone(health: number): TableChipTone {
  return health < 40 ? 'danger' : health < 70 ? 'warning' : 'success'
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
  return value == null ? 'Немає даних' : `${new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 1 }).format(value * 100)}%`
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
        <Card className="assort-product-section" withBorder>
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
      <Card className="assort-product-section" withBorder>
        <Stack gap={6}>
          <Text className="assort-product-hero__name">{detail?.name ?? `ID ${detail?.product_id ?? ''}`}</Text>
          {detail?.vendor_code && (
            <TableChip tone="product" value={detail.vendor_code} />
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
    <Stack className="assort-product-card app-table-chips" gap={12}>
      <ProductHero detail={detail} producerId={producerId} producerName={producerName} />
      <ProductAiAction actionLabel={actionLabel} actionReasons={actionReasons} t={t} />

      <SimpleGrid className="assort-product-metrics" cols={{ base: 2, md: 4 }} spacing={12}>
        <Stat label={t('Залишок на складі')} value={formatNullableNumber(detail.qty_on_hand)} />
        <Stat label={t('Вартість залишку')} value={<>{decimal.format(detail.eur_value)} <TableChip tone="source" value="EUR" /></>} />
        <Stat label={t('Оцінена маржа')} value={formatPercent(detail.margin_pct)} />
        <Stat
          label={t('Запасу вистачить')}
          value={detail.cover_days == null ? '—' : <TableChip tone={detail.band === 'understock' ? 'warning' : 'neutral'} value={formatDays(detail.cover_days)} />}
        />
      </SimpleGrid>

      <ProductSalesAnalytics analytics={analytics} error={analyticsError} />

      <SimpleGrid className="assort-score-grid" cols={{ base: 1, md: 3 }} spacing={10}>
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
      <div className="assort-product-related">
        <SubstitutesPanel key={`substitutes-${productId}`} error={subsError} substitutes={subs} t={t} />
        <RegionsPanel key={`regions-${productId}`} error={regionsError} productRegions={productRegions} regionId={regionId} t={t} />
      </div>
    </Stack>
  )
}

type ProductCardTranslate = (key: string) => string

function ProductHero({
  detail,
  producerId,
  producerName,
}: {
  detail: ProductDetail
  producerId: number | null
  producerName: string
}) {
  return (
    <Card className="assort-product-hero" radius="md" withBorder>
      <Group align="center" gap={10} wrap="wrap">
          <Group gap={8} miw={0}>
            <Text className="assort-product-hero__name">{detail.name ?? detail.product_id}</Text>
            <TableChip tone="product" value={detail.vendor_code || `ID ${detail.product_id}`} />
          </Group>
          {producerId !== null && (
            <Group className="assort-product-hero__producer" gap={6} wrap="nowrap" miw={0}>
              <Factory size={14} />
              <TableChip tone="document" value={producerName || `#${producerId}`} />
            </Group>
          )}
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
      <Group gap={8}>
        <Text className="app-section-title" fw={600} size="sm">{t('Рекомендація')}</Text>
        <TableChip tone={ACTION_TONES[actionLabel] ?? 'neutral'} value={t(ACTION_LABELS[actionLabel] ?? 'Перевірити товар')} />
        {actionReasons.map(reason => <TableChip key={reason} value={t(REASON_LABELS[reason] ?? 'Потребує перевірки')} />)}
      </Group>
    </Card>
  )
}

function CommercialProfile({ detail, t }: { detail: ProductDetail; t: ProductCardTranslate }) {
  return (
    <Card className="assort-product-section" radius="md" withBorder>
      <details className="assort-score-details">
        <summary><span className="app-section-title">{t('Комерційний профіль')}</span></summary>
        <Stack gap={12}>
        <Text size="xs" c="dimmed">{financialPeriod(detail)}</Text>
        <SimpleGrid cols={{ base: 2, md: 4 }} spacing={10}>
          <Stat label={t('Продано за період')} value={formatNullableNumber(detail.annual_units)} />
          <Stat label={t('Продажі до повернень')} value={money.format(detail.revenue_eur)} />
          <Stat label={t('Продажі мінус повернення')} value={detail.net_revenue_eur == null ? `${t('Відома частина')}: ${detail.known_net_revenue_eur == null ? '—' : money.format(detail.known_net_revenue_eur)}` : money.format(detail.net_revenue_eur)} />
          <Stat
            label={t('Поточна собівартість одиниці')}
            value={detail.unit_cost_eur == null ? t('Немає даних') : preciseMoney.format(detail.unit_cost_eur)}
          />
          <Stat
            label={t('Середня ціна продажу')}
            value={detail.avg_price_eur == null ? t('Немає даних') : preciseMoney.format(detail.avg_price_eur)}
          />
        </SimpleGrid>
        <Group gap={6}>
          <TableChip value={`${t('Внесок у продажі')}: ${t(ABC_LABELS[detail.abc] ?? 'недостатньо даних')} (${t('клас')} ${detail.abc})`} />
          <TableChip value={`${t('Регулярність попиту')}: ${t(XYZ_LABELS[detail.xyz] ?? 'недостатньо даних')} (${t('клас')} ${detail.xyz})`} />
          <TableChip value={`${t('Стан запасу')}: ${t(formatClass(detail.band))}`} />
          <TableChip value={`${t('Стадія попиту')}: ${t(formatClass(detail.lifecycle))}`} />
          <TableChip value={detail.return_rate === 0
            ? t('Повернень не було')
            : `${t('Повернення')}: ${formatPercent(detail.return_rate)}`} />
        </Group>
        </Stack>
      </details>
    </Card>
  )
}

function relatedNumber(value: number | null | undefined, fractionDigits?: number) {
  if (value == null || !Number.isFinite(value)) return '—'
  return fractionDigits === undefined
    ? decimal.format(value)
    : new Intl.NumberFormat('uk-UA', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }).format(value)
}

function SubstitutesPanel({ error, substitutes, t }: {
  error: string | null
  substitutes: ProductSubstitutes | null
  t: ProductCardTranslate
}) {
  const [expanded, setExpanded] = useValueState(false)
  const candidates = substitutes?.candidates ?? []
  const visible = expanded ? candidates : candidates.slice(0, 6)
  return (
    <Card className="assort-product-section assort-related-panel" radius="md" withBorder>
      <Group justify="space-between" gap={6} mb={8}>
        <Text className="app-section-title" fw={600} size="sm">{t('Доступні замінники')}</Text>
        {!error && <TableChip value={candidates.length} title={t('Кількість замінників')} />}
      </Group>
      {error ? (
        <Alert color="gray" icon={<CircleAlert size={16} />} variant="outline">{error}</Alert>
      ) : candidates.length === 0 ? (
        <Text className="assort-related-empty" c="dimmed" size="sm">{t('Замінників у наявності не знайдено.')}</Text>
      ) : (
        <>
          <div className="assort-related-table" data-expanded={expanded} tabIndex={0} role="region" aria-label={t('Доступні замінники')}>
            <table>
              <thead><tr><th scope="col">{t('Товар')}</th><th scope="col">{t('Залишок')}</th><th scope="col">{t('Оцінка')}</th></tr></thead>
              <tbody>{visible.map(candidate => (
                <tr key={candidate.product_id}>
                  <td>
                    <div className="assort-related-name assort-related-product-name"><Package size={16} aria-hidden="true" />{candidate.name ?? candidate.product_id}</div>
                    <div className="assort-related-meta">
                      <TableChip tone="product" value={candidate.vendor_code || `ID ${candidate.product_id}`} />
                      {candidate.primary_producer_name && <TableChip tone="document" value={candidate.primary_producer_name} />}
                    </div>
                  </td>
                  <td><TableChip tone={candidate.qty_on_hand > 0 ? 'storage' : 'neutral'} value={relatedNumber(candidate.qty_on_hand)} /></td>
                  <td><TableChip tone={Number.isFinite(candidate.health) ? healthTone(candidate.health) : 'neutral'} value={Number.isFinite(candidate.health) ? `${Math.round(candidate.health)}/100` : '—'} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          {candidates.length > 6 && <Button className="assort-related-more" variant="subtle" color="gray" size="compact-xs" onClick={() => setExpanded(value => !value)} aria-expanded={expanded}>{expanded ? t('Згорнути') : `${t('Показати всі')} · ${candidates.length}`}</Button>}
        </>
      )}
    </Card>
  )
}

function RegionsPanel({ error, productRegions, regionId, t }: {
  error: string | null
  productRegions: ProductRegions | null
  regionId?: number
  t: ProductCardTranslate
}) {
  const [expanded, setExpanded] = useValueState(false)
  const regions = productRegions?.regions ?? []
  const visible = expanded ? regions : regions.slice(0, 6)
  return (
    <Card className="assort-product-section assort-related-panel" radius="md" withBorder>
      <Group justify="space-between" gap={6} mb={8}>
        <Text className="app-section-title" fw={600} size="sm">{t('Де купують товар')}</Text>
        {!error && <TableChip value={regions.length} title={t('Кількість регіонів')} />}
      </Group>
      {error ? (
        <Alert color="gray" icon={<CircleAlert size={16} />} variant="outline">{error}</Alert>
      ) : regions.length === 0 ? (
        <Text className="assort-related-empty" c="dimmed" size="sm">{t('За обраний період продажів у регіонах не було.')}</Text>
      ) : (
        <>
          <div className="assort-related-table" data-expanded={expanded} tabIndex={0} role="region" aria-label={t('Де купують товар')}>
            <table>
              <thead><tr><th scope="col">{t('Регіон')}</th><th scope="col">{t('К-сть')}</th><th scope="col" title={t('Замовлення')}>{t('Зам.')}</th><th scope="col">{t('Клієнти')}</th><th scope="col">{t('До повернень')} <TableChip tone="source" value="EUR" /></th><th scope="col">{t('Мінус повернення')} <TableChip tone="source" value="EUR" /></th></tr></thead>
              <tbody>{visible.map(region => (
                <tr key={region.region_id ?? 'unassigned'} aria-current={(region.region_id ?? 0) === regionId ? 'true' : undefined}>
                  <td><TableChip tone="document" value={region.region_name || (region.region_id == null ? t('Без регіону') : `#${region.region_id}`)} /></td>
                  <td>{relatedNumber(region.regional_units)}</td>
                  <td>{relatedNumber(region.regional_order_count)}</td>
                  <td>{relatedNumber(region.regional_client_count)}</td>
                  <td>{relatedNumber(region.regional_revenue_eur, 2)}</td>
                  <td>{region.net_revenue_eur === null ? `${t('Відома частина')}: ${relatedNumber(region.known_net_revenue_eur, 2)}` : relatedNumber(region.net_revenue_eur, 2)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          {regions.length > 6 && <Button className="assort-related-more" variant="subtle" color="gray" size="compact-xs" onClick={() => setExpanded(value => !value)} aria-expanded={expanded}>{expanded ? t('Згорнути') : `${t('Показати всі')} · ${regions.length}`}</Button>}
        </>
      )}
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
      <details className="assort-score-details">
        <summary>
          <span className="app-section-title">{label}</span>
          <TableChip tone={score === null ? 'neutral' : healthTone(score)} value={formatScore(score)} />
        </summary>
        <Stack gap={10}>
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
      </details>
    </Card>
  )
}

/* §7.2 metric: compact mono label and an unboxed mono value —
   no boxes around each number. */
function Stat({ label, value }: { label: string; value: ReactNode }) {
  const eur = typeof value === 'string' ? /^(.*)\sEUR$/.exec(value) : null
  return (
    <div>
      <span className="assort-stat__label app-section-title">{label}</span>
      <span className="assort-stat__value">{eur ? <>{eur[1]} <TableChip tone="source" value="EUR" /></> : value}</span>
    </div>
  )
}
