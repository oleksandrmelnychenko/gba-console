import { MantineProvider } from '@mantine/core'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { apiRequest } from '../../../shared/api/apiClient'
import type { ReportSelectedValue } from '../types'
import { priceDatasetFixture, priceSelectionFixture } from '../data/nativePriceFilterLookup.test-fixtures'
import { NativePriceFilterValuePicker } from './NativePriceFilterValuePicker'
vi.mock('../../../shared/api/apiClient',()=>({apiRequest:vi.fn()}))
const api=vi.mocked(apiRequest),row={Id:'2132454',Name:'Документ GBA [2132454]'},selected=[{Data:{Id:row.Id},Name:row.Name,Value:0}]
function Form({initial=[],error,from='2026-10-01'}:{initial?:ReportSelectedValue[];error?:string;from?:string}) {
 const [values,setValues]=useState(initial)
 return <MantineProvider env="test"><I18nProvider><NativePriceFilterValuePicker dataSource={46} dataset={priceDatasetFixture()} selection={{...priceSelectionFixture(12),Values:values}} from={from} to="2026-10-31" label="Значення" error={error} onChange={setValues}/><output data-testid="values">{JSON.stringify(values)}</output></I18nProvider></MantineProvider>
}
beforeEach(()=>{api.mockReset();Object.defineProperty(HTMLElement.prototype,'scrollIntoView',{configurable:true,value:vi.fn()})})
afterEach(()=>{cleanup();vi.restoreAllMocks()})
async function exact(){await userEvent.click(screen.getByRole('radio',{name:'Точний ID'}));return screen.getByRole('combobox',{name:'Точний ID значення'})as HTMLInputElement}
it('selects a valid exact document then clears only search without a red error or extra GET',async()=>{
 api.mockImplementation(async(_path,options)=>options?.query?.exactId===row.Id?[row]:[]);render(<Form/>);await waitFor(()=>expect(api).toHaveBeenCalledOnce());const input=await exact();await userEvent.type(input,row.Id);await screen.findByRole('option',{name:row.Name});const count=api.mock.calls.length;await userEvent.click(screen.getByRole('option',{name:row.Name}));await waitFor(()=>expect(input.value).toBe(''))
 expect(screen.queryByText(/Вкажіть точний позитивний ID/)).toBeNull();expect(input.getAttribute('aria-invalid')).not.toBe('true');expect(JSON.parse(screen.getByTestId('values').textContent!)).toEqual(selected);expect(api).toHaveBeenCalledTimes(count)
})
it('removing the last stored document restores blank exact-query error without hydration',async()=>{
 api.mockResolvedValue([]);render(<Form initial={selected}/>);await waitFor(()=>expect(api).toHaveBeenCalledOnce());await exact();expect(screen.queryByText(/Вкажіть точний позитивний ID/)).toBeNull();const count=api.mock.calls.length;await userEvent.click(screen.getByRole('button',{name:'Видалити '+row.Name}));expect(await screen.findByText(/Вкажіть точний позитивний ID/)).toBeTruthy();expect(api).toHaveBeenCalledTimes(count)
})
it('retains bad nonempty typed-query validation even with a valid selected chip',async()=>{
 api.mockResolvedValue([]);render(<Form initial={selected}/>);await waitFor(()=>expect(api).toHaveBeenCalledOnce());await userEvent.type(await exact(),'0001');expect(await screen.findByText(/Вкажіть точний позитивний ID/)).toBeTruthy();expect(JSON.parse(screen.getByTestId('values').textContent!)).toEqual(selected);expect(api).toHaveBeenCalledOnce()
})
it('never hides an external active-selection validation error',async()=>{
 api.mockResolvedValue([]);render(<Form initial={selected} error="Вибраний документ не підтверджено."/>);await waitFor(()=>expect(api).toHaveBeenCalledOnce());await exact();expect(screen.getByText('Вибраний документ не підтверджено.')).toBeTruthy()
})
it('does not make malformed archived raw keys look valid or trigger an exact lookup',async()=>{
 const raw='{ "Id":"0001", "Archived":true }',bad=[{Data:raw,Name:'Архів без підтвердження',Value:0}]as unknown as ReportSelectedValue[];api.mockResolvedValue([]);render(<Form initial={bad}/>);await waitFor(()=>expect(api).toHaveBeenCalledOnce());await exact();expect(await screen.findByText(/Вкажіть точний позитивний ID/)).toBeTruthy();expect(JSON.parse(screen.getByTestId('values').textContent!)).toEqual(bad);expect(api).toHaveBeenCalledOnce()
})
it('does not suppress query errors when the same document period is invalid',async()=>{
 api.mockResolvedValue([]);render(<Form initial={selected} from="2026-02-30"/>);await exact();expect(await screen.findByText(/Оберіть коректний період/)).toBeTruthy();expect(api).not.toHaveBeenCalled()
})
it('keeps native lookup403 failure and selected raw identity visible for nonempty exact lookup',async()=>{
 api.mockImplementation(async(_path,options)=>{if(options?.query?.exactId)throw new Error('403');return[]});render(<Form initial={selected}/>);await waitFor(()=>expect(api).toHaveBeenCalledOnce());await userEvent.type(await exact(),'999');expect(await screen.findByRole('button',{name:'Спробувати ще раз'})).toBeTruthy();expect(JSON.parse(screen.getByTestId('values').textContent!)).toEqual(selected)
})

it('retains blank exact-query validation for an invalid scalar selection cardinality',async()=>{
 api.mockResolvedValue([]);const invalid=[...selected,{Data:{Id:'2132458'},Name:'Інший документ',Value:0}];render(<Form initial={invalid}/>);await waitFor(()=>expect(api).toHaveBeenCalledOnce());await exact();expect(await screen.findByText(/Вкажіть точний позитивний ID/)).toBeTruthy();expect(JSON.parse(screen.getByTestId('values').textContent!)).toEqual(invalid);expect(api).toHaveBeenCalledOnce()
})
