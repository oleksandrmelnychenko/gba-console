import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { searchCustomerGroupChoices } from './customerGroupSelectionsApi'
vi.mock('../../../shared/api/apiClient',()=>({apiRequest:vi.fn()}))
const api=vi.mocked(apiRequest),max='9223372036854775807'
beforeEach(()=>api.mockReset())
it('sends explicit field9 exact Int64 token unchanged and strips unrelated DTO identity',async()=>{
 api.mockResolvedValue([{Id:max,Name:'Клієнт — Договір №A ['+max+']',AgreementID:2,ClientID:3}]);const signal=new AbortController().signal
 expect(await searchCustomerGroupChoices(9,'id:'+max,0,signal)).toEqual([{Id:max,Name:'Клієнт — Договір №A ['+max+']'}])
 expect(api).toHaveBeenCalledWith('/report/datasets/lookup',{query:{dataSource:44,field:9,value:'id:'+max,offset:0,limit:30},signal})
})
it('pages literal name/number without cohort/period/customer coupling and does not bulk load empty query',async()=>{
 api.mockResolvedValue([{Id:'9007199254740993',Name:'Одна назва'},{Id:'9007199254740994',Name:'Одна назва'}])
 expect((await searchCustomerGroupChoices(9,'123',30)).map(x=>x.Id)).toEqual(['9007199254740993','9007199254740994'])
 expect(api).toHaveBeenLastCalledWith('/report/datasets/lookup',{query:{dataSource:44,field:9,value:'123',offset:30,limit:30},signal:undefined})
 api.mockClear();expect(await searchCustomerGroupChoices(9,' ',0)).toEqual([]);expect(api).not.toHaveBeenCalled()
})
it.each(['id:0','id:01','id:-1','id:1.0','id:1e3','id:9223372036854775808','id: 1'])('rejects invalid exact input before lookup %s',async query=>{
 await expect(searchCustomerGroupChoices(9,query,0)).rejects.toThrow();expect(api).not.toHaveBeenCalled()
})
it('does not page exact tokens or exceed bounded offset',async()=>{
 await expect(searchCustomerGroupChoices(9,'id:1',30)).rejects.toThrow();await expect(searchCustomerGroupChoices(9,'name',10001)).rejects.toThrow();expect(api).not.toHaveBeenCalled()
})
it.each([{Id:1,Name:'A'},{Id:9007199254740992,Name:'A'},{Id:'01',Name:'A'},{Id:'9223372036854775808',Name:'A'},{AgreementID:'1',Name:'A'},{Id:'1',Name:''}])('refuses noncanonical/stringless/foreign lookup identity %j',async item=>{
 api.mockResolvedValue([item]);await expect(searchCustomerGroupChoices(9,'test',0)).rejects.toThrow()
})
it('refuses exact mismatches, duplicate IDs and oversized pages',async()=>{
 api.mockResolvedValue([{Id:'2',Name:'Name id:1'}]);await expect(searchCustomerGroupChoices(9,'id:1',0)).rejects.toThrow()
 api.mockResolvedValue([{Id:'1',Name:'A'},{Id:'1',Name:'B'}]);await expect(searchCustomerGroupChoices(9,'test',0)).rejects.toThrow()
 api.mockResolvedValue(Array.from({length:31},(_,i)=>({Id:String(i+1),Name:'A'})));await expect(searchCustomerGroupChoices(9,'test',0)).rejects.toThrow()
})
it('does not widen product-safe-number identity or reserve id namespace for manager names',async()=>{
 await expect(searchCustomerGroupChoices(1,'id:'+max,0)).rejects.toThrow()
 api.mockResolvedValue([{Id:2,LastName:'id:literal'}]);await searchCustomerGroupChoices(10,'id:literal',30)
 expect(api).toHaveBeenLastCalledWith('/usermanagement/profiles/search/lookup',{query:{value:'id:literal',offset:30,limit:30},signal:undefined})
})
