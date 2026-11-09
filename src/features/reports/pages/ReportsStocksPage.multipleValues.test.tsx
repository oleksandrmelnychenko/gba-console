import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { apiRequest } from '../../../shared/api/apiClient'
import type { ReportDataset, ReportSelection } from '../types'
import { InlineReportSelection, ReportSelectionsCard } from './ReportsStocksPage'
import { priceDatasetFixture } from '../data/nativePriceFilterLookup.test-fixtures'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const organizations = [
  { Id: 10565, NetUid: 'adaef157-991d-418a-a205-786d2358c830', Name: 'ТОВ «АМГ «КОНКОРД»' },
  { Id: 10566, NetUid: '0a5b4380-ca16-49a1-96d8-7de238c8ef5f', Name: 'Фенікс' },
]
type Mode = 'row' | 'card' | 'modal'
function Form({ mode = 'row', source = 2, condition = 0, field = 0, dataset: supplied }: {
  mode?: Mode; source?: number; condition?: number; field?: number; dataset?: ReportDataset
}) {
  const [selection, setSelection] = useState<ReportSelection>({ IsChecked: true,
    SelectedField: { Type: field, Name: field === 0 ? 'Організація' : 'Група товару' },
    FilterCondition: { Type: condition, Name: condition === 0 ? 'Дорівнює' : 'Не дорівнює' }, Values: [] })
  const dataset: ReportDataset = supplied ?? { DataSource: source, Name: 'Звіт', Description: '', PeriodRequired: true,
    PeriodSupported: true, Groupings: [], Measurements: [], Filters: [selection.SelectedField], Limitations: [] }
  const request = { dataSource: source, from: '2026-10-01', to: '2026-10-31', selections: [selection], sorted: { Row: [], Col: [], Measurements: [] } }
  const props = { dataset, request, dataSource: source, from: request.from, to: request.to, selections: [selection],
    filterFieldOptions: [{ value: String(field), label: selection.SelectedField.Name, field: selection.SelectedField }],
    onChange: (action: { kind: string; selection?: ReportSelection }) => { if (action.selection) setSelection(action.selection) } }
  return <MantineProvider env="test"><I18nProvider>{mode === 'modal'
    ? <ReportSelectionsCard {...props} selectionKeys={['organization']} />
    : <InlineReportSelection {...props} selection={selection} index={0} variant={mode} />}
    <output data-testid="selection">{JSON.stringify(selection)}</output>
  </I18nProvider></MantineProvider>
}
const selected = () => JSON.parse(screen.getByTestId('selection').textContent!) as ReportSelection
beforeEach(() => {
  vi.mocked(apiRequest).mockReset().mockResolvedValue(organizations)
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
})
afterEach(cleanup)

it.each(([0, 1] as const).flatMap(condition => (['row', 'card', 'modal'] as const).map(mode => ({ condition, mode }))))(
  'retains both DEV organizations and promotes condition $condition in $mode', async ({ condition, mode }) => {
    render(<Form mode={mode} condition={condition} />)
    if (mode === 'modal') fireEvent.click(screen.getByRole('button', { name: 'Редагувати' }))
    const input = screen.getByRole('combobox', { name: 'Значення' })
    fireEvent.click(input)
    fireEvent.click(await screen.findByRole('option', { name: organizations[0].Name }))
    if (mode !== 'modal') expect(selected().FilterCondition.Type).toBe(condition)
    fireEvent.click(input)
    fireEvent.click(await screen.findByRole('option', { name: organizations[1].Name }))
    if (mode === 'modal') fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
    expect(selected().Values.map(value => value.Data.Id)).toEqual([10565, 10566])
    expect(selected().FilterCondition.Type).toBe(condition === 0 ? 2 : 4)
    expect(selected().Values.map(value => value.Data.NetUid)).toEqual(organizations.map(item => item.NetUid))
    if (mode !== 'modal') {
      fireEvent.change(input, { target: { value: 'Фенікс' } })
      fireEvent.click(await screen.findByRole('option', { name: organizations[1].Name }))
      expect(selected().Values.map(value => value.Data.Id)).toEqual([10565])
      expect(selected().FilterCondition.Type).toBe(condition === 0 ? 2 : 4)
    }
  },
)

