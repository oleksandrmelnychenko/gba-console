import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Group,
  SegmentedControl,
  Skeleton,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core'
import { CircleAlert, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getProductSourcePriceComparison } from '../api/productsApi'
import { buildProductSourceComparisonRows, isPolishPricingName } from '../productSourcePricing'
import type {
  CalculatedProductPrice,
  ProductSourcePrice,
  ProductSourcePriceComparison,
  ProductSourcePriceSet,
} from '../types'
import { formatAmount, formatPrice } from '../utils'

type PriceViewMode = 'amg' | 'fenix' | 'compare'

type SourcePriceCacheEntry = {
  expiresAt: number
  value: ProductSourcePriceComparison
}

const SOURCE_PRICE_CACHE_TTL_MS = 2 * 60 * 1000
const SOURCE_PRICE_CACHE_LIMIT = 100
const sourcePriceCache = new Map<string, SourcePriceCacheEntry>()

const differenceFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  signDisplay: 'exceptZero',
})

export function ProductPriceSourcePanel({
  effectivePrices,
  productNetId,
}: {
  effectivePrices: CalculatedProductPrice[]
  productNetId?: string
}) {
  const { t } = useI18n()
  const [viewMode, setViewMode] = useState<PriceViewMode>('compare')
  const [comparison, setComparison] = useState<ProductSourcePriceComparison | null>(null)
  const [failedProductNetId, setFailedProductNetId] = useState<string | null>(null)
  const [reloadVersion, setReloadVersion] = useState(0)
  const shouldLoadSources = Boolean(productNetId)
  const currentComparison = comparison?.ProductNetId === productNetId
    ? comparison
    : productNetId
      ? getCachedSourcePrices(productNetId)
      : null
  const hasError = failedProductNetId === productNetId
  const isLoading = shouldLoadSources && !currentComparison && !hasError

  useEffect(() => {
    if (!shouldLoadSources || !productNetId) {
      return
    }

    const cached = getCachedSourcePrices(productNetId)

    if (cached) {
      return
    }

    const controller = new AbortController()

    void getProductSourcePriceComparison(productNetId, controller.signal)
      .then((result) => {
        if (!result) {
          setFailedProductNetId(productNetId)
          return
        }

        cacheSourcePrices(productNetId, result)
        setComparison({ ...result })
        setFailedProductNetId(null)
      })
      .catch((error: unknown) => {
        if (!isAbortError(error)) {
          setFailedProductNetId(productNetId)
        }
      })

    return () => controller.abort()
  }, [productNetId, reloadVersion, shouldLoadSources])

  // Keep the established GBA price-type order while showing only source data.
  const effectiveOrder = useMemo(() => buildEffectivePricingOrder(effectivePrices), [effectivePrices])
  const comparisonRows = useMemo(
    () =>
      buildProductSourceComparisonRows(currentComparison?.Amg, currentComparison?.Fenix)
        .filter((row) => hasSourcePriceValue(row.amg) || hasSourcePriceValue(row.fenix))
        .sort((left, right) => compareByEffectiveOrder(left.pricingName, right.pricingName, effectiveOrder)),
    [currentComparison?.Amg, currentComparison?.Fenix, effectiveOrder],
  )

  const refreshSourcePrices = () => {
    if (productNetId) {
      sourcePriceCache.delete(productNetId)
    }

    setComparison(null)
    setFailedProductNetId(null)
    setReloadVersion((current) => current + 1)
  }

  return (
    <Stack gap={8}>
      <Group gap={6} wrap="nowrap">
        <SegmentedControl
          aria-label={t('Джерело цін')}
          className="product-price-source-control"
          data={[
            { label: 'AMG', value: 'amg' },
            { label: t('Контех'), value: 'fenix' },
            { label: t('Порівняти'), value: 'compare' },
          ]}
          fullWidth
          size="xs"
          value={viewMode}
          onChange={(value) => setViewMode(value as PriceViewMode)}
        />
        <Tooltip label={t('Оновити ціни з джерел')}>
          <ActionIcon
            aria-label={t('Оновити ціни з джерел')}
            color="gray"
            loading={isLoading}
            size="sm"
            variant="subtle"
            onClick={refreshSourcePrices}
          >
            <RefreshCw size={15} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <div className="product-price-source-pane">
        {isLoading && !currentComparison ? (
          <Stack gap={10} py={4}>
            {Array.from({ length: 8 }, (_, index) => (
              <Group gap="sm" key={index} wrap="nowrap">
                <Skeleton height={14} radius="sm" style={{ flex: 1 }} />
                <Skeleton height={14} radius="sm" width={80} />
                <Skeleton height={14} radius="sm" width={80} />
              </Group>
            ))}
          </Stack>
        ) : hasError ? (
          <Alert color="red" icon={<CircleAlert size={16} />} variant="light">
            {t('Не вдалося завантажити ціни з джерел')}
          </Alert>
        ) : viewMode === 'compare' ? (
          <ComparisonPricesView
            amg={currentComparison?.Amg}
            fenix={currentComparison?.Fenix}
            rows={comparisonRows}
          />
        ) : (
          <SourcePricesView
            currencyCode={currentComparison?.LocalCurrencyCode || 'UAH'}
            effectiveOrder={effectiveOrder}
            label={viewMode === 'amg' ? 'AMG' : t('Контех')}
            source={viewMode === 'amg' ? currentComparison?.Amg : currentComparison?.Fenix}
          />
        )}
      </div>
    </Stack>
  )
}

