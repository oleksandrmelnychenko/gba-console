import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { searchCustomerGroupChoices } from './customerGroupSelectionsApi'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
beforeEach(() => api.mockReset())
it.each([15, 16] as const)('uses the bounded source44 author%d namespace, exact decimal string and no manager-role substitution', async field => {
  const controller = new AbortController()
  api.mockResolvedValue([{ Id: '9007199254740993', Name: 'Однакове ім’я [9007199254740993]', NetUid: 'ignored', UserDetailsId: 10 }])
  expect(await searchCustomerGroupChoices(field, 'id:9007199254740993', 0, controller.signal)).toEqual([{ Id: '9007199254740993', Name: 'Однакове ім’я [9007199254740993]' }])
  expect(api).toHaveBeenLastCalledWith('/report/datasets/lookup', { query: { dataSource: 44, field, value: 'id:9007199254740993', offset: 0, limit: 30 }, signal: controller.signal })
  await searchCustomerGroupChoices(field, 'Однакове', 30)
  expect(api).toHaveBeenLastCalledWith('/report/datasets/lookup', { query: { dataSource: 44, field, value: 'Однакове', offset: 30, limit: 30 }, signal: undefined })
})
it.each([15, 16] as const)('refuses malformed/ambiguous author%d IDs without rounding and does not bulk-load an empty query', async field => {
  expect(await searchCustomerGroupChoices(field, '', 0)).toEqual([]); expect(api).not.toHaveBeenCalled()
  for (const query of ['id:01', 'id:0', 'id:9223372036854775808', 'id: 1', 'id:1.0']) await expect(searchCustomerGroupChoices(field, query, 0)).rejects.toThrow()
  await expect(searchCustomerGroupChoices(field, 'id:10', 30)).rejects.toThrow(); expect(api).not.toHaveBeenCalled()
  for (const response of [[{ Id: 10, Name: 'Number' }], [{ Id: '01', Name: 'Alias' }], [{ Id: '9', Name: 'Wrong exact' }], [{ Id: '10', Name: 'A' }, { Id: '10', Name: 'B' }]]) {
    api.mockResolvedValue(response); await expect(searchCustomerGroupChoices(field, 'id:10', 0)).rejects.toThrow()
  }
})
it('leaves client manager10 on its existing User.Id lookup rather than either author namespace', async () => {
  api.mockResolvedValue([{ Id: 10, FirstName: 'Основний', LastName: 'Менеджер', UserDetailsId: 999 }])
  expect(await searchCustomerGroupChoices(10, 'id:literal', 30)).toEqual([{ Id: 10, Name: 'Менеджер Основний [10]' }])
  expect(api).toHaveBeenCalledWith('/usermanagement/profiles/search/lookup', { query: { value: 'id:literal', offset: 30, limit: 30 }, signal: undefined })
})
