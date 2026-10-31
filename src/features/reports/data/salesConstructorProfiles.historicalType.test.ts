import { expect, it, vi } from 'vitest'
import { datasetConfigurationError } from './reportDatasets'
import { salesConstructorDataset, salesConstructorError, namedSalesPriceTypeError, NAMED_SALES_PRICE_TYPE_UNAVAILABLE } from './salesConstructorProfiles'
import { namedPriceDataset, namedPriceRequest } from './namedPriceType.test-fixtures'
import { normalizeSavedTemplate } from '../api/reportWorkspaceApi'
import { reportWorkspaceDraftCompatibility } from './reportWorkspaceDraftCompatibility'
vi.mock('../../../shared/api/apiClient',()=>({apiRequest:vi.fn()}))
const cases=(['sales','grossProfit']as const).flatMap(profile=>[0,1,2,4].flatMap(condition=>[true,undefined].map(checked=>({profile,condition,checked}))))
it.each(cases)('rejects named$profile active11 condition$condition checked$checked without mutating stored selection/profile',({profile,condition,checked})=>{
 const request=namedPriceRequest(profile,condition);if(checked===undefined)delete(request.selections[0]as Partial<typeof request.selections[number]>).IsChecked
 const before=structuredClone(request);expect(salesConstructorError(request,namedPriceDataset)).toBe(NAMED_SALES_PRICE_TYPE_UNAVAILABLE);expect(namedSalesPriceTypeError(request)).toBe(NAMED_SALES_PRICE_TYPE_UNAVAILABLE);expect(request).toEqual(before)
})
it.each(['sales','grossProfit']as const)('opens an archived active11 %s template/draft for correction but still blocks Generate and save',profile=>{
 const request={...namedPriceRequest(profile),filterExpression:{Version:1 as const,Root:{Kind:3 as const,SelectionIndex:0}}},before=structuredClone(request)
 expect(datasetConfigurationError(request,namedPriceDataset,'workspace')).toBeNull();expect(datasetConfigurationError(request,namedPriceDataset)).toBe(NAMED_SALES_PRICE_TYPE_UNAVAILABLE)
 expect(reportWorkspaceDraftCompatibility({name:'Архів',data:request,measurements:[],activeTemplate:null,previousPeriod:{from:'',to:''}},namedPriceDataset)).toBeNull()
 expect(salesConstructorError(request,namedPriceDataset)).toBe(NAMED_SALES_PRICE_TYPE_UNAVAILABLE);expect(request).toEqual(before)
})
it.each(['sales','grossProfit']as const)('retains unchecked11 raw JSON/profile/expression in %s while ignoring the inactive predicate',profile=>{
 const request={...namedPriceRequest(profile,0,false),filterExpression:{Version:1 as const,Root:{Kind:3 as const,SelectionIndex:0}}},before=structuredClone(request)
 expect(salesConstructorError(request,namedPriceDataset)).toBeNull();expect(datasetConfigurationError(request,namedPriceDataset)).toBeNull();expect(request).toEqual(before)
 const saved=normalizeSavedTemplate({Id:'historical-type',Revision:1,Name:'Архів',UpdatedAtUtc:'2026-10-31T00:00:00Z',Data:{DataSource:2,From:request.from,To:request.to,Sorted:request.sorted,Selections:request.selections,ReportProfile:profile,FilterExpression:request.filterExpression}})
 expect(saved.Data.selections).toEqual(request.selections);expect(saved.Data.reportProfile).toBe(profile);expect(saved.Data.filterExpression).toEqual(request.filterExpression)
})
it.each(['sales','grossProfit']as const)('hides11 only from the effective named %s source2 selector and leaves raw datasets intact',profile=>{
 const before=structuredClone(namedPriceDataset),effective=salesConstructorDataset(namedPriceDataset,profile)!
 expect(effective.Filters.some(field=>field.Type===11)).toBe(false);expect(effective.Filters.map(field=>field.Type)).toEqual(namedPriceDataset.Filters.filter(field=>![11,21,64].includes(field.Type)).map(field=>field.Type));expect(namedPriceDataset).toEqual(before)
 expect(salesConstructorDataset(namedPriceDataset,undefined)).toBe(namedPriceDataset)
 expect(salesConstructorDataset({...namedPriceDataset,DataSource:44},profile)!.Filters.some(field=>field.Type===11)).toBe(true)
})
it('does not weaken other invalid profiles or measures when opening a saved template',()=>{
 const request=namedPriceRequest('grossProfit');expect(salesConstructorError({...request,reportProfile:'foreign'},namedPriceDataset,true)).toContain('Невідомий')
 expect(salesConstructorError({...request,sorted:{...request.sorted,Measurements:[{Type:14,Name:'Чужий',IsChecked:true,parentName:''}]}},namedPriceDataset,true)).toContain('Показник')
})
it('leaves unprofiled source2 current-price behavior and foreign source44 requests outside the named guard',()=>{
 const request=namedPriceRequest();delete request.reportProfile;expect(namedSalesPriceTypeError(request)).toBeNull()
 expect(namedSalesPriceTypeError({...request,dataSource:44,reportProfile:'sales'})).toBeNull();expect(request.selections[0].Values[0].Data).toBe('{"Id":"9007199254740993","Archived":true}')
})

it('restoring active11 still rejects a foreign source, unknown active field, malformed presentation and malformed expression',()=>{
 const request=namedPriceRequest(),before=structuredClone(request)
 expect(salesConstructorError({...request,dataSource:44},namedPriceDataset,true)).toBeTruthy()
 const unknown={...request,selections:[...request.selections,{...request.selections[0],SelectedField:{Type:999,Name:'Чужий відбір'}}]}
 expect(datasetConfigurationError(unknown,namedPriceDataset,'workspace')).toContain('не підтримує')
 const presentation={...request,constructorPresentation:{Version:99}}as unknown as typeof request
 expect(salesConstructorError(presentation,namedPriceDataset,true)).toBeTruthy()
 const detail={...request,sorted:{...request.sorted,Row:[{type:84,key:'Detail',label:'Детальний запис GBA'},...request.sorted.Row]}}
 expect(salesConstructorError(detail,namedPriceDataset,true)).toBeTruthy()
 const tree={...request,filterExpression:{Version:1,Root:{Kind:3,SelectionIndex:99}}}as unknown as typeof request
 expect(datasetConfigurationError(tree,namedPriceDataset,'workspace')).toBeTruthy();expect(request).toEqual(before)
})
it('restores a missing IsChecked active11 payload without adding the flag or modifying the raw selection/tree',()=>{
 const request=namedPriceRequest();delete(request.selections[0]as Partial<typeof request.selections[number]>).IsChecked
 const before=structuredClone(request)
 expect(datasetConfigurationError(request,namedPriceDataset,'workspace')).toBeNull();expect(salesConstructorError(request,namedPriceDataset)).toBe(NAMED_SALES_PRICE_TYPE_UNAVAILABLE);expect(request).toEqual(before);expect(Object.hasOwn(request.selections[0],'IsChecked')).toBe(false)
})
