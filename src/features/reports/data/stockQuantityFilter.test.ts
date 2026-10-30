import { expect,it } from 'vitest'
import { cloneStockQuantityFilter,positiveClosingQuantity,readStockQuantityFilter,requestStockQuantityFilter,stockQuantityFilterError,stockQuantityFilterSupported } from './stockQuantityFilter'
import { stockQuantityCapability,stockQuantityDataset,stockQuantityRequest } from './stockQuantityFilter.test-fixtures'
import { normalizeSavedTemplate } from '../api/reportWorkspaceApi'

it('omits absent/null legacy settings and admits only exact after-grouping source45 capability',()=>{
 expect(requestStockQuantityFilter(stockQuantityRequest())).toBeUndefined();expect(cloneStockQuantityFilter({StockQuantityFilter:null})).toEqual({})
 expect(stockQuantityFilterSupported(stockQuantityDataset)).toBe(true)
 for(const change of [{stage:'RawRows'},{unknownQuantity:'Zero'},{maxColumnGroupings:1},{requiresMeasure:false},{value:1},{rowGroupingTypes:[0,5,29]},{rowGroupingTypes:undefined}])expect(stockQuantityFilterSupported({...stockQuantityDataset,stockQuantityFilter:{...stockQuantityCapability,...change}})).toBe(false)
 expect(stockQuantityFilterSupported({...stockQuantityDataset,DataSource:2})).toBe(false)
})
it('keeps restored raw settings and rejects invalid semantics only at run/save admission',()=>{
 const request=stockQuantityRequest();const raw={...positiveClosingQuantity};const saved=normalizeSavedTemplate({Id:'stock',Revision:1,Name:'Залишок',UpdatedAtUtc:'2026-10-30T00:00:00Z',Data:{DataSource:45,From:request.from,To:request.to,Sorted:request.sorted,Selections:[],StockQuantityFilter:raw}})
 expect(requestStockQuantityFilter(saved.Data)).toEqual(raw)
 expect(stockQuantityFilterError(saved.Data,stockQuantityDataset)).toBeNull()
 expect(stockQuantityFilterError(saved.Data,{...stockQuantityDataset,stockQuantityFilter:undefined})).toMatch(/Сервер ще/)
 for(const value of [{...raw,value:1},{...raw,value:'0'},{...raw,measure:105},{...raw,extra:true},{...raw,comparison:'GreaterThanOrEqual'},'106>0'])expect(readStockQuantityFilter(value)).toBeNull()
 expect(stockQuantityFilterError({...request,stockQuantityFilter:raw,StockQuantityFilter:raw})).not.toBeNull()
 expect(stockQuantityFilterError({...request,dataSource:2,stockQuantityFilter:raw})).not.toBeNull()
})
it('requires selected closing quantity and row-only grouped scope without modifying choices',()=>{
 const request={...stockQuantityRequest(),stockQuantityFilter:positiveClosingQuantity};const before=structuredClone(request)
 expect(stockQuantityFilterError(request,stockQuantityDataset)).toBeNull();expect(request).toEqual(before)
 const missing=structuredClone(request);missing.sorted.Measurements[0].IsChecked=false;expect(stockQuantityFilterError(missing)).toMatch(/показник/)
 const columns=structuredClone(request);columns.sorted.Col=[{type:0,key:'Year',label:'Рік'}];expect(stockQuantityFilterError(columns)).toMatch(/без групування колонок/)
 const empty=structuredClone(request);empty.sorted.Row=[];expect(stockQuantityFilterError(empty)).not.toBeNull()
})

it('restricts active filter date axes while preserving ordinary date grouping and editable date ranges',()=>{
 for(const type of [0,1,2,3]){
  const request=stockQuantityRequest();request.sorted.Row.unshift({type,key:'Period',label:'Період'})
  expect(stockQuantityFilterError(request,stockQuantityDataset)).toBeNull()
  const active={...request,stockQuantityFilter:positiveClosingQuantity};const before=structuredClone(active)
  expect(stockQuantityFilterError(active,stockQuantityDataset)).toMatch(/групування за роком/)
  expect(active).toEqual(before)
 }
 const request={...stockQuantityRequest(),stockQuantityFilter:positiveClosingQuantity,from:'2020-01-01',to:'2026-10-27'}
 expect(stockQuantityFilterError(request,stockQuantityDataset)).toBeNull()
})
