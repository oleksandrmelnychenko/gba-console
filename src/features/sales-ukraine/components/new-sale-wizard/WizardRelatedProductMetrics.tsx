import { Box, Text } from '@mantine/core'
import { TableChip } from '../../../../shared/ui/TableChip'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { getWizardProductNumber, getWizardSellableQty, type WizardSaleProduct } from './wizardSaleProduct'

const amountFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
const qtyFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3 })

export function WizardRelatedProductMetrics({ product, setQty, isVatSale, localCurrencyCode }: {
  product: WizardSaleProduct
  setQty?: number
  isVatSale: boolean
  localCurrencyCode: string
}) {
  const { t } = useI18n()
  const localPrice = getWizardProductNumber(product.CurrentPriceEurToUah) ?? getWizardProductNumber(product.CurrentLocalPrice) ?? 0

  return (
    <Box className="new-sale-related-row__metrics">
      <Box className="new-sale-related-row__metric">
        <Text className="new-sale-related-row__metric-label">{t('Доступно')}</Text>
        {/* Search-payload sellable qty (stable across focus) so the number does
            not jump when switching between analogues as the detailed snapshot
            loads for the focused row (bug #17). */}
        <TableChip value={`${qtyFormatter.format(getWizardSellableQty(product, isVatSale) ?? 0)} ${product.MeasureUnit?.Name ?? ''}`} />
        {setQty != null && (
          <Text className="new-sale-related-row__set-qty">{t('У комплекті')}: {qtyFormatter.format(setQty)}</Text>
        )}
      </Box>
      <Box className="new-sale-related-row__metric">
        <TableChip tone="source" value="EUR" />
        <Text className="new-sale-related-row__amount app-money">{amountFormatter.format(getWizardProductNumber(product.CurrentPrice) ?? 0)}</Text>
      </Box>
      <Box className="new-sale-related-row__metric">
        <TableChip tone="source" value={localCurrencyCode} />
        <Text className="new-sale-related-row__amount app-money">{amountFormatter.format(localPrice)}</Text>
      </Box>
    </Box>
  )
}
