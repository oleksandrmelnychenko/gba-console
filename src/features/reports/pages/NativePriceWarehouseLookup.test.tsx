import { MantineProvider } from '@mantine/core'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { apiRequest } from '../../../shared/api/apiClient'
import type { ReportDataset, ReportSelectedValue } from '../types'
import { nativePriceFilterCapability, nativePriceFilterDescriptor, nativePriceSavedKey, PRICE_FILTER_UNAVAILABLE } from '../data/nativePriceFilterLookup'
import { priceCapabilityFixture, priceDatasetFixture, priceSelectionFixture } from '../data/nativePriceFilterLookup.test-fixtures'
import { NativePriceFilterValuePicker } from './NativePriceFilterValuePicker'
vi.mock('../../../shared/api/apiClient',()=>({apiRequest:vi.fn()}))
const api=vi.mocked(apiRequest),route='/report/datasets/price-comparison/filters/lookup'
function legacyDataset(){const dataset=priceDatasetFixture();const cap=priceCapabilityFixture();cap.fields=cap.fields.filter(field=>field.fieldType!==21);dataset.priceFilterLookup=cap;dataset.Filters=dataset.Filters.filter(field=>field.Type!==21);return dataset}
it.each([false,true])('admits the exact prior9 or new10 owned descriptors (new=%s)',current=>{
 const dataset=current?priceDatasetFixture():legacyDataset();expect(nativePriceFilterCapability(dataset,46)).toHaveLength(current?10:9)
 expect(nativePriceFilterDescriptor(dataset,46,4)?.fieldType).toBe(4);expect(nativePriceFilterDescriptor(dataset,46,21)?.fieldType).toBe(current?21:undefined)
})
const badCaps=[
 ()=>({...priceCapabilityFixture(),fields:priceCapabilityFixture().fields.slice(1)}),
 ()=>({...priceCapabilityFixture(),fields:priceCapabilityFixture().fields.slice(0,8)}),
 ()=>({...priceCapabilityFixture(),fields:[...priceCapabilityFixture().fields,priceCapabilityFixture().fields[0]]}),
 ()=>({...priceCapabilityFixture(),fields:priceCapabilityFixture().fields.map(field=>field.fieldType===21?{...field,fieldType:22}:field)}),
 ()=>({...priceCapabilityFixture(),fields:priceCapabilityFixture().fields.map(field=>field.fieldType===21?{...field,conditions:[0,1,2,3,4]}:field)}),
 ()=>({...priceCapabilityFixture(),fields:priceCapabilityFixture().fields.map(field=>field.fieldType===21?{...field,hierarchy:true}:field)}),
 ()=>({...priceCapabilityFixture(),fields:priceCapabilityFixture().fields.map(field=>field.fieldType===21?{...field,periodRequired:true}:field)}),
 ()=>({...priceCapabilityFixture(),extra:true}),
]
it.each(badCaps.map((make,index)=>({make,index})))('refuses partial/foreign/duplicate/contradictory capability$index',({make})=>{
 const dataset=priceDatasetFixture();dataset.priceFilterLookup=make();expect(nativePriceFilterCapability(dataset,46)).toBeNull()
})
it.each([2,44])('never borrows source46 warehouse capability for source%i',source=>expect(nativePriceFilterCapability(priceDatasetFixture(),source)).toBeNull())
it.each(['1','9007199254740993','9223372036854775807'])('retains exact warehouse string%s without numeric conversion',id=>{
 const raw=JSON.stringify({Id:id,Archived:true});const saved={Data:raw,Name:'Збережений склад',Value:0}as unknown as ReportSelectedValue
 expect(nativePriceSavedKey(21,saved)).toBe(id);expect(saved.Data).toBe(raw)
})
const retained=[{Data:'{"Id":"9007199254740993","Archived":true}',Name:'Збережений склад',Value:0}]as unknown as ReportSelectedValue[]
function Form({dataset=priceDatasetFixture(),from='2026-10-01'}:{dataset?:ReportDataset;from?:string}){
 const [values,setValues]=useState(retained)
 return <MantineProvider env="test"><I18nProvider><NativePriceFilterValuePicker dataSource={46} dataset={dataset} selection={{...priceSelectionFixture(21,2),Values:values}} from={from} to="2026-10-31" label="Значення" onChange={setValues}/><output data-testid="values">{JSON.stringify(values)}</output></I18nProvider></MantineProvider>
}
beforeEach(()=>{api.mockReset();Object.defineProperty(HTMLElement.prototype,'scrollIntoView',{configurable:true,value:vi.fn()})})
afterEach(()=>{cleanup();vi.restoreAllMocks()})
it('keeps old-server warehouse unavailable without fallback or changing saved rawJSON',()=>{
 render(<Form dataset={legacyDataset()}/>);expect(screen.getByText(PRICE_FILTER_UNAVAILABLE)).toBeTruthy();expect(JSON.parse(screen.getByTestId('values').textContent!)).toEqual(retained);expect(api).not.toHaveBeenCalled()
})
it('keeps warehouse403 on the own endpoint and preserves saved values',async()=>{
 api.mockRejectedValue(new Error('403'));render(<Form/>);await screen.findByRole('button',{name:'Спробувати ще раз'});expect(api).toHaveBeenCalledOnce();expect(api.mock.calls[0][0]).toBe(route);expect(JSON.parse(screen.getByTestId('values').textContent!)).toEqual(retained)
})
it('does not refetch a date-independent warehouse directory after the report period changes',async()=>{
 api.mockResolvedValue([]);const view=render(<Form/>);await waitFor(()=>expect(api).toHaveBeenCalledOnce());view.rerender(<Form from="2026-09-01"/>);expect(api).toHaveBeenCalledOnce()
})
it('selects a new exactInt64 warehouse through the visible picker and preserves old rawJSON',async()=>{
 const row={Id:'9223372036854775807',Name:'Склад [9223372036854775807]'};api.mockImplementation(async(_path,options)=>options?.query?.exactId?[row]:[])
 render(<Form/>);await waitFor(()=>expect(api).toHaveBeenCalledOnce());await userEvent.click(screen.getByRole('radio',{name:'Точний ID'}));await userEvent.type(screen.getByRole('combobox',{name:'Точний ID значення'}),row.Id)
 await userEvent.click(await screen.findByRole('option',{name:row.Name}));expect(JSON.parse(screen.getByTestId('values').textContent!)).toEqual([...retained,{Data:{Id:row.Id},Name:row.Name,Value:0}]);expect(api.mock.calls.at(-1)?.[1]?.query).toEqual({dataSource:46,field:21,exactId:row.Id,offset:0,limit:30})
})
