import { Alert, Badge, Box, Button, Group, Progress, Skeleton, Text } from '@mantine/core'
import { CircleAlert, Package, ShoppingCart, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { AppModal } from '../../../../shared/ui/AppModal'
import { CREATE_ACTION_COLOR } from '../../../../shared/ui/page-header-actions/PageHeaderActions'
import { getProductMainImage, getProductShopImageUrl } from '../../../products/utils'
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

  const visibleProducts = products.filter((product) => !product.NetUid || !excludeNetUids.has(product.NetUid))
  const maximumSellable = Math.max(
    0,
    ...visibleProducts.map((product) => getWizardSellableQty(product, isVatSale) ?? 0),
  )

  return (
    <AppModal
      centered
      className="wizard-cross-sell-modal"
      opened={opened}
      size="min(1240px, calc(100vw - 32px))"
      title={
        <Group gap={8} wrap="nowrap">
          <Sparkles size={16} />
          <Text fw={600}>
            {seedProduct?.VendorCode
              ? `${t('З цим товаром купують')} · ${seedProduct.VendorCode}`
              : t('Кросс-продажі для клієнта')}
          </Text>
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
              <Text c="dimmed" size="xs">{t('Товари впорядковані за силою рекомендації')}</Text>
            </div>
            <Badge className="app-role-pill is-orange" size="sm" variant="light">
              {isLoading ? '…' : visibleProducts.length}
            </Badge>
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
        <Badge className="app-role-pill is-gray" size="xs" variant="light">
          {recommendationCount} {t('зв’язків')}
        </Badge>
      </div>
      <ProductArtwork className="wizard-cross-sell-seed__image" product={product} />
      <div className="wizard-cross-sell-seed__copy">
        <span className="wizard-cross-sell-code">{product?.VendorCode || product?.Articul || ''}</span>
        <strong title={product?.NameUA || product?.Name || undefined}>
          {product?.NameUA || product?.Name || t('Товар')}
        </strong>
      </div>
      <div className="wizard-cross-sell-seed__metrics">
        <ProductMetric label={t('Наявність')} value={`${qtyFormatter.format(sellable)} ${product?.MeasureUnit?.Name ?? ''}`} />
        <ProductMetric label="EUR" value={amountFormatter.format(getWizardProductNumber(product?.CurrentPrice) ?? 0)} />
        <ProductMetric label={localCurrencyCode} value={amountFormatter.format(localPrice)} />
      </div>
      <div className="wizard-cross-sell-seed__hint">
        <Sparkles size={14} />
        <span>{t('Від цього товару побудована добірка')}</span>
      </div>
    </section>
  )
}

function CrossSellProductCard({
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
  const facts = [product.MainOriginalNumber, product.Top, product.Size]
    .filter((value): value is string => Boolean(value?.trim()))
    .slice(0, 2)

  return (
    <article className="wizard-cross-sell-card">
      <span className="wizard-cross-sell-card__rank" aria-label={`${t('Рекомендація')} ${rank}`}>
        {String(rank).padStart(2, '0')}
      </span>
      <ProductArtwork className="wizard-cross-sell-card__image" product={product} />
      <div className="wizard-cross-sell-card__body">
        <div className="wizard-cross-sell-card__headline">
          <span className="wizard-cross-sell-code">{code}</span>
          {facts.length > 0 && (
            <span className="wizard-cross-sell-card__facts">
              {facts.map((fact) => <span key={fact}>{fact}</span>)}
            </span>
          )}
        </div>
        <strong className="wizard-cross-sell-card__name" title={name}>{name}</strong>
        <div className="wizard-cross-sell-card__metrics">
          <ProductMetric label={t('Наявність')} value={`${qtyFormatter.format(sellable)} ${product.MeasureUnit?.Name ?? ''}`} />
          <ProductMetric label="EUR" value={amountFormatter.format(getWizardProductNumber(product.CurrentPrice) ?? 0)} />
          <ProductMetric label={localCurrencyCode} value={amountFormatter.format(localPrice)} />
        </div>
        <div className="wizard-cross-sell-card__availability">
          <span>{sellable > 0 ? t('Є в наявності') : t('Немає в наявності')}</span>
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
    </article>
  )
}

function ProductMetric({ label, value }: { label: string; value: string }) {
  return (
    <span className="wizard-cross-sell-metric">
      <small>{label}</small>
      <strong>{value}</strong>
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
          <Skeleton height={76} radius={10} width={76} />
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
