import fixture from '../data/customerGroupRegion.server-fixture.json'
import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { apiRequest } from '../../../shared/api/apiClient'
import { getReportDatasets, getServerReportTemplates, parseReportDatasets, saveServerReportTemplate } from '../api/reportWorkspaceApi'
import { searchDatasetReportValues } from '../api/reportsApi'
import { defaultDatasetRequest } from '../data/reportDatasets'
import type { ReportTemplate } from '../types'
import { changeReportPeriod } from '../testing/reportPeriod'
import { ReportsStocksPage } from './ReportsStocksPage'
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(), saveServerReportTemplate: vi.fn() }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), searchDatasetReportValues: vi.fn() }))
const dataset = parseReportDatasets([fixture.dataset])[0]
function template(condition = 2, checked = true): ReportTemplate {
  const data = defaultDatasetRequest(dataset, '2026-10-01', '2026-10-27')
  data.customerGroups = { Version: 1, Groups: [{ Name: 'Еталон', ClientIds: [71, 72] }, { Name: 'Набір B', ClientIds: [72, 73] }] }
  data.sorted.Row = [{ type: 7, key: 'ProductName', label: 'Назва товару' }, { type: 3, key: 'Day', label: 'День' }]
  data.sorted.Col = [{ type: 82, key: 'CustomerComparisonSource', label: 'Джерело даних' }]
  data.sorted.Measurements = [112, 109, 114].map(Type => ({ Type, Name: String(Type), parentName: String(Type), IsChecked: true }))
  data.selections = [{ IsChecked: true, SelectedField: { Type: 0, Name: 'Organization' }, FilterCondition: { Type: 2, Name: 'У списку' }, Values: [{ Data: { Id: 10 }, Name: 'Організація', Value: 0 }] }, { IsChecked: checked, SelectedField: { Type: 7, Name: 'Поточний регіон клієнта' }, FilterCondition: { Type: condition, Name: condition === 0 ? 'Дорівнює' : condition === 1 ? 'Не дорівнює' : 'У списку' },
    Values: JSON.parse(String.raw`[{"Data":"{\"Id\":10}","Name":"Старий регіон","Value":10},{"Data":{"Id":30},"Name":"Архівний регіон","Value":30}]`) }]
  return { Id: 'source44-region', Revision: 1, UpdatedAtUtc: '2026-10-29T12:00:00Z', Name: 'Набори з регіонами', Data: data }
}
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(apiRequest).mockImplementation(async path => path === '/regions/all/codes' ? [{ Id: 10, Name: 'Новий регіон', NetUid: 'one', RegionCodes: [{ Id: 999, Value: 'CHILD' }] }, { Id: 20, Name: 'Новий регіон', NetUid: 'two' }] : [{ Id: 10, Name: 'Організація' }])
  vi.mocked(getReportDatasets).mockResolvedValue([dataset]); vi.mocked(getServerReportTemplates).mockResolvedValue([template()])
  vi.mocked(searchDatasetReportValues).mockImplementation(async (_source, _field, params) => params.value.startsWith('id:') ? [{ Id: Number(params.value.slice(3)), Name: 'Клієнт' + params.value }] : [])
  vi.mocked(saveServerReportTemplate).mockImplementation(async value => ({ ...value, Revision: 2 }))
})
afterEach(cleanup)
async function ready() {
  render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
  fireEvent.click(await screen.findByRole('button', { name: 'Відкрити Порівняння роботи клієнтів.xls' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Відкрити Порівняння роботи клієнтів.xls' })).toHaveProperty('ariaCurrent', 'true'))
}
async function restore() {
  await ready(); fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Відкрити для редагування: Набори з регіонами' }))
  await screen.findByRole('group', { name: 'Умова відбору 2', exact: true })
}
it('gates Region7 by server metadata without promoting RegionCode8 on old servers', async () => {
  vi.mocked(getReportDatasets).mockResolvedValue([{ ...dataset, Filters: dataset.Filters.filter(field => field.Type !== 7) }])
  await ready(); fireEvent.click(screen.getByRole('button', { name: 'Додати умову', exact: true }))
  fireEvent.click(screen.getByRole('combobox', { name: 'Поле', exact: true }))
  expect(screen.queryByRole('option', { name: 'Поточний регіон клієнта', exact: true })).toBeNull()
  expect(screen.queryByRole('option', { name: 'Код регіону', exact: true })).toBeNull()
})
it('offers four flat conditions and saves dates, exact stale IDs, overlapping sets and row/measure order intact', async () => {
  await restore()
  fireEvent.click(within(screen.getByRole('group', { name: 'Умова відбору 2', exact: true })).getByRole('combobox', { name: 'Умова' }))
  expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['Дорівнює', 'Не дорівнює', 'У списку', 'Не у списку'])
  fireEvent.click(screen.getByRole('option', { name: 'У списку' }))
  changeReportPeriod({ from: '2026-09-01', to: '2026-09-30' })
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' })); fireEvent.click(screen.getByRole('button', { name: 'Оновити шаблон' }))
  await waitFor(() => expect(saveServerReportTemplate).toHaveBeenCalledOnce())
  const saved = vi.mocked(saveServerReportTemplate).mock.calls[0][0].Data, original = template().Data
  expect(saved).toMatchObject({ dataSource: 44, from: '2026-09-01', to: '2026-09-30', customerGroups: original.customerGroups, selections: original.selections })
  expect(saved.sorted.Row.map(row => row.type)).toEqual([7, 3]); expect(saved.sorted.Col.map(row => row.type)).toEqual([82])
  expect(saved.sorted.Measurements.map(field => field.Type)).toEqual([112, 109, 114]); expect(saved.reportProfile).toBeUndefined()
})
it.each([0, 1])('keeps two saved IDs for condition%i blocked until explicit list correction', async condition => {
  vi.mocked(getServerReportTemplates).mockResolvedValue([template(condition)])
  await restore()
  expect(screen.getByRole('button', { name: 'Застосувати й показати' })).toHaveProperty('disabled', true)
  expect(screen.getAllByText('Оберіть одне значення для цієї умови.').length).toBeGreaterThan(0)
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  expect(screen.getByRole('button', { name: 'Оновити шаблон' })).toHaveProperty('disabled', true)
  expect(screen.getByRole('button', { name: 'Новий шаблон' })).toHaveProperty('disabled', true)
  expect(saveServerReportTemplate).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Закрити' }))
  fireEvent.click(within(screen.getByRole('group', { name: 'Умова відбору 2', exact: true })).getByRole('combobox', { name: 'Умова' })); fireEvent.click(screen.getByRole('option', { name: 'У списку' }))
  expect(screen.getByRole('button', { name: 'Застосувати й показати' })).toHaveProperty('disabled', false)
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' })); fireEvent.click(screen.getByRole('button', { name: 'Оновити шаблон' }))
  await waitFor(() => expect(saveServerReportTemplate).toHaveBeenCalledOnce())
  const saved = vi.mocked(saveServerReportTemplate).mock.calls[0][0].Data
  expect(saved.customerGroups).toEqual(template().Data.customerGroups); expect(saved.selections).toEqual(template().Data.selections)
})
it.each([0, 1])('ignores disabled invalid single-value condition%i without rewriting it', async condition => {
  vi.mocked(getServerReportTemplates).mockResolvedValue([template(condition, false)])
  await restore(); expect(screen.getByRole('button', { name: 'Застосувати й показати' })).toHaveProperty('disabled', false)
})

it('preserves unsafe saved Region identity for explicit correction and blocks Generate and Save', async () => {
  const saved=template(); saved.Data.selections[1].Values=[{Data:'{"Id":"9007199254740993"}',Name:'Старий регіон',Value:0}]
  vi.mocked(getServerReportTemplates).mockResolvedValue([saved]); await restore()
  expect(screen.getByRole('button',{name:'Застосувати й показати'})).toHaveProperty('disabled',true)
  expect(screen.getByText('Повторно оберіть регіон клієнта: збережений ідентифікатор не підтверджено.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:'Шаблони'})); expect(screen.getByRole('button',{name:'Оновити шаблон'})).toHaveProperty('disabled',true)
  expect(saveServerReportTemplate).not.toHaveBeenCalled()
})
