import type { SalesUkraineOrderItem, SalesUkraineUser } from '../../types'
import { getWizardSplitAgreementNetId } from './newSaleWizardState'
import type { WizardSaleProduct } from './wizardSaleProduct'
import { addWizardSplitOrderItem, type WizardSplitOrderItem } from './wizardSplitSale'

export function addWizardCartSplitItems(
  items: WizardSplitOrderItem[],
  source: SalesUkraineOrderItem & { Product: WizardSaleProduct },
  qty: number,
  comment: string | undefined,
  user: SalesUkraineUser | undefined,
  agreementNetId: string | null,
): WizardSplitOrderItem[] {
  const base = items.length > 0 && getWizardSplitAgreementNetId() === agreementNetId ? items : []

  return addWizardSplitOrderItem(base, source, qty, comment, user)
}
