import { normalizeSavedTemplate } from '../api/reportWorkspaceApi'
import { expect, it } from 'vitest'
import { netDataset } from './reportDatasets.test-fixtures'
import { defaultDatasetRequest } from './reportDatasets'
import { returnItemStatus, returnItemStatusesCapability, returnItemStatusesError } from './returnItemStatuses'
import type { ReportRequestBody } from '../types'
import { returnStatusDataset } from './returnItemStatuses.test-fixtures'
function request(Data: unknown): ReportRequestBody {
 const body: ReportRequestBody = { ...defaultDatasetRequest(returnStatusDataset,'2026-10-01','2026-10-27'), returnsOnly:true,
  selections:[{IsChecked:true,SelectedField:{Type:64,Name:'Причина повернення'},FilterCondition:{Type:0,Name:'Дорівнює'},Values:[{Data:{},Name:'Збережена назва',Value:0}]}] }
 // Deliberately model the untyped saved-wire boundary, including malformed payloads.
 Reflect.set(body.selections[0].Values[0], 'Data', Data)
 return body
}
it.each([0,6,8])('admits enum %s without using legacy dictionary identity', value => {
 expect(returnItemStatus({ReturnItemStatus:value})).toBe(value)
 expect(returnItemStatus(JSON.stringify({ReturnItemStatus:value}))).toBe(value)
 expect(returnItemStatusesError(request({ReturnItemStatus:value}),returnStatusDataset)).toBeNull()
})
it.each([{ReturnItemStatus:-1},{ReturnItemStatus:9},{ReturnItemStatus:'0'},{ReturnItemStatus:0,Id:71},{returnItemStatus:0},'{"ReturnItemStatus":0,"ReturnItemStatus":6}','{"ReturnItemStatus":0e0}','{"ReturnItemStatus":0.0}',{Name:'БРАК'}])('rejects malformed or invented reason %j', data => {
 expect(returnItemStatus(data)).toBeNull();expect(returnItemStatusesError(request(data),returnStatusDataset)).not.toBeNull()
})
it('preserves legacy raw IDs and multi-equality; never maps71 to enum71 or0',()=>{
 const raw=request('{"Id":71,"Name":"Стара назва"}');raw.selections[0].Values.push({Data:{Id:72},Name:'Інша',Value:0});const before=JSON.stringify(raw)
 expect(returnItemStatusesError(raw,returnStatusDataset)).toBeNull();expect(returnItemStatus({Id:71})).toBeNull();expect(JSON.stringify(raw)).toBe(before)
 raw.selections[0].Values.push({Data:{ReturnItemStatus:6},Name:'Брак',Value:0});expect(returnItemStatusesError(raw,returnStatusDataset)).toContain('Не змішуйте')
})
it('fails closed for old/malformed capability without blocking a disabled stored selection',()=>{
 const raw=request({ReturnItemStatus:0});expect(returnItemStatusesError(raw,netDataset)).toContain('Сервер не підтримує')
 expect(returnItemStatusesCapability({...returnStatusDataset,returnItemStatuses:{...returnStatusDataset.returnItemStatuses,values:Array(9).fill({value:0,name:'Zero'})}})).toBeNull()
 raw.selections[0].IsChecked=false;expect(returnItemStatusesError(raw,netDataset)).toBeNull()
})
it('does not admit capability in another source or apply returns picker policy to ordinary reports',()=>{
 expect(returnItemStatusesCapability({...returnStatusDataset,DataSource:44})).toBeNull()
 const raw=request({Name:'legacy untouched'});raw.returnsOnly=false;expect(returnItemStatusesError(raw,returnStatusDataset)).toBeNull()
})

it('accepts a single escaped canonical key but rejects duplicate decoded keys',()=>{
 expect(returnItemStatus(String.raw`{"ReturnItemStat\u0075s":0}`)).toBe(0)
 expect(returnItemStatus(String.raw`{"ReturnItemStat\u0075s":0,"ReturnItemStatus":6}`)).toBeNull()
})
it.each([0,1,2,4])('preserves valid existing multi-values with condition %s',condition=>{
 const raw=request({ReturnItemStatus:0});raw.selections[0].FilterCondition.Type=condition
 raw.selections[0].Values.push({Data:{ReturnItemStatus:6},Name:'Брак',Value:0})
 expect(returnItemStatusesError(raw,returnStatusDataset)).toBeNull()
})

it.each(['{"Id":71,"Name":"Стара назва"}','{"ReturnItemStatus":0}'])('restores saved raw JSON without rewriting it: %s', raw=>{
 const body=request(raw)
 const restored=normalizeSavedTemplate({Id:'return-status',Revision:1,Name:'Повернення',UpdatedAtUtc:'2026-10-30T00:00:00Z',Data:{DataSource:2,ReturnsOnly:true,From:body.from,To:body.to,Sorted:body.sorted,Selections:body.selections}})
 expect(restored.Data.selections[0].Values[0].Data).toBe(raw)
 expect(returnItemStatusesError(restored.Data,returnStatusDataset)).toBeNull()
})
