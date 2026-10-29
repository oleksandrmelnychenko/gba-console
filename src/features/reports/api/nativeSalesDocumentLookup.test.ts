import { createStockReport } from './reportsApi'
import type { ReportRequestBody } from '../types'
import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { searchNativeSalesDocuments, salesDocumentKey, salesDocumentSelectedEntity } from './nativeSalesDocumentLookup'
vi.mock('../../../shared/api/apiClient',()=>({apiRequest:vi.fn()}))
const api=vi.mocked(apiRequest), params={value:'',offset:0,limit:30}
beforeEach(()=>api.mockReset())
it.each([[12,'sale'],[14,'return']] as const)('keeps field%s identities exact and authoritative Kyiv captions',async(field,Kind)=>{
 const items=[{Id:'9007199254740993',Kind,Name:`${Kind} №12 · 25.10.2026 03:30:00`}]
 api.mockResolvedValue(items)
 const result=await searchNativeSalesDocuments(field,'2026-10-18','2026-10-27',{...params,value:' 03:30 '})
 expect(result[0]).toMatchObject({Id:items[0].Id,Name:items[0].Name,salesDocumentKind:Kind})
 expect(api).toHaveBeenCalledWith('/report/datasets/sales/documents/lookup',{query:{field,from:'2026-10-18',to:'2026-10-27',value:'03:30',offset:0,limit:30},signal:undefined})
 expect(salesDocumentKey(result[0])).toBe(`${Kind}:9007199254740993`)
})
it('keeps colliding numeric sale/return IDs and legacy saved identities separate without caption matching',()=>{
 const sale=salesDocumentSelectedEntity({Data:{Id:42},Name:'Однакова назва',Value:42},12)
 const returned=salesDocumentSelectedEntity({Data:{Id:'42'},Name:'Однакова назва',Value:0},14)
 expect(salesDocumentKey(sale)).toBe('sale:42');expect(salesDocumentKey(returned)).toBe('return:42')
})
it('restores an exact saved out-of-period ID and preserves the proven original sale link',async()=>{
 api.mockResolvedValue([{Id:'9223372036854775807',Kind:'return',Name:'Повернення · до: Продаж',OriginalSaleId:'9007199254740993',OriginalSaleName:'Продаж · 01.01.2025 12:00:00'}])
 const result=await searchNativeSalesDocuments(14,'2026-10-18','2026-10-27',{...params,value:'id:9223372036854775807'})
 expect(result[0].OriginalSaleId).toBe('9007199254740993')
})
it.each([
 {Id:42,Kind:'sale',Name:'Rounded'}, {Id:'01',Kind:'sale',Name:'Alias'},
 {Id:'9223372036854775808',Kind:'sale',Name:'Overflow'}, {Id:'42',Kind:'return',Name:'Wrong kind'},
 {Id:'42',Kind:'sale',Name:'Bad parent',OriginalSaleId:'1',OriginalSaleName:'Sale'},
])('rejects malformed/wrong-kind response %j',async item=>{
 api.mockResolvedValue([item]);await expect(searchNativeSalesDocuments(12,'2026-10-18','2026-10-27',params)).rejects.toThrow()
})
it('rejects duplicate IDs and wrong exact restoration rather than picking first caption',async()=>{
 api.mockResolvedValue([{Id:'42',Kind:'sale',Name:'One'},{Id:'42',Kind:'sale',Name:'Two'}])
 await expect(searchNativeSalesDocuments(12,'2026-10-18','2026-10-27',params)).rejects.toThrow()
 api.mockResolvedValue([{Id:'43',Kind:'sale',Name:'One'}])
 await expect(searchNativeSalesDocuments(12,'2026-10-18','2026-10-27',{...params,value:'id:42'})).rejects.toThrow()
})
it.each([[13,'2026-10-18','2026-10-27'],[12,'2026-02-30','2026-03-01'],[14,'2026-10-28','2026-10-27']] as const)('rejects invalid scope without network',async(field,from,to)=>{
 await expect(searchNativeSalesDocuments(field,from,to,params)).rejects.toThrow();expect(api).not.toHaveBeenCalled()
})

it('normalizes only presentation keys of legacy JSON text without rewriting saved payloads',()=>{
 const Data='{"Id":123,"Name":"old number"}'
 const saved={Data,Name:'123',Value:123} as unknown as import('../types').ReportSelectedValue
 expect(salesDocumentKey(salesDocumentSelectedEntity(saved,12))).toBe('sale:123')
 expect(saved.Data).toBe(Data)
 const large={...saved,Data:'{"Id":"9007199254740993"}'} as unknown as import('../types').ReportSelectedValue
 expect(salesDocumentKey(salesDocumentSelectedEntity(large,14))).toBe('return:9007199254740993')
 for (const Data of ['{"Id":123,"id":124}','{"Id":9007199254740993}','{"Id":',' '.repeat(65537)]) {
  const bad={...saved,Data} as unknown as import('../types').ReportSelectedValue
  expect(salesDocumentKey(salesDocumentSelectedEntity(bad,12))).toBeNull()
 }
})

it.each(['sales','grossProfit'])('keeps %s document kinds in distinct fields and preserves saved payload wire',async reportProfile=>{
 const body:ReportRequestBody={dataSource:2,reportProfile,from:'2026-10-18',to:'2026-10-27',sorted:{Row:[],Col:[],Measurements:[{Type:4,Name:'SalesValueWithVAT',IsChecked:true,parentName:''}]},selections:[
  {IsChecked:true,SelectedField:{Type:12,Name:'Документ продажу'},FilterCondition:{Type:0,Name:'Дорівнює'},Values:[{Data:{Id:'9007199254740993'},Name:'Продаж · 01.01.2025 12:00:00',Value:0}]},
  {IsChecked:true,SelectedField:{Type:14,Name:'Повернення'},FilterCondition:{Type:0,Name:'Дорівнює'},Values:[{Data:'{"Id":123}' as unknown as import('../types').ReportEntity,Name:'Стара назва',Value:123}]},
 ]}
 const original=structuredClone(body);api.mockResolvedValue({DocumentURL:'/reports/doc.xlsx',PdfDocumentURL:'/reports/doc.pdf'})
 await createStockReport(body)
 expect(api).toHaveBeenLastCalledWith('/report/stocks/generate',expect.objectContaining({body:original}))
 expect(body).toEqual(original)
})

it('accepts the existing source2 calendar range and periods longer than366days',async()=>{
 api.mockResolvedValue([])
 await expect(searchNativeSalesDocuments(12,'2025-01-01','2026-10-27',params)).resolves.toEqual([])
 await expect(searchNativeSalesDocuments(14,'1900-01-01','9998-12-31',params)).resolves.toEqual([])
 for (const [from,to] of [['1899-12-31','2026-10-27'],['2026-10-18','9999-01-01']])
  await expect(searchNativeSalesDocuments(12,from,to,params)).rejects.toThrow()
})