it('uses the native price picker with exact Int64 IDs and promotes its negative condition', async () => {
  const rows = [{ Id: '9007199254740993', Name: 'Група A' }, { Id: '9007199254740994', Name: 'Група B' }]
  vi.mocked(apiRequest).mockResolvedValue(rows)
  render(<Form source={46} field={4} condition={1} dataset={priceDatasetFixture()} />)
  fireEvent.click(screen.getByRole('combobox', { name: 'Значення' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Група A' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Група B' }))
  expect(selected()).toMatchObject({ FilterCondition: { Type: 4 }, Values: rows.map(row => ({ Data: { Id: row.Id }, Name: row.Name })) })
  expect(vi.mocked(apiRequest).mock.calls.every(call => call[0] === '/report/datasets/price-comparison/filters/lookup')).toBe(true)
})

it.each([0, 3, 35, 38, 41, 43, 44, 45, 46])('retains multiple organization IDs through source %i picker', async source => {
  if ([35, 38, 41, 43].includes(source)) vi.mocked(apiRequest).mockResolvedValue(organizations.map(item => ({ ...item, Id: String(item.Id) })))
  render(<Form source={source} />)
  const input = screen.getByRole('combobox', { name: 'Значення' })
  fireEvent.click(input)
  fireEvent.click(await screen.findByRole('option', { name: organizations[0].Name }))
  fireEvent.click(await screen.findByRole('option', { name: organizations[1].Name }))
  expect(selected().Values.map(value => String(value.Data.Id))).toEqual(['10565', '10566'])
  expect(selected().FilterCondition.Type).toBe(2)
})

it('does not promote an unavailable negative financial condition', async () => {
  vi.mocked(apiRequest).mockResolvedValue(organizations.map(item => ({ ...item, Id: String(item.Id) })))
  render(<Form source={35} condition={1} />)
  const input = screen.getByRole('combobox', { name: 'Значення' })
  for (const organization of organizations) {
    fireEvent.click(input)
    fireEvent.click(await screen.findByRole('option', { name: organization.Name }))
  }
  expect(selected().FilterCondition.Type).toBe(1)
  expect(selected().Values).toHaveLength(1)
  expect(screen.getByRole('alert').textContent).toContain('недоступна')
})

it('appends manual values, ignores duplicates and removes one without losing the other', () => {
  render(<Form source={0} field={99} />)
  for (const value of ['A', 'B', 'A']) {
    fireEvent.change(screen.getByRole('textbox', { name: 'Значення' }), { target: { value } })
    fireEvent.click(screen.getByRole('button', { name: 'Додати' }))
  }
  expect(selected().Values.map(value => value.Name)).toEqual(['A', 'B'])
  expect(selected().FilterCondition.Type).toBe(2)
  fireEvent.click(screen.getAllByRole('button', { name: /^Видалити$/ })[0])
  expect(selected().Values.map(value => value.Name)).toEqual(['B'])
})

it('retains native product IDs across successive remote searches', async () => {
  const rows = [{ Id: '9007199254740993', Name: 'Товар A', VendorCode: 'ART-A' }, { Id: '9007199254740994', Name: 'Товар B', VendorCode: 'ART-B' }]
  vi.mocked(apiRequest).mockImplementation(async (_path, options) => options?.query?.value === 'ART-B' ? [rows[1]] : [rows[0]])
  const dataset = { ...priceDatasetFixture(), DataSource: 2, Filters: [{ Type: 1, Name: 'Товар' }],
    salesProductLookup: { version: 1, fieldTypes: [1], identityKind: 'positiveInt64String', periodRequired: false,
      supportsNameAndArticleSearch: true, exactIdParameter: 'exactId', paging: 'offset', maximumPageSize: 50 } }
  render(<Form source={2} field={1} dataset={dataset} />)
  const input = screen.getByRole('combobox', { name: 'Значення' })
  fireEvent.click(input)
  fireEvent.click(await screen.findByRole('option', { name: /Товар A/ }))
  fireEvent.change(input, { target: { value: 'ART-B' } })
  fireEvent.click(await screen.findByRole('option', { name: /Товар B/ }))
  expect(selected().Values.map(value => value.Data.Id)).toEqual(rows.map(row => row.Id))
  expect(selected().FilterCondition.Type).toBe(2)
})