function SourcePricesView({
  currencyCode,
  effectiveOrder,
  label,
  source,
}: {
  currencyCode: string
  effectiveOrder: Map<string, number>
  label: string
  source?: ProductSourcePriceSet | null
}) {
  const { t } = useI18n()

  if (!source?.IsLinked) {
    return <SourceState color="gray" text={t('Товар не прив’язаний до джерела')} />
  }

  if (!source.IsAvailable) {
    return <SourceState color="red" text={`${label}: ${t('Джерело цін недоступне')}`} />
  }

  const prices = (source.Prices || [])
    .filter((price) => !isPolishPricingName(price.PricingName) && hasSourcePriceValue(price))
    .sort((left, right) => compareByEffectiveOrder(left.PricingName || '', right.PricingName || '', effectiveOrder))

  return (
    <>
      <PriceHeader localCurrencyCode={currencyCode} />
      <Stack className="product-price-source-list" gap={2}>
        {prices.length > 0 ? (
          prices.map((price) => <SourcePriceRow key={price.PricingName} price={price} />)
        ) : (
          <Text c="dimmed" size="sm">{t('Цін не знайдено')}</Text>
        )}
      </Stack>
    </>
  )
}

function SourcePriceRow({ price }: { price: ProductSourcePrice }) {
  const { t } = useI18n()
  const showDetails = price.IsCalculated || (
    typeof price.BasePriceEur === 'number' && price.BasePriceEur !== price.PriceEur
  )

  return (
    <Box className="product-inline-price-row">
      <Group gap="sm" wrap="nowrap">
        <Text lineClamp={1} size="sm" style={{ flex: 1, minWidth: 0 }}>{price.PricingName || '-'}</Text>
        <PriceValue value={price.PriceEur} />
        <PriceValue value={price.PriceLocal} />
      </Group>
      {showDetails ? (
        <Group gap={6} mt={1} wrap="wrap">
          <Text c="dimmed" lh={1.1} style={{ fontSize: 12 }}>
            {t('База EUR')}: {formatPrice(price.BasePriceEur)}
          </Text>
          {typeof price.ExtraChargePercent === 'number' ? (
            <Badge color="gray" size="xs" variant="light">
              {formatSignedPercent(price.ExtraChargePercent)}
            </Badge>
          ) : null}
        </Group>
      ) : null}
    </Box>
  )
}

function ComparisonPricesView({
  amg,
  fenix,
  rows,
}: {
  amg?: ProductSourcePriceSet | null
  fenix?: ProductSourcePriceSet | null
  rows: ReturnType<typeof buildProductSourceComparisonRows>
}) {
  const { t } = useI18n()

  return (
    <Stack gap={6}>
      <Group gap={6} wrap="wrap">
        <SourceStatusBadge label="AMG" source={amg} />
        <SourceStatusBadge label={t('Контех')} source={fenix} />
      </Group>
      <div className="product-price-compare-header">
        <Text c="dimmed" size="xs">{t('Тип ціни')}</Text>
        <Text c="dimmed" size="xs" ta="right">AMG</Text>
        <Text c="dimmed" size="xs" ta="right">{t('Контех')}</Text>
        <Text c="dimmed" size="xs" ta="right">Δ EUR</Text>
      </div>
      <Stack className="product-price-source-list" gap={2}>
        {rows.length > 0 ? rows.map((row) => (
          <div className="product-price-compare-row" key={row.pricingName}>
            <Text lineClamp={1} size="sm">{row.pricingName}</Text>
            <Text className="app-money" fw={650} size="sm" ta="right">{formatPrice(row.amg?.PriceEur)}</Text>
            <Text className="app-money" fw={650} size="sm" ta="right">{formatPrice(row.fenix?.PriceEur)}</Text>
            <Text
              className={`app-money ${getDifferenceClass(row.differenceEur)}`}
              fw={650}
              size="sm"
              ta="right"
            >
              {formatDifference(row.differenceEur)}
            </Text>
          </div>
        )) : (
          <Text c="dimmed" size="sm">{t('Цін не знайдено')}</Text>
        )}
      </Stack>
    </Stack>
  )
}

