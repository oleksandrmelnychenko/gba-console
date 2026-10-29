import { expect, it } from 'vitest'
import type { ReportSelection } from '../types'
import { customerGroupSelectionsError } from './customerGroupSelections'
const selection = (field:number,condition=2,checked=true):ReportSelection=>({IsChecked:checked,SelectedField:{Type:field,Name:String(field)},FilterCondition:{Type:condition,Name:'Умова'},Values:JSON.parse(String.raw`[{"Data":"{\"Id\":10}","Name":"Старе","Value":10},{"Data":{"Id":20},"Name":"Відсутнє","Value":0}]`)})
it.each([0,1,2,4])('preserves valid Product set semantics for condition%d',condition=>{
  expect(customerGroupSelectionsError(44,[selection(1,condition)])).toBeNull()
})
it.each([8,10])('validates active field%d cardinality but leaves disabled raw template untouched',field=>{
  for(const condition of [0,1]) {
    expect(customerGroupSelectionsError(44,[selection(field,condition)])).toBe('Оберіть одне значення для цієї умови.')
    expect(customerGroupSelectionsError(44,[selection(field,condition,false)])).toBeNull()
  }
  for(const condition of [2,4]) expect(customerGroupSelectionsError(44,[selection(field,condition)])).toBeNull()
})
it('keeps other sources and Org/Region outside new validation',()=>{
  expect(customerGroupSelectionsError(2,[selection(8,0)])).toBeNull()
  expect(customerGroupSelectionsError(44,[selection(0,0),selection(7,0)])).toBeNull()
})
it.each([1,8,10])('rejects unsafe ID without dropping raw data for field%d',field=>{
 const value=selection(field);value.Values=JSON.parse(String.raw`[{"Data":"{\"Id\":\"9007199254740993\"}","Name":"Старе","Value":0}]`)
 const before=JSON.stringify(value)
 expect(customerGroupSelectionsError(44,[value])).toContain('ідентифікатор не підтверджено')
 expect(JSON.stringify(value)).toBe(before)
})
