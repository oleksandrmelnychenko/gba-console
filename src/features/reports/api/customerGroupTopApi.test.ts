import { beforeEach,expect,it,vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { searchCustomerGroupTop } from './customerGroupTopApi'
vi.mock('../../../shared/api/apiClient',()=>({apiRequest:vi.fn()}))
const api=vi.mocked(apiRequest);beforeEach(()=>api.mockReset())
it('loads a bounded report-authorized directory and ignores unstable rownumber IDs',async()=>{
 const signal=new AbortController().signal;api.mockResolvedValue([{Name:'E  ',Id:99},{Name:'X9',Id:1}]);expect(await searchCustomerGroupTop('',0,signal)).toEqual(['E  ','X9'])
 expect(api).toHaveBeenCalledWith('/report/datasets/lookup',{query:{dataSource:44,field:3,value:'',offset:0,limit:30},signal})
})
it.each(['E  ','%_','id:123',' '])('uses literal text %j with no trim/ID/cohort/period interpretation',async value=>{
 api.mockResolvedValue([{Name:'E  '}]);await searchCustomerGroupTop(value,30);expect(api).toHaveBeenCalledWith('/report/datasets/lookup',{query:{dataSource:44,field:3,value,offset:30,limit:30},signal:undefined})
})
const malformed:unknown[]=[[{Id:1}],[{Name:''}],[{Name:'\u0085'}],[{Name:'A'.repeat(65)}],[{Name:1}],[{Name:'A'},{Name:'A'}],Array.from({length:31},(_,i)=>({Name:'A'+i}))]
it.each(malformed.map(response=>({response})))('rejects incomplete/ambiguous/unbounded directory $response',async({response})=>{
 api.mockResolvedValue(response);await expect(searchCustomerGroupTop('',0)).rejects.toThrow()
})
it('keeps raw-space/case distinct while refusing invalid query bounds before I/O',async()=>{
 api.mockResolvedValue([{Name:'E'},{Name:'E  '},{Name:'e'}]);expect(await searchCustomerGroupTop('',0)).toEqual(['E','E  ','e'])
 api.mockClear();for(const offset of [-1,1.5,10001])await expect(searchCustomerGroupTop('',offset)).rejects.toThrow();await expect(searchCustomerGroupTop('x'.repeat(121),0)).rejects.toThrow();expect(api).not.toHaveBeenCalled()
})
