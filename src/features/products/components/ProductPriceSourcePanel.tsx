import { TableChip } from '../../../shared/ui/TableChip'
import {
  Alert,
  Box,
  Button,
  Group,
  SegmentedControl,
  Skeleton,
  Stack,
  Text,
} from '@mantine/core'
import { Building2, CircleAlert, Warehouse } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useProductSourcePrices } from '../useProductSourcePrices'
import {
  buildEffectivePricingOrder,
  compareSourcePricingNames,
  isPolishPricingName,
} from '../productSourcePricing'
import type {
  CalculatedProductPrice,
  ProductSourcePrice,
  ProductSourcePriceSet,
} from '../types'
import { formatAmount, formatPrice } from '../utils'

type PriceViewMode = 'amg' | 'fenix'

export function ProductPriceSourcePanel({
  effectivePrices,
  productNetId,
  refreshKey = 0,
}: {
  effectivePrices: CalculatedProductPrice[]
  productNetId?: string
  refreshKey?: number
}) {
  const { t } = useI18n()
  const [viewMode, setViewMode] = useState<PriceViewMode>('amg')
  const { comparison: currentComparison, error, isLoading, retry } = useProductSourcePrices(productNetId, refreshKey)

  // Keep the established GBA price-type order while showing only source data.
  const effectiveOrder = useMemo(() => buildEffectivePricingOrder(effectivePrices), [effectivePrices])


  return (
    <Stack gap={8}>
      <Group gap={6} wrap="nowrap">
        <SegmentedControl
          aria-label={t('Джерело цін')}
          className="product-price-source-control"
          data={[
            { label: <span className="product-price-source-label"><Building2 size={14} aria-hidden /><span>AMG</span></span>, value: 'amg' },
            { label: <span className="product-price-source-label"><Warehouse size={14} aria-hidden /><span>{t('Контех')}</span></span>, value: 'fenix' },
          ]}
          fullWidth
          color="brand"
          size="xs"
          value={viewMode}
          onChange={(value) => setViewMode(value as PriceViewMode)}
        />

      </Group>

      <div className="product-price-source-pane">
        {isLoading && !currentComparison && !error ? (
          <Stack gap={10} py={4}>
            {Array.from({ length: 8 }, (_, index) => (
              <Group gap="sm" key={index} wrap="nowrap">
                <Skeleton height={14} radius="sm" style={{ flex: 1 }} />
                <Skeleton height={14} radius="sm" width={80} />
                <Skeleton height={14} radius="sm" width={80} />
              </Group>
            ))}
          </Stack>
        ) : error ? (
          <Alert color="red" icon={<CircleAlert size={16} />} variant="light" role="alert">
            <Stack gap="xs">
              <Text size="sm">{error}</Text>
              <Button size="xs" variant="light" loading={isLoading} onClick={() => retry()}>
                {t('Повторити завантаження цін')}
              </Button>
            </Stack>
          </Alert>
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
    .sort((left, right) => compareSourcePricingNames(left.PricingName || '', right.PricingName || '', effectiveOrder))

  return (
    <>
      <PriceHeader localCurrencyCode={currencyCode} />
      <Stack className="product-price-source-list" gap={2}>
        {prices.length > 0 ? (
          prices.map((price) => <SourcePriceRow key={price.PricingName} price={price} />)
        ) : (
          <Text c="gray.8" size="sm">{t('Цін не знайдено')}</Text>
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
          <Text c="gray.8" lh={1.1} style={{ fontSize: 12 }}>
            {t('База EUR')}: <span className="app-money app-money-meta">{formatPrice(price.BasePriceEur)}</span>
          </Text>
          {typeof price.ExtraChargePercent === 'number' ? (
            <TableChip tone="document" value={formatSignedPercent(price.ExtraChargePercent)} />
          ) : null}
        </Group>
      ) : null}
    </Box>
  )
}

function PriceHeader({ localCurrencyCode }: { localCurrencyCode: string }) {
  const { t } = useI18n()

  return (
    <Group gap="sm" wrap="nowrap">
      <Text className="app-section-title" fw={600} size="sm" style={{ flex: 1, minWidth: 0 }}>{t('Тип ціни')}</Text>
      <Text c="gray.9" fw={600} size="sm" ta="right" style={{ flexShrink: 0, width: 80 }}><TableChip tone="source" value="EUR" /></Text>
      <Text c="gray.9" fw={600} size="sm" ta="right" style={{ flexShrink: 0, width: 80 }}><TableChip tone="source" value={localCurrencyCode} /></Text>
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

function SourceState({ color, text }: { color: string; text: string }) {
  return (
    <Alert color={color} icon={<CircleAlert size={16} />} variant="light">
      {text}
    </Alert>
  )
}

function hasSourcePriceValue(price?: ProductSourcePrice): boolean {
  return isFinitePrice(price?.PriceEur) || isFinitePrice(price?.PriceLocal)
}

function isFinitePrice(value?: number | null): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function formatSignedPercent(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${formatAmount(value)}%`
}
