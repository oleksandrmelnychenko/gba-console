import { getSalesUkraineEditSaleStatistic } from '../../../../shared/sale-audit/saleAuditApi'
import type { SalesUkraineSale } from '../../types'
import { getWizardSalesRegister, mapWizardSaleRegisterItems, type WizardSaleRegisterQuery, type WizardSaleRegisterStatistic } from './wizardClientStepApi'

export type WizardRegisterError = 'load' | 'saved-list' | 'saved-details'

/** A shift can create child sales. Read membership and recomputed totals together,
 * bypassing GETs that may have started before the mutation committed. */
export async function getWizardRegisterAfterSave(
  query: WizardSaleRegisterQuery,
  signal: AbortSignal,
  editedSale?: SalesUkraineSale,
): Promise<{ items: WizardSaleRegisterStatistic[]; detailsFailed: boolean }> {
  const [list, detail] = await Promise.allSettled([
    getWizardSalesRegister(query, signal, { fresh: true }),
    editedSale?.NetUid
      ? getSalesUkraineEditSaleStatistic(editedSale.NetUid, signal, { fresh: true })
      : Promise.resolve(null),
  ])
  if (list.status === 'rejected') throw list.reason
  const items = mapWizardSaleRegisterItems(list.value)
  const statistic = detail.status === 'fulfilled' ? detail.value : null
  const index = editedSale?.NetUid
    ? items.findIndex(item => item.Sale?.NetUid === editedSale.NetUid)
    : -1
  const detailsFailed = index >= 0 && statistic?.Sale?.NetUid !== editedSale?.NetUid
  // Only the list endpoint decides membership under the active filters.
  if (index >= 0 && !detailsFailed) items[index] = statistic as unknown as WizardSaleRegisterStatistic
  return { items, detailsFailed }
}
