import { apiRequest } from '../../../shared/api/apiClient'
import { GROUPED_DEBTOR_ROOT, readGroupedDebtorCapability, readGroupedDebtorStatement,
  type GroupedDebtorCapability, type GroupedDebtorStatement } from '../data/groupedDebtor'
import { validSettlementPeriodDays } from '../data/settlementPeriod'

export async function getGroupedDebtorCapability(signal?: AbortSignal): Promise<GroupedDebtorCapability> {
  const body = await apiRequest<unknown>('/report/datasets/41/grouped-debtor/capability', { signal })
  const capability = readGroupedDebtorCapability(body)
  if (!capability) throw new Error('Сервер повернув некоректний стан групового звіту дебіторки.')
  return capability
}

export async function getGroupedDebtorStatement(from: string, to: string,
  signal?: AbortSignal): Promise<GroupedDebtorStatement> {
  if (!validSettlementPeriodDays(from, to)) throw new Error('Оберіть завершений період до 31 дня.')
  const body = await apiRequest<unknown>('/report/datasets/41/grouped-debtor/statement', {
    query: { from, to, buyerRootSourceId: GROUPED_DEBTOR_ROOT }, signal,
  })
  const statement = readGroupedDebtorStatement(body, from, to)
  if (!statement) throw new Error('Сервер повернув неповний груповий звіт дебіторки.')
  return statement
}
