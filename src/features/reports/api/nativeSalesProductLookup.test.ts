import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { productOptionName, searchNativeSalesProducts } from './nativeSalesProductLookup'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
beforeEach(() => {
  api.mockReset()
})
it.each(['123', 'id:123', "%_'", 'Артикул'])('sends literal text %s without identity heuristics', async (value) => {
  api.mockResolvedValue([])
  const controller = new AbortController()
  await searchNativeSalesProducts({ value, offset: 30 }, controller.signal)
  expect(api).toHaveBeenCalledWith('/report/datasets/sales/products/lookup', {
    query: { value, offset: 30, limit: 30 },
    signal: controller.signal,
  })
})
it('preserves large string IDs and empty name/sku without decorated report names', async () => {
  const value = { Id: '9223372036854775807', Name: '', VendorCode: '' }
  api.mockResolvedValue([value])
  expect(await searchNativeSalesProducts({ exactId: value.Id })).toEqual([value])
  expect(productOptionName(value)).toBe('Товар [9223372036854775807]')
  expect(api.mock.calls[0][1]?.query).toEqual({ exactId: value.Id, offset: 0, limit: 30 })
})
it.each([
  { exactId: '01' },
  { exactId: '1', value: 'abc' },
  { exactId: '1', offset: 1 },
  { limit: 51 },
  { offset: -1 },
])('refuses invalid query before transport %j', async (query) => {
  await expect(searchNativeSalesProducts(query)).rejects.toThrow()
  expect(api).not.toHaveBeenCalled()
})
it.each([
  { response: [{ Id: 1, Name: 'X', VendorCode: '' }] },
  {
    response: [
      { Id: '1', Name: 'X', VendorCode: '' },
      { Id: '1', Name: 'X', VendorCode: '' },
    ],
  },
  { response: [{ Id: '2', Name: 'X', VendorCode: '' }] },
])('refuses rounded/duplicate/wrong exact ID responses', async ({ response }) => {
  api.mockResolvedValue(response)
  await expect(searchNativeSalesProducts({ exactId: '1' })).rejects.toThrow()
})
