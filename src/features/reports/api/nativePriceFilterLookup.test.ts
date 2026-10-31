import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { searchNativePriceFilters, validPriceFilterPeriod } from './nativePriceFilterLookup'
import { NATIVE_PRICE_FILTER_FIELDS } from '../data/nativePriceFilterLookup'
vi.mock('../../../shared/api/apiClient',()=>({apiRequest:vi.fn()}))
const api=vi.mocked(apiRequest),route='/report/datasets/price-comparison/filters/lookup'
beforeEach(()=>{api.mockReset()})
it.each(NATIVE_PRICE_FILTER_FIELDS)('uses field%i source46 owner and exact namespace without another report/registry transport',async field=>{
 const id=field===3?' 01 ':'9223372036854775807',row={Id:id,Name:field===3?id:'Повний підпис [9223372036854775807]'},query={...(field===3?{exactValue:id}:{exactId:id}),...(field===12||field===14?{from:'2026-10-01',to:'2026-10-31'}:{})}
 api.mockResolvedValue([row]);const controller=new AbortController()
 expect(await searchNativePriceFilters(46,field,query,controller.signal)).toEqual([row]);expect(api).toHaveBeenCalledWith(route,{query:{dataSource:46,field,...query,offset:0,limit:30},signal:controller.signal})
})
it.each(['01','id:123','%_',"quote's",' A ','Код [77]'])('sends literal untrimmed search %j without an ID heuristic',async value=>{
 api.mockResolvedValue([]);await searchNativePriceFilters(46,3,{value,offset:30});expect(api).toHaveBeenCalledWith(route,{query:{dataSource:46,field:3,value,offset:30,limit:30},signal:undefined})
})
it.each([2,3,44,45,0])('rejects source%i before transport',async source=>{await expect(searchNativePriceFilters(source,3,{})).rejects.toThrow();expect(api).not.toHaveBeenCalled()})
it.each([0,1,2,6,9,11,20,21,64])('rejects unrelated field%i before transport',async field=>{await expect(searchNativePriceFilters(46,field,{})).rejects.toThrow();expect(api).not.toHaveBeenCalled()})
it.each([{field:3,query:{exactId:'1'}},{field:4,query:{exactValue:'x'}},{field:3,query:{exactValue:' '}},{field:3,query:{exactValue:'x'.repeat(65)}},{field:4,query:{exactId:'01'}},{field:4,query:{exactId:'9223372036854775808'}},{field:4,query:{exactId:'1',value:'query'}},{field:3,query:{exactValue:'01',offset:30}},{field:4,query:{from:'2026-01-01',to:'2026-01-02'}},{field:12,query:{}},{field:14,query:{from:'2024-10-01',to:'2024-10-02'}},{field:12,query:{from:'2026-02-30',to:'2026-03-01'}},{field:14,query:{from:'2025-01-01',to:'2026-01-02'}},{field:3,query:{value:'x'.repeat(121)}},{field:4,query:{limit:51}},{field:4,query:{offset:-1}}])('rejects malformed field$query parameters before transport',async({field,query})=>{await expect(searchNativePriceFilters(46,field,query)).rejects.toThrow();expect(api).not.toHaveBeenCalled()})
it.each([[{Id:1,Name:'Unsafe'}],[{Id:'01',Name:'Bad canonical'}],[{Id:'1',Name:''}],[{Id:'1',Name:'Duplicate'},{Id:'1',Name:'Duplicate'}],[{Id:'2',Name:'Wrong exact'}],[{Id:'1',Name:'Excess',Other:true}]].map(rows=>({rows})))('rejects malformed/unsafe/extraneous/duplicate/wrong-exact response $rows',async({rows})=>{
 api.mockResolvedValue(rows);await expect(searchNativePriceFilters(46,4,{exactId:'1'})).rejects.toThrow()
})
it('keeps TOP binary raw reference identity distinct without promising financial binary membership',async()=>{
 const rows=[{Id:'A',Name:'A'},{Id:'a',Name:'a'},{Id:'A ',Name:'A '},{Id:'01',Name:'01'},{Id:'1',Name:'1'}];api.mockResolvedValue(rows)
 expect(await searchNativePriceFilters(46,3,{})).toEqual(rows)
 api.mockResolvedValue([{Id:'A',Name:'a'}]);await expect(searchNativePriceFilters(46,3,{})).rejects.toThrow()
})
it('retains authorization failure on the same native transport without an alternate route',async()=>{
 api.mockRejectedValue(new Error('403'));await expect(searchNativePriceFilters(46,15,{value:'Ім’я'})).rejects.toThrow('403');expect(api).toHaveBeenCalledOnce();expect(api.mock.calls[0][0]).toBe(route)
})
it('matches source46 inclusive366day window and rejects an extra day',()=>{
 expect(validPriceFilterPeriod('2025-01-01','2026-01-01')).toBe(true);expect(validPriceFilterPeriod('2025-01-01','2026-01-02')).toBe(false)
})

it('accepts the .NET-valid FEFF raw TOP without applying numeric-caption trim rules',async()=>{
 const row={Id:'\uFEFF',Name:'\uFEFF'};api.mockResolvedValue([row]);expect(await searchNativePriceFilters(46,3,{exactValue:'\uFEFF'})).toEqual([row])
})
it.each([' ','\t','\u0085','\u2000'])('rejects actual Unicode White_Space-only TOP%j before transport',async exactValue=>{
 await expect(searchNativePriceFilters(46,3,{exactValue})).rejects.toThrow();expect(api).not.toHaveBeenCalled()
})
