import { useMemo, type ComponentProps } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { ProductFullDetailPanel } from './ProductFullDetailPanel'
import type { ProductDetailSnapshot } from './useWizardProductData'
import { buildWizardProductAvailabilityChips, buildWizardProductAvailabilityRows } from './wizardProductAvailabilityModel'
import { getWizardDetailedSellableQty } from './wizardSaleAvailability'

type Props = Omit<ComponentProps<typeof ProductFullDetailPanel>,
  'chips' | 'rows' | 'detailsError' | 'isLoadingDetails' | 'nearestSupplyOrder' | 'isFullDetail' | 'showRowDetails' | 'displayQty'
> & { snapshot: ProductDetailSnapshot | null }

// Main products, analogues and components share the same availability model.
// Keep it here so navigating rows doesn't rebuild counts and stock row objects.
export function WizardProductDetailsPanel({ snapshot, selectedChipIndex, ...props }: Props) {
  const { t } = useI18n()
  const availabilities = snapshot?.availabilities
  const chips = useMemo(() => buildWizardProductAvailabilityChips(availabilities, t), [availabilities, t])
  const rows = useMemo(() => buildWizardProductAvailabilityRows(availabilities, selectedChipIndex), [availabilities, selectedChipIndex])
  const displayQty = useMemo(() => getWizardDetailedSellableQty(props.product, props.isVatSale, availabilities) ?? 0,
    [props.product, props.isVatSale, availabilities])

  return <ProductFullDetailPanel
    {...props}
    chips={chips}
    rows={rows}
    selectedChipIndex={selectedChipIndex}
    displayQty={displayQty}
    detailsError={snapshot?.detailsError}
    isLoadingDetails={!snapshot?.detailsLoaded}
    nearestSupplyOrder={snapshot?.nearestOrder}
    isFullDetail
    showRowDetails={selectedChipIndex === 0}
  />
}
