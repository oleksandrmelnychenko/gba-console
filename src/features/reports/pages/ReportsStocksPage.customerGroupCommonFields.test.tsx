import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { apiRequest } from '../../../shared/api/apiClient'
import { createStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from '../api/reportWorkspaceApi'
import { customerCommonFieldsDataset as dataset } from '../data/customerGroupCommonFields.test-fixtures'
import { defaultDatasetRequest } from '../data/reportDatasets'
import type { ReportTemplate } from '../types'
import { changeReportPeriod } from '../testing/reportPeriod'
import { ReportsStocksPage } from './ReportsStocksPage'
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(), saveServerReportTemplate: vi.fn() }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))
function saved(field: number, condition = 0): ReportTemplate {
  const Data = defaultDatasetRequest(dataset, '2026-10-18', '2026-10-27')
  Data.customerGroups = { Version: 1, Groups: [{ Name: 'Еталон', ClientIds: [71] }, { Name: 'Набір B', ClientIds: [71] }] }
  Data.sorted.Row = [{ type: 17, key: 'SaleDocument', label: 'Документ продажу' }]
  Data.sorted.Measurements = [112, 109].map(Type => ({ Type, Name: String(Type), parentName: '', IsChecked: true }))
  Data.selections = [{ IsChecked: true, SelectedField: { Type: field, Name: String(field) }, FilterCondition: { Type: condition, Name: condition === 0 ? 'Дорівнює' : 'У списку' },
    Values: [{ Data: '{"Id":"9007199254740993"}' as never, Name: 'Старий запис', Value: 0 }, { Data: { Id: '9223372036854775807' }, Name: 'Архівний запис', Value: 0 }] }]
  return { Id: 'common-fields', Revision: 1, Name: 'Точні відбори документів та авторів', Data }
}
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue([dataset]); vi.mocked(apiRequest).mockResolvedValue([])
  vi.mocked(searchDatasetReportValues).mockImplementation(async (_source, _field, params) => params.value.startsWith('id:') ? [{ Id: Number(params.value.slice(3)), Name: 'Клієнт' }] : [])
  vi.mocked(saveServerReportTemplate).mockImplementation(async template => ({ ...template, Revision: 2 }))
})
afterEach(cleanup)
it.each([12, 14, 15, 16])('blocks invalid field%d Run/Save, then list repair preserves raw IDs, cohorts and dates without generating', async field => {
  const original = saved(field); vi.mocked(getServerReportTemplates).mockResolvedValue([original])
  render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
  fireEvent.click(await screen.findByRole('button', { name: 'Відкрити Порівняння роботи клієнтів.xls' }))
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' })); fireEvent.click(await screen.findByRole('button', { name: 'Відкрити для редагування: Точні відбори документів та авторів' }))
  const row = await screen.findByRole('group', { name: 'Умова відбору 1' })
  expect(screen.getByRole('button', { name: 'Застосувати й показати' })).toHaveProperty('disabled', true)
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' })); expect(screen.getByRole('button', { name: 'Оновити шаблон' })).toHaveProperty('disabled', true)
  expect(saveServerReportTemplate).not.toHaveBeenCalled(); expect(createStockReport).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Закрити' })); fireEvent.click(within(row).getByRole('combobox', { name: 'Умова' }))
  expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['Дорівнює', 'Не дорівнює', 'У списку', 'Не у списку'])
  fireEvent.click(screen.getByRole('option', { name: 'У списку' })); expect(screen.getByRole('button', { name: 'Застосувати й показати' })).toHaveProperty('disabled', false)
  changeReportPeriod({ from: '2026-09-01', to: '2026-09-30' })
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' })); fireEvent.click(screen.getByRole('button', { name: 'Оновити шаблон' }))
  await waitFor(() => expect(saveServerReportTemplate).toHaveBeenCalledOnce())
  const actual = vi.mocked(saveServerReportTemplate).mock.calls[0][0].Data
  expect(actual.customerGroups).toEqual(original.Data.customerGroups); expect(actual.from).toBe('2026-09-01'); expect(actual.to).toBe('2026-09-30')
  expect(actual.selections[0].Values).toEqual(original.Data.selections[0].Values); expect(actual.selections[0].FilterCondition.Type).toBe(2)
  expect(actual.sorted.Row.map(item => item.type)).toEqual([17]); expect(actual.sorted.Measurements.map(item => item.Type)).toEqual([112, 109])
  expect(createStockReport).not.toHaveBeenCalled()
})
