import { apiRequest } from '../../../shared/api/apiClient'
import { cashPeriodExactId, readCashPeriodLeg, type CashPeriodLeg } from '../data/cashPeriod'

/** One bounded native lookup page. Captions identify choices visually; ID plus NetUID bind the request. */
export async function getCashPeriodLegs(afterId = '0', limit = 30,
  signal?: AbortSignal): Promise<CashPeriodLeg[]> {
  if ((afterId !== '0' && cashPeriodExactId(afterId) === null)
    || !Number.isInteger(limit) || limit < 1 || limit > 50)
    throw new Error('Некоректна сторінка рахунків руху коштів.')
  const body = await apiRequest<unknown>('/report/datasets/40/currency-legs', {
    query: { afterId, limit }, signal,
  })
  if (!Array.isArray(body) || body.length > limit)
    throw new Error('Сервер повернув некоректну сторінку рахунків.')
  const values = body.map(readCashPeriodLeg)
  if (values.some(value => value === null))
    throw new Error('Сервер повернув рахунок без точної валюти чи ідентичності.')
  const legs = values as CashPeriodLeg[]
  let last = BigInt(afterId)
  for (const leg of legs) {
    const id = BigInt(leg.CurrencyRegisterId)
    if (id <= last) throw new Error('Сервер повернув повторні або неупорядковані рахунки.')
    last = id
  }
  return legs
}
