import { Alert, Badge, Box, Button, Group, Progress, Skeleton, Text } from '@mantine/core'
import { CircleAlert, Package, ShoppingCart, Sparkles } from 'lucide-react'
import { memo, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { TableChip, type TableChipTone } from '../../../../shared/ui/TableChip'
import { AppModal } from '../../../../shared/ui/AppModal'
import { CREATE_ACTION_COLOR } from '../../../../shared/ui/page-header-actions/PageHeaderActions'
import { getProductMainImage, getProductMainOriginalNumber, getProductShopImageUrl, isCriticalProductTop } from '../../../products/utils'
import { getProductCoPurchaseRecommendations } from '../../../clients/api/clientRecommendationsApi'
import { getWizardProductNumber, getWizardSellableQty, type WizardSaleProduct } from './wizardSaleProduct'
import './wizard-cross-sell-modal.css'

const amountFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
const qtyFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3 })

// Co-purchase (cross-sell) picker for the sale wizard cart: «з цим зазвичай беруть ще й це».
// The AI service returns ranked product ids; the system endpoint hydrates them with the
// agreement-scoped availability and prices, so the cards here match search-result numbers.
export function WizardCrossSellModal({
  agreementNetId,
  clientNetId,
  excludeNetUids,
  isVatSale,
  localCurrencyCode,
  opened,
  zIndex,
  seedProduct,
  useEurToUah,
  onClose,
  onPick,
}: {
  agreementNetId: string | null
  clientNetId: string | null
  excludeNetUids: Set<string>
  isVatSale: boolean
  localCurrencyCode: string
  opened: boolean
  zIndex?: number
  seedProduct: WizardSaleProduct | null
  useEurToUah: boolean
  onClose: () => void
  onPick: (product: WizardSaleProduct) => void
}) {
  const { t } = useI18n()
  const [products, setProducts] = useState<WizardSaleProduct[]>([])
  const [isLoading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!opened || !clientNetId) {
      return
    }

    const controller = new AbortController()
    const loadTimer = window.setTimeout(() => {
      setLoading(true)
      setError(null)

      getProductCoPurchaseRecommendations(seedProduct?.NetUid ?? '', clientNetId, false, {
        clientAgreementNetId: agreementNetId ?? undefined,
        signal: controller.signal,
      })
        .then((items) => {
          if (!controller.signal.aborted) {
            setProducts(items as unknown as WizardSaleProduct[])
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setError(t('Не вдалося завантажити кросс-продажі'))
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoading(false)
          }
        })
    }, 0)

    return () => {
      window.clearTimeout(loadTimer)
      controller.abort()
    }
  }, [opened, clientNetId, agreementNetId, seedProduct?.NetUid, t])

  const visibleProducts = useMemo(
    () => products.filter((product) => !product.NetUid || !excludeNetUids.has(product.NetUid)),
    [excludeNetUids, products],
  )
  const maximumSellable = useMemo(() => {
    let maximum = 0

    for (const product of visibleProducts) {
      maximum = Math.max(maximum, getWizardSellableQty(product, isVatSale) ?? 0)
    }

    return maximum
  }, [isVatSale, visibleProducts])

  return (
    <AppModal
      zIndex={zIndex}
      centered
      className="wizard-cross-sell-modal"
      opened={opened}
      size="min(1240px, calc(100vw - 32px))"
      title={
        <Group gap={8} wrap="nowrap">
          <Sparkles className="wizard-cross-sell-ai-icon" size={16} fill="currentColor" strokeWidth={0} />
          <Text fw={600}>
            {seedProduct?.VendorCode ? t('З цим товаром купують') : t('Кросс-продажі для клієнта')}
          </Text>
          {seedProduct?.VendorCode && <TableChip tone="product" value={seedProduct.VendorCode} />}
        </Group>
      }
      onClose={onClose}
    >
      <div className="wizard-cross-sell-graph">
        <SeedProductCard
          isVatSale={isVatSale}
          localCurrencyCode={localCurrencyCode}
          product={seedProduct}
          recommendationCount={visibleProducts.length}
          useEurToUah={useEurToUah}
        />

        <section className="wizard-cross-sell-related" aria-busy={isLoading || undefined}>
          <header className="wizard-cross-sell-related__head">
            <div>
              <Text className="app-section-title" fw={600}>{t('Разом купують')}</Text>
            </div>
            <TableChip value={isLoading ? '…' : visibleProducts.length} />
          </header>

          <div className="wizard-cross-sell-related__scroll">
            {error ? (
              <Alert color="orange" icon={<CircleAlert size={18} />} variant="light">
                {error}
              </Alert>
            ) : isLoading ? (
              <CrossSellLoadingCards />
            ) : visibleProducts.length === 0 ? (
              <div className="wizard-cross-sell-empty">
                <Package size={22} strokeWidth={1.6} />
                <strong>{t('Пов’язаних товарів поки немає')}</strong>
                <span>{t('Для цього товару ще недостатньо спільних покупок')}</span>
              </div>
            ) : (
              <div className="wizard-cross-sell-related__list">
                {visibleProducts.map((product, index) => (
                  <CrossSellProductCard
                    key={product.NetUid || product.VendorCode || index}
                    isVatSale={isVatSale}
                    localCurrencyCode={localCurrencyCode}
                    maximumSellable={maximumSellable}
                    product={product}
                    rank={index + 1}
                    useEurToUah={useEurToUah}
                    onPick={onPick}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </AppModal>
  )
}

function SeedProductCard({
  isVatSale,
  localCurrencyCode,
  product,
  recommendationCount,
  useEurToUah,
}: {
  isVatSale: boolean
  localCurrencyCode: string
  product: WizardSaleProduct | null
  recommendationCount: number
  useEurToUah: boolean
}) {
  const { t } = useI18n()
  const sellable = product ? getWizardSellableQty(product, isVatSale) ?? 0 : 0
  const localPrice = product
    ? (useEurToUah
        ? getWizardProductNumber(product.CurrentPriceEurToUah)
        : getWizardProductNumber(product.CurrentLocalPrice)) ?? 0
    : 0

  return (
    <section className="wizard-cross-sell-seed">
      <div className="wizard-cross-sell-seed__eyebrow">
        <span>{t('Основний товар')}</span>
        <TableChip value={`${recommendationCount} ${t('зв’язків')}`} />
      </div>
      <ProductArtwork className="wizard-cross-sell-seed__image" product={product} />
      <div className="wizard-cross-sell-seed__copy">
        <TableChip tone="product" value={product?.VendorCode || product?.Articul} />
        <strong title={product?.NameUA || product?.Name || undefined}>
          {product?.NameUA || product?.Name || t('Товар')}
        </strong>
      </div>
      <div className="wizard-cross-sell-seed__metrics">
        <ProductMetric quantity label={t('Наявність')} value={`${qtyFormatter.format(sellable)} ${product?.MeasureUnit?.Name ?? ''}`} />
        <ProductMetric currency label="EUR" value={amountFormatter.format(getWizardProductNumber(product?.CurrentPrice) ?? 0)} />
        <ProductMetric currency label={localCurrencyCode} value={amountFormatter.format(localPrice)} />
      </div>
    </section>
  )
}

const CrossSellProductCard = memo(function CrossSellProductCard({
  isVatSale,
  localCurrencyCode,
  maximumSellable,
  product,
  rank,
  useEurToUah,
  onPick,
}: {
  isVatSale: boolean
  localCurrencyCode: string
  maximumSellable: number
  product: WizardSaleProduct
  rank: number
  useEurToUah: boolean
  onPick: (product: WizardSaleProduct) => void
}) {
  const { t } = useI18n()
  const sellable = getWizardSellableQty(product, isVatSale) ?? 0
  const localPrice =
    (useEurToUah
      ? getWizardProductNumber(product.CurrentPriceEurToUah)
      : getWizardProductNumber(product.CurrentLocalPrice)) ?? 0
  const availabilityPercent = maximumSellable > 0 ? Math.min(100, (sellable / maximumSellable) * 100) : 0
  const code = product.VendorCode || product.Articul || ''
  const name = product.NameUA || product.Name || ''
  const facts: { key: string; value?: string | null; tone: TableChipTone }[] = [
    { key: 'original', value: getProductMainOriginalNumber(product), tone: 'warning' },
    { key: 'top', value: product.Top, tone: isCriticalProductTop(product.Top) ? 'danger' : 'neutral' },
    { key: 'size', value: product.Size, tone: 'warning' },
  ]

  return (
    <article className="wizard-cross-sell-card">
      <Badge
        className="app-role-pill is-gray wizard-cross-sell-card__rank"
        aria-label={`${t('Рекомендація')} ${rank}`}
        size="xs"
        variant="light"
      >
        {String(rank).padStart(2, '0')}
      </Badge>
      <div className="wizard-cross-sell-card__content">
        <ProductArtwork className="wizard-cross-sell-card__image" product={product} />
        <div className="wizard-cross-sell-card__body">
          <div className="wizard-cross-sell-card__headline">
            <TableChip tone="product" value={code} />
            {facts.length > 0 && (
              <span className="wizard-cross-sell-card__facts">
                {facts.filter((fact) => fact.value && !['-', '—'].includes(fact.value.trim())).map((fact) => <TableChip key={fact.key} tone={fact.tone} value={fact.value} />)}
              </span>
            )}
          </div>
          <strong className="wizard-cross-sell-card__name" title={name}>{name}</strong>
          <div className="wizard-cross-sell-card__metrics">
            <ProductMetric quantity label={t('Наявність')} value={`${qtyFormatter.format(sellable)} ${product.MeasureUnit?.Name ?? ''}`} />
            <ProductMetric currency label="EUR" value={amountFormatter.format(getWizardProductNumber(product.CurrentPrice) ?? 0)} />
            <ProductMetric currency label={localCurrencyCode} value={amountFormatter.format(localPrice)} />
          </div>
          <div className="wizard-cross-sell-card__availability">
            <TableChip tone={sellable > 0 ? 'success' : 'danger'} value={sellable > 0 ? t('Є в наявності') : t('Немає в наявності')} />
            <Progress
              aria-label={t('Відносний залишок')}
              color={sellable > 0 ? 'green' : 'gray'}
              radius="xl"
              size={5}
              value={availabilityPercent}
            />
          </div>
        </div>
        <Button
          className="wizard-cross-sell-card__action"
          color={CREATE_ACTION_COLOR}
          leftSection={<ShoppingCart size={15} />}
          size="compact-sm"
          onClick={() => onPick(product)}
        >
          {t('В кошик')}
        </Button>
      </div>
    </article>
  )
})

function ProductMetric({ currency = false, quantity = false, label, value }: { currency?: boolean; quantity?: boolean; label: string; value: string }) {
  return (
    <span className="wizard-cross-sell-metric">
      <small>{currency ? <TableChip tone="source" value={label} /> : label}</small>
      <strong>{quantity ? <TableChip value={value} /> : value}</strong>
    </span>
  )
}

function ProductArtwork({ className, product }: { className: string; product: WizardSaleProduct | null }) {
  const code = product?.VendorCode || product?.Articul || ''
  const imageUrl = product ? getProductMainImage(product)?.ImageUrl || getProductShopImageUrl(product) : ''
  const [failedImageUrl, setFailedImageUrl] = useState('')

  return (
    <Box className={`wizard-cross-sell-artwork ${className}`}>
      {imageUrl && failedImageUrl !== imageUrl ? (
        <img alt={code} loading="lazy" src={imageUrl} onError={() => setFailedImageUrl(imageUrl)} />
      ) : (
        <Package aria-hidden="true" size={28} strokeWidth={1.5} />
      )}
    </Box>
  )
}

function CrossSellLoadingCards() {
  return (
    <div className="wizard-cross-sell-loading">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="wizard-cross-sell-loading__card">
          <Skeleton height={112} radius={12} width={112} />
          <div>
            <Skeleton height={10} mb={10} radius="xl" width="32%" />
            <Skeleton height={13} mb={14} radius="xl" width="78%" />
            <Skeleton height={22} radius={7} width="92%" />
          </div>
          <Skeleton height={34} radius={8} width={106} />
        </div>
      ))}
    </div>
  )
}
