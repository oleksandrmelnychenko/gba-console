import actualManagers from '../data/customerGroupManager.directory-fixture.json'
import actualDirectory from '../data/customerGroupRegion.directory-fixture.json'
import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getCustomerGroupRegionCodes, searchCustomerGroupChoices } from './customerGroupSelectionsApi'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
beforeEach(() => api.mockReset())
it('reads actual child codes, keeps parent context and does not substitute parent Id/NetUid', async () => {
  api.mockResolvedValue(actualDirectory)
  expect(await getCustomerGroupRegionCodes()).toEqual(actualDirectory[0].RegionCodes.map(code => ({ Id: code.Id, Name: `${code.Value} — ${actualDirectory[0].Name} [${code.Id}]` })))
})
it.each([
  [{ Id: 10, Name: 'A', RegionCodes: [{ Id: 20, RegionId: 11, Value: 'C' }] }],
  [{ Id: 10, Name: 'A', RegionCodes: [{ Id: 9007199254740992, RegionId: 10, Value: 'C' }] }],
  [{ Id: 10, Name: 'A', RegionCodes: [{ Id: 20, RegionId: 10, Value: 'C' }, { Id: 20, RegionId: 10, Value: 'C' }] }],
])('rejects unproved child identity or parent association %j', async response => {
  api.mockResolvedValue(response); await expect(getCustomerGroupRegionCodes()).rejects.toThrow()
})
it('keeps child IDs distinct for same code across different parents', async () => {
  api.mockResolvedValue([{Id:10,Name:'A',RegionCodes:[{Id:20,RegionId:10,Value:'CODE'}]}, {Id:11,Name:'B',RegionCodes:[{Id:21,RegionId:11,Value:'CODE'}]}])
  expect(await getCustomerGroupRegionCodes()).toEqual([{Id:20,Name:'CODE — A [20]'},{Id:21,Name:'CODE — B [21]'}])
})
it('uses exact Product1 namespace and leaves plain numeric query untouched with bounded paging', async () => {
  api.mockResolvedValue([{ Id: 38242326, Name: 'Товар [38242326]' }])
  const controller = new AbortController()
  expect(await searchCustomerGroupChoices(1, ' id:38242326 ', 0, controller.signal)).toEqual([{ Id: 38242326, Name: 'Товар [38242326]' }])
  expect(api).toHaveBeenLastCalledWith('/report/datasets/lookup', { query: { dataSource:44,field:1,value:'id:38242326',offset:0,limit:30 }, signal:controller.signal })
  await searchCustomerGroupChoices(1, '38242326', 30)
  expect(api).toHaveBeenLastCalledWith('/report/datasets/lookup', { query: { dataSource:44,field:1,value:'38242326',offset:30,limit:30 }, signal:undefined })
})
it.each(['id:0','id:01','id:-1','id:1.0','id:1e3','id:9007199254740993','id: 1','id:abc'])('rejects malformed/unsafe exact token without rounding: %s', async query => {
  await expect(searchCustomerGroupChoices(1,query,0)).rejects.toThrow(); expect(api).not.toHaveBeenCalled()
})
it('does not page exact IDs, exceed max offset or load users with empty query', async () => {
  await expect(searchCustomerGroupChoices(1,'id:1',30)).rejects.toThrow()
  await expect(searchCustomerGroupChoices(10,'Test',10001)).rejects.toThrow()
  expect(await searchCustomerGroupChoices(10,' ',0)).toEqual([]); expect(api).not.toHaveBeenCalled()
})
it('maps actual manager DTO User.Id/name only, never details identity or role/active filters', async () => {
  api.mockResolvedValue([{Id:20,FirstName:'Іван',LastName:'Петренко',MiddleName:'Іванович',UserDetailsId:999,NetUid:'uuid',IsActive:false,UserRoleId:42}])
  expect(await searchCustomerGroupChoices(10,'Петренко',30)).toEqual([{Id:20,Name:'Петренко Іван Іванович [20]'}])
  expect(api).toHaveBeenCalledWith('/usermanagement/profiles/search/lookup',{query:{value:'Петренко',offset:30,limit:30},signal:undefined})
})
it.each([{Id:9007199254740992,Name:'X'}, {Id:'20',Name:'X'}, {UserDetailsId:20,Name:'X'}])('refuses unsafe/nonexact response identities %j',async item=>{
  api.mockResolvedValue([item]); await expect(searchCustomerGroupChoices(1,'XX',0)).rejects.toThrow()
})

it('does not accept an old-server name match as an exact Product ID proof',async()=>{
 api.mockResolvedValue([{Id:2,Name:'Назва id:1'}]);await expect(searchCustomerGroupChoices(1,'id:1',0)).rejects.toThrow('точний ID')
})

it('accepts the redacted actual normal lookup DTO and strips unrelated profile fields',async()=>{
 api.mockResolvedValue(actualManagers)
 expect(await searchCustomerGroupChoices(10,'Приклад',0)).toEqual([{Id:20,Name:'Приклад Тест Довідниковий [20]'}])
})