function PriceHeader({ localCurrencyCode }: { localCurrencyCode: string }) {
  const { t } = useI18n()

  return (
    <Group gap="sm" wrap="nowrap">
      <Text className="app-section-title" fw={600} size="sm" style={{ flex: 1, minWidth: 0 }}>{t('Тип ціни')}</Text>
      <Text c="gray.9" fw={600} size="sm" ta="right" style={{ flexShrink: 0, width: 80 }}>EUR</Text>
      <Text c="gray.9" fw={600} size="sm" ta="right" style={{ flexShrink: 0, width: 80 }}>{localCurrencyCode}</Text>
    </Group>
  )
}

function PriceValue({ value }: { value?: number | null }) {
  return (
    <Text className="app-money" fw={650} size="sm" ta="right" style={{ flexShrink: 0, width: 80 }}>
      {formatPrice(value)}
    </Text>
  )
}

function SourceStatusBadge({ label, source }: { label: string; source?: ProductSourcePriceSet | null }) {
  const { t } = useI18n()
  const status = !source?.IsLinked
    ? { color: 'gray', text: t('немає зв’язку') }
    : !source.IsAvailable
      ? { color: 'red', text: t('недоступне') }
      : { color: 'teal', text: t('актуальне') }

  return (
    <Badge color={status.color} size="sm" variant="light">
      {label}: {status.text}
    </Badge>
  )
}

function SourceState({ color, text }: { color: string; text: string }) {
  return (
    <Alert color={color} icon={<CircleAlert size={16} />} variant="light">
      {text}
    </Alert>
  )
}

function getCachedSourcePrices(productNetId: string): ProductSourcePriceComparison | null {
  const cached = sourcePriceCache.get(productNetId)

  if (!cached) {
    return null
  }

  if (cached.expiresAt <= Date.now()) {
    sourcePriceCache.delete(productNetId)
    return null
  }

  return cached.value
}

function cacheSourcePrices(productNetId: string, value: ProductSourcePriceComparison) {
  if (sourcePriceCache.size >= SOURCE_PRICE_CACHE_LIMIT) {
    const oldestKey = sourcePriceCache.keys().next().value

    if (oldestKey) {
      sourcePriceCache.delete(oldestKey)
    }
  }

  sourcePriceCache.set(productNetId, {
    expiresAt: Date.now() + SOURCE_PRICE_CACHE_TTL_MS,
    value,
  })
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

/* CalculatedPrices preserve the established business order of price types. */
function buildEffectivePricingOrder(prices: CalculatedProductPrice[]): Map<string, number> {
  const order = new Map<string, number>()

  prices.forEach((price, index) => {
    const name = price.Pricing?.Name?.trim().toLocaleLowerCase('uk')

    if (name && !order.has(name)) {
      order.set(name, index)
    }
  })

  return order
}

function compareByEffectiveOrder(leftName: string, rightName: string, order: Map<string, number>): number {
  const left = order.get(leftName.trim().toLocaleLowerCase('uk')) ?? Number.MAX_SAFE_INTEGER
  const right = order.get(rightName.trim().toLocaleLowerCase('uk')) ?? Number.MAX_SAFE_INTEGER

  return left === right ? leftName.localeCompare(rightName, 'uk', { sensitivity: 'base' }) : left - right
}

function hasSourcePriceValue(price?: ProductSourcePrice): boolean {
  return isFinitePrice(price?.PriceEur) || isFinitePrice(price?.PriceLocal)
}

function isFinitePrice(value?: number | null): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function formatDifference(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? differenceFormatter.format(value)
    : '-'
}

function formatSignedPercent(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${formatAmount(value)}%`
}

function getDifferenceClass(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) < 0.005) {
    return 'is-equal'
  }

  return value > 0 ? 'is-higher' : 'is-lower'
}
