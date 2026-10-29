import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { ReportSelectedValue } from '../types'
import { SelectionValuePicker } from './ReportsStocksPage'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
const rawSaved: ReportSelectedValue[] = JSON.parse(String.raw`[{"Data":"{\"Id\":10}","Name":"Стара назва","Value":10},{"Data":{"Id":30},"Name":"Архівна організація","Value":30}]`)
function Form({ values = rawSaved, from = '2026-10-01', disabled = false }: { values?: ReportSelectedValue[]; from?: string; disabled?: boolean }) {
  const [selected, setSelected] = useState(values)
  return <MantineProvider env="test"><I18nProvider><SelectionValuePicker dataSource={44} lookupProfitUnavailable={disabled} from={from} to="2026-10-27" label="Організація"
    selection={{ IsChecked: true, SelectedField: { Type: 0, Name: 'Organization' }, FilterCondition: { Type: 2, Name: 'У списку' }, Values: selected }}
    selections={[]} onChange={setSelected} /><output data-testid="selected">{JSON.stringify(selected)}</output></I18nProvider></MantineProvider>
}
beforeEach(() => { api.mockReset(); api.mockResolvedValue([{ Id: 10, NetUid: 'old-id', Name: 'Нова назва', Currency: { Id: 1 } }, { Id: 20, NetUid: 'other-id', Name: 'Нова назва' }]); Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() }) })
afterEach(cleanup)
it('uses real organization DTO adapter, stable ID choices and preserves absent/JSON-string saved values across dates', async () => {
  const view = render(<Form />)
  await waitFor(() => expect(api).toHaveBeenCalledWith('/organizations/all', { signal: expect.any(AbortSignal) }))
  fireEvent.click(screen.getByRole('combobox', { name: 'Організація' }))
  const other = await screen.findByRole('option', { name: 'Нова назва' })
  expect(screen.getAllByRole('option')).toHaveLength(3)
  expect(screen.getByRole('option', { name: 'Стара назва' })).toBeTruthy()
  expect(screen.getByRole('option', { name: 'Архівна організація' })).toBeTruthy()
  fireEvent.click(other)
  const selected = JSON.parse(screen.getByTestId('selected').textContent!)
  expect(selected).toEqual([...rawSaved, { Data: { Id: 20 }, Name: 'Нова назва', Value: 0 }])
  view.rerender(<Form from="2026-09-01" />)
  expect(JSON.parse(screen.getByTestId('selected').textContent!)).toEqual(selected)
})
it.each([{ Id: 9007199254740992, Name: 'Небезпечний ID' }, { Id: '10', Name: 'Некоректний DTO' }, { Name: 'Без ID' }])('rejects malformed numeric DTO without discarding saved selection %j', async value => {
  api.mockResolvedValue([value]); render(<Form />)
  expect(await screen.findByText('Не вдалося завантажити організації. Збережений відбір залишено без змін.')).toBeTruthy()
  expect(JSON.parse(screen.getByTestId('selected').textContent!)).toEqual(rawSaved)
})
it('keeps two different exact IDs selectable despite equal captions', async () => {
  api.mockResolvedValue([{ Id: 10, Name: 'Одна назва' }, { Id: 20, Name: 'Одна назва' }]); render(<Form values={[]} />)
  fireEvent.click(screen.getByRole('combobox', { name: 'Організація' }))
  const options = await screen.findAllByRole('option', { name: 'Одна назва' }); fireEvent.click(options[0]); fireEvent.click(options[1])
  expect(JSON.parse(screen.getByTestId('selected').textContent!).map((value: ReportSelectedValue) => value.Data.Id)).toEqual([10, 20])
})

it('keeps safe IDs above Int32 exact in Data and uses only an enum-safe descriptive Value', async () => {
  api.mockResolvedValue([{ Id: 1099511627776, Name: 'Великий ID' }]); render(<Form values={[]} />)
  fireEvent.click(screen.getByRole('combobox', { name: 'Організація' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Великий ID' }))
  expect(JSON.parse(screen.getByTestId('selected').textContent!)).toEqual([{ Data: { Id: 1099511627776 }, Name: 'Великий ID', Value: 0 }])
})

it('ignores an aborted old catalogue response after the picker is disabled and re-enabled', async () => {
  let resolveOld!: (value: unknown) => void
  api.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
    .mockResolvedValueOnce([{ Id: 20, Name: 'Актуальна організація' }])
  const view = render(<Form values={[]} />)
  await waitFor(() => expect(api).toHaveBeenCalledOnce())
  const signal = api.mock.calls[0][1]?.signal
  view.rerender(<Form values={[]} disabled />)
  expect(signal?.aborted).toBe(true)
  view.rerender(<Form values={[]} />)
  fireEvent.click(screen.getByRole('combobox', { name: 'Організація' }))
  expect(await screen.findByRole('option', { name: 'Актуальна організація' })).toBeTruthy()
  resolveOld([{ Id: 10, Name: 'Стара відповідь' }])
  await waitFor(() => expect(screen.queryByRole('option', { name: 'Стара відповідь' })).toBeNull())
  expect(screen.getByRole('option', { name: 'Актуальна організація' })).toBeTruthy()
  expect(JSON.parse(screen.getByTestId('selected').textContent!)).toEqual([])
})
