import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiRequest } from '../../../shared/api/apiClient'

import {
  getDirectOrderProductIncome,
  getSupplyOrderProductIncome,
  hasDirectOrderProductIncome,
  normalizeDirectOrderProductIncome,
} from './directOrderProductIncomeApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('direct order product income api helpers', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('treats empty payloads as missing income', () => {
    expect(normalizeDirectOrderProductIncome(null)).toBeNull()
    expect(normalizeDirectOrderProductIncome({})).toBeNull()
    expect(hasDirectOrderProductIncome(null)).toBe(false)
  })

  it('keeps real income payloads even when only number is available', () => {
    const income = normalizeDirectOrderProductIncome({ Number: '00000042' })

    expect(income?.Number).toBe('00000042')
    expect(hasDirectOrderProductIncome(income)).toBe(true)
  })

  it('keeps direct order income on the legacy direct-order endpoint', async () => {
    apiRequestMock.mockResolvedValueOnce({ Number: '00000042' })

    await getDirectOrderProductIncome('direct-order-1')

    expect(apiRequestMock).toHaveBeenCalledWith('/products/incomes/get/supply/order', {
      query: { netId: 'direct-order-1' },
      errorMessages: {
        default: 'Не вдалося завантажити оприходування',
        network: 'Сервер оприходування недоступний',
      },
    })
  })

  it('loads Ukraine supply income from the supply-order endpoint', async () => {
    apiRequestMock.mockResolvedValueOnce({ Number: '00000043' })

    const income = await getSupplyOrderProductIncome('to-ukraine-order-1', 'toUkraine')

    expect(income?.Number).toBe('00000043')
    expect(apiRequestMock).toHaveBeenCalledWith('/products/incomes/supply/order/ukraine/get', {
      query: { netId: 'to-ukraine-order-1' },
      errorMessages: {
        default: 'Не вдалося завантажити оприходування',
        network: 'Сервер оприходування недоступний',
      },
    })
  })
})
