import fixture from '../data/constructorDatasets.dev-fixture.json'
import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getReportProductGroups, previewStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates, parseReportDatasets } from '../api/reportWorkspaceApi'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: null, hasPermission: () => true }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(),
  previewStockReport: vi.fn(), searchDatasetReportValues: vi.fn(), getReportProductGroups: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue(parseReportDatasets(fixture))
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(getReportProductGroups).mockResolvedValue([{ Id: 4425, Name: 'AL-KO' }])
  vi.mocked(searchDatasetReportValues).mockResolvedValue([{ Id: 4425, Name: 'AL-KO [4425]' }])
  vi.mocked(previewStockReport).mockResolvedValue({ result: { document: {}, raw: {} }, preview: {
    Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true, Request: null,
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: 0, ReturnedRows: 0, HasMore: false },
    RowSchema: [], ColumnSchema: [], Rows: [], Columns: [], Cells: [],
  } })
})
afterEach(cleanup)

it.each([
  { source: 3, workbook: 'gba:purchases-constructor:v1', option: 'AL-KO', lookup: () => expect(getReportProductGroups).toHaveBeenCalled() },
  { source: 45, workbook: 'gba:stock-period-constructor:v1', option: 'AL-KO [4425]',
    lookup: () => expect(searchDatasetReportValues).toHaveBeenCalledWith(45, 4, expect.objectContaining({ offset: 0 }), expect.anything()) },
])('picks «Товарна група» in source $source, loads its values and sends the exact group id', async ({ source, workbook, option, lookup }) => {
  render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
  fireEvent.click(await screen.findByRole('button', { name: `Відкрити ${workbook}` }))
  const filters = await screen.findByRole('region', { name: 'Відбори' })
  fireEvent.click(within(filters).getByRole('button', { name: 'Додати відбір' }))
  const row = within(screen.getByRole('group', { name: 'Умова відбору 1' }))
  fireEvent.click(row.getByRole('combobox', { name: 'Поле' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Товарна група' }))
  expect(row.getByRole('combobox', { name: 'Поле' })).toHaveProperty('value', 'Товарна група')
  fireEvent.click(row.getByRole('combobox', { name: 'Тип порівняння' }))
  expect(screen.getAllByRole('option').filter(item => item.getAttribute('data-combobox-disabled') !== 'true').map(item => item.textContent))
    .toEqual(['Рівне', 'Не рівне', 'В списку', 'Не в списку'])
  fireEvent.click(screen.getByRole('option', { name: 'В списку' }))
  const value = row.getByRole('combobox', { name: 'Значення' })
  fireEvent.click(value)
  fireEvent.change(value, { target: { value: 'AL' } })
  await waitFor(lookup)
  fireEvent.click(await screen.findByRole('option', { name: option }))
  fireEvent.click(screen.getAllByRole('button', { name: /^Сформувати$|Застосувати й показати/ }).at(-1)!)
  await waitFor(() => expect(previewStockReport).toHaveBeenCalled())
  expect(vi.mocked(previewStockReport).mock.calls.at(-1)![0]).toMatchObject({ dataSource: source, selections: [{
    SelectedField: { Type: 4, Name: 'ProductGroup' }, FilterCondition: { Type: 2 }, Values: [{ Data: expect.objectContaining({ Id: 4425 }) }],
  }] })
})
