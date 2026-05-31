import { apiRequest } from '../../../shared/api/apiClient'
import { readNumber } from './salesApi'

export async function getTotalActForEditing(): Promise<number> {
  const result = await apiRequest<unknown>('/protocol/act/invoice/get/history/qty')

  if (typeof result === 'number') {
    return result
  }

  const direct = readNumber(result)

  if (typeof direct === 'number') {
    return direct
  }

  if (result && typeof result === 'object') {
    const payload = result as Record<string, unknown>
    return readNumber(payload.Qty) ?? readNumber(payload.Total) ?? readNumber(payload.Count) ?? 0
  }

  return 0
}
