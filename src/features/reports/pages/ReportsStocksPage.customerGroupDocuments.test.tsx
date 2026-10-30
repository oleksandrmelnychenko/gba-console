import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { apiRequest } from '../../../shared/api/apiClient'
import type { ReportDataset, ReportSelectedValue, ReportSelection } from '../types'
import { customerCommonFieldsDataset } from '../data/customerGroupCommonFields.test-fixtures'
import { SelectionValuePicker } from './ReportsStocksPage'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest), changed = vi.fn()
const rawSaved: ReportSelectedValue = { Data: '{"Id":"9223372036854775807"}' as never, Name: 'Збережена назва документа', Value: 0 }
function Picker({ field, dataset = customerCommonFieldsDataset }: { field: number; dataset?: ReportDataset }) {
  const [values, setValues] = useState<ReportSelectedValue[]>([rawSaved]), [from, setFrom] = useState('2026-10-18')
  const selection: ReportSelection = { IsChecked: true, SelectedField: { Type: field, Name: field === 14 ? 'Повернення від клієнта' : 'Документ продажу' },
    FilterCondition: { Type: 2, Name: 'У списку' }, Values: values }
  return <MantineProvider env="test"><I18nProvider><button onClick={() => setFrom('2026-10-19')}>Змінити дату</button>
    <SelectionValuePicker dataSource={44} dataset={dataset} selection={selection} selections={[selection]} from={from} to="2026-10-27" label="Значення"
      onChange={next => { setValues(next); changed(next) }} /><output data-testid="raw-selected">{JSON.stringify(values)}</output></I18nProvider></MantineProvider>
}
beforeEach(() => { vi.clearAllMocks(); Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() }) })
afterEach(cleanup)
it.each([[12, 'sale'], [14, 'return']] as const)('uses source44 field%d document capability and keeps saved ID/date on failed lookup', async (field, Kind) => {
  const Name = 'Документ №17 · 19.10.2026 13:14:53'
  api.mockResolvedValue([{ Id: '9007199254740993', Kind, Name }]); render(<Picker field={field} />)
  fireEvent.click(screen.getByRole('combobox', { name: 'Значення' })); fireEvent.click(await screen.findByRole('option', { name: Name }))
  const expected = [rawSaved, { Data: { Id: '9007199254740993' }, Name, Value: 0 }]
  expect(changed.mock.calls.at(-1)?.[0]).toEqual(expected)
  api.mockRejectedValue(new Error('offline')); fireEvent.click(screen.getByRole('button', { name: 'Змінити дату' }))
  await waitFor(() => expect(api).toHaveBeenLastCalledWith('/report/datasets/sales/documents/lookup', expect.objectContaining({ query: expect.objectContaining({ field, from: '2026-10-19', to: '2026-10-27' }) })))
  expect(JSON.parse(screen.getByTestId('raw-selected').textContent!)).toEqual(expected)
  expect(changed).toHaveBeenCalledOnce(); expect(api.mock.calls.every(([path]) => path === '/report/datasets/sales/documents/lookup')).toBe(true)
})
it.each([12, 14])('never falls back to a legacy bulk catalogue when source44 field%d capability is absent', field => {
  render(<Picker field={field} dataset={{ ...customerCommonFieldsDataset, salesDocumentLookup: undefined }} />)
  expect(screen.getByRole('combobox', { name: 'Значення' })).toHaveProperty('disabled', true)
  expect(JSON.parse(screen.getByTestId('raw-selected').textContent!)).toEqual([rawSaved]); expect(api).not.toHaveBeenCalled(); expect(changed).not.toHaveBeenCalled()
})
