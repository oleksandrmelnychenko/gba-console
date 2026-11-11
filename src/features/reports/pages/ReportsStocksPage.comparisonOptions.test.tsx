import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getReportDatasets, getServerReportTemplates, parseReportDatasets } from '../api/reportWorkspaceApi'
import catalog from '../data/constructorDatasets.dev-fixture.json'
import { netDataset } from '../data/reportDatasets.test-fixtures'
import wire from '../data/currentVparivanieAnalysis.hierarchy-capability-fixture.json'
import type { ReportDataset, ReportRequestBody, ReportSelection } from '../types'
import { InlineReportSelection, ReportSelectionsCard, ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn().mockResolvedValue([]) }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))

const rowLabels = ['Рівне', 'Не рівне', 'В списку', 'В групі зі списку', 'Не в списку', 'Не в групі зі списку', 'В групі', 'Не в групі']
const editorLabels = ['Дорівнює', 'Не дорівнює', 'У списку', 'У групі зі списку', 'Не у списку', 'Не у групі зі списку', 'У групі', 'Не у групі']
const sources = [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 32, 35, 36, 38, 39, 40, 41, 43, 44, 45, 46]
const page = (children: React.ReactNode) => <MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider>
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  vi.mocked(getReportDatasets).mockResolvedValue(parseReportDatasets(catalog))
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
})

it('shows all eight comparisons when adding an empty filter on the actual sales report page', async () => {
  render(page(<ReportsStocksPage consoleScope />))
  fireEvent.click(await screen.findByRole('button', { name: 'Додати відбір' }))
  const row = screen.getByRole('group', { name: 'Умова відбору 1' })
  expect(within(row).getByRole('combobox', { name: 'Поле' })).toHaveProperty('value', '')
  fireEvent.click(within(row).getByRole('combobox', { name: 'Тип порівняння' }))
  expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(rowLabels)
})

it.each(sources.flatMap(source => (['modal', 'card', 'row'] as const).map(mode => ({ source, mode }))))(
  'keeps all comparison types visible for source $source in $mode', ({ source, mode }) => {
    const selection: ReportSelection = { IsChecked: true, SelectedField: { Type: 0, Name: '' },
      FilterCondition: { Type: 0, Name: 'Дорівнює' }, Values: [] }
    const dataset: ReportDataset = { ...netDataset, DataSource: source, Filters: [] }
    const request: ReportRequestBody = { dataSource: source, from: '2026-11-01', to: '2026-11-11',
      selections: [selection], sorted: { Row: [], Col: [], Measurements: [] } }
    const onChange = vi.fn()
    const props = { dataset, request, dataSource: source, from: request.from, to: request.to,
      selections: request.selections, filterFieldOptions: [], onChange }
    render(page(mode === 'row' ? <InlineReportSelection {...props} selection={selection} index={0} variant="row" />
      : <ReportSelectionsCard {...props} inline={mode === 'card'} selectionKeys={['new']} />))
    if (mode === 'modal') fireEvent.click(screen.getByRole('button', { name: 'Редагувати' }))
    fireEvent.click(screen.getByRole('combobox', { name: mode === 'row' ? 'Тип порівняння' : 'Умова' }))
    const labels = mode === 'row' ? rowLabels : editorLabels
    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(labels)
    for (const type of [3, 5, 6, 7]) {
      const option = screen.getByRole('option', { name: labels[type] })
      expect(option.getAttribute('data-combobox-disabled')).toBe('true')
      fireEvent.click(option)
    }
    expect(onChange).not.toHaveBeenCalled()
  },
)

it.each([0, 1, 2, 3, 4, 5, 6, 7])('selects supported operator %i for a product hierarchy without changing its wire code', type => {
  const field = { Type: 1, Name: 'Товар', hierarchy: wire.filters.find(field => field.type === 1)!.hierarchy }
  const dataset = { ...netDataset, Filters: [field] } as ReportDataset
  const selection: ReportSelection = { IsChecked: true, SelectedField: field, FilterCondition: { Type: type === 0 ? 1 : 0, Name: type === 0 ? 'Не дорівнює' : 'Дорівнює' }, Values: [] }
  const request: ReportRequestBody = { dataSource: 2, from: '2026-11-01', to: '2026-11-11', selections: [selection], sorted: { Row: [], Col: [], Measurements: [] } }
  const onChange = vi.fn()
  render(page(<InlineReportSelection dataset={dataset} request={request} dataSource={2} selection={selection} selections={[selection]}
    index={0} variant="row" from={request.from} to={request.to} filterFieldOptions={[{ field, label: field.Name, value: '1' }]} onChange={onChange} />))
  fireEvent.click(screen.getByRole('combobox', { name: 'Тип порівняння' }))
  const option = screen.getByRole('option', { name: rowLabels[type] })
  expect(option.getAttribute('data-combobox-disabled')).toBeNull()
  fireEvent.click(option)
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ selection: expect.objectContaining({ FilterCondition: expect.objectContaining({ Type: type }) }) }))
})

it.each([6, 7])('retains the real DEV group AL-KO 4425 when changing single-group comparison %i', type => {
  const field = { Type: 1, Name: 'Товар', hierarchy: wire.filters.find(field => field.type === 1)!.hierarchy }
  const dataset = { ...netDataset, Filters: [field] } as ReportDataset
  const selection: ReportSelection = { IsChecked: true, SelectedField: field, FilterCondition: { Type: type, Name: editorLabels[type] },
    Values: [{ Name: 'AL-KO', Value: 0, Data: { kind: 'productGroup', id: '4425' } }] }
  const request: ReportRequestBody = { dataSource: 2, from: '2026-11-01', to: '2026-11-11', selections: [selection], sorted: { Row: [], Col: [], Measurements: [] } }
  const onChange = vi.fn()
  render(page(<InlineReportSelection dataset={dataset} request={request} dataSource={2} selection={selection} selections={[selection]}
    index={0} variant="row" from={request.from} to={request.to} filterFieldOptions={[{ field, label: field.Name, value: '1' }]} onChange={onChange} />))
  expect(screen.getByText('Група: AL-KO')).toBeTruthy()
  fireEvent.click(screen.getByRole('combobox', { name: 'Тип порівняння' }))
  expect(screen.getAllByRole('option')).toHaveLength(8)
  fireEvent.click(screen.getByRole('option', { name: rowLabels[type === 6 ? 7 : 6] }))
  expect(onChange).toHaveBeenCalledWith({ kind: 'replace', index: 0, selection: {
    ...selection, FilterCondition: { Type: type === 6 ? 7 : 6, Name: editorLabels[type === 6 ? 7 : 6] },
  } })
})
