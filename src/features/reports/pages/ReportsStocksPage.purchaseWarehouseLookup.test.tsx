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
const warehouses = [{ Id: 2963, Name: 'Склад' }, { Id: 2968, Name: 'Склад' }]
function Picker({ from = '2026-10-18', to = '2026-10-27' }: { from?: string; to?: string }) {
  const [selection, setSelection] = useState<ReportSelection>({ IsChecked: true,
    SelectedField: { Type: 21, Name: 'Warehouse' }, FilterCondition: { Type: 2, Name: 'У списку' }, Values: [] })
  return <MantineProvider env="test"><I18nProvider>
    <SelectionValuePicker dataSource={3} selection={selection} selections={[selection]} from={from} to={to}
      label="Склад надходження" onChange={Values => setSelection(previous => ({ ...previous, Values }))} />
    <output data-testid="selected">{JSON.stringify(selection.Values)}</output>
  </I18nProvider></MantineProvider>
}
const selected = () => JSON.parse(screen.getByTestId('selected').textContent!)
beforeEach(() => {
  api.mockReset(); api.mockResolvedValue(warehouses)
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
})
afterEach(cleanup)

it('uses the receipt dataset lookup and retains distinct same-name warehouse IDs across period changes', async () => {
  const view = render(<Picker />)
  const input = screen.getByRole('combobox', { name: 'Склад надходження' })
  fireEvent.click(input)
  await waitFor(() => expect(api).toHaveBeenCalledWith('/report/datasets/lookup', expect.objectContaining({
    query: { dataSource: 3, field: 21, value: '', offset: 0, limit: 30 }, signal: expect.any(AbortSignal),
  })))
  fireEvent.click((await screen.findAllByRole('option', { name: 'Склад' }))[0])
  fireEvent.click(input)
  const second = await screen.findAllByRole('option', { name: 'Склад' })
  expect(second).toHaveLength(2)
  fireEvent.click(second[1])
  await waitFor(() => expect(selected().map((value: { Data: { Id: number } }) => value.Data.Id)).toEqual([2963, 2968]))
  view.rerender(<Picker from="2026-09-01" to="2026-09-30" />)
  expect(selected().map((value: { Data: { Id: number }; Name: string }) => [value.Data.Id, value.Name])).toEqual([[2963, 'Склад'], [2968, 'Склад']])
  expect(api.mock.calls.every(([url]) => url === '/report/datasets/lookup')).toBe(true)
})

it('shows a failed lookup without presenting invalid numeric identities as selectable warehouses', async () => {
  api.mockResolvedValue([{ Id: 9007199254740992, Name: 'Склад' }])
  render(<Picker />)
  fireEvent.click(screen.getByRole('combobox', { name: 'Склад надходження' }))
  expect(await screen.findByText('Не вдалося завантажити значення. Змініть пошук, щоб спробувати ще раз.')).toBeTruthy()
  expect(screen.queryByRole('option', { name: 'Склад' })).toBeNull()
  expect(selected()).toEqual([])
})
