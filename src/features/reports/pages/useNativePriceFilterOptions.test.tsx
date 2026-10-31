import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { useNativePriceFilterOptions } from './useNativePriceFilterOptions'
vi.mock('../../../shared/api/apiClient',()=>({apiRequest:vi.fn()}))
const api=vi.mocked(apiRequest),row=(Id:string)=>({Id,Name:'Значення ['+Id+']'})
beforeEach(()=>{api.mockReset()})
afterEach(cleanup)
it('aborts field changes and ignores late responses sharing the same numeric ID namespace',async()=>{
 let finish!:(rows:unknown)=>void
 api.mockImplementation((_path,options)=>options?.query?.field===7?new Promise(resolve=>{finish=resolve}):Promise.resolve([{Id:'1',Name:'Код регіону [1]'}]))
 const view=renderHook(({field})=>useNativePriceFilterOptions(46,field,'text','',true),{initialProps:{field:7}})
 await waitFor(()=>expect(api).toHaveBeenCalledOnce());const signal=api.mock.calls[0][1]?.signal
 view.rerender({field:8});expect(signal?.aborted).toBe(true)
 await waitFor(()=>expect(view.result.current.items).toEqual([{Id:'1',Name:'Код регіону [1]'}]))
 await act(async()=>{finish([{Id:'1',Name:'Старий регіон [1]'}])});expect(view.result.current.items[0].Name).toBe('Код регіону [1]')
})
it('does not resurrect A→B→A old options while the new A request is pending',async()=>{
 let calls=0,finish!:(rows:unknown)=>void
 api.mockImplementation(()=>{calls++;return calls===3?new Promise(resolve=>{finish=resolve}):Promise.resolve([row(String(calls))])})
 const view=renderHook(({field})=>useNativePriceFilterOptions(46,field,'text','',true),{initialProps:{field:7}})
 await waitFor(()=>expect(view.result.current.items).toEqual([row('1')]))
 view.rerender({field:8});await waitFor(()=>expect(view.result.current.items).toEqual([row('2')]))
 view.rerender({field:7});expect(view.result.current.items).toEqual([]);await waitFor(()=>expect(api).toHaveBeenCalledTimes(3))
 await act(async()=>{finish([row('3')])});expect(view.result.current.items).toEqual([row('3')])
})
it('invalidates a pending scalar lookup when the condition changes to a list without losing scope',async()=>{
 let finish!:(rows:unknown)=>void;api.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve})).mockResolvedValue([row('2')])
 const view=renderHook(({condition})=>useNativePriceFilterOptions(46,15,'text','',true,'','',condition),{initialProps:{condition:0}})
 await waitFor(()=>expect(api).toHaveBeenCalledOnce());const signal=api.mock.calls[0][1]?.signal
 view.rerender({condition:2});expect(signal?.aborted).toBe(true);await waitFor(()=>expect(view.result.current.items).toEqual([row('2')]))
 await act(async()=>{finish([row('1')])});expect(view.result.current.items).toEqual([row('2')]);expect(api.mock.calls.every(call=>call[1]?.query?.field===15)).toBe(true)
})
it('ignores period changes for current directories but refetches and aborts for native documents',async()=>{
 api.mockResolvedValue([row('1')]);const current=renderHook(({from})=>useNativePriceFilterOptions(46,7,'text','',true,from,'2026-10-31'),{initialProps:{from:'2026-10-01'}})
 await waitFor(()=>expect(api).toHaveBeenCalledOnce());current.rerender({from:'2026-09-01'});expect(api).toHaveBeenCalledOnce();expect(api.mock.calls[0][1]?.query).not.toHaveProperty('from');current.unmount();api.mockReset()
 let finish!:(rows:unknown)=>void;api.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve})).mockResolvedValue([row('2')])
 const docs=renderHook(({from})=>useNativePriceFilterOptions(46,12,'exact','2',true,from,'2026-10-31'),{initialProps:{from:'2026-10-01'}})
 await waitFor(()=>expect(api).toHaveBeenCalledOnce());const signal=api.mock.calls[0][1]?.signal
 docs.rerender({from:'2026-09-01'});expect(signal?.aborted).toBe(true);await waitFor(()=>expect(docs.result.current.items).toEqual([row('2')]))
 await act(async()=>{finish([row('2')])});expect(api.mock.calls.at(-1)?.[1]?.query).toMatchObject({field:12,from:'2026-09-01',to:'2026-10-31',exactId:'2'})
})
it('keeps disabled/unsupported/invalid-period scopes empty and aborts the prior request',async()=>{
 api.mockImplementation(()=>new Promise(()=>{}));const view=renderHook(({enabled,condition})=>useNativePriceFilterOptions(46,4,'text','',enabled,'','',condition),{initialProps:{enabled:true,condition:0}})
 await waitFor(()=>expect(api).toHaveBeenCalledOnce());const signal=api.mock.calls[0][1]?.signal
 view.rerender({enabled:false,condition:0});expect(signal?.aborted).toBe(true);expect(view.result.current.items).toEqual([])
 view.rerender({enabled:true,condition:3});expect(api).toHaveBeenCalledOnce();expect(view.result.current.more).toBe(false)
})
it('appends two pages of large string IDs without rounding or conflating same captions',async()=>{
 const first=Array.from({length:30},(_,index)=>({Id:String(9007199254740993n+BigInt(index)),Name:'Одна назва'})),last={Id:'9223372036854775807',Name:'Одна назва'}
 api.mockImplementation(async(_path,options)=>options?.query?.offset===0?first:[last])
 const view=renderHook(()=>useNativePriceFilterOptions(46,4,'text','Назва',true));await waitFor(()=>expect(view.result.current.more).toBe(true))
 act(()=>{view.result.current.loadMore()});await waitFor(()=>expect(view.result.current.items).toHaveLength(31))
 expect(view.result.current.items.at(-1)?.Id).toBe(last.Id);expect(api.mock.calls.map(call=>call[1]?.query?.offset)).toEqual([0,30])
})
it('retries an authorization failure on the same native owner without a legacy fallback',async()=>{
 api.mockRejectedValueOnce(new Error('403')).mockResolvedValueOnce([])
 const view=renderHook(()=>useNativePriceFilterOptions(46,16,'text','Ім’я',true));await waitFor(()=>expect(view.result.current.error).toBeTruthy())
 act(()=>{view.result.current.retry()});await waitFor(()=>expect(api).toHaveBeenCalledTimes(2))
 expect(api.mock.calls.every(call=>call[0]==='/report/datasets/price-comparison/filters/lookup'&&call[1]?.query?.dataSource===46&&call[1]?.query?.field===16)).toBe(true)
})
it('restarts a changed duplicate page from offset0 instead of retrying the duplicate forever',async()=>{
 const first=Array.from({length:30},(_,index)=>row(String(index+1)));api.mockResolvedValueOnce(first).mockResolvedValueOnce([first[0]]).mockResolvedValueOnce([row('40')])
 const view=renderHook(()=>useNativePriceFilterOptions(46,10,'text','Користувач',true));await waitFor(()=>expect(view.result.current.more).toBe(true))
 act(()=>{view.result.current.loadMore()});await waitFor(()=>expect(view.result.current.error).toContain('Список змінився'))
 act(()=>{view.result.current.retry()});await waitFor(()=>expect(view.result.current.items).toEqual([row('40')]))
 expect(api.mock.calls.map(call=>call[1]?.query?.offset)).toEqual([0,30,0])
})
