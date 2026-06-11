import type { Client } from '../../../clients/types'
import type { SalesUkraineSale } from '../../types'

export const SALE_LIFE_CYCLE_NEW = 0

export function canReassignWizardSale(client: Client | null, sale: SalesUkraineSale | null): boolean {
  if (!client || !sale) {
    return false
  }

  if (Number(sale.BaseLifeCycleStatus?.SaleLifeCycleType) !== SALE_LIFE_CYCLE_NEW) {
    return false
  }

  return (client.SubClients?.length ?? 0) > 0 || Boolean(client.IsSubClient) || Boolean(client.IsTradePoint)
}

export function getReassignRootClientNetId(client: Client): string | null {
  return client.RootClient?.NetUid ?? client.NetUid ?? null
}

export function needsReassignRootLookup(client: Client): boolean {
  return Boolean((client.IsSubClient || client.IsTradePoint) && !client.RootClient?.NetUid && client.NetUid)
}
