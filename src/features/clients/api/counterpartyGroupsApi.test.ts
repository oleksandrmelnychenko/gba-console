import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  createCounterpartyGroup,
  deleteCounterpartyGroup,
  getClientCounterpartyGroup,
  getCounterpartyGroupMembers,
  getCounterpartyGroupTree,
  moveClientsToCounterpartyGroup,
  updateCounterpartyGroup,
} from './counterpartyGroupsApi'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
beforeEach(() => api.mockReset())

const group = '11111111-2222-3333-4444-555555555555'
const parent = '22222222-2222-3333-4444-555555555555'
const client = '33333333-2222-3333-4444-555555555555'

describe('counterparty groups API', () => {
  it('reads the tree and drops rows without an identity', async () => {
    api.mockResolvedValue([
      { NetUid: group, ParentNetUid: parent, Key: 'AB', Name: 'Харків', Code: 12, RegionCode: 'KH00', IsSystem: false,
        IsUngrouped: false, IsFromOneC: true, IsManuallyEdited: true, ClientCount: 4 },
      { NetUid: 'broken', Name: 'Без ключа' },
    ])
    await expect(getCounterpartyGroupTree()).resolves.toEqual([{ NetUid: group, ParentNetUid: parent, Key: 'AB', Name: 'Харків',
      Code: 12, RegionCode: 'KH00', IsSystem: false, IsUngrouped: false, IsFromOneC: true, IsManuallyEdited: true, ClientCount: 4 }])
    expect(api).toHaveBeenLastCalledWith('/clients/counterparty-groups/tree', {})
    api.mockResolvedValue({ Body: [] })
    await expect(getCounterpartyGroupTree()).rejects.toThrow('некоректний довідник')
  })

  it('pages the members of a group with search and cancellation', async () => {
    const signal = new AbortController().signal
    api.mockResolvedValue({ Items: [{ ClientNetUid: client, Name: 'ФОП', RegionCode: null, Usreou: '123', IsPlaced: true,
      IsManuallyPlaced: false }], HasMore: true })
    await expect(getCounterpartyGroupMembers(group, 'фоп', 50, 50, signal)).resolves.toEqual({
      Items: [{ ClientNetUid: client, Name: 'ФОП', RegionCode: null, Usreou: '123', IsPlaced: true, IsManuallyPlaced: false }],
      HasMore: true,
    })
    expect(api).toHaveBeenLastCalledWith('/clients/counterparty-groups/members',
      { query: { groupNetUid: group, search: 'фоп', offset: 50, limit: 50 }, signal })
  })

  it('reads the placement of one client', async () => {
    api.mockResolvedValue({ ClientNetUid: client, GroupNetUid: group, GroupName: 'Харків', GroupPath: 'Покупці / Харків',
      IsPlaced: true, IsManuallyPlaced: true })
    await expect(getClientCounterpartyGroup(client)).resolves.toEqual({ ClientNetUid: client, GroupNetUid: group,
      GroupName: 'Харків', GroupPath: 'Покупці / Харків', IsPlaced: true, IsManuallyPlaced: true })
    expect(api).toHaveBeenLastCalledWith('/clients/counterparty-groups/client', { query: { clientNetUid: client } })
    api.mockResolvedValue(null)
    await expect(getClientCounterpartyGroup(client)).resolves.toBeNull()
  })

  it('posts group edits and client moves', async () => {
    api.mockResolvedValue({ NetUid: group, ParentNetUid: parent, Key: 'AB', Name: 'Нова' })
    await createCounterpartyGroup({ ParentNetUid: parent, Name: 'Нова', RegionCode: null })
    expect(api).toHaveBeenLastCalledWith('/clients/counterparty-groups/create',
      { method: 'POST', body: { ParentNetUid: parent, Name: 'Нова', RegionCode: null } })
    await updateCounterpartyGroup(group, { ParentNetUid: null, Name: 'Інша', RegionCode: 'KH00' })
    expect(api).toHaveBeenLastCalledWith('/clients/counterparty-groups/update',
      { method: 'POST', body: { NetUid: group, ParentNetUid: null, Name: 'Інша', RegionCode: 'KH00' } })
    await deleteCounterpartyGroup(group)
    expect(api).toHaveBeenLastCalledWith('/clients/counterparty-groups/delete', { method: 'POST', body: { NetUid: group } })
    api.mockResolvedValue(2)
    await expect(moveClientsToCounterpartyGroup([client, client, parent], group)).resolves.toBe(2)
    expect(api).toHaveBeenLastCalledWith('/clients/counterparty-groups/move-clients',
      { method: 'POST', body: { ClientNetUids: [client, parent], GroupNetUid: group } })
  })
})
