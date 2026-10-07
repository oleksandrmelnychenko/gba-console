import { apiRequest } from '../../../shared/api/apiClient'
import { counterpartyGroupId, type CounterpartyGroupChoice } from '../data/sourceCounterpartyGroups'

export async function getSettlementCounterpartyGroups(value = '', offset = 0, limit = 30,
  signal?: AbortSignal): Promise<CounterpartyGroupChoice[]> {
  if (value.length > 120 || !Number.isInteger(offset) || offset < 0 || offset > 10000
    || !Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error('Некоректна сторінка груп контрагентів.')
  const body = await apiRequest<unknown>('/report/datasets/41/counterparty-groups', {
    query: { value, offset, limit }, signal,
  })
  if (!Array.isArray(body) || body.length > limit || body.some(row => !row || typeof row !== 'object'
    || !counterpartyGroupId(row.Id) || typeof row.Name !== 'string' || !row.Name.trim())
    || new Set(body.map(row => row.Id.toUpperCase())).size !== body.length)
    throw new Error('Сервер повернув некоректну сторінку поточних груп контрагентів.')
  return structuredClone(body) as CounterpartyGroupChoice[]
}
