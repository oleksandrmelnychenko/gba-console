import { useI18n } from '../../../../shared/i18n/useI18n'
import { DocumentDetailLayout } from '../../../../shared/ui/document-detail/DocumentDetail'
import type { WizardCalculatedProductPricing, WizardNearestSupplyOrder } from './newSaleWizardApi'
import type { WizardSaleProduct } from './wizardSaleProduct'
import type { WizardDetailChip, WizardDetailRow } from './wizardProductDetailModel'
import { ProductSummaryCard } from './ProductSummaryCard'
import { ProductStockPrices } from './ProductStockPrices'
import { ProductDescriptionSection } from './ProductDescriptionSection'
import { ProductAvailabilitySection } from './ProductAvailabilitySection'
import { WizardAiPriceHint } from './WizardAiPriceHint'
import './product-full-detail-panel.css'

export type { WizardDetailChip, WizardDetailRow } from './wizardProductDetailModel'

export function ProductFullDetailPanel({
  canEditDescription,
  chips,
  clientAgreementNetId,
  currentPriceEur,
  descriptionDraft,
  detailsError,
  isFullDetail,
  isEditingDescription,
  isLoadingDetails = false,
  isVatSale,
  localCurrencyCode = 'UAH',
  nearestSupplyOrder,
  pricing,
  product,
  rows,
  selectedChipIndex,
  selectedRowIndex,
  showSummary = true,
  showRowDetails,
  displayQty,
  onDescriptionDraftChange,
  onOpenImage,
  onRetryDetails,
  onSelectChip,
  onToggleDescription,
}: {
  canEditDescription: boolean
  chips: WizardDetailChip[]
  clientAgreementNetId?: string | null
  currentPriceEur?: number | null
  descriptionDraft: string
  detailsError?: string | null
  isFullDetail: boolean
  isEditingDescription: boolean
  isLoadingDetails?: boolean
  isVatSale: boolean
  localCurrencyCode?: string
  nearestSupplyOrder?: WizardNearestSupplyOrder | null
  pricing: WizardCalculatedProductPricing | null
  product: WizardSaleProduct
  rows: WizardDetailRow[]
  selectedChipIndex: number | null
  selectedRowIndex: number | null
  showSummary?: boolean
  showRowDetails: boolean
  displayQty?: number
  onDescriptionDraftChange: (value: string) => void
  onOpenImage?: () => void
  onRetryDetails?: () => void
  onSelectChip?: (index: number) => void
  onToggleDescription: () => void
}) {
  const { t } = useI18n()
  return (
    <section aria-label={t('Детальна інформація про товар')} className="new-sale-product-detail">
      <DocumentDetailLayout summary={null}>
        {showSummary && <ProductSummaryCard variant="detail" currentPriceEur={currentPriceEur} displayQty={displayQty} localCurrencyCode={localCurrencyCode} pricing={pricing} product={product} onOpenImage={onOpenImage} />}
        <div className="new-sale-product-detail__columns">
          <ProductStockPrices
            product={product}
            isVatSale={isVatSale}
            localCurrencyCode={localCurrencyCode}
            displayQty={displayQty}
            isFullDetail={isFullDetail}
            discountRate={pricing?.DiscountRate ?? null}
            nearestSupplyOrder={nearestSupplyOrder}
          />
          <ProductDescriptionSection
            key={product.NetUid || product.VendorCode || product.Articul}
            canEditDescription={canEditDescription}
            description={product.Description}
            descriptionDraft={descriptionDraft}
            isEditingDescription={isEditingDescription}
            onDescriptionDraftChange={onDescriptionDraftChange}
            onToggleDescription={onToggleDescription}
          />
        </div>
        <ProductAvailabilitySection
          chips={chips}
          rows={rows}
          selectedChipIndex={selectedChipIndex}
          selectedRowIndex={selectedRowIndex}
          isFullDetail={isFullDetail}
          isLoadingDetails={isLoadingDetails}
          detailsError={detailsError}
          showRowDetails={showRowDetails}
          measureUnit={product.MeasureUnit?.Name || t('шт')}
          onSelectChip={onSelectChip}
          onRetryDetails={onRetryDetails}
        />
        <WizardAiPriceHint clientAgreementNetId={clientAgreementNetId} productNetId={product.NetUid} withVat={isVatSale} />
      </DocumentDetailLayout>
    </section>
  )
}
