import { expect,it } from 'vitest'
import { customerGroupTopName,customerGroupTopValues,validCustomerGroupTopName } from './customerGroupTop'
import { customerGroupSelectionsError } from './customerGroupSelections'
import type { ReportSelection,ReportSelectedValue } from '../types'
const selected:ReportSelectedValue[]=JSON.parse(String.raw`[{"Data":"{\"Name\":\"E  \",\"Id\":999}","Name":"Стара назва E","Value":0},{"Data":{"Name":"UNKNOWN"},"Name":"Архів","Value":0}]`)
const selection=(condition=2,checked=true):ReportSelection=>({IsChecked:checked,SelectedField:{Type:3,Name:'TOP'},FilterCondition:{Type:condition,Name:'Умова'},Values:selected})
it.each(['E  ','X9',' A ','invalid:0','<TOP>','id:123','A'.repeat(64),'😀'.repeat(32),'\uFEFF'])('preserves raw business code %j independent of IDs',name=>{
 expect(validCustomerGroupTopName(name)).toBe(true);expect(customerGroupTopName({Name:name,Id:999})).toBe(name);expect(customerGroupTopName(JSON.stringify({name}))).toBe(name)
})
it.each(['',' ','\t','\u0085','\u00A0','\u1680','\u202F','\u205F','\u3000','A'.repeat(65),'😀'.repeat(33)])('rejects empty/.NET whitespace/overlong code %j',name=>{
 expect(validCustomerGroupTopName(name)).toBe(false);expect(customerGroupTopName({Name:name})).toBeNull()
})
it.each(['{"Id":1}','{"Name":1}','{"Name":"A","NAME":"B"}','{"Name":"A","Name":"B"}','{"nested":{"Name":"A"}}','[]','{"Name":null}'])('refuses substituted or ambiguous saved identity %s',raw=>expect(customerGroupTopName(raw)).toBeNull())
it('distinguishes raw-space codes and keeps rawJSON/oldcaptions/disappeared values without rownumber identities',()=>{
 const model=customerGroupTopValues(selected,['E','E  ','X9']);expect(model.selected[0]).toEqual({value:'top:"E  "',label:'Стара назва E'})
 expect(model.change(model.selected.map(x=>x.value))).toEqual(selected)
 expect(model.change([...model.selected.map(x=>x.value),'top:"E"'])).toEqual([...selected,{Data:{Name:'E'},Name:'E',Value:0}])
 const bad:ReportSelectedValue[]=[{Data:{Id:1},Name:'invalid:0',Value:0}];const collision=customerGroupTopValues(bad,['invalid:0']);expect(collision.selected[0].value).not.toBe(collision.data[0].value)
})
it.each([0,1])('blocks active multi equality%d while retaining disabled and explicit list correction',condition=>{
 expect(customerGroupSelectionsError(44,[selection(condition)])).toBe('Оберіть одне значення для цієї умови.')
 expect(customerGroupSelectionsError(44,[selection(condition,false)])).toBeNull();expect(customerGroupSelectionsError(44,[selection(2)])).toBeNull();expect(customerGroupSelectionsError(44,[selection(4)])).toBeNull()
})
it('enforces local code not catalog membership; guards limits and leaves other sources untouched',()=>{
 const s=selection();s.Values=[{Data:{Id:9},Name:'X9',Value:0}];expect(customerGroupSelectionsError(44,[s])).toContain('код');s.IsChecked=false;expect(customerGroupSelectionsError(44,[s])).toBeNull()
 const tooMany=selection();tooMany.Values=Array.from({length:101},(_,i)=>({Data:{Name:'T'+i},Name:'T'+i,Value:0}));expect(customerGroupSelectionsError(44,[tooMany])).toContain('100')
 expect(customerGroupSelectionsError(44,[selection(3)])).toContain('чотирьох');expect(customerGroupSelectionsError(2,[selection(0)])).toBeNull()
})

it('decodes escaped Name keys once and distinguishes nested unrelated names from duplicate aliases',()=>{
 expect(customerGroupTopName(String.raw`{"Na\u006de":"E  ","nested":{"Name":"OTHER"}}`)).toBe('E  ')
 expect(customerGroupTopName(String.raw`{"Name":"E  ","Na\u006de":"X9"}`)).toBeNull()
})
