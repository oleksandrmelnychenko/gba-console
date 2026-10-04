import { apiRequest } from '../../../shared/api/apiClient'
import { isStatementCapability, normalizeStatement, type StatementCapability, type StatementRequest, type StatementResult } from '../data/originalCounterpartyStatement'
const route = '/report/originals/counterparty-statement'
export async function getStatementCapability(signal?: AbortSignal): Promise<StatementCapability> {
  const response = await apiRequest<unknown>(`${route}/capabilities`, { signal })
  if (!isStatementCapability(response)) throw new Error('Сервер не підтвердив оригінал відомості взаєморозрахунків Fenix.')
  return response
}
export async function readStatement(request: StatementRequest, signal?: AbortSignal): Promise<StatementResult> {
  return normalizeStatement(await apiRequest<unknown>(`${route}/preview`, { method: 'POST', body: request, dedupe: false, signal }), request)
}
