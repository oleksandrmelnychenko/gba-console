import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getReportProductTop, searchDatasetReportValues } from '../api/reportsApi'
import type { ReportSelection } from '../types'
import { SelectionValuePicker } from './ReportsStocksPage'

vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(),
  getReportProductTop: vi.fn(), searchDatasetReportValues: vi.fn() }))

function Picker({ source, condition = 0, field = 3 }: { source: number; condition?: number; field?: number }) {
  const [selection, setSelection] = useState<ReportSelection>({ IsChecked: true,
    SelectedField: { Type: field, Name: field === 3 ? 'TOP' : 'Товар' },
    FilterCondition: { Type: condition, Name: condition === 2 ? 'У списку' : 'Дорівнює' }, Values: [] })
  return <MantineProvider env="test"><I18nProvider>
    <SelectionValuePicker dataSource={source} selection={selection} selections={[selection]}
      from="2026-10-01" to="2026-10-27" label="Значення"
      onChange={Values => setSelection(previous => ({ ...previous, Values }))} />
    <output data-testid="selection">{JSON.stringify(selection)}</output>
  </I18nProvider></MantineProvider>
}

function selectedValues() {
  return (JSON.parse(screen.getByTestId('selection').textContent!) as ReportSelection).Values
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportProductTop).mockResolvedValue([{ Name: 'A' }, { Name: 'X9' }])
  vi.mocked(searchDatasetReportValues).mockResolvedValue([{ Id: 123, Name: 'Товар 123' }])
})

it.each([3, 45])('selects a named TOP code from the shared catalogue for native source %i', async source => {
  render(<Picker source={source} />)
  const input = screen.getByRole('combobox', { name: 'Значення' })
  fireEvent.click(input)
  await screen.findByRole('option', { name: 'X9' })
  fireEvent.change(input, { target: { value: 'X9' } })
  fireEvent.click(await screen.findByRole('option', { name: 'X9' }))
  expect(selectedValues()).toEqual([{ Data: { Name: 'X9' }, Name: 'X9', Value: 0 }])
  expect(getReportProductTop).toHaveBeenCalledOnce()
  expect(searchDatasetReportValues).not.toHaveBeenCalled()
})

it.each([3, 45])('retains named TOP selections when filtering and reopening the list for source %i', async source => {
  render(<Picker source={source} condition={2} />)
  const input = screen.getByRole('combobox', { name: 'Значення' })
  fireEvent.click(input)
  fireEvent.click(await screen.findByRole('option', { name: 'A' }))
  await waitFor(() => expect(selectedValues()).toHaveLength(1))
  fireEvent.click(input)
  fireEvent.change(input, { target: { value: 'X9' } })
  fireEvent.click(await screen.findByRole('option', { name: 'X9' }))
  expect(selectedValues()).toEqual([
    { Data: { Name: 'A' }, Name: 'A', Value: 0 },
    { Data: { Name: 'X9' }, Name: 'X9', Value: 0 },
  ])
  expect(getReportProductTop).toHaveBeenCalledOnce()
  expect(searchDatasetReportValues).not.toHaveBeenCalled()
})

it('keeps native product lookups on their numeric endpoint', async () => {
  render(<Picker source={45} field={1} />)
  fireEvent.click(screen.getByRole('combobox', { name: 'Значення' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Товар 123' }))
  expect(selectedValues()).toEqual([{ Data: { Id: 123, Name: 'Товар 123' }, Name: 'Товар 123', Value: 123 }])
  expect(searchDatasetReportValues).toHaveBeenCalledWith(45, 1, { limit: 30, offset: 0, value: '' }, expect.any(AbortSignal))
  expect(getReportProductTop).not.toHaveBeenCalled()
})
