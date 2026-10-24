import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { searchDatasetReportValues } from '../api/reportsApi'
import type { ReportSelectedValue, ReportSelection } from '../types'
import { SelectionValuePicker } from './ReportsStocksPage'

vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), searchDatasetReportValues: vi.fn() }))
const initial: ReportSelectedValue[] = Array.from({ length: 38 }, (_, index) => ({
  Name: `Supplier ${index + 1}`, Value: 0, Data: { Id: String(627290 + index), Name: `Supplier ${index + 1}`, NetUid: `exact-supplier-${index}` },
}))
const changed = vi.fn()
function Picker({ from = '2026-09-01' }: { from?: string }) {
  const [values, setValues] = useState(initial)
  const selection: ReportSelection = { IsChecked: true, SelectedField: { Type: 17, Name: 'Постачальник' },
    FilterCondition: { Type: 2, Name: 'У списку' }, Values: values }
  return <MantineProvider env="test"><I18nProvider><SelectionValuePicker dataSource={38} lookupProfitReadMode={0}
    selection={selection} selections={[selection]} from={from} to="2026-10-24" label="Значення"
    onChange={next => { changed(next); setValues(next) }} /></I18nProvider></MantineProvider>
}
beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(searchDatasetReportValues).mockResolvedValue([])
})

it('keeps 38 selected suppliers compact, searches remotely and adds via keyboard without replacing saved identities', async () => {
  const next = { Id: '9007199254740993', Name: 'BENEFIT OTOMOTIV', NetUid: 'new-exact-supplier' }
  vi.mocked(searchDatasetReportValues).mockImplementation(async (_source, _field, query) => query.value === 'BEN' ? [next] : [])
  const view = render(<Picker />)
  expect(screen.getByRole('button', { name: 'Вибрано: 38' })).toBeTruthy()
  expect(screen.queryByRole('option', { name: 'Supplier 1' })).toBeNull()
  const input = screen.getByRole('combobox', { name: 'Значення' })
  const user = userEvent.setup()
  await user.type(input, 'BEN')
  await screen.findByRole('option', { name: 'BENEFIT OTOMOTIV' })
  expect(screen.queryByRole('option', { name: 'Supplier 1' })).toBeNull()
  await user.keyboard('{ArrowDown}{Enter}')
  await screen.findByRole('button', { name: 'Вибрано: 39' })
  const selected = changed.mock.calls.at(-1)![0]
  expect(selected.slice(0, 38)).toEqual(initial)
  expect(selected[38].Data).toEqual(next)
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('option')).toBeNull()
  view.rerender(<Picker from="2026-10-01" />)
  expect(screen.getByRole('button', { name: 'Вибрано: 39' })).toBeTruthy()
  expect(changed).toHaveBeenCalledOnce()
})

it('lets users search and remove saved selections even when the remote directory fails', async () => {
  vi.mocked(searchDatasetReportValues).mockRejectedValue(new Error('offline'))
  render(<Picker />)
  fireEvent.click(screen.getByRole('button', { name: 'Вибрано: 38' }))
  const input = screen.getByRole('combobox', { name: 'Значення' })
  fireEvent.change(input, { target: { value: 'Supplier 38' } })
  const option = await screen.findByRole('option', { name: 'Supplier 38' })
  fireEvent.click(option)
  await waitFor(() => expect(changed).toHaveBeenCalledWith(initial.slice(0, 37)))
  expect(screen.getByRole('button', { name: 'Вибрано: 37' })).toBeTruthy()
})
