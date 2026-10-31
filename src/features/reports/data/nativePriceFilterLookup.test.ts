import { expect, it, vi } from 'vitest'
import { parseReportDatasets } from '../api/reportWorkspaceApi'
import type { ReportDataset, ReportSelectedValue } from '../types'
import { isNativePriceFilterField, nativePriceFilterCapability, nativePriceFilterDescriptor, nativePriceFilterSelectionError, nativePriceSavedKey, NATIVE_PRICE_FILTER_FIELDS, PRICE_FILTER_UNAVAILABLE } from './nativePriceFilterLookup'
import { priceCapabilityFixture, priceDatasetFixture, priceSelectionFixture } from './nativePriceFilterLookup.test-fixtures'
import { reportSelectionConditions } from './reportSelectionPolicy'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
it.each(NATIVE_PRICE_FILTER_FIELDS)('admits only source46 field%i with exact advertised identity and flat condition contract', field => {
 const dataset=priceDatasetFixture(),descriptor=nativePriceFilterDescriptor(dataset,46,field)
 expect(descriptor).toEqual(priceCapabilityFixture().fields.find(item=>item.fieldType===field))
 expect([...reportSelectionConditions(46,dataset,undefined,field)!]).toEqual([0,1,2,4])
 expect(nativePriceFilterDescriptor(dataset,2,field)).toBeNull();expect(nativePriceFilterDescriptor({...dataset,DataSource:44},46,field)).toBeNull()
})
const badCaps=[undefined,null,[],{version:99},...['version','dataSource','endpoint','paging','maximumPageSize','fields'].map(key=>{const cap:Record<string,unknown>=priceCapabilityFixture();delete cap[key];return cap}),{...priceCapabilityFixture(),extra:true},{...priceCapabilityFixture(),dataSource:44},{...priceCapabilityFixture(),endpoint:'https://foreign.invalid/lookup'},{...priceCapabilityFixture(),fields:[...priceCapabilityFixture().fields,priceCapabilityFixture().fields[0]]},...[{identityKind:'positiveInt64String'},{exactParameter:'exactId'},{periodRequired:true},{hierarchy:true},{conditions:[0,1,2,3,4]},{extra:true}].map(patch=>({...priceCapabilityFixture(),fields:priceCapabilityFixture().fields.map((field,index)=>index?field:{...field,...patch})}))]
it.each(badCaps.map(priceFilterLookup=>({priceFilterLookup})))('rejects malformed capability without inferring any legacy transport $priceFilterLookup',({priceFilterLookup})=>{
 expect(nativePriceFilterCapability({...priceDatasetFixture(),priceFilterLookup},46)).toBeNull()
})
it.each([undefined,null,[null],[]].map(Filters=>({Filters})))('rejects malformed/missing filter catalogue without throwing $Filters',({Filters})=>{
 expect(nativePriceFilterCapability({...priceDatasetFixture(),Filters}as unknown as ReportDataset,46)).toBeNull()
})
it('retains new metadata through the real dataset parser and leaves the original object unchanged',()=>{
 const raw=priceDatasetFixture(),before=structuredClone(raw),parsed=parseReportDatasets([raw])[0]
 expect(nativePriceFilterCapability(parsed,46)).toEqual(priceCapabilityFixture().fields);expect(raw).toEqual(before)
})
it.each(['01','1',' A ','a','Код [77]'])('keeps raw TOP key %j and a legacy saved JSON object exactly',Name=>{
 const Data=JSON.stringify({Name,Archived:true}),value={Data,Name:'Збережено',Value:0}as unknown as ReportSelectedValue
 expect(nativePriceSavedKey(3,value)).toBe(Name);expect(value.Data).toBe(Data)
})
it.each([4,7,8,10,12,14,15,16]as const)('keeps field%i archived Int64 string and safe legacy numeric key without converting selected payload',field=>{
 const raw='{ "Id":"9007199254740993", "Archived":true }',value={Data:raw,Name:'Архів',Value:0}as unknown as ReportSelectedValue
 expect(nativePriceSavedKey(field,value)).toBe('9007199254740993');expect(value.Data).toBe(raw)
 expect(nativePriceSavedKey(field,{Data:{Id:12},Name:'Старий',Value:0})).toBe('12')
 expect(nativePriceSavedKey(field,{Data:{Id:9007199254740992},Name:'Небезпечний',Value:0})).toBeNull()
})
it.each([3,5,6,7])('rejects unsupported saved condition%i while preserving its data',condition=>{
 const selection={...priceSelectionFixture(3,condition),Values:[{Data:{Name:'01'},Name:'01',Value:0}]},before=structuredClone(selection)
 expect(nativePriceFilterSelectionError(46,[selection],priceDatasetFixture())).toContain('чотирьох');expect(selection).toEqual(before)
})
it('keeps inactive unverified raw selections and rejects active missing-cap selections',()=>{
 const selection={...priceSelectionFixture(4),Values:[{Data:{Id:'9007199254740993'},Name:'Архів',Value:0}]}
 expect(nativePriceFilterSelectionError(46,[selection],{...priceDatasetFixture(),priceFilterLookup:undefined})).toBe(PRICE_FILTER_UNAVAILABLE)
 expect(nativePriceFilterSelectionError(46,[{...selection,IsChecked:false}],undefined)).toBeNull()
 expect(nativePriceFilterSelectionError(44,[selection],undefined)).toBeNull();expect(isNativePriceFilterField(46,11)).toBe(false)
})
