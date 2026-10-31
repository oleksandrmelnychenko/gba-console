import { MantineProvider } from '@mantine/core'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { apiRequest } from '../../../shared/api/apiClient'
import type { ReportDataset, ReportSelectedValue, ReportSelection } from '../types'
import { NATIVE_PRICE_FILTER_FIELDS } from '../data/nativePriceFilterLookup'
import { priceDatasetFixture, priceSelectionFixture } from '../data/nativePriceFilterLookup.test-fixtures'
import { reportProductDataset } from '../data/reportProductLookup.test-fixtures'
import { ReportSelectionsCard, SelectionValuePicker } from './ReportsStocksPage'
vi.mock('../../../shared/api/apiClient',()=>({apiRequest:vi.fn()}))
const api=vi.mocked(apiRequest),route='/report/datasets/price-comparison/filters/lookup'
function Picker({source=46,field=4,dataset=priceDatasetFixture(),values=[]}:{source?:number;field?:number;dataset?:ReportDataset;values?:ReportSelectedValue[]}){
 return <MantineProvider env="test"><I18nProvider><SelectionValuePicker dataSource={source} dataset={dataset} selection={{IsChecked:true,SelectedField:{Type:field,Name:'Поле'},FilterCondition:{Type:0,Name:'Дорівнює'},Values:values}} selections={[]} from="2026-10-01" to="2026-10-31" label="Значення" onChange={()=>{}}/></I18nProvider></MantineProvider>
}
beforeEach(()=>{api.mockReset();api.mockResolvedValue([]);Object.defineProperty(HTMLElement.prototype,'scrollIntoView',{configurable:true,value:vi.fn()})})
afterEach(cleanup)
it.each(NATIVE_PRICE_FILTER_FIELDS)('dispatches source46 field%i only to its own scoped minimal native endpoint',async field=>{
 render(<Picker field={field}/>);await waitFor(()=>expect(api).toHaveBeenCalledOnce());expect(api.mock.calls[0][0]).toBe(route);expect(api.mock.calls[0][1]?.query).toMatchObject({dataSource:46,field})
})
it.each([undefined,{version:99},{...priceDatasetFixture().priceFilterLookup as object,dataSource:44}])('keeps source46 missing/invalid capability failclosed with archived selection intact %j',priceFilterLookup=>{
 const raw=[{Data:{Id:'9007199254740993'},Name:'Архівний ключ',Value:0}];render(<Picker values={raw} dataset={{...priceDatasetFixture(),priceFilterLookup}}/>);expect(screen.getByText('Архівний ключ')).toBeTruthy();expect(screen.getByText(/Сервер не підтвердив довідник/)).toBeTruthy();expect(api).not.toHaveBeenCalled()
})
it('refuses a foreign dataset owner instead of reusing its source46 capability',()=>{
 render(<Picker dataset={{...priceDatasetFixture(),DataSource:44}}/>);expect(screen.getByText(/Сервер не підтвердив довідник/)).toBeTruthy();expect(api).not.toHaveBeenCalled()
})
it('preserves source44 raw TOP transport without admitting the source46 endpoint',async()=>{
 render(<Picker source={44} field={3} dataset={{...priceDatasetFixture(),DataSource:44}}/>);await waitFor(()=>expect(api).toHaveBeenCalled());expect(api.mock.calls.every(call=>call[0]!==route)).toBe(true)
})
it('preserves unprofiled source2 TOP and its old static directory route',async()=>{
 render(<Picker source={2} field={3} dataset={{...priceDatasetFixture(),DataSource:2}}/>);await waitFor(()=>expect(api).toHaveBeenCalled());expect(api.mock.calls.every(call=>call[0]!==route)).toBe(true)
})
it('keeps accepted P11 Product1 on its shared report route rather than the nine-field endpoint',async()=>{
 render(<Picker source={3} field={1} dataset={reportProductDataset(3)}/>);await waitFor(()=>expect(api).toHaveBeenCalledOnce());expect(api.mock.calls[0][0]).toBe('/report/datasets/products/lookup');expect(api.mock.calls[0][1]?.query?.dataSource).toBe(3)
})
it.each([3,4]as const)('opens and saves a source46 field%i modal preserving opaque saved JSON bytes without auto exact hydration',async field=>{
 const value={Data:field===3?'{ "Name":" A ","Archived":true }':'{ "Id":"9007199254740993","Archived":true }',Name:'Архівний підпис',Value:0}as unknown as ReportSelectedValue
 function Form(){const [selection,setSelection]=useState<ReportSelection>({...priceSelectionFixture(field),Values:[value]});return <MantineProvider env="test"><I18nProvider><ReportSelectionsCard dataSource={46} dataset={priceDatasetFixture()} selections={[selection]} from="2026-10-01" to="2026-10-31" filterFieldOptions={priceDatasetFixture().Filters.map(item=>({field:item,label:item.Name,value:String(item.Type)}))} onChange={edit=>{if(edit.kind==='replace')setSelection(edit.selection)}}/><output data-testid="raw-selection">{JSON.stringify(selection)}</output></I18nProvider></MantineProvider>}
 render(<Form/>);const before=screen.getByTestId('raw-selection').textContent;await userEvent.click(screen.getByRole('button',{name:'Редагувати'}));await screen.findByRole('dialog');await waitFor(()=>expect(api).toHaveBeenCalledOnce());expect(api.mock.calls[0][1]?.query).not.toHaveProperty('exactId');expect(api.mock.calls[0][1]?.query).not.toHaveProperty('exactValue');await userEvent.click(screen.getByRole('button',{name:'Зберегти'}));expect(screen.getByTestId('raw-selection').textContent).toBe(before)
})
