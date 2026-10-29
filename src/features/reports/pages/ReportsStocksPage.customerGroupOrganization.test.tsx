import fixture from '../data/customerGroupOrganization.server-fixture.json'
import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  data.selections = [{ IsChecked: checked, SelectedField: { Type: 0, Name: 'Organization' }, FilterCondition: { Type: condition, Name: condition === 0 ? 'Дорівнює' : condition === 1 ? 'Не дорівнює' : 'У списку' },
    Values: JSON.parse(String.raw`[{"Data":"{\"Id\":10}","Name":"Стара організація","Value":10},{"Data":{"Id":30},"Name":"Архівна організація","Value":30}]`) }]
  return { Id: 'source44-org', Revision: 1, UpdatedAtUtc: '2026-10-29T12:00:00Z', Name: 'Набори з організаціями', Data: data }
}
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(apiRequest).mockResolvedValue([{ Id: 10, Name: 'Нова організація', NetUid: 'one' }, { Id: 20, Name: 'Нова організація', NetUid: 'two' }])
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
  fireEvent.click(await screen.findByRole('button', { name: 'Відкрити для редагування: Набори з організаціями' }))
  await screen.findByRole('button', { name: 'Додати організацію' })
}
it('gates the organization section by server metadata, without promoting it on old servers', async () => {
  vi.mocked(getReportDatasets).mockResolvedValue([{ ...dataset, Filters: dataset.Filters.filter(field => field.Type !== 0) }])
  await ready(); expect(screen.queryByRole('button', { name: 'Додати організацію' })).toBeNull()
})
it('offers four flat conditions and saves dates, exact stale IDs, overlapping sets and row/measure order intact', async () => {
  await restore()
  fireEvent.click(screen.getByRole('combobox', { name: 'Умова' }))
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
  fireEvent.click(screen.getByRole('combobox', { name: 'Умова' })); fireEvent.click(screen.getByRole('option', { name: 'У списку' }))
  expect(screen.getByRole('button', { name: 'Застосувати й показати' })).toHaveProperty('disabled', false)
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' })); fireEvent.click(screen.getByRole('button', { name: 'Оновити шаблон' }))
  await waitFor(() => expect(saveServerReportTemplate).toHaveBeenCalledOnce())
  const saved = vi.mocked(saveServerReportTemplate).mock.calls[0][0].Data
  expect(saved.customerGroups).toEqual(template().Data.customerGroups); expect(saved.selections[0].Values).toEqual(template().Data.selections[0].Values)
})
it.each([0, 1])('ignores disabled invalid single-value condition%i without rewriting it', async condition => {
  vi.mocked(getServerReportTemplates).mockResolvedValue([template(condition, false)])
  await restore(); expect(screen.getByRole('button', { name: 'Застосувати й показати' })).toHaveProperty('disabled', false)
})
