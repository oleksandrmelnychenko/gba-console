import { getSalesUkraineEditSaleStatistic } from '../../../../shared/sale-audit/saleAuditApi'
import type { SalesUkraineSale } from '../../types'
import { getWizardSalesRegister, mapWizardSaleRegisterItems, type WizardSaleRegisterQuery, type WizardSaleRegisterStatistic } from './wizardClientStepApi'

/** A shift can create child sales. Read membership and recomputed totals together,
 * bypassing GETs that may have started before the mutation committed. */
export async function getWizardRegisterAfterSave(
  query: WizardSaleRegisterQuery,
  signal: AbortSignal,
  editedSale?: SalesUkraineSale,
): Promise<WizardSaleRegisterStatistic[]> {
  const [list, detail] = await Promise.allSettled([
    getWizardSalesRegister(query, signal, { fresh: true }),
    editedSale?.NetUid
      ? getSalesUkraineEditSaleStatistic(editedSale.NetUid, signal, { fresh: true })
      : Promise.resolve(null),
  ])
  if (list.status === 'rejected') throw list.reason
  const items = mapWizardSaleRegisterItems(list.value)
  const statistic = detail.status === 'fulfilled' ? detail.value : null
  const index = statistic?.Sale?.NetUid
    ? items.findIndex(item => item.Sale?.NetUid === statistic.Sale?.NetUid)
    : -1
  // Only the list endpoint decides membership under the active filters.
  if (index >= 0) items[index] = statistic as unknown as WizardSaleRegisterStatistic
  return items
}
