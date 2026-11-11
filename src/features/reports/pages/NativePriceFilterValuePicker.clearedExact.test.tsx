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
const input=()=>screen.getByRole('combobox',{name:'Значення'})as HTMLInputElement
const values=()=>JSON.parse(screen.getByTestId('values').textContent!)
it('selects a valid exact document by id: token, then clears only the search without a red error or extra GET',async()=>{
 api.mockImplementation(async(_path,options)=>options?.query?.exactId===row.Id?[row]:[]);render(<Form/>);await waitFor(()=>expect(api).toHaveBeenCalledOnce());expect(screen.queryByRole('radio')).toBeNull();await userEvent.type(input(),'id:'+row.Id);await screen.findByRole('option',{name:row.Name});const count=api.mock.calls.length;await userEvent.click(screen.getByRole('option',{name:row.Name}));await waitFor(()=>expect(input().value).toBe(''))
 expect(screen.queryByText(/Вкажіть точний позитивний ID/)).toBeNull();expect(input().getAttribute('aria-invalid')).not.toBe('true');expect(values()).toEqual(selected);expect(api.mock.calls.filter(call=>call[1]?.query?.exactId)).toHaveLength(count-1)
})
it('an empty input is never an exact-ID error, with or without a stored document',async()=>{
 api.mockResolvedValue([]);render(<Form initial={selected}/>);await waitFor(()=>expect(api).toHaveBeenCalledOnce());expect(screen.queryByText(/Вкажіть точний позитивний ID/)).toBeNull();await userEvent.click(screen.getByRole('button',{name:'Видалити '+row.Name}));expect(values()).toEqual([]);expect(screen.queryByText(/Вкажіть точний позитивний ID/)).toBeNull();expect(api.mock.calls.every(call=>call[1]?.query?.exactId===undefined)).toBe(true)
})
it('retains bad nonempty typed-query validation even with a valid selected chip',async()=>{
 api.mockResolvedValue([]);render(<Form initial={selected}/>);await waitFor(()=>expect(api).toHaveBeenCalledOnce());await userEvent.type(input(),'id:0001');expect(await screen.findByText(/Вкажіть точний позитивний ID/)).toBeTruthy();expect(values()).toEqual(selected);expect(api.mock.calls.every(call=>call[1]?.query?.exactId===undefined)).toBe(true)
})
it('never hides an external active-selection validation error',async()=>{
 api.mockResolvedValue([]);render(<Form initial={selected} error="Вибраний документ не підтверджено."/>);await waitFor(()=>expect(api).toHaveBeenCalledOnce());expect(screen.getByText('Вибраний документ не підтверджено.')).toBeTruthy()
})
it('does not rewrite malformed archived raw keys or trigger an exact lookup for them',async()=>{
 const raw='{ "Id":"0001", "Archived":true }',bad=[{Data:raw,Name:'Архів без підтвердження',Value:0}]as unknown as ReportSelectedValue[];api.mockResolvedValue([]);render(<Form initial={bad}/>);await waitFor(()=>expect(api).toHaveBeenCalledOnce());expect(values()).toEqual(bad);expect(api.mock.calls[0][1]?.query?.exactId).toBeUndefined()
})
it('does not suppress query errors when the same document period is invalid',async()=>{
 api.mockResolvedValue([]);render(<Form initial={selected} from="2026-02-30"/>);expect(await screen.findByText(/Оберіть коректний період/)).toBeTruthy();expect(api).not.toHaveBeenCalled()
})
it('keeps native lookup403 failure and selected raw identity visible for nonempty exact lookup',async()=>{
 api.mockImplementation(async(_path,options)=>{if(options?.query?.exactId)throw new Error('403');return[]});render(<Form initial={selected}/>);await waitFor(()=>expect(api).toHaveBeenCalledOnce());await userEvent.type(input(),'id:999');expect(await screen.findByRole('option',{name:'Спробувати ще раз'})).toBeTruthy();expect(screen.getByRole('alert').textContent).toBe('Не вдалося завантажити довідник. Повторіть спробу.');expect(values()).toEqual(selected)
})
it('says what to type after a bare id: token instead of raising an error',async()=>{
 api.mockResolvedValue([]);render(<Form/>);await waitFor(()=>expect(api).toHaveBeenCalledOnce());await userEvent.type(input(),'id:');expect(await screen.findByText('Введіть ID після id:')).toBeTruthy();expect(screen.queryByText(/Вкажіть точний позитивний ID/)).toBeNull();expect(api).toHaveBeenCalledOnce()
})
