import { MantineProvider } from '@mantine/core'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { apiRequest } from '../../../shared/api/apiClient'
import { searchAnalysisValues } from '../api/currentVparivanieAnalysisApi'
import { reportProductDataset } from '../data/reportProductLookup.test-fixtures'
import type { ReportProductLookupSource } from '../data/productLookupCapability'
import type { AnalysisFieldDescriptor } from '../data/currentVparivanieAnalysis'
import type { ReportSelectedValue } from '../types'
import { CurrentVparivanieAnalysisValuePicker } from './CurrentVparivanieAnalysisValuePicker'
import { NativeSalesProductPicker } from './NativeSalesProductPicker'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
vi.mock('../api/currentVparivanieAnalysisApi', () => ({ searchAnalysisValues: vi.fn(), getAnalysisHierarchyPage: vi.fn() }))
const api = vi.mocked(apiRequest), groups = vi.mocked(searchAnalysisValues), id = '9007199254740993'
const descriptor = { type: 1, hierarchy: { version: 1, groupKind: 'productGroup', itemKind: 'product', itemField: 1,
  groupConditions: [3,5,6,7], mixedConditions: [3,5] } } as AnalysisFieldDescriptor
function Form({ source=3, condition=3 }: { source?: ReportProductLookupSource; condition?: number }) {
 const [values,setValues]=useState<ReportSelectedValue[]>([{Data:{kind:'productGroup',id},Name:'Збережена група',Value:0}])
 return <MantineProvider env="test"><I18nProvider><CurrentVparivanieAnalysisValuePicker descriptor={descriptor}
  selection={{IsChecked:true,SelectedField:{Type:1,Name:'Товар'},FilterCondition:{Type:condition,Name:'Умова'},Values:values}}
  selections={[]} from="2026-10-01" to="2026-10-30" onChange={setValues}
  renderItemPicker={context=><NativeSalesProductPicker dataSource={source} dataset={reportProductDataset(source)} {...context}/>}/>
  <output data-testid="values">{JSON.stringify(values)}</output></I18nProvider></MantineProvider>
}
beforeEach(()=>{api.mockReset().mockResolvedValue([{Id:id,Name:'Товар',VendorCode:'SKU'}]);groups.mockReset().mockResolvedValue([{id,name:'Група',data:{Id:id}}]);Object.defineProperty(HTMLElement.prototype,'scrollIntoView',{configurable:true,value:vi.fn()})})
afterEach(cleanup)
const mixedCases=([2,3,44,45] as const).flatMap(source=>[3,5].map(condition=>({source,condition})))
it.each(mixedCases)('preserves exact2-key product/group kind identities under report$source mixedcondition$condition',async({source,condition})=>{
 render(<Form source={source} condition={condition}/>);await waitFor(()=>expect(groups).toHaveBeenCalledOnce());expect(api).not.toHaveBeenCalled()
 await userEvent.click(screen.getByRole('radio',{name:'Товари'}));await waitFor(()=>expect(api).toHaveBeenCalledOnce())
 expect(api.mock.calls[0][0]).toBe('/report/datasets/products/lookup');expect(api.mock.calls[0][1]?.query?.dataSource).toBe(source)
 await userEvent.click(screen.getByRole('combobox',{name:'Значення'}));await userEvent.click(await screen.findByRole('option',{name:'Товар · SKU [9007199254740993]'}))
 expect(JSON.parse(screen.getByTestId('values').textContent!)).toEqual([
  {Data:{kind:'productGroup',id},Name:'Збережена група',Value:0},
  {Data:{kind:'product',id},Name:'Товар · SKU',Value:0},
 ])
 const signal=api.mock.calls[0][1]?.signal
 await userEvent.click(screen.getByRole('radio',{name:'Групи'}));await waitFor(()=>expect(groups).toHaveBeenCalledTimes(2))
 expect(api).toHaveBeenCalledOnce();expect(signal?.aborted).toBe(true)
})
it.each([6,7])('never mounts a report-product transport for group-only condition%i',async condition=>{
 render(<Form source={3} condition={condition}/>);await waitFor(()=>expect(groups).toHaveBeenCalledOnce())
 expect(api).not.toHaveBeenCalled();expect(screen.queryByRole('radio',{name:'Товари'})).toBeNull()
 expect(JSON.parse(screen.getByTestId('values').textContent!)[0].Data).toEqual({kind:'productGroup',id})
})
