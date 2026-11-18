import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { ReportSelection } from '../types'
import { SelectionValuePicker } from './ReportsStocksPage'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
const manufacturers = [{ Id: 4383, Name: 'MARSTECH' }, { Id: 4384, Name: 'AYFAR' }]
const supplier: ReportSelection = { IsChecked: true, SelectedField: { Type: 17, Name: 'Постачальник' },
  FilterCondition: { Type: 2, Name: 'У списку' }, Values: [{ Data: { Id: 635333 }, Name: 'ПЛА-ТАН', Value: 0 }, { Data: { Id: 631635 }, Name: 'ПЛА-ТАН', Value: 0 }] }
function Picker({ dataSource = 2, others = [] }: { dataSource?: number; others?: ReportSelection[] }) {
  const [selection, setSelection] = useState<ReportSelection>({ IsChecked: true,
    SelectedField: { Type: 75, Name: 'Виробник' }, FilterCondition: { Type: 2, Name: 'У списку' }, Values: [] })
  return <MantineProvider env="test"><I18nProvider>
    <SelectionValuePicker dataSource={dataSource} selection={selection} selections={[...others, selection]} from="2025-10-01" to="2025-10-31"
      label="Виробник" onChange={Values => setSelection(previous => ({ ...previous, Values }))} />
    <output data-testid="selected">{JSON.stringify(selection.Values)}</output>
  </I18nProvider></MantineProvider>
}
const selected = () => JSON.parse(screen.getByTestId('selected').textContent!)
beforeEach(() => {
  api.mockReset(); api.mockResolvedValue(manufacturers)
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
})
afterEach(cleanup)

it('searches the brand folders on the server and keeps exact identities', async () => {
  render(<Picker />)
  const input = screen.getByRole('combobox', { name: 'Виробник' })
  fireEvent.click(input)
  await waitFor(() => expect(api).toHaveBeenCalledWith('/report/datasets/lookup', expect.objectContaining({
    query: { dataSource: 2, field: 75, value: '', offset: 0, limit: 30 }, signal: expect.any(AbortSignal),
  })))
  fireEvent.change(input, { target: { value: 'MARS' } })
  await waitFor(() => expect(api).toHaveBeenLastCalledWith('/report/datasets/lookup', expect.objectContaining({
    query: { dataSource: 2, field: 75, value: 'MARS', offset: 0, limit: 30 } })))
  fireEvent.click(await screen.findByRole('option', { name: 'MARSTECH' }))
  await waitFor(() => expect(selected().map((value: { Data: { Id: number } }) => value.Data.Id)).toEqual([4383]))
})

it('narrows the manufacturers to the chosen goods suppliers', async () => {
  render(<Picker dataSource={3} others={[supplier]} />)
  fireEvent.click(screen.getByRole('combobox', { name: 'Виробник' }))
  await waitFor(() => expect(api).toHaveBeenCalledWith('/report/datasets/lookup', expect.objectContaining({
    query: { dataSource: 3, field: 75, value: '', offset: 0, limit: 30, supplierIds: '631635,635333' } })))
  expect(await screen.findByRole('option', { name: 'AYFAR' })).toBeTruthy()
})
