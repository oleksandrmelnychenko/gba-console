import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { ReportSelection } from '../types'
import { chosenGoodsSuppliers, NO_GOODS_SUPPLIERS, SelectionValuePicker } from './ReportsStocksPage'

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
    query: { dataSource: 2, field: 75, value: '', offset: 0, limit: 50 }, signal: expect.any(AbortSignal),
  })))
  fireEvent.change(input, { target: { value: 'MARS' } })
  await waitFor(() => expect(api).toHaveBeenLastCalledWith('/report/datasets/lookup', expect.objectContaining({
    query: { dataSource: 2, field: 75, value: 'MARS', offset: 0, limit: 50 } })))
  fireEvent.click(await screen.findByRole('option', { name: 'MARSTECH' }))
  await waitFor(() => expect(selected().map((value: { Data: { Id: number } }) => value.Data.Id)).toEqual([4383]))
})

it('narrows the manufacturers to the chosen goods suppliers', async () => {
  render(<Picker dataSource={3} others={[supplier]} />)
  fireEvent.click(screen.getByRole('combobox', { name: 'Виробник' }))
  await waitFor(() => expect(api).toHaveBeenCalledWith('/report/datasets/lookup', expect.objectContaining({
    query: { dataSource: 3, field: 75, value: '', offset: 0, limit: 50, supplierIds: '631635,635333' } })))
  expect(await screen.findByRole('option', { name: 'AYFAR' })).toBeTruthy()
})

it('loads every brand page instead of stopping at the first one', async () => {
  const page = (from: number, count: number) => Array.from({ length: count }, (_, index) => ({ Id: from + index, Name: `Бренд ${from + index}` }))
  api.mockReset()
  api.mockResolvedValueOnce(page(1, 50)).mockResolvedValueOnce(page(51, 23))
  render(<Picker />)
  fireEvent.click(screen.getByRole('combobox', { name: 'Виробник' }))
  expect(await screen.findByRole('option', { name: 'Бренд 73' })).toBeTruthy()
  expect(api).toHaveBeenNthCalledWith(2, '/report/datasets/lookup', expect.objectContaining({
    query: { dataSource: 2, field: 75, value: '', offset: 50, limit: 50 } }))
})

it('narrows by every active supplier condition together', () => {
  const rows = (type: number, ...ids: number[]): ReportSelection => ({ IsChecked: true, SelectedField: { Type: 17, Name: 'Постачальник' },
    FilterCondition: { Type: type, Name: '' }, Values: ids.map(Id => ({ Data: { Id }, Name: String(Id), Value: 0 })) })
  expect(chosenGoodsSuppliers([rows(2, 1, 2, 3), rows(2, 2, 3, 4), rows(4, 3)])).toEqual([2])
  expect(chosenGoodsSuppliers([rows(2, 1), rows(2, 2)])).toBe(NO_GOODS_SUPPLIERS)
  expect(chosenGoodsSuppliers([rows(4, 1)])).toEqual([])
})
