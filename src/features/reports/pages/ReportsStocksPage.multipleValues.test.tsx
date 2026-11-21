import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { apiRequest } from '../../../shared/api/apiClient'
import type { ReportDataset, ReportSelection } from '../types'
import { InlineReportSelection, ReportSelectionsCard } from './ReportsStocksPage'
import { priceDatasetFixture } from '../data/nativePriceFilterLookup.test-fixtures'
import { analysisDataset } from '../data/currentVparivanieAnalysis.test-fixtures'

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
    filterFieldOptions: dataset.Filters.map(option => ({ value: String(option.Type), label: option.Name, field: option })),
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
    fireEvent.click(await screen.findByRole('option', { name: organizations[0].Name.replace(/ \[\d+\]$/,'') }))
    if (mode !== 'modal') expect(selected().FilterCondition.Type).toBe(condition)
    fireEvent.click(input)
    fireEvent.click(await screen.findByRole('option', { name: organizations[1].Name.replace(/ \[\d+\]$/,'') }))
    if (mode === 'modal') fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
    expect(selected().Values.map(value => value.Data.Id)).toEqual([10565, 10566])
    expect(selected().FilterCondition.Type).toBe(condition === 0 ? 2 : 4)
    expect(selected().Values.map(value => value.Data.NetUid)).toEqual(organizations.map(item => item.NetUid))
    if (mode !== 'modal') {
      fireEvent.change(input, { target: { value: 'Фенікс' } })
      fireEvent.click(await screen.findByRole('option', { name: organizations[1].Name.replace(/ \[\d+\]$/,'') }))
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

it('edits a settlement filter using the exact service-supplier ID and the directory caption', async () => {
  const serviceSupplier = { Id: '32750', Name: 'Fenix 5918 — % банку' }
  const fields = [{ Type: 0, Name: 'Організація' }, { Type: 17, Name: 'Постачальник послуг' }]
  const dataset: ReportDataset = { DataSource: 41, Name: 'Взаєморозрахунки всі', Description: '',
    PeriodRequired: true, PeriodSupported: true, Groupings: [], Measurements: [], Filters: fields, Limitations: [] }
  vi.mocked(apiRequest).mockImplementation(async (path, options) => {
    if (path === '/report/datasets/lookup' && options?.query?.field === 17 && options.query.value === '5918') {
      return [serviceSupplier]
    }
    return []
  })
  render(<Form mode="modal" source={41} dataset={dataset} />)
  fireEvent.click(screen.getByRole('button', { name: 'Редагувати' }))
  const field = screen.getByRole('combobox', { name: 'Поле' })
  fireEvent.click(field)
  expect(screen.getByRole('group', { name: 'Контрагент' })).toBeTruthy()
  fireEvent.click(screen.getByRole('option', { name: 'Постачальник товару (довідник)' }))
  const directory = await screen.findByRole('dialog', { name: 'Постачальник товару' })
  fireEvent.click(within(directory).getByRole('button', { name: 'Закрити' }))
  expect(field).toHaveProperty('value', 'Організація')
  fireEvent.click(field)
  fireEvent.click(screen.getByRole('option', { name: 'Постачальник послуг' }))
  const search = screen.getByRole('combobox', { name: 'Значення' })
  fireEvent.click(search)
  fireEvent.change(search, { target: { value: '5918' } })
  fireEvent.click(await screen.findByRole('option', { name: serviceSupplier.Name }))
  fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
  expect(selected()).toMatchObject({ SelectedField: fields[1],
    Values: [{ Data: { Id: serviceSupplier.Id }, Name: serviceSupplier.Name }] })
  expect(vi.mocked(apiRequest).mock.calls).toContainEqual([
    '/report/datasets/lookup', expect.objectContaining({ query: expect.objectContaining({ dataSource: 41, field: 17, value: '5918' }) }),
  ])
})

it('opens a supplier directory from the analysis field tree without replacing the buyer field', async () => {
  vi.mocked(apiRequest).mockResolvedValue([])
  render(<Form mode="modal" source={39} field={5} dataset={analysisDataset} />)
  fireEvent.click(screen.getByRole('button', { name: 'Редагувати' }))
  const editor = within(screen.getByRole('dialog', { name: 'Редагувати умову відбору' }))
  fireEvent.click(editor.getByRole('button', { name: 'Покупець' }))
  const fieldPicker = within(await screen.findByRole('dialog', { name: 'Поле відбору' }))
  fireEvent.click(fieldPicker.getByRole('button', { name: 'Постачальник послуг (довідник)' }))
  const directory = within(await screen.findByRole('dialog', { name: 'Постачальник послуг' }))
  fireEvent.click(directory.getByRole('button', { name: 'Закрити' }))
  expect(editor.getByRole('button', { name: 'Покупець' })).toBeTruthy()
  expect(selected().SelectedField.Type).toBe(5)
})

it('loads the buyer role in a legacy workbook and searches by the directory code', async () => {
  const fields = [{ Type: 0, Name: 'Організація' }, { Type: 6, Name: 'Клієнт' }]
  const dataset: ReportDataset = { DataSource: 0, Name: 'Залишки та продажі', Description: '',
    PeriodRequired: true, PeriodSupported: true, Groupings: [], Measurements: [], Filters: fields, Limitations: [] }
  const buyer = { Id: 632374, Name: 'ТК С.В.С.-2006 ТОВ', RegionCode: { Value: 'BKI64901' } }
  vi.mocked(apiRequest).mockImplementation(async (path, options) => {
    if (path !== '/clients/reports/stocks/search' || options?.query?.typeRoleFilter !== '1') return []
    return options.query.value === 'BKI64901' ? [buyer] : [{ Id: 633122, Name: 'ОК-АВТО ТОВ', RegionCode: { Value: 'BCK02805' } }]
  })
  render(<Form mode="card" source={0} dataset={dataset} />)
  fireEvent.click(screen.getByRole('combobox', { name: 'Поле' }))
  fireEvent.click(screen.getByRole('option', { name: 'Покупець' }))
  const search = screen.getByRole('combobox', { name: 'Значення' })
  fireEvent.click(search)
  expect(await screen.findByRole('option', { name: 'BCK02805 — ОК-АВТО ТОВ' })).toBeTruthy()
  fireEvent.change(search, { target: { value: 'BKI64901' } })
  const caption = 'BKI64901 — ТК С.В.С.-2006 ТОВ'
  fireEvent.click(await screen.findByRole('option', { name: caption }))
  expect(selected()).toMatchObject({ SelectedField: fields[1], Values: [{ Data: { Id: buyer.Id }, Name: caption }] })
  expect(vi.mocked(apiRequest).mock.calls).toContainEqual([
    '/clients/reports/stocks/search', expect.objectContaining({ query: expect.objectContaining({ typeRoleFilter: '1', value: 'BKI64901' }) }),
  ])
})

it.each([0, 3, 35, 38, 41, 43, 44, 45, 46])('retains multiple organization IDs through source %i picker', async source => {
  if ([35, 38, 41, 43].includes(source)) vi.mocked(apiRequest).mockResolvedValue(organizations.map(item => ({ ...item, Id: String(item.Id) })))
  render(<Form source={source} />)
  const input = screen.getByRole('combobox', { name: 'Значення' })
  fireEvent.click(input)
  fireEvent.click(await screen.findByRole('option', { name: organizations[0].Name.replace(/ \[\d+\]$/,'') }))
  fireEvent.click(await screen.findByRole('option', { name: organizations[1].Name.replace(/ \[\d+\]$/,'') }))
  expect(selected().Values.map(value => String(value.Data.Id))).toEqual(['10565', '10566'])
  expect(selected().FilterCondition.Type).toBe(2)
})

it('does not promote an unavailable negative financial condition', async () => {
  vi.mocked(apiRequest).mockResolvedValue(organizations.map(item => ({ ...item, Id: String(item.Id) })))
  render(<Form source={35} condition={1} />)
  const input = screen.getByRole('combobox', { name: 'Значення' })
  for (const organization of organizations) {
    fireEvent.click(input)
    fireEvent.click(await screen.findByRole('option', { name: organization.Name.replace(/ \[\d+\]$/,'') }))
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
  fireEvent.click(screen.getByRole('button', { name: 'Видалити A' }))
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
