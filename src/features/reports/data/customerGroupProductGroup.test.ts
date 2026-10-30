import { expect, it } from 'vitest'
import { customerGroupProductGroupId, customerGroupProductGroupQueryError } from './customerGroupProductGroup'
import { canonicalCustomerGroupInt64Id } from './customerGroupInt64'
import { customerGroupChoiceValues } from './customerGroupChoiceValues'
import { customerGroupSelectionsError } from './customerGroupSelections'
import { customerGroupDirectoryId } from './customerGroupDirectory'
import type { ReportSelection, ReportSelectedValue } from '../types'
const max='9223372036854775807'
const raw:ReportSelectedValue[]=JSON.parse(String.raw`[{"Data":"{\"Id\":\"9007199254740993\"}","Name":"Стара назва","Value":0},{"Data":{"Id":"9223372036854775807"},"Name":"Архівний група","Value":0}]`)
const selection=(condition=2,checked=true):ReportSelection=>({IsChecked:checked,SelectedField:{Type:4,Name:'Поточні прямі групи товару'},FilterCondition:{Type:condition,Name:'Умова'},Values:raw})
it.each(['1','9007199254740993',max])('preserves exact Int64 string %s through object and savedJSON',id=>{
 expect(canonicalCustomerGroupInt64Id(id)).toBe(id);expect(customerGroupProductGroupId({Id:id})).toBe(id);expect(customerGroupProductGroupId(JSON.stringify({Id:id}))).toBe(id)
 expect(customerGroupProductGroupQueryError('id:'+id)).toBeNull()
})
it.each(['0','01','-1','1.0','1e3',' 1','9223372036854775808','18446744073709551615'])('rejects noncanonical/out-ofrange Id %s',id=>{
 expect(canonicalCustomerGroupInt64Id(id)).toBeNull();expect(customerGroupProductGroupId({Id:id})).toBeNull();expect(customerGroupProductGroupQueryError('id:'+id)).not.toBeNull()
})
it.each(['{"Id":1.0}','{"Id":1e3}','{"Id":1.0000000000000001}','{"Id":9007199254740993}','{"Id":9223372036854775807}','{"Id":"1","ID":"2"}','{"Id":"1","Id":"2"}','{"ParentGroupID":"1"}','{"NetUid":"1"}'])('rejects unsafe numeric tokens and ambiguous/substituted identities %s',data=>{
 expect(customerGroupProductGroupId(data)).toBeNull()
})
it('accepts safe legacy integer payload without changing its bytes or broadening numeric directories',()=>{
 expect(customerGroupProductGroupId('{"id":123}')).toBe('123');expect(customerGroupProductGroupId({Id:123})).toBe('123')
 expect(customerGroupDirectoryId({Id:max})).toBeNull();expect(customerGroupDirectoryId({Id:'9007199254740993'})).toBeNull()
 const legacy:ReportSelectedValue[]=JSON.parse(String.raw`[{"Data":"{\"id\":123}","Name":"Збережена назва","Value":0}]`)
 const same=customerGroupChoiceValues(legacy,[{Id:'123',Name:'Нова назва'}],4)
 expect(same.selected).toEqual([{value:'123',label:'Збережена назва'}]);expect(same.change(['123'])).toEqual(legacy)
})
it('keeps exact old raw values/captions and distinguishes same-caption lookup IDs',()=>{
 const options=[{Id:'9007199254740993',Name:'Нова назва'},{Id:'9007199254740994',Name:'Однакова назва'},{Id:'9007199254740995',Name:'Однакова назва'}]
 const model=customerGroupChoiceValues(raw,options,4)
 expect(model.selected.map(x=>x.value)).toEqual(['9007199254740993',max]);expect(model.data[0].label).toBe('Стара назва')
 expect(model.change(['9007199254740993',max])).toEqual(raw)
 expect(model.change(['9007199254740993',max,'9007199254740994','9007199254740995'])).toEqual([...raw,{Data:{Id:'9007199254740994'},Name:'Однакова назва',Value:0},{Data:{Id:'9007199254740995'},Name:'Однакова назва',Value:0}])
})
it.each([0,1])('blocks active multi direct group condition%d but allows explicit list repair and disabled preservation',condition=>{
 expect(customerGroupSelectionsError(44,[selection(condition)])).toBe('Оберіть одне значення для цієї умови.')
 expect(customerGroupSelectionsError(44,[selection(condition,false)])).toBeNull()
 for(const list of [2,4])expect(customerGroupSelectionsError(44,[selection(list)])).toBeNull()
})
it('rejects checked unsafeData, >100 and nonflat while retaining out-ofscope and disabled behavior',()=>{
 const bad=selection();bad.Values=JSON.parse('[{"Data":{"Id":9007199254740993},"Name":"Old","Value":0}]')
 expect(customerGroupSelectionsError(44,[bad])).toContain('ідентифікатор');bad.IsChecked=false;expect(customerGroupSelectionsError(44,[bad])).toBeNull()
 const many=selection();many.Values=Array.from({length:101},(_,i)=>({Data:{Id:String(i+1)},Name:'A',Value:0}));expect(customerGroupSelectionsError(44,[many])).toContain('100')
 const group=selection(3);expect(customerGroupSelectionsError(44,[group])).toContain('чотирьох')
 expect(customerGroupSelectionsError(2,[selection(0)])).toBeNull()
})
