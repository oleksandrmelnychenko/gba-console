import { Group, Text } from '@mantine/core'
import { memo, useMemo } from 'react'
import { formatLocalDate } from '../../../../shared/date/dateTime'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { TableChip } from '../../../../shared/ui/TableChip'
import { DocumentDetailSection } from '../../../../shared/ui/document-detail/DocumentDetail'
import type { WizardNearestSupplyOrder } from './newSaleWizardApi'
import type { WizardSaleProduct } from './wizardSaleProduct'
import { buildWizardStockPriceLines, getWizardStockCurrencyPrice } from './wizardProductDetailModel'

const qtyFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3 })
const priceFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })

export const ProductStockPrices = memo(function ProductStockPrices({
  product, isVatSale, localCurrencyCode, displayQty = 0, isFullDetail, discountRate, nearestSupplyOrder,
}: {
  product: WizardSaleProduct
  isVatSale: boolean
  localCurrencyCode: string
  displayQty?: number
  isFullDetail: boolean
  discountRate: number | null
  nearestSupplyOrder?: WizardNearestSupplyOrder | null
}) {
  const { t } = useI18n()
  const measureUnit = product.MeasureUnit?.Name || t('шт')
  const legacyLines = useMemo(() => buildWizardStockPriceLines(product, isVatSale, localCurrencyCode, displayQty),
    [product, isVatSale, localCurrencyCode, displayQty])
  const stockCurrencies = useMemo(() => [...new Set(['EUR', localCurrencyCode, ...legacyLines.flatMap((line) => line.uahPrice != null ? ['UAH'] : [])])],
    [localCurrencyCode, legacyLines])
  return (
    <DocumentDetailSection title={t('Наявність і ціни')} stacked>
      {isFullDetail && (
        <div className="new-sale-product-detail__table-scroll">
          <table className="app-static-table" aria-label={t('Наявність і ціни')}>
            <thead><tr>
              <th scope="col">{t('Джерело')}</th>
              <th scope="col" className="app-table-cell-number">{t('К-сть')}</th>
              {stockCurrencies.map((currency) => <th key={currency} scope="col" className="app-table-cell-number"><TableChip tone="source" value={currency} /></th>)}
            </tr></thead>
            <tbody>{legacyLines.map((line) => (
              <tr key={line.key}>
                <th scope="row">{t(line.label)}</th>
                <td className="app-table-cell-number">{qtyFormatter.format(line.qty)} <TableChip value={measureUnit} /></td>
                {stockCurrencies.map((currency) => <td key={currency} className="app-table-cell-number">{formatPrice(getWizardStockCurrencyPrice(line, currency))}</td>)}
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {(discountRate != null || nearestSupplyOrder) && (
        <Group gap={16} className="new-sale-product-detail__extra">
          {discountRate != null && <Group gap={6}><Text size="xs">{t('Знижка')}</Text><TableChip tone="document" value={priceFormatter.format(discountRate) + '%'} /></Group>}
          {nearestSupplyOrder && <Group gap={6}>
            <Text size="xs">{t('Найближча партія')}</Text>
            <TableChip tone="document" value={nearestSupplyOrder.OrderArrivedDate ? formatLocalDate(new Date(nearestSupplyOrder.OrderArrivedDate)) : '—'} />
            <span className="app-money">{qtyFormatter.format(nearestSupplyOrder.Qty ?? 0)}</span><TableChip value={measureUnit} />
          </Group>}
        </Group>
      )}
    </DocumentDetailSection>
  )
})

function formatPrice(value: number | null | undefined): string {
  return value == null ? '—' : priceFormatter.format(value)
}
